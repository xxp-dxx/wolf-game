import { nanoid } from "nanoid";
import type { Server, Socket } from "socket.io";
import type { Lobby, Player, ClientGameState, ChatMessage } from "./types.js";
import {
  DISCUSSION_DURATION_MS,
  VOTING_DURATION_MS,
  BLOODBATH_PCT,
  BLIND_MARTYR_PCT,
  OVERPOPULATION_PCT,
  CONDITION_CHECK_DURATION_MS,
  RESOLUTION_DURATION_MS,
  MIN_PLAYERS,
  MAX_PLAYERS,
} from "./constants.js";
import { generateBotMessage, generateBotVote } from "./ai.js";
import { logger } from "../lib/logger.js";

const lobbies = new Map<string, Lobby>();
const socketToLobby = new Map<string, string>();
const spectators = new Map<string, string>();

function genLobbyId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function clearPhaseTimer(lobby: Lobby) {
  if (lobby.phaseTimer) {
    clearTimeout(lobby.phaseTimer);
    lobby.phaseTimer = null;
  }
}

function clearBotTimers(lobby: Lobby) {
  for (const t of lobby.botTimers) clearTimeout(t);
  lobby.botTimers = [];
}

function getBloodbathThreshold(lobby: Lobby): number {
  const pct = BLOODBATH_PCT[lobby.difficulty] / 100;
  return Math.floor(lobby.startingPlayerCount * pct);
}

function buildClientState(lobby: Lobby, socketId: string): ClientGameState {
  const player = lobby.players.get(socketId);
  const isSpectator = spectators.has(socketId);
  const alivePlayers = [...lobby.players.values()].filter((p) => p.alive);
  const votedCount = alivePlayers.filter((p) => p.vote !== null).length;

  return {
    lobbyId: lobby.id,
    isPrivate: lobby.isPrivate,
    phase: lobby.phase,
    players: [...lobby.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      acknowledged: p.acknowledged,
      isYou: p.id === socketId,
      isBot: p.isBot,
    })),
    hostId: lobby.hostId,
    round: lobby.round,
    startingPlayerCount: lobby.startingPlayerCount,
    bloodbathThreshold: getBloodbathThreshold(lobby),
    blindMartyrThresholdPct: BLIND_MARTYR_PCT[lobby.difficulty],
    overpopulationThresholdPct: OVERPOPULATION_PCT[lobby.difficulty],
    difficulty: lobby.difficulty,
    gameMode: lobby.gameMode,
    wolfCount: lobby.wolfCount,
    chat: lobby.chat,
    history: lobby.history,
    resolution: lobby.resolution,
    discussionEndsAt: lobby.discussionEndsAt,
    votingEndsAt: lobby.votingEndsAt,
    playerCount: lobby.players.size,
    aliveCount: alivePlayers.length,
    votedCount,
    hasVoted: player?.vote !== null && player?.vote !== undefined,
    myVote: player?.vote ?? null,
    youAreWolf: !isSpectator && lobby.wolfIds.has(socketId),
    isSpectator,
  };
}

function broadcastState(io: Server, lobby: Lobby) {
  for (const [socketId] of lobby.players) {
    const state = buildClientState(lobby, socketId);
    io.to(socketId).emit("state_update", state);
  }
  for (const [socketId, lobbyId] of spectators) {
    if (lobbyId === lobby.id) {
      const state = buildSpectatorState(lobby, socketId);
      io.to(socketId).emit("state_update", state);
    }
  }
}

