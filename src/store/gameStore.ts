import { create } from 'zustand';
import type { GameState, Player, Company, ShareHolding, Loan } from '../entities/types';
import { INITIAL_COMPANIES } from '../data/companies';
import { GAME_EVENTS, pickWeightedEvent, type GameEvent } from '../data/events';

interface GameStore extends GameState {
  initGame: (playerNames: string[]) => void;
  nextTurn: () => void;
  addLog: (message: string) => void;
  buyShares: (companyId: string, amount: number) => boolean;
  sellShares: (companyId: string, amount: number) => boolean;
  takeLoan: (amount: number) => boolean;
  repayLoan: (loanId: string, amount?: number) => boolean;
  getPlayerShares: (playerId: string, companyId: string) => number;
  getOwnershipPercent: (playerId: string, companyId: string) => number;
  recalculateControl: () => void;
  payDividends: () => void;
  accrueInterest: () => void;
  triggerEvent: () => void;
  syncCreditWithReputation: () => void;
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

function applyPriceImpact(company: Company, amount: number, isBuy: boolean): Company {
  const impactFactor = 0.0035;
  const direction = isBuy ? 1 : -1;
  const change = company.sharePrice * impactFactor * amount * direction;
  const newPrice = Math.max(5, Math.round(company.sharePrice + change));
  return {
    ...company,
    sharePrice: newPrice,
    valuation: newPrice * company.totalShares,
  };
}

/** Interest rate now strongly influenced by reputation + creditRating */
function getInterestRate(creditRating: number, reputation: number): number {
  const base = 0.075;
  const creditMod = (70 - creditRating) * 0.0018;
  const repMod = (50 - reputation) * 0.0012;
  return Math.max(0.035, Math.min(0.22, base + creditMod + repMod));
}

function getMaxDebt(creditRating: number, reputation: number): number {
  return (creditRating * 180_000) + (reputation * 80_000);
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

    set({
      ...initialState,
      players,
      companies: createInitialCompanies(),
      status: 'playing',
      turn: 1,
      actionPointsRemaining: 3,
      log: [
        'Game initialized. Welcome to Popoly: Tech Dominion.',
        '8 companies listed. Starting capital: $10M. Bank is open.',
        'Events can trigger at the start of rounds.',
        "--- You's turn ---",
      ],
    });
  },

  addLog: (message: string) => {
    set((state) => ({
      log: [...state.log, message].slice(-160),
    }));
  },

  getPlayerShares: (playerId: string, companyId: string) => {
    const player = get().players.find((p) => p.id === playerId);
    if (!player) return 0;
    return player.shares.find((s) => s.companyId === companyId)?.amount ?? 0;
  },

  getOwnershipPercent: (playerId: string, companyId: string) => {
    const company = get().companies.find((c) => c.id === companyId);
    if (!company || company.totalShares === 0) return 0;
    return (get().getPlayerShares(playerId, companyId) / company.totalShares) * 100;
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

    if (!player || !company || amount <= 0) return false;
    if (actionPointsRemaining < 1) {
      state.addLog('Not enough Action Points.');
      return false;
    }

    const cost = company.sharePrice * amount;
    if (player.cash < cost) {
      state.addLog(`${player.name} needs $${cost.toLocaleString()} but has insufficient cash.`);
      return false;
    }

    const updatedPlayers = players.map((p) => {
      if (p.id !== player.id) return p;
      const existing = p.shares.find((s) => s.companyId === companyId);
      const newShares = existing
        ? p.shares.map((s) =>
            s.companyId === companyId ? { ...s, amount: s.amount + amount } : s
          )
        : [...p.shares, { companyId, amount }];
      return { ...p, cash: p.cash - cost, shares: newShares };
    });

    const updatedCompanies = companies.map((c) =>
      c.id === companyId ? applyPriceImpact(c, amount, true) : c
    );

    set({
      players: updatedPlayers,
      companies: updatedCompanies,
      actionPointsRemaining: actionPointsRemaining - 1,
    });

    get().recalculateControl();
    const newPrice = updatedCompanies.find((c) => c.id === companyId)?.sharePrice;
    get().addLog(
      `${player.name} bought ${amount} ${company.name} @ $${company.sharePrice} → $${newPrice}`
    );
    return true;
  },

