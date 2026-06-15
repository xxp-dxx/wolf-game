export interface Player {
  id: string;
  name: string;
  alive: boolean;
  acknowledged: boolean;
  isYou: boolean;
  isBot?: boolean;
}

export interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
}

export type Difficulty = "easy" | "normal" | "hard";
export type GameMode = "standard" | "wolveless" | "multi-wolf" | "local" | "compact" | "local-compact";

export interface GameState {
  lobbyId: string;
  isPrivate: boolean;
  phase: "lobby" | "briefing" | "discussion" | "voting" | "resolution" | "condition_check" | "game_over" | "victory";
  players: Player[];
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
  history: Array<{
    round: number;
    wolfId: string;
    wolfName: string;
    wolfVote: "red" | "blue";
    casualties: string[];
    clearCondition: "bloodbath" | "blind_martyr" | "stalemate" | null;
    redPct: number;
    bluePct: number;
    biteActivated: boolean;
  }>;
  resolution: {
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
    clearCondition: "bloodbath" | "blind_martyr" | "stalemate" | null;
    survivorCount: number;
  } | null;
  discussionEndsAt: number | null;
  votingEndsAt: number | null;
  playerCount: number;
  aliveCount: number;
  votedCount: number;
  hasVoted: boolean;
  myVote: "red" | "blue" | null;
  youAreWolf: boolean;
  isSpectator: boolean;
  liveRedCount: number;
  liveBlueCount: number;
}
