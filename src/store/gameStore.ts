import { create } from 'zustand';
import type { GameState, Player, Company, ShareHolding } from '../entities/types';
import { INITIAL_COMPANIES } from '../data/companies';

interface GameStore extends GameState {
  initGame: (playerNames: string[]) => void;
  nextTurn: () => void;
  addLog: (message: string) => void;
  buyShares: (companyId: string, amount: number) => boolean;
  sellShares: (companyId: string, amount: number) => boolean;
  getPlayerShares: (playerId: string, companyId: string) => number;
  getOwnershipPercent: (playerId: string, companyId: string) => number;
  recalculateControl: () => void;
  payDividends: () => void;
  runBotTurn: () => void;
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
    secrets: [],
  }));
}

/** Simple price impact: buying pushes price up, selling pushes it down */
function applyPriceImpact(company: Company, amount: number, isBuy: boolean): Company {
  const impactFactor = 0.004; // 0.4% per share roughly, scaled
  const direction = isBuy ? 1 : -1;
  const change = company.sharePrice * impactFactor * amount * direction;
  const newPrice = Math.max(5, Math.round(company.sharePrice + change));
  const newValuation = newPrice * company.totalShares;

  return {
    ...company,
    sharePrice: newPrice,
    valuation: newValuation,
  };
}

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
        '8 companies listed on the market. Starting capital: $10M each.',
        '--- You\'s turn ---',
      ],
    });
  },

  addLog: (message: string) => {
    set((state) => ({
      log: [...state.log, message].slice(-120),
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
      state.addLog(
        `${player.name} does not have enough cash (need $${cost.toLocaleString()}).`
      );
      return false;
    }

    // Update player
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

    // Update company price
    const updatedCompanies = companies.map((c) =>
      c.id === companyId ? applyPriceImpact(c, amount, true) : c
    );

    set({
      players: updatedPlayers,
      companies: updatedCompanies,
      actionPointsRemaining: actionPointsRemaining - 1,
    });

    get().recalculateControl();
    get().addLog(
      `${player.name} bought ${amount} shares of ${company.name} for $${cost.toLocaleString()} (new price: $${updatedCompanies.find((c) => c.id === companyId)?.sharePrice}).`
    );

    return true;
  },

  sellShares: (companyId: string, amount: number) => {
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

    const owned = state.getPlayerShares(player.id, companyId);
    if (owned < amount) {
      state.addLog(`${player.name} only owns ${owned} shares of ${company.name}.`);
      return false;
    }

    const proceeds = company.sharePrice * amount;

    const updatedPlayers = players.map((p) => {
      if (p.id !== player.id) return p;

      const newShares = p.shares
        .map((s) =>
          s.companyId === companyId ? { ...s, amount: s.amount - amount } : s
        )
        .filter((s) => s.amount > 0);

      return {
        ...p,
        cash: p.cash + proceeds,
        shares: newShares,
      };
    });

    const updatedCompanies = companies.map((c) =>
      c.id === companyId ? applyPriceImpact(c, amount, false) : c
    );

    set({
      players: updatedPlayers,
      companies: updatedCompanies,
      actionPointsRemaining: actionPointsRemaining - 1,
    });

    get().recalculateControl();
    get().addLog(
      `${player.name} sold ${amount} shares of ${company.name} for $${proceeds.toLocaleString()} (new price: $${updatedCompanies.find((c) => c.id === companyId)?.sharePrice}).`
    );

    return true;
  },

  payDividends: () => {
    const { players, companies, addLog } = get();

    let totalPaid = 0;
    const updatedPlayers = players.map((player) => {
      let dividend = 0;

      for (const holding of player.shares) {
        const company = companies.find((c) => c.id === holding.companyId);
        if (!company || company.cashFlow <= 0) continue;

        // Simple: each share gets a portion of cashFlow
        const perShare = company.cashFlow / company.totalShares;
        dividend += Math.floor(perShare * holding.amount);
      }

      if (dividend > 0) {
        totalPaid += dividend;
        addLog(`${player.name} received $${dividend.toLocaleString()} in dividends.`);
      }

      return {
        ...player,
        cash: player.cash + dividend,
      };
    });

    if (totalPaid > 0) {
      set({ players: updatedPlayers });
      addLog(`Total dividends paid this round: $${totalPaid.toLocaleString()}.`);
    }
  },

  runBotTurn: () => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining } = state;
    const bot = players[currentPlayerIndex];

    if (!bot || !bot.isBot) return;

    // Very simple bot: try to buy 10-50 shares of 1-2 random companies while it has AP and cash
    let ap = actionPointsRemaining;
    const available = [...companies].sort(() => Math.random() - 0.5);

    for (const company of available) {
      if (ap <= 0) break;

      const qty = Math.random() > 0.6 ? 50 : 10;
      const cost = company.sharePrice * qty;

      if (bot.cash >= cost) {
        const success = state.buyShares(company.id, qty);
        if (success) {
          ap -= 1;
          // refresh bot reference after state change
          const updatedBot = get().players[currentPlayerIndex];
          if (!updatedBot || updatedBot.cash < company.sharePrice * 10) break;
        }
      }
    }

    // If still has AP, sometimes do nothing (pass)
    if (get().actionPointsRemaining > 0) {
      get().addLog(`${bot.name} ends its actions.`);
    }
  },

  nextTurn: () => {
    const state = get();
    const { currentPlayerIndex, players, turn } = state;
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    const isNewRound = nextIndex === 0;

    if (isNewRound) {
      // Pay dividends at the start of a new round
      state.payDividends();
      state.addLog(`=== Round ${turn + 1} begins ===`);
    }

    const nextPlayer = players[nextIndex];

    set({
      currentPlayerIndex: nextIndex,
      turn: isNewRound ? turn + 1 : turn,
      actionPointsRemaining: 3,
    });

    state.addLog(`--- ${nextPlayer.name}'s turn ---`);

    // If next player is a bot, run its turn automatically after a short delay feel
    if (nextPlayer.isBot) {
      // We run it synchronously for simplicity for now
      setTimeout(() => {
        get().runBotTurn();
        // After bot finishes, auto-end turn if it still has the turn
        const current = get();
        if (current.players[current.currentPlayerIndex]?.id === nextPlayer.id) {
          // Give a tiny pause then end
          setTimeout(() => get().nextTurn(), 400);
        }
      }, 300);
    }
  },
}));