  sellShares: (companyId: string, amount: number) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);

    if (!player || !company || amount <= 0) return false;
    if (actionPointsRemaining < 1) {
      state.addLog('Not enough Action Points.');
      return false;
    }

    const owned = state.getPlayerShares(player.id, companyId);
    if (owned < amount) {
      state.addLog(`${player.name} only owns ${owned} shares.`);
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
      return { ...p, cash: p.cash + proceeds, shares: newShares };
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
    const newPrice = updatedCompanies.find((c) => c.id === companyId)?.sharePrice;
    get().addLog(
      `${player.name} sold ${amount} ${company.name} @ $${company.sharePrice} → $${newPrice}`
    );
    return true;
  },

  takeLoan: (amount: number) => {
    const state = get();
    const { currentPlayerIndex, players, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];

    if (!player || amount < 500_000) {
      state.addLog('Minimum loan is $500,000.');
      return false;
    }
    if (actionPointsRemaining < 1) {
      state.addLog('Not enough Action Points.');
      return false;
    }

    const currentDebt = player.loans.reduce((sum, l) => sum + l.remaining, 0);
    const maxDebt = getMaxDebt(player.creditRating, player.reputation);
    if (currentDebt + amount > maxDebt) {
      state.addLog(
        `${player.name} credit limit reached (~$${(maxDebt / 1e6).toFixed(1)}M). Improve reputation or credit.`
      );
      return false;
    }

    const rate = getInterestRate(player.creditRating, player.reputation);
    const loan: Loan = {
      id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      from: 'bank',
      to: player.id,
      principal: amount,
      interestRate: rate,
      remaining: amount,
    };

    const updatedPlayers = players.map((p) =>
      p.id === player.id
        ? { ...p, cash: p.cash + amount, loans: [...p.loans, loan] }
        : p
    );

    set({
      players: updatedPlayers,
      actionPointsRemaining: actionPointsRemaining - 1,
    });

    get().addLog(
      `${player.name} took $${amount.toLocaleString()} loan at ${(rate * 100).toFixed(1)}% (rep & credit affect rate).`
    );
    return true;
  },

  repayLoan: (loanId: string, amount?: number) => {
    const state = get();
    const { currentPlayerIndex, players } = state;
    const player = players[currentPlayerIndex];
    if (!player) return false;

    const loan = player.loans.find((l) => l.id === loanId);
    if (!loan) return false;

    const repayAmount = Math.min(amount ?? loan.remaining, loan.remaining, player.cash);
    if (repayAmount <= 0) {
      state.addLog('Nothing to repay or insufficient cash.');
      return false;
    }

    const updatedPlayers = players.map((p) => {
      if (p.id !== player.id) return p;
      const newLoans = p.loans
        .map((l) =>
          l.id === loanId ? { ...l, remaining: l.remaining - repayAmount } : l
        )
        .filter((l) => l.remaining > 0);
      return { ...p, cash: p.cash - repayAmount, loans: newLoans };
    });

    set({ players: updatedPlayers });
    get().addLog(`${player.name} repaid $${repayAmount.toLocaleString()}.`);
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
        const perShare = company.cashFlow / company.totalShares;
        dividend += Math.floor(perShare * holding.amount);
      }
      if (dividend > 0) {
        totalPaid += dividend;
        addLog(`${player.name} received $${dividend.toLocaleString()} dividends.`);
      }
      return { ...player, cash: player.cash + dividend };
    });

    if (totalPaid > 0) {
      set({ players: updatedPlayers });
      addLog(`Total dividends: $${totalPaid.toLocaleString()}.`);
    }
  },

  accrueInterest: () => {
    const { players, addLog } = get();
    let any = false;

    const updatedPlayers = players.map((player) => {
      if (player.loans.length === 0) return player;
      const newLoans = player.loans.map((loan) => {
        const interest = Math.floor(loan.remaining * loan.interestRate * 0.25);
        if (interest > 0) {
          any = true;
          addLog(
            `${player.name} interest +$${interest.toLocaleString()} (${(loan.interestRate * 100).toFixed(1)}%)`
          );
        }
        return { ...loan, remaining: loan.remaining + interest };
      });
      return { ...player, loans: newLoans };
    });

    if (any) set({ players: updatedPlayers });
  },

  syncCreditWithReputation: () => {
    // Slow drift of creditRating toward reputation influence
    const { players } = get();
    const updated = players.map((p) => {
      const target = 50 + Math.round((p.reputation - 50) * 0.4);
      const next = p.creditRating + Math.sign(target - p.creditRating);
      return { ...p, creditRating: Math.max(20, Math.min(95, next)) };
    });
    set({ players: updated });
  },

  triggerEvent: () => {
    // ~70% chance of an event each new round
    if (Math.random() > 0.72) {
      get().addLog('No major market event this round.');
      return;
    }

    const event = pickWeightedEvent(GAME_EVENTS);
    get().addLog(`⚡ EVENT: ${event.title}`);
    get().addLog(`   ${event.description}`);

    const { companies, players } = get();
    let updatedCompanies = [...companies];
    let updatedPlayers = [...players];

    const applyToCompany = (c: Company, e: GameEvent): Company => {
      let next = { ...c };
      if (e.effects.sharePriceMult) {
        next.sharePrice = Math.max(5, Math.round(c.sharePrice * e.effects.sharePriceMult));
        next.valuation = next.sharePrice * next.totalShares;
      }
      if (e.effects.cashFlowMult) {
        next.cashFlow = Math.max(10, Math.round(c.cashFlow * e.effects.cashFlowMult));
      }
      if (e.effects.reputationDelta) {
        next.reputation = Math.max(0, Math.min(100, c.reputation + e.effects.reputationDelta));
      }
      if (e.effects.securityDelta) {
        next.securityLevel = Math.max(1, Math.min(10, c.securityLevel + e.effects.securityDelta));
      }
      return next;
    };

    if (event.target === 'global') {
      updatedCompanies = companies.map((c) => applyToCompany(c, event));
      if (event.effects.creditRatingDelta) {
        updatedPlayers = players.map((p) => ({
          ...p,
          creditRating: Math.max(
            20,
            Math.min(95, p.creditRating + (event.effects.creditRatingDelta ?? 0))
          ),
        }));
      }
    } else if (event.target === 'sector' && event.sector) {
      updatedCompanies = companies.map((c) =>
        c.sector === event.sector ? applyToCompany(c, event) : c
      );
    }

    set({ companies: updatedCompanies, players: updatedPlayers });
    get().recalculateControl();
  },

  runBotTurn: () => {
    let guard = 0;

    while (get().actionPointsRemaining > 0 && guard < 6) {
      guard++;
      const { currentPlayerIndex, players, companies } = get();
      const bot = players[currentPlayerIndex];
      if (!bot || !bot.isBot) break;

      const scored = companies
        .map((c) => {
          const owned = get().getPlayerShares(bot.id, c.id);
          const ownership = (owned / c.totalShares) * 100;
          const valueScore = c.cashFlow / Math.max(c.sharePrice, 1);
          const controlBonus = ownership >= 30 && ownership < 50 ? 2.8 : ownership > 0 ? 1.3 : 1;
          const random = 0.8 + Math.random() * 0.4;
          return { company: c, score: valueScore * controlBonus * random, owned };
        })
        .sort((a, b) => b.score - a.score);

      let acted = false;

      for (const { company, owned } of scored) {
        if (get().actionPointsRemaining <= 0) break;
        const qty = owned > 0 && owned < company.totalShares * 0.5 ? 50 : 10;
        const cost = company.sharePrice * qty;

        if (bot.cash >= cost) {
          if (get().buyShares(company.id, qty)) {
            acted = true;
            break;
          }
        } else if (bot.cash < 2_500_000 && bot.loans.length < 2) {
          if (get().takeLoan(2_000_000)) {
            acted = true;
            break;
          }
        }
      }

      if (!acted && bot.shares.length > 0 && Math.random() > 0.65) {
        const holding = bot.shares[Math.floor(Math.random() * bot.shares.length)];
        const sellQty = Math.min(25, holding.amount);
        if (sellQty > 0 && get().sellShares(holding.companyId, sellQty)) {
          acted = true;
        }
      }

      if (!acted) break;
    }

    const bot = get().players[get().currentPlayerIndex];
    if (bot?.isBot) get().addLog(`${bot.name} finished its turn.`);
  },

  nextTurn: () => {
    const state = get();
    const { currentPlayerIndex, players, turn } = state;
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    const isNewRound = nextIndex === 0;

    if (isNewRound) {
      state.accrueInterest();
      state.payDividends();
      state.syncCreditWithReputation();
      state.triggerEvent();
      state.addLog(`=== Round ${turn + 1} begins ===`);
    }

    const nextPlayer = players[nextIndex];

    set({
      currentPlayerIndex: nextIndex,
      turn: isNewRound ? turn + 1 : turn,
      actionPointsRemaining: 3,
    });

    state.addLog(`--- ${nextPlayer.name}'s turn ---`);

    if (nextPlayer.isBot) {
      setTimeout(() => {
        get().runBotTurn();
        setTimeout(() => {
          const current = get();
          if (current.players[current.currentPlayerIndex]?.id === nextPlayer.id) {
            get().nextTurn();
          }
        }, 420);
      }, 260);
    }
  },
}));
