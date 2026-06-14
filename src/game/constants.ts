import type { Difficulty } from "./types.js";

export const DISCUSSION_DURATION_MS: Record<Difficulty, number> = {
  easy: 3 * 60 * 1000,
  normal: 2 * 60 * 1000,
  hard: 1 * 60 * 1000,
};

export const VOTING_DURATION_MS = 15_000;

export const OVERPOPULATION_PCT: Record<Difficulty, number> = {
  easy: 70,
  normal: 70,
  hard: 70,
};

export const BLOODBATH_PCT: Record<Difficulty, number> = {
  easy: 40,
  normal: 30,
  hard: 20,
};

export const BLIND_MARTYR_PCT: Record<Difficulty, number> = {
  easy: 40,
  normal: 30,
  hard: 20,
};

export const MIN_PLAYERS = 8;
export const MAX_PLAYERS = 100;

export const CONDITION_CHECK_DURATION_MS = 7_000;
export const RESOLUTION_DURATION_MS = 10_000;