function buildSpectatorState(lobby: Lobby, socketId: string): ClientGameState {
  const alivePlayers = [...lobby.players.values()].filter((p) => p.alive);
  const votedCount = alivePlayers.filter((p) => p.vote !== null).length;

  return {
    lobbyId: lobby.id,
    isPrivate: lobby.isPrivate,
    phase: lobby.phase,
    players: [...lobby.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      acknowledged: p.acknowledged,
      isYou: false,
      isBot: p.isBot,
    })),
    hostId: lobby.hostId,
    round: lobby.round,
    startingPlayerCount: lobby.startingPlayerCount,
    bloodbathThreshold: getBloodbathThreshold(lobby),
    blindMartyrThresholdPct: BLIND_MARTYR_PCT[lobby.difficulty],
    overpopulationThresholdPct: OVERPOPULATION_PCT[lobby.difficulty],
    difficulty: lobby.difficulty,
    gameMode: lobby.gameMode,
    wolfCount: lobby.wolfCount,
    chat: lobby.chat,
    history: lobby.history,
    resolution: lobby.resolution,
    discussionEndsAt: lobby.discussionEndsAt,
    votingEndsAt: lobby.votingEndsAt,
    playerCount: lobby.players.size,
    aliveCount: alivePlayers.length,
    votedCount,
    hasVoted: false,
    myVote: null,
    youAreWolf: false,
    isSpectator: true,
  };
}

function assignWolves(lobby: Lobby): void {
  lobby.wolfIds.clear();
  const alive = [...lobby.players.values()].filter((p) => p.alive);
  if (lobby.gameMode === "wolveless") return;

  const count = lobby.gameMode === "multi-wolf"
    ? Math.min(lobby.wolfCount, Math.floor(alive.length / 2))
    : 1;

  const shuffled = [...alive].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) {
    if (shuffled[i]) lobby.wolfIds.add(shuffled[i].id);
  }
}

function startDiscussion(io: Server, lobby: Lobby) {
  clearBotTimers(lobby);
  lobby.chat = [];
  lobby.phase = "discussion";
  assignWolves(lobby);

  const duration = DISCUSSION_DURATION_MS[lobby.difficulty];
  lobby.discussionEndsAt = Date.now() + duration;
  lobby.votingEndsAt = null;

  broadcastState(io, lobby);
  scheduleBotMessages(io, lobby);

  clearPhaseTimer(lobby);
  lobby.phaseTimer = setTimeout(() => startVoting(io, lobby), duration);
}

function scheduleBotMessages(io: Server, lobby: Lobby) {
  const bots = [...lobby.players.values()].filter((p) => p.isBot && p.alive);
  if (bots.length === 0) return;

  const duration = DISCUSSION_DURATION_MS[lobby.difficulty];
  const msgCount = Math.min(bots.length * 2, 8);

  for (let i = 0; i < msgCount; i++) {
    const delay = Math.floor((duration * 0.1) + Math.random() * (duration * 0.7));
    const bot = bots[Math.floor(Math.random() * bots.length)];

    const t = setTimeout(async () => {
      if (lobby.phase !== "discussion") return;
      const alivePlayers = [...lobby.players.values()].filter((p) => p.alive).map((p) => p.name);
      const recent = lobby.chat.slice(-6).map((m) => ({ playerName: m.playerName, text: m.text }));

      const text = await generateBotMessage({
        botName: bot.name,
        isWolf: lobby.wolfIds.has(bot.id),
        round: lobby.round,
        alivePlayers,
        recentMessages: recent,
        gameMode: lobby.gameMode,
        wolfCount: lobby.wolfCount,
      });

      if (lobby.phase !== "discussion") return;

      const msg: ChatMessage = {
        playerId: bot.id,
        playerName: bot.name,
        text,
        timestamp: Date.now(),
      };
      lobby.chat.push(msg);
      io.to(lobby.id).emit("chat_message", msg);
      for (const [socketId, lobbyId] of spectators) {
        if (lobbyId === lobby.id) {
          io.to(socketId).emit("chat_message", msg);
        }
      }
    }, delay);
    lobby.botTimers.push(t);
  }
}

