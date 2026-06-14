export interface Player {
  id: string;
  name: string;
  alive: boolean;
  acknowledged: boolean;
  isBot: boolean;
  vote: "red" | "blue" | null;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

export type Difficulty = "easy" | "normal" | "hard";
export type GameMode = "standard" | "wolveless" | "multi-wolf" | "local" | "compact" | "local-compact";

export interface RoundHistory {
  round: number;
  wolfId: string;
  wolfName: string;
  wolfVote: "red" | "blue";
  casualties: string[];
  clearCondition: "bloodbath" | "blind_martyr" | null;
  redPct: number;
  bluePct: number;
}

export interface Resolution {
  redCount: number;
  blueCount: number;
  total: number;
  redPct: number;
  bluePct: number;
  overpopulation: boolean;
  wolfId: string;
  wolfName: string;
  wolfVote: "red" | "blue";
  wolfBiteActivated: boolean;
  wolfInMinority: boolean;
  peacefulRound: boolean;
  casualties: string[];
  clearCondition: "bloodbath" | "blind_martyr" | null;
  survivorCount: number;
}

export interface Lobby {
  id: string;
  hostId: string;
  isPrivate: boolean;
  difficulty: Difficulty;
  gameMode: GameMode;
  wolfCount: number;
  phase: "lobby" | "briefing" | "discussion" | "voting" | "resolution" | "condition_check" | "game_over" | "victory";
  players: Map<string, Player>;
  chat: ChatMessage[];
  history: RoundHistory[];
  round: number;
  startingPlayerCount: number;
  wolfIds: Set<string>;
  discussionEndsAt: number | null;
  votingEndsAt: number | null;
  resolution: Resolution | null;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  botTimers: ReturnType<typeof setTimeout>[];
}

export interface ClientGameState {
  lobbyId: string;
  isPrivate: boolean;
  phase: Lobby["phase"];
  players: Array<{
    id: string;
    name: string;
    alive: boolean;
    acknowledged: boolean;
    isYou: boolean;
    isBot: boolean;
  }>;
  hostId: string;
  round: number;
  startingPlayerCount: number;
  bloodbathThreshold: number;
  blindMartyrThresholdPct: number;
  overpopulationThresholdPct: number;
  difficulty: Difficulty;
  gameMode: GameMode;
  wolfCount: number;
  chat: ChatMessage[];
  history: RoundHistory[];
  resolution: Resolution | null;
  discussionEndsAt: number | null;
  votingEndsAt: number | null;
  playerCount: number;
  aliveCount: number;
  votedCount: number;
  hasVoted: boolean;
  myVote: "red" | "blue" | null;
  youAreWolf: boolean;
  isSpectator: boolean;
}
