import { create } from 'zustand';
import type { GameState, Player, Company, ShareHolding } from '../entities/types';
import { INITIAL_COMPANIES } from '../data/companies';

interface GameStore extends GameState {
  initGame: (playerNames: string[]) => void;
  nextTurn: () => void;
  addLog: (message: string) => void;
  buyShares: (companyId: string, amount: number) => boolean;
  getPlayerShares: (playerId: string, companyId: string) => number;
  getOwnershipPercent: (playerId: string, companyId: string) => number;
  recalculateControl: () => void;
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

function createInitialCompanies(): Company[] {
  return INITIAL_COMPANIES.map((c) => ({
    ...c,
    controlledBy: null,
    secrets: [], // will be populated later
  }));
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  initGame: (playerNames: string[]) => {
    const players: Player[] = playerNames.map((name, i) => ({
      id: `player-${i}`,
      name,
      isBot: i > 0,
      cash: 10_000_000, // $10M starting capital
      shares: [],
      controlledCompanyIds: [],
      reputation: 50,
      intelligenceLevel: 1,
      creditRating: 70,
      loans: [],
      modifiers: {},
    }));

    const companies = createInitialCompanies();

    set({
      ...initialState,
      players,
      companies,
      status: 'playing',
      turn: 1,
      actionPointsRemaining: 3,
      log: [
        'Game initialized. Welcome to Popoly: Tech Dominion.',
        `8 companies listed on the market. Starting capital: $10M each.`,
      ],
    });
  },

  nextTurn: () => {
    const { currentPlayerIndex, players, turn, addLog } = get();
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    const isNewRound = nextIndex === 0;

    const nextPlayer = players[nextIndex];

    set({
      currentPlayerIndex: nextIndex,
      turn: isNewRound ? turn + 1 : turn,
      actionPointsRemaining: 3,
    });

    get().addLog(`--- ${nextPlayer.name}'s turn ---`);
  },

  addLog: (message: string) => {
    set((state) => ({
      log: [...state.log, message].slice(-100), // keep last 100 entries
    }));
  },

  getPlayerShares: (playerId: string, companyId: string) => {
    const player = get().players.find((p) => p.id === playerId);
    if (!player) return 0;
    const holding = player.shares.find((s) => s.companyId === companyId);
    return holding?.amount ?? 0;
  },

  getOwnershipPercent: (playerId: string, companyId: string) => {
    const company = get().companies.find((c) => c.id === companyId);
    if (!company || company.totalShares === 0) return 0;
    const amount = get().getPlayerShares(playerId, companyId);
    return (amount / company.totalShares) * 100;
  },

  recalculateControl: () => {
    const { companies, players } = get();

    const updatedCompanies = companies.map((company) => {
      let maxPercent = 0;
      let controller: string | null = null;

      for (const player of players) {
        const percent = get().getOwnershipPercent(player.id, company.id);
        if (percent > maxPercent && percent >= 50) {
          maxPercent = percent;
          controller = player.id;
        }
      }

      return { ...company, controlledBy: controller };
    });

    // Update controlledCompanyIds on players
    const updatedPlayers = players.map((player) => ({
      ...player,
      controlledCompanyIds: updatedCompanies
        .filter((c) => c.controlledBy === player.id)
        .map((c) => c.id),
    }));

    set({ companies: updatedCompanies, players: updatedPlayers });
  },

  buyShares: (companyId: string, amount: number) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);

    if (!player || !company) return false;
    if (actionPointsRemaining < 1) {
      state.addLog('Not enough Action Points.');
      return false;
    }
    if (amount <= 0) return false;

    const cost = company.sharePrice * amount;
    if (player.cash < cost) {
      state.addLog(`${player.name} does not have enough cash (need $${cost.toLocaleString()}).`);
      return false;
    }

    // Update player cash and shares
    const updatedPlayers = players.map((p) => {
      if (p.id !== player.id) return p;

      const existing = p.shares.find((s) => s.companyId === companyId);
      let newShares: ShareHolding[];

      if (existing) {
        newShares = p.shares.map((s) =>
          s.companyId === companyId ? { ...s, amount: s.amount + amount } : s
        );
      } else {
        newShares = [...p.shares, { companyId, amount }];
      }

      return {
        ...p,
        cash: p.cash - cost,
        shares: newShares,
      };
    });

    set({
      players: updatedPlayers,
      actionPointsRemaining: actionPointsRemaining - 1,
    });

    get().recalculateControl();
    get().addLog(
      `${player.name} bought ${amount} shares of ${company.name} for $${cost.toLocaleString()}.`
    );

    return true;
  },
}));