function startVoting(io: Server, lobby: Lobby) {
  clearBotTimers(lobby);
  clearPhaseTimer(lobby);
  lobby.phase = "voting";
  lobby.votingEndsAt = Date.now() + VOTING_DURATION_MS;
  lobby.discussionEndsAt = null;

  for (const p of lobby.players.values()) p.vote = null;

  broadcastState(io, lobby);

  scheduleBotVotes(io, lobby);

  lobby.phaseTimer = setTimeout(() => resolveVotes(io, lobby), VOTING_DURATION_MS);
}

function scheduleBotVotes(io: Server, lobby: Lobby) {
  const bots = [...lobby.players.values()].filter((p) => p.isBot && p.alive);
  for (const bot of bots) {
    const delay = 2000 + Math.random() * (VOTING_DURATION_MS - 4000);
    const t = setTimeout(async () => {
      if (lobby.phase !== "voting") return;
      const alivePlayers = [...lobby.players.values()].filter((p) => p.alive);
      const redCount = alivePlayers.filter((p) => p.vote === "red").length;
      const blueCount = alivePlayers.filter((p) => p.vote === "blue").length;

      const vote = await generateBotVote({
        botName: bot.name,
        isWolf: lobby.wolfIds.has(bot.id),
        round: lobby.round,
        alivePlayers: alivePlayers.map((p) => p.name),
        recentMessages: lobby.chat.slice(-4).map((m) => ({ playerName: m.playerName, text: m.text })),
        gameMode: lobby.gameMode,
        wolfCount: lobby.wolfCount,
        redCount,
        blueCount,
        aliveCount: alivePlayers.length,
      });

      if (lobby.phase !== "voting") return;
      bot.vote = vote;

      const allVoted = [...lobby.players.values()].filter((p) => p.alive).every((p) => p.vote !== null);
      broadcastState(io, lobby);

      if (allVoted) {
        clearPhaseTimer(lobby);
        clearBotTimers(lobby);
        resolveVotes(io, lobby);
      }
    }, delay);
    lobby.botTimers.push(t);
  }
}

