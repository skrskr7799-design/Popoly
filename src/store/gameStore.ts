import { create } from 'zustand';
import type {
  GameState,
  Player,
  Company,
  Loan,
  CompanySecret,
} from '../entities/types';
import { INITIAL_COMPANIES } from '../data/companies';
import { GAME_EVENTS, pickWeightedEvent } from '../data/events';

interface GameStore extends GameState {
  winnerId: string | null;
  initGame: (playerNames: string[]) => void;
  nextTurn: () => void;
  addLog: (message: string) => void;
  buyShares: (companyId: string, amount: number) => boolean;
  sellShares: (companyId: string, amount: number) => boolean;
  takeLoan: (amount: number) => boolean;
  repayLoan: (loanId: string, amount?: number) => boolean;
  upgradeIntelligence: () => boolean;
  performEspionage: (companyId: string) => boolean;
  leakSecret: (companyId: string, secretId: string) => boolean;
  raiseSecurity: (companyId: string) => boolean;
  getPlayerShares: (playerId: string, companyId: string) => number;
  getOwnershipPercent: (playerId: string, companyId: string) => number;
  getKnownSecrets: (playerId: string, companyId: string) => CompanySecret[];
  getNetWorth: (playerId: string) => number;
  getScore: (playerId: string) => number;
  recalculateControl: () => void;
  payDividends: () => void;
  accrueInterest: () => void;
  triggerEvent: () => void;
  syncCreditWithReputation: () => void;
  checkVictory: () => void;
  runBotTurn: () => void;
}

const initialState: GameState & { winnerId: string | null } = {
  turn: 0,
  phase: 'innovation_boom',
  players: [],
  companies: [],
  currentPlayerIndex: 0,
  actionPointsRemaining: 0,
  log: [],
  status: 'setup',
  winnerId: null,
};

