import { validateGameState } from '../domain/invariants';
import { createComputeBottleneckState } from '../scenario/computeBottleneck';
import type { GameState } from '../domain/types';

export function initializeGame(seed?: number): GameState {
  const state = createComputeBottleneckState(seed);
  const issues = validateGameState(state);
  if (issues.length > 0) {
    const details = issues.map((issue) => `[${issue.code}] ${issue.message}`).join('\n');
    throw new Error(`Invalid scenario initial state:\n${details}`);
  }
  return state;
}