function resolveVotes(io: Server, lobby: Lobby) {
  clearPhaseTimer(lobby);
  clearBotTimers(lobby);
  lobby.phase = "resolution";

  const alive = [...lobby.players.values()].filter((p) => p.alive);
  const total = alive.length;

  let redCount = 0, blueCount = 0;
  for (const p of alive) {
    if (p.vote === "red") redCount++;
    else blueCount++;
  }

  const redPct = total > 0 ? (redCount / total) * 100 : 0;
  const bluePct = total > 0 ? (blueCount / total) * 100 : 0;

  const overpopThreshold = OVERPOPULATION_PCT[lobby.difficulty];
  const overpopulation = bluePct > overpopThreshold;

  const wolfPlayer = lobby.wolfIds.size > 0
    ? alive.find((p) => lobby.wolfIds.has(p.id))
    : null;
  const wolfId = wolfPlayer?.id ?? "";
  const wolfName = wolfPlayer?.name ?? "NONE";
  const wolfVote: "red" | "blue" = wolfPlayer?.vote ?? (Math.random() < 0.5 ? "red" : "blue");

  let wolfBiteActivated = false;
  if (lobby.gameMode !== "wolveless" && !overpopulation) {
    if (lobby.gameMode === "multi-wolf") {
      const allWolvesAgree = [...lobby.wolfIds].every((wid) => {
        const wp = lobby.players.get(wid);
        return wp?.vote === wolfVote;
      });
      const majorityColor = redCount >= blueCount ? "red" : "blue";
      wolfBiteActivated = allWolvesAgree && redCount !== blueCount && wolfVote === majorityColor;
    } else {
      const majorityColor = redCount > blueCount ? "red" : (blueCount > redCount ? "blue" : null);
      wolfBiteActivated = majorityColor !== null && wolfVote === majorityColor;
    }
  }

  const wolfInMinority = wolfVote === (redCount <= blueCount ? "red" : "blue");

  const casualties: string[] = [];

  if (overpopulation) {
    for (const p of alive) casualties.push(p.id);
  } else if (wolfBiteActivated) {
    const minorityColor = wolfVote === "red" ? "blue" : "red";
    for (const p of alive) {
      if (p.vote === minorityColor) casualties.push(p.id);
    }
  } else {
    if (redCount >= blueCount) {
      for (const p of alive) {
        if (p.vote === "blue") casualties.push(p.id);
      }
    }
  }

  const peacefulRound = !wolfBiteActivated && !overpopulation && blueCount > redCount;

  for (const id of casualties) {
    const p = lobby.players.get(id);
    if (p) p.alive = false;
  }

  const survivorCount = alive.length - casualties.length;

  let clearCondition: "bloodbath" | "blind_martyr" | null = null;
  if (survivorCount <= getBloodbathThreshold(lobby)) {
    clearCondition = "bloodbath";
  } else if (lobby.gameMode !== "wolveless" && wolfVote === "blue") {
    if (lobby.gameMode === "multi-wolf") {
      const allWolvesBlue = [...lobby.wolfIds].every((wid) => {
        const wp = lobby.players.get(wid);
        return wp?.vote === "blue";
      });
      if (allWolvesBlue && bluePct <= BLIND_MARTYR_PCT[lobby.difficulty]) {
        clearCondition = "blind_martyr";
      }
    } else {
      if (bluePct <= BLIND_MARTYR_PCT[lobby.difficulty]) {
        clearCondition = "blind_martyr";
      }
    }
  }

  lobby.resolution = {
    redCount,
    blueCount,
    total,
    redPct,
    bluePct,
    overpopulation,
    wolfId,
    wolfName,
    wolfVote,
    wolfBiteActivated,
    wolfInMinority,
    peacefulRound,
    casualties: casualties.map((id) => lobby.players.get(id)?.name ?? id),
    clearCondition,
    survivorCount,
  };

  lobby.history.push({
    round: lobby.round,
    wolfId,
    wolfName,
    wolfVote,
    casualties: casualties.map((id) => lobby.players.get(id)?.name ?? id),
    clearCondition,
    redPct,
    bluePct,
  });

  broadcastState(io, lobby);

  lobby.phaseTimer = setTimeout(() => {
    lobby.phase = "condition_check";
    broadcastState(io, lobby);

    lobby.phaseTimer = setTimeout(() => {
      if (clearCondition !== null) {
        lobby.phase = survivorCount === 0 ? "game_over" : "victory";
        broadcastState(io, lobby);
      } else {
        const newAlive = [...lobby.players.values()].filter((p) => p.alive);
        if (newAlive.length < 2) {
          lobby.phase = "game_over";
          broadcastState(io, lobby);
        } else {
          lobby.round++;
          startDiscussion(io, lobby);
        }
      }
    }, CONDITION_CHECK_DURATION_MS);
  }, RESOLUTION_DURATION_MS);
}

function BOT_NAMES(): string[] {
  return [
    "OMEN-Δ", "APEX-13", "VOID-07", "DRIFT-41", "ECHO-X",
    "GHOST-07", "FLUX-X", "THORN-V", "SHARD-19", "ECHO-II",
    "NEXUS-3", "VIPER-9", "CROW-Z", "PULSE-8", "STATIC-4",
    "NULL-99", "ROGUE-5", "FORGE-2", "DUSK-11", "CIPHER-6",
  ];
}