function createInitialCompanies(): Company[] {
  return INITIAL_COMPANIES.map((c) => ({
    ...c,
    controlledBy: null,
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

function getInterestRate(creditRating: number, reputation: number): number {
  const base = 0.075;
  const creditMod = (70 - creditRating) * 0.0018;
  const repMod = (50 - reputation) * 0.0012;
  return Math.max(0.035, Math.min(0.22, base + creditMod + repMod));
}

function getMaxDebt(creditRating: number, reputation: number): number {
  return creditRating * 180_000 + reputation * 80_000;
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
      winnerId: null,
      log: [
        'Game initialized. Welcome to Popoly: Tech Dominion.',
        'Espionage, loans, events and corporate warfare are live.',
        'Victory checked from round 12 by score (net worth + control + rep).',
        "--- You's turn ---",
      ],
    });
  },

  addLog: (message: string) => {
    set((state) => ({
      log: [...state.log, message].slice(-200),
    }));
  },

  getPlayerShares: (playerId, companyId) => {
    const player = get().players.find((p) => p.id === playerId);
    if (!player) return 0;
    return player.shares.find((s) => s.companyId === companyId)?.amount ?? 0;
  },

  getOwnershipPercent: (playerId, companyId) => {
    const company = get().companies.find((c) => c.id === companyId);
    if (!company || company.totalShares === 0) return 0;
    return (get().getPlayerShares(playerId, companyId) / company.totalShares) * 100;
  },

  getKnownSecrets: (playerId, companyId) => {
    const company = get().companies.find((c) => c.id === companyId);
    if (!company) return [];
    return company.secrets.filter(
      (s) => s.leaked || (s.discoveredBy && s.discoveredBy.includes(playerId))
    );
  },

  getNetWorth: (playerId) => {
    const player = get().players.find((p) => p.id === playerId);
    if (!player) return 0;
    const { companies } = get();
    let sharesValue = 0;
    for (const h of player.shares) {
      const c = companies.find((x) => x.id === h.companyId);
      if (c) sharesValue += c.sharePrice * h.amount;
    }
    const debt = player.loans.reduce((s, l) => s + l.remaining, 0);
    return player.cash + sharesValue - debt;
  },

  getScore: (playerId) => {
    const player = get().players.find((p) => p.id === playerId);
    if (!player) return 0;
    const net = get().getNetWorth(playerId);
    const controlBonus = player.controlledCompanyIds.length * 3_500_000;
    const repBonus = player.reputation * 40_000;
    return net + controlBonus + repBonus;
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

  buyShares: (companyId, amount) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);
    if (!player || !company || amount <= 0 || actionPointsRemaining < 1) return false;
    const cost = company.sharePrice * amount;
    if (player.cash < cost) {
      state.addLog(`${player.name} needs $${cost.toLocaleString()}.`);
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
    get().addLog(`${player.name} bought ${amount} ${company.name} → $${newPrice}`);
    return true;
  },

  sellShares: (companyId, amount) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);
    if (!player || !company || amount <= 0 || actionPointsRemaining < 1) return false;
    const owned = state.getPlayerShares(player.id, companyId);
    if (owned < amount) return false;
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
    get().addLog(`${player.name} sold ${amount} ${company.name}`);
    return true;
  },

  takeLoan: (amount) => {
    const state = get();
    const { currentPlayerIndex, players, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];
    if (!player || amount < 500_000 || actionPointsRemaining < 1) return false;
    const currentDebt = player.loans.reduce((sum, l) => sum + l.remaining, 0);
    const maxDebt = getMaxDebt(player.creditRating, player.reputation);
    if (currentDebt + amount > maxDebt) {
      state.addLog(`${player.name} credit limit reached.`);
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
    set({ players: updatedPlayers, actionPointsRemaining: actionPointsRemaining - 1 });
    get().addLog(
      `${player.name} took $${amount.toLocaleString()} @ ${(rate * 100).toFixed(1)}%`
    );
    return true;
  },

  repayLoan: (loanId, amount) => {
    const state = get();
    const { currentPlayerIndex, players } = state;
    const player = players[currentPlayerIndex];
    if (!player) return false;
    const loan = player.loans.find((l) => l.id === loanId);
    if (!loan) return false;
    const repayAmount = Math.min(amount ?? loan.remaining, loan.remaining, player.cash);
    if (repayAmount <= 0) return false;
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

  upgradeIntelligence: () => {
    const state = get();
    const { currentPlayerIndex, players, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];
    if (!player || actionPointsRemaining < 1) return false;
    if (player.intelligenceLevel >= 8) {
      state.addLog('Intelligence already maxed.');
      return false;
    }
    const cost = player.intelligenceLevel * 1_200_000;
    if (player.cash < cost) {
      state.addLog(`Need $${cost.toLocaleString()} to upgrade Intel.`);
      return false;
    }
    const updatedPlayers = players.map((p) =>
      p.id === player.id
        ? { ...p, cash: p.cash - cost, intelligenceLevel: p.intelligenceLevel + 1 }
        : p
    );
    set({ players: updatedPlayers, actionPointsRemaining: actionPointsRemaining - 1 });
    get().addLog(
      `${player.name} upgraded Intelligence to level ${player.intelligenceLevel + 1}.`
    );
    return true;
  },

  raiseSecurity: (companyId) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);
    if (!player || !company || actionPointsRemaining < 1) return false;

    // Only controller or major shareholder can meaningfully raise security
    const ownership = state.getOwnershipPercent(player.id, companyId);
    if (ownership < 25 && company.controlledBy !== player.id) {
      state.addLog('Need at least 25% ownership or control to raise security.');
      return false;
    }
    if (company.securityLevel >= 9) {
      state.addLog('Security already very high.');
      return false;
    }

    const cost = 600_000 + company.securityLevel * 250_000;
    if (player.cash < cost) {
      state.addLog(`Raising security costs $${cost.toLocaleString()}.`);
      return false;
    }

    const updatedCompanies = companies.map((c) =>
      c.id === companyId
        ? { ...c, securityLevel: Math.min(10, c.securityLevel + 1) }
        : c
    );
    const updatedPlayers = players.map((p) =>
      p.id === player.id ? { ...p, cash: p.cash - cost } : p
    );

    set({
      companies: updatedCompanies,
      players: updatedPlayers,
      actionPointsRemaining: actionPointsRemaining - 1,
    });
    get().addLog(
      `${player.name} raised ${company.name} security to ${company.securityLevel + 1}.`
    );
    return true;
  },

  performEspionage: (companyId) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);
    if (!player || !company || actionPointsRemaining < 1) return false;

    const baseCost = 400_000 + company.securityLevel * 180_000;
    const cost = Math.round(baseCost * (1 - (player.intelligenceLevel - 1) * 0.06));
    if (player.cash < cost) {
      state.addLog(`Espionage requires $${cost.toLocaleString()}.`);
      return false;
    }

    const intelFactor = player.intelligenceLevel * 12;
    const securityFactor = company.securityLevel * 11;
    const chance = Math.max(0.08, Math.min(0.82, 0.28 + (intelFactor - securityFactor) / 100));

    let updatedPlayers = players.map((p) =>
      p.id === player.id ? { ...p, cash: p.cash - cost } : p
    );
    set({
      players: updatedPlayers,
      actionPointsRemaining: actionPointsRemaining - 1,
    });

    if (Math.random() > chance) {
      const detected = Math.random() < 0.35 + company.securityLevel * 0.04;
      if (detected) {
        updatedPlayers = get().players.map((p) =>
          p.id === player.id
            ? { ...p, reputation: Math.max(0, p.reputation - 6) }
            : p
        );
        set({ players: updatedPlayers });
        get().addLog(
          `❌ ${player.name}'s op on ${company.name} failed and was DETECTED. Rep -6.`
        );
      } else {
        get().addLog(`❌ ${player.name}'s op on ${company.name} failed.`);
      }
      return false;
    }

    const unknown = company.secrets.filter(
      (s) => !s.leaked && !(s.discoveredBy ?? []).includes(player.id)
    );
    if (unknown.length === 0) {
      get().addLog(`✅ ${player.name} found no new secrets at ${company.name}.`);
      return true;
    }

    const sorted = [...unknown].sort((a, b) => b.severity - a.severity);
    const pick =
      player.intelligenceLevel >= 4
        ? sorted[0]
        : sorted[Math.floor(Math.random() * sorted.length)];

    const updatedCompanies = get().companies.map((c) => {
      if (c.id !== companyId) return c;
      return {
        ...c,
        secrets: c.secrets.map((s) =>
          s.id === pick.id
            ? { ...s, discoveredBy: [...(s.discoveredBy ?? []), player.id] }
            : s
        ),
      };
    });
    set({ companies: updatedCompanies });
    get().addLog(
      `✅ ${player.name} uncovered severity-${pick.severity} secret at ${company.name}.`
    );
    get().addLog(`   "${pick.description}"`);
    return true;
  },

  leakSecret: (companyId, secretId) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);
    if (!player || !company || actionPointsRemaining < 1) return false;

    const secret = company.secrets.find((s) => s.id === secretId);
    if (!secret || secret.leaked) return false;
    if (!(secret.discoveredBy ?? []).includes(player.id)) {
      state.addLog('You have not discovered this secret.');
      return false;
    }

    const cost = 250_000;
    if (player.cash < cost) {
      state.addLog(`Leak requires $${cost.toLocaleString()}.`);
      return false;
    }

    const priceHit = 1 - secret.severity * 0.04; // stronger
    const repHit = secret.severity * 3.5;
    const cashFlowHit = 1 - secret.severity * 0.025;

    const updatedCompanies = companies.map((c) => {
      if (c.id !== companyId) return c;
      const newPrice = Math.max(5, Math.round(c.sharePrice * priceHit));
      return {
        ...c,
        sharePrice: newPrice,
        valuation: newPrice * c.totalShares,
        reputation: Math.max(0, c.reputation - repHit),
        cashFlow: Math.max(10, Math.round(c.cashFlow * cashFlowHit)),
        secrets: c.secrets.map((s) =>
          s.id === secretId ? { ...s, leaked: true } : s
        ),
      };
    });

    // Hurt the controlling player's personal reputation too
    let updatedPlayers = players.map((p) => {
      if (p.id === player.id) {
        return {
          ...p,
          cash: p.cash - cost,
          reputation: Math.min(100, p.reputation + 3),
        };
      }
      if (company.controlledBy && p.id === company.controlledBy) {
        return {
          ...p,
          reputation: Math.max(0, p.reputation - Math.round(secret.severity * 1.8)),
        };
      }
      return p;
    });

    set({
      companies: updatedCompanies,
      players: updatedPlayers,
      actionPointsRemaining: actionPointsRemaining - 1,
    });

    get().addLog(
      `📢 LEAK by ${player.name} on ${company.name} (severity ${secret.severity})!`
    );
    get().addLog(`   "${secret.description}"`);
    if (company.controlledBy) {
      const ctrl = players.find((p) => p.id === company.controlledBy);
      if (ctrl) {
        get().addLog(`   ${ctrl.name}'s reputation also took a hit as controller.`);
      }
    }
    get().recalculateControl();
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
        dividend += Math.floor((company.cashFlow / company.totalShares) * holding.amount);
      }
      if (dividend > 0) {
        totalPaid += dividend;
        addLog(`${player.name} +$${dividend.toLocaleString()} dividends`);
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
    const { players } = get();
    const updated = players.map((p) => {
      const target = 50 + Math.round((p.reputation - 50) * 0.4);
      const next = p.creditRating + Math.sign(target - p.creditRating);
      return { ...p, creditRating: Math.max(20, Math.min(95, next)) };
    });
    set({ players: updated });
  },

  triggerEvent: () => {
    if (Math.random() > 0.7) {
      get().addLog('No major market event this round.');
      return;
    }
    const event = pickWeightedEvent(GAME_EVENTS);
    get().addLog(`⚡ EVENT: ${event.title}`);
    get().addLog(`   ${event.description}`);

    const { companies, players } = get();
    let updatedCompanies = [...companies];
    let updatedPlayers = [...players];

    const applyToCompany = (c: Company) => {
      let next = { ...c };
      if (event.effects.sharePriceMult) {
        next.sharePrice = Math.max(5, Math.round(c.sharePrice * event.effects.sharePriceMult));
        next.valuation = next.sharePrice * next.totalShares;
      }
      if (event.effects.cashFlowMult) {
        next.cashFlow = Math.max(10, Math.round(c.cashFlow * event.effects.cashFlowMult));
      }
      if (event.effects.reputationDelta) {
        next.reputation = Math.max(0, Math.min(100, c.reputation + event.effects.reputationDelta));
      }
      if (event.effects.securityDelta) {
        next.securityLevel = Math.max(1, Math.min(10, c.securityLevel + event.effects.securityDelta));
      }
      return next;
    };

    if (event.target === 'global') {
      updatedCompanies = companies.map(applyToCompany);
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
        c.sector === event.sector ? applyToCompany(c) : c
      );
    }

    set({ companies: updatedCompanies, players: updatedPlayers });
    get().recalculateControl();
  },

  checkVictory: () => {
    const { turn, players, status } = get();
    if (status !== 'playing' || turn < 12) return;

    // After round 12, highest score wins (or continue until someone is far ahead)
    const scores = players.map((p) => ({
      id: p.id,
      name: p.name,
      score: get().getScore(p.id),
    }));
    scores.sort((a, b) => b.score - a.score);

    const leader = scores[0];
    const second = scores[1];

    // Decisive lead or hard stop at round 20
    if (turn >= 20 || (leader.score > second.score * 1.35 && turn >= 12)) {
      set({ status: 'finished', winnerId: leader.id });
      get().addLog(`🏆 ${leader.name} wins with score $${(leader.score / 1e6).toFixed(1)}M!`);
    }
  },

  runBotTurn: () => {
    let guard = 0;
    while (get().actionPointsRemaining > 0 && guard < 7) {
      guard++;
      const { currentPlayerIndex, players, companies } = get();
      const bot = players[currentPlayerIndex];
      if (!bot || !bot.isBot) break;

      // 1. Protect controlled companies
      for (const cid of bot.controlledCompanyIds) {
        const c = companies.find((x) => x.id === cid);
        if (c && c.securityLevel < 6 && bot.cash > 2_000_000 && Math.random() > 0.55) {
          if (get().raiseSecurity(cid)) continue;
        }
      }

      // 2. Upgrade intel sometimes
      if (bot.intelligenceLevel < 5 && bot.cash > 4_000_000 && Math.random() > 0.65) {
        if (get().upgradeIntelligence()) continue;
      }

      // 3. Spy / leak
      if (Math.random() > 0.55) {
        // Prefer high-value or rival-controlled companies
        const targets = [...companies].sort(() => Math.random() - 0.5);
        for (const t of targets) {
          const known = get().getKnownSecrets(bot.id, t.id);
          const high = known.find((s) => !s.leaked && s.severity >= 7);
          if (high && Math.random() > 0.4) {
            if (get().leakSecret(t.id, high.id)) break;
          } else if (Math.random() > 0.5) {
            if (get().performEspionage(t.id)) break;
          }
        }
        if (get().actionPointsRemaining <= 0) break;
      }

      // 4. Market actions
      const scored = companies
        .map((c) => {
          const owned = get().getPlayerShares(bot.id, c.id);
          const ownership = (owned / c.totalShares) * 100;
          const valueScore = c.cashFlow / Math.max(c.sharePrice, 1);
          const controlBonus =
            ownership >= 30 && ownership < 50 ? 3.0 : ownership > 0 ? 1.4 : 1;
          return {
            company: c,
            score: valueScore * controlBonus * (0.75 + Math.random() * 0.5),
            owned,
          };
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

      if (!acted && bot.shares.length > 0 && Math.random() > 0.7) {
        const holding = bot.shares[Math.floor(Math.random() * bot.shares.length)];
        const sellQty = Math.min(30, holding.amount);
        if (sellQty > 0) get().sellShares(holding.companyId, sellQty);
      } else if (!acted) break;
    }

    const bot = get().players[get().currentPlayerIndex];
    if (bot?.isBot) get().addLog(`${bot.name} finished its turn.`);
  },

  nextTurn: () => {
    const state = get();
    if (state.status === 'finished') return;

    const { currentPlayerIndex, players, turn } = state;
    const nextIndex = (currentPlayerIndex + 1) % players.length;
    const isNewRound = nextIndex === 0;

    if (isNewRound) {
      state.accrueInterest();
      state.payDividends();
      state.syncCreditWithReputation();
      state.triggerEvent();
      state.addLog(`=== Round ${turn + 1} begins ===`);
      state.checkVictory();
      if (get().status === 'finished') return;
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
          if (
            current.status === 'playing' &&
            current.players[current.currentPlayerIndex]?.id === nextPlayer.id
          ) {
            get().nextTurn();
          }
        }, 400);
      }, 240);
    }
  },
}));
