import { create } from 'zustand';
import type { GameState, Player } from '../entities/types';

interface GameStore extends GameState {
  initGame: (playerNames: string[]) => void;
  nextTurn: () => void;
  addLog: (message: string) => void;
}

const initialState: GameState = {
  turn: 0,
  phase: 'innovation_boom',
  players: [],
  companies: [],
  currentPlayerIndex: 0,
  actionPointsRemaining: 0,
  log: [],
  status: 'setup',
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  initGame: (playerNames: string[]) => {
    const players: Player[] = playerNames.map((name, i) => ({
      id: `player-${i}`,
      name,
      isBot: i > 0,
      cash: 10_000_000,
      shares: [],
      controlledCompanyIds: [],
      reputation: 50,
      intelligenceLevel: 1,
      creditRating: 70,
      loans: [],
      modifiers: {},
    }));

    set({
      ...initialState,
      players,
      status: 'playing',
      turn: 1,
      actionPointsRemaining: 3,
      log: ['Game initialized. Welcome to Popoly: Tech Dominion.'],
    });
  },

  nextTurn: () => {
    const { currentPlayerIndex, players, turn } = get();
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    const isNewRound = nextIndex === 0;

    set({
      currentPlayerIndex: nextIndex,
      turn: isNewRound ? turn + 1 : turn,
      actionPointsRemaining: 3,
    });
  },

  addLog: (message: string) => {
    set((state) => ({
      log: [...state.log, message],
    }));
  },
}));