export function setupLobbyHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("create_lobby", (data: {
      name: string;
      isPrivate: boolean;
      botCount: number;
      difficulty: string;
      gameMode: string;
      wolfCount: number;
    }) => {
      const lobbyId = genLobbyId();
      const player: Player = {
        id: socket.id,
        name: data.name.slice(0, 20),
        alive: true,
        acknowledged: false,
        isBot: false,
        vote: null,
      };

      const lobby: Lobby = {
        id: lobbyId,
        hostId: socket.id,
        isPrivate: !!data.isPrivate,
        difficulty: (["easy", "normal", "hard"].includes(data.difficulty) ? data.difficulty : "normal") as any,
        gameMode: (["standard", "wolveless", "multi-wolf"].includes(data.gameMode) ? data.gameMode : "standard") as any,
        wolfCount: Math.max(2, Math.min(10, Number(data.wolfCount) || 2)),
        phase: "lobby",
        players: new Map([[socket.id, player]]),
        chat: [],
        history: [],
        round: 1,
        startingPlayerCount: 0,
        wolfIds: new Set(),
        discussionEndsAt: null,
        votingEndsAt: null,
        resolution: null,
        phaseTimer: null,
        botTimers: [],
      };

      const botCount = Math.max(0, Math.min(MAX_PLAYERS - 1, Number(data.botCount) || 0));
      const usedNames = new Set<string>();
      const allBotNames = BOT_NAMES();
      for (let i = 0; i < botCount; i++) {
        const available = allBotNames.filter((n) => !usedNames.has(n));
        const name = available.length > 0
          ? available[Math.floor(Math.random() * available.length)]
          : `BOT-${i + 1}`;
        usedNames.add(name);
        const botId = `bot_${nanoid(8)}`;
        lobby.players.set(botId, {
          id: botId,
          name,
          alive: true,
          acknowledged: true,
          isBot: true,
          vote: null,
        });
      }

      lobbies.set(lobbyId, lobby);
      socketToLobby.set(socket.id, lobbyId);
      socket.join(lobbyId);

      socket.emit("lobby_joined", { lobbyId, isHost: true });
      socket.emit("state_update", buildClientState(lobby, socket.id));
    });

    socket.on("join_lobby", (data: { lobbyId: string; name: string }) => {
      const lobby = lobbies.get(data.lobbyId.toUpperCase());
      if (!lobby) { socket.emit("error", { message: "LOBBY NOT FOUND." }); return; }
      if (lobby.phase !== "lobby") { socket.emit("error", { message: "GAME IN PROGRESS." }); return; }
      if (lobby.players.size >= MAX_PLAYERS) { socket.emit("error", { message: "LOBBY FULL." }); return; }

      const player: Player = {
        id: socket.id,
        name: data.name.slice(0, 20),
        alive: true,
        acknowledged: false,
        isBot: false,
        vote: null,
      };

      lobby.players.set(socket.id, player);
      socketToLobby.set(socket.id, lobby.id);
      socket.join(lobby.id);

      socket.emit("lobby_joined", { lobbyId: lobby.id, isHost: false });
      broadcastState(io, lobby);
    });

    socket.on("join_public_lobby", (data: { name: string }) => {
      const available = [...lobbies.values()].filter(
        (l) => !l.isPrivate && l.phase === "lobby" && l.players.size < MAX_PLAYERS
      );
      if (available.length === 0) {
        socket.emit("error", { message: "NO PUBLIC LOBBIES. CREATE ONE." });
        return;
      }
      const lobby = available[0];
      const player: Player = {
        id: socket.id,
        name: data.name.slice(0, 20),
        alive: true,
        acknowledged: false,
        isBot: false,
        vote: null,
      };
      lobby.players.set(socket.id, player);
      socketToLobby.set(socket.id, lobby.id);
      socket.join(lobby.id);
      socket.emit("lobby_joined", { lobbyId: lobby.id, isHost: false });
      broadcastState(io, lobby);
    });

    socket.on("get_public_lobbies", () => {
      const list = [...lobbies.values()]
        .filter((l) => !l.isPrivate && l.phase === "lobby")
        .map((l) => ({
          id: l.id,
          playerCount: l.players.size,
          difficulty: l.difficulty,
          gameMode: l.gameMode,
        }));
      socket.emit("public_lobbies", list);
    });

    socket.on("start_game", () => {
      const lobbyId = socketToLobby.get(socket.id);
      if (!lobbyId) return;
      const lobby = lobbies.get(lobbyId);
      if (!lobby) return;
      if (lobby.hostId !== socket.id) { socket.emit("error", { message: "ONLY HOST CAN START." }); return; }
      if (lobby.players.size < MIN_PLAYERS) { socket.emit("error", { message: `MINIMUM ${MIN_PLAYERS} PLAYERS REQUIRED.` }); return; }
      if (lobby.phase !== "lobby") return;

      lobby.phase = "briefing";
      lobby.startingPlayerCount = lobby.players.size;
      broadcastState(io, lobby);
    });

    socket.on("acknowledge_rules", () => {
      const lobbyId = socketToLobby.get(socket.id);
      if (!lobbyId) return;
      const lobby = lobbies.get(lobbyId);
      if (!lobby || lobby.phase !== "briefing") return;
      const player = lobby.players.get(socket.id);
      if (!player) return;
      player.acknowledged = true;

      const humanPlayers = [...lobby.players.values()].filter((p) => !p.isBot);
      const allAcked = humanPlayers.every((p) => p.acknowledged);

      broadcastState(io, lobby);

      if (allAcked) {
        lobby.round = 1;
        startDiscussion(io, lobby);
      }
    });

    socket.on("send_message", (data: { text: string }) => {
      const lobbyId = socketToLobby.get(socket.id);
      if (!lobbyId) return;
      const lobby = lobbies.get(lobbyId);
      if (!lobby || lobby.phase !== "discussion") return;
      const player = lobby.players.get(socket.id);
      if (!player || !player.alive) return;

      const msg: ChatMessage = {
        playerId: socket.id,
        playerName: player.name,
        text: data.text.slice(0, 300),
        timestamp: Date.now(),
      };
      lobby.chat.push(msg);
      io.to(lobbyId).emit("chat_message", msg);
      for (const [sid, lid] of spectators) {
        if (lid === lobbyId) io.to(sid).emit("chat_message", msg);
      }
    });

    socket.on("cast_vote", (data: { color: "red" | "blue" }) => {
      const lobbyId = socketToLobby.get(socket.id);
      if (!lobbyId) return;
      const lobby = lobbies.get(lobbyId);
      if (!lobby || lobby.phase !== "voting") return;
      const player = lobby.players.get(socket.id);
      if (!player || !player.alive || player.vote !== null) return;
      if (!["red", "blue"].includes(data.color)) return;

      player.vote = data.color;
      broadcastState(io, lobby);

      const alive = [...lobby.players.values()].filter((p) => p.alive);
      const allVoted = alive.every((p) => p.vote !== null);
      if (allVoted) {
        clearPhaseTimer(lobby);
        clearBotTimers(lobby);
        resolveVotes(io, lobby);
      }
    });

    socket.on("spectate_lobby", (data: { lobbyId: string }) => {
      const lobby = lobbies.get(data.lobbyId.toUpperCase());
      if (!lobby) { socket.emit("error", { message: "LOBBY NOT FOUND." }); return; }

      spectators.set(socket.id, lobby.id);
      socket.join(lobby.id + "_spectators");

      const state = buildSpectatorState(lobby, socket.id);
      socket.emit("lobby_joined", { lobbyId: lobby.id, isHost: false, isSpectator: true });
      socket.emit("state_update", state);
    });

    socket.on("disconnect", () => {
      const lobbyId = socketToLobby.get(socket.id);
      if (lobbyId) {
        const lobby = lobbies.get(lobbyId);
        if (lobby) {
          lobby.players.delete(socket.id);
          socketToLobby.delete(socket.id);

          if (lobby.phase === "lobby" && lobby.players.size === 0) {
            lobbies.delete(lobbyId);
          } else {
            if (lobby.hostId === socket.id) {
              const firstHuman = [...lobby.players.values()].find((p) => !p.isBot);
              if (firstHuman) lobby.hostId = firstHuman.id;
            }
            broadcastState(io, lobby);
          }
        }
      }
      spectators.delete(socket.id);
    });
  });
}

export { lobbies };
