import { create } from 'zustand';
import type {
  GameState,
  Player,
  Company,
  Loan,
  CompanySecret,
  EconomyPhase,
} from '../entities/types';
import { INITIAL_COMPANIES } from '../data/companies';
import { GAME_EVENTS, pickWeightedEvent } from '../data/events';
import { getPhaseConfig, nextPhase } from '../data/economy';

// NOTE: Full implementation is large; see repo history / local artifacts.
// This restore includes phaseRounds and phase-aware helpers.

interface GameStore extends GameState {
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
  advancePhaseIfNeeded: () => void;
  syncCreditWithReputation: () => void;
  checkVictory: () => void;
  runBotTurn: () => void;
}

const initialState: GameState = {
  turn: 0,
  phase: 'innovation_boom',
  phaseRounds: 0,
  players: [],
  companies: [],
  currentPlayerIndex: 0,
  actionPointsRemaining: 0,
  log: [],
  status: 'setup',
  winnerId: null,
};

function createInitialCompanies(): Company[] {
  return INITIAL_COMPANIES.map((c) => ({ ...c, controlledBy: null }));
}

function applyPriceImpact(company: Company, amount: number, isBuy: boolean, phase: EconomyPhase): Company {
  const cfg = getPhaseConfig(phase);
  const impactFactor = 0.0035 * cfg.priceImpactMult;
  const direction = isBuy ? 1 : -1;
  const change = company.sharePrice * impactFactor * amount * direction;
  const newPrice = Math.max(5, Math.round(company.sharePrice + change));
  return { ...company, sharePrice: newPrice, valuation: newPrice * company.totalShares };
}

function getInterestRate(creditRating: number, reputation: number, phase: EconomyPhase): number {
  const cfg = getPhaseConfig(phase);
  const base = 0.075 * cfg.interestMult;
  const creditMod = (70 - creditRating) * 0.0018;
  const repMod = (50 - reputation) * 0.0012;
  return Math.max(0.03, Math.min(0.25, base + creditMod + repMod));
}

function getMaxDebt(creditRating: number, reputation: number): number {
  return creditRating * 180_000 + reputation * 80_000;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  initGame: (playerNames) => {
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
    const phaseCfg = getPhaseConfig('innovation_boom');
    set({
      ...initialState,
      players,
      companies: createInitialCompanies(),
      status: 'playing',
      turn: 1,
      phase: 'innovation_boom',
      phaseRounds: 1,
      actionPointsRemaining: 3,
      winnerId: null,
      log: [
        'Game initialized. Welcome to Popoly: Tech Dominion.',
        `Economy phase: ${phaseCfg.label} — ${phaseCfg.description}`,
        'Espionage, loans, events, phases and scoring are live.',
        "--- You's turn ---",
      ],
    });
  },

  addLog: (message) => set((s) => ({ log: [...s.log, message].slice(-220) })),

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
    return company.secrets.filter((s) => s.leaked || (s.discoveredBy && s.discoveredBy.includes(playerId)));
  },

  getNetWorth: (playerId) => {
    const player = get().players.find((p) => p.id === playerId);
    if (!player) return 0;
    let sharesValue = 0;
    for (const h of player.shares) {
      const c = get().companies.find((x) => x.id === h.companyId);
      if (c) sharesValue += c.sharePrice * h.amount;
    }
    const debt = player.loans.reduce((s, l) => s + l.remaining, 0);
    return player.cash + sharesValue - debt;
  },

  getScore: (playerId) => {
    const player = get().players.find((p) => p.id === playerId);
    if (!player) return 0;
    return get().getNetWorth(playerId) + player.controlledCompanyIds.length * 3_500_000 + player.reputation * 40_000;
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
      controlledCompanyIds: updatedCompanies.filter((c) => c.controlledBy === player.id).map((c) => c.id),
    }));
    set({ companies: updatedCompanies, players: updatedPlayers });
  },

  buyShares: (companyId, amount) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining, phase } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);
    if (!player || !company || amount <= 0 || actionPointsRemaining < 1) return false;
    const cost = company.sharePrice * amount;
    if (player.cash < cost) { state.addLog(`${player.name} needs $${cost.toLocaleString()}.`); return false; }
    const updatedPlayers = players.map((p) => {
      if (p.id !== player.id) return p;
      const existing = p.shares.find((s) => s.companyId === companyId);
      const newShares = existing
        ? p.shares.map((s) => (s.companyId === companyId ? { ...s, amount: s.amount + amount } : s))
        : [...p.shares, { companyId, amount }];
      return { ...p, cash: p.cash - cost, shares: newShares };
    });
    const updatedCompanies = companies.map((c) => (c.id === companyId ? applyPriceImpact(c, amount, true, phase) : c));
    set({ players: updatedPlayers, companies: updatedCompanies, actionPointsRemaining: actionPointsRemaining - 1 });
    get().recalculateControl();
    get().addLog(`${player.name} bought ${amount} ${company.name}`);
    return true;
  },

  sellShares: (companyId, amount) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining, phase } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);
    if (!player || !company || amount <= 0 || actionPointsRemaining < 1) return false;
    const owned = state.getPlayerShares(player.id, companyId);
    if (owned < amount) return false;
    const proceeds = company.sharePrice * amount;
    const updatedPlayers = players.map((p) => {
      if (p.id !== player.id) return p;
      const newShares = p.shares.map((s) => (s.companyId === companyId ? { ...s, amount: s.amount - amount } : s)).filter((s) => s.amount > 0);
      return { ...p, cash: p.cash + proceeds, shares: newShares };
    });
    const updatedCompanies = companies.map((c) => (c.id === companyId ? applyPriceImpact(c, amount, false, phase) : c));
    set({ players: updatedPlayers, companies: updatedCompanies, actionPointsRemaining: actionPointsRemaining - 1 });
    get().recalculateControl();
    get().addLog(`${player.name} sold ${amount} ${company.name}`);
    return true;
  },

  takeLoan: (amount) => {
    const state = get();
    const { currentPlayerIndex, players, actionPointsRemaining, phase } = state;
    const player = players[currentPlayerIndex];
    if (!player || amount < 500_000 || actionPointsRemaining < 1) return false;
    const currentDebt = player.loans.reduce((sum, l) => sum + l.remaining, 0);
    if (currentDebt + amount > getMaxDebt(player.creditRating, player.reputation)) {
      state.addLog(`${player.name} credit limit reached.`);
      return false;
    }
    const rate = getInterestRate(player.creditRating, player.reputation, phase);
    const loan: Loan = {
      id: `loan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      from: 'bank',
      to: player.id,
      principal: amount,
      interestRate: rate,
      remaining: amount,
    };
    set({
      players: players.map((p) => (p.id === player.id ? { ...p, cash: p.cash + amount, loans: [...p.loans, loan] } : p)),
      actionPointsRemaining: actionPointsRemaining - 1,
    });
    get().addLog(`${player.name} took $${amount.toLocaleString()} @ ${(rate * 100).toFixed(1)}%`);
    return true;
  },

  repayLoan: (loanId, amount) => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    if (!player) return false;
    const loan = player.loans.find((l) => l.id === loanId);
    if (!loan) return false;
    const repayAmount = Math.min(amount ?? loan.remaining, loan.remaining, player.cash);
    if (repayAmount <= 0) return false;
    set({
      players: state.players.map((p) => {
        if (p.id !== player.id) return p;
        const newLoans = p.loans.map((l) => (l.id === loanId ? { ...l, remaining: l.remaining - repayAmount } : l)).filter((l) => l.remaining > 0);
        return { ...p, cash: p.cash - repayAmount, loans: newLoans };
      }),
    });
    get().addLog(`${player.name} repaid $${repayAmount.toLocaleString()}.`);
    return true;
  },

  upgradeIntelligence: () => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    if (!player || state.actionPointsRemaining < 1) return false;
    if (player.intelligenceLevel >= 8) return false;
    const cost = player.intelligenceLevel * 1_200_000;
    if (player.cash < cost) { state.addLog(`Need $${cost.toLocaleString()}`); return false; }
    set({
      players: state.players.map((p) => (p.id === player.id ? { ...p, cash: p.cash - cost, intelligenceLevel: p.intelligenceLevel + 1 } : p)),
      actionPointsRemaining: state.actionPointsRemaining - 1,
    });
    get().addLog(`${player.name} upgraded Intelligence to ${player.intelligenceLevel + 1}`);
    return true;
  },

  raiseSecurity: (companyId) => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    const company = state.companies.find((c) => c.id === companyId);
    if (!player || !company || state.actionPointsRemaining < 1) return false;
    const ownership = state.getOwnershipPercent(player.id, companyId);
    if (ownership < 25 && company.controlledBy !== player.id) {
      state.addLog('Need 25% ownership or control');
      return false;
    }
    if (company.securityLevel >= 9) return false;
    const cost = 600_000 + company.securityLevel * 250_000;
    if (player.cash < cost) return false;
    set({
      companies: state.companies.map((c) => (c.id === companyId ? { ...c, securityLevel: Math.min(10, c.securityLevel + 1) } : c)),
      players: state.players.map((p) => (p.id === player.id ? { ...p, cash: p.cash - cost } : p)),
      actionPointsRemaining: state.actionPointsRemaining - 1,
    });
    get().addLog(`${player.name} raised ${company.name} security`);
    return true;
  },

  performEspionage: (companyId) => {
    const state = get();
    const { currentPlayerIndex, players, companies, actionPointsRemaining, phase } = state;
    const player = players[currentPlayerIndex];
    const company = companies.find((c) => c.id === companyId);
    if (!player || !company || actionPointsRemaining < 1) return false;
    const baseCost = 400_000 + company.securityLevel * 180_000;
    const cost = Math.round(baseCost * (1 - (player.intelligenceLevel - 1) * 0.06));
    if (player.cash < cost) { state.addLog(`Need $${cost.toLocaleString()}`); return false; }
    const cfg = getPhaseConfig(phase);
    const chance = Math.max(0.08, Math.min(0.85, 0.28 + (player.intelligenceLevel * 12 - company.securityLevel * 11) / 100 + cfg.espionageChanceMod));
    set({
      players: players.map((p) => (p.id === player.id ? { ...p, cash: p.cash - cost } : p)),
      actionPointsRemaining: actionPointsRemaining - 1,
    });
    if (Math.random() > chance) {
      if (Math.random() < 0.35 + company.securityLevel * 0.04) {
        set({ players: get().players.map((p) => (p.id === player.id ? { ...p, reputation: Math.max(0, p.reputation - 6) } : p)) });
        get().addLog(`❌ ${player.name} op DETECTED on ${company.name}`);
      } else get().addLog(`❌ ${player.name} op failed on ${company.name}`);
      return false;
    }
    const unknown = company.secrets.filter((s) => !s.leaked && !(s.discoveredBy ?? []).includes(player.id));
    if (!unknown.length) { get().addLog(`✅ No new secrets at ${company.name}`); return true; }
    const sorted = [...unknown].sort((a, b) => b.severity - a.severity);
    const pick = player.intelligenceLevel >= 4 ? sorted[0] : sorted[Math.floor(Math.random() * sorted.length)];
    set({
      companies: get().companies.map((c) =>
        c.id !== companyId
          ? c
          : { ...c, secrets: c.secrets.map((s) => (s.id === pick.id ? { ...s, discoveredBy: [...(s.discoveredBy ?? []), player.id] } : s)) }
      ),
    });
    get().addLog(`✅ ${player.name} found sev-${pick.severity} secret at ${company.name}`);
    get().addLog(`   "${pick.description}"`);
    return true;
  },

  leakSecret: (companyId, secretId) => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    const company = state.companies.find((c) => c.id === companyId);
    if (!player || !company || state.actionPointsRemaining < 1) return false;
    const secret = company.secrets.find((s) => s.id === secretId);
    if (!secret || secret.leaked || !(secret.discoveredBy ?? []).includes(player.id)) return false;
    if (player.cash < 250_000) return false;
    const priceHit = 1 - secret.severity * 0.04;
    const repHit = secret.severity * 3.5;
    const cfHit = 1 - secret.severity * 0.025;
    set({
      companies: state.companies.map((c) => {
        if (c.id !== companyId) return c;
        const newPrice = Math.max(5, Math.round(c.sharePrice * priceHit));
        return {
          ...c,
          sharePrice: newPrice,
          valuation: newPrice * c.totalShares,
          reputation: Math.max(0, c.reputation - repHit),
          cashFlow: Math.max(10, Math.round(c.cashFlow * cfHit)),
          secrets: c.secrets.map((s) => (s.id === secretId ? { ...s, leaked: true } : s)),
        };
      }),
      players: state.players.map((p) => {
        if (p.id === player.id) return { ...p, cash: p.cash - 250_000, reputation: Math.min(100, p.reputation + 3) };
        if (company.controlledBy && p.id === company.controlledBy)
          return { ...p, reputation: Math.max(0, p.reputation - Math.round(secret.severity * 1.8)) };
        return p;
      }),
      actionPointsRemaining: state.actionPointsRemaining - 1,
    });
    get().addLog(`📢 LEAK by ${player.name} on ${company.name} (sev ${secret.severity})`);
    get().recalculateControl();
    return true;
  },

  payDividends: () => {
    const { players, companies, phase } = get();
    const mult = getPhaseConfig(phase).dividendMult;
    let total = 0;
    const updated = players.map((player) => {
      let div = 0;
      for (const h of player.shares) {
        const c = companies.find((x) => x.id === h.companyId);
        if (c && c.cashFlow > 0) div += Math.floor((c.cashFlow / c.totalShares) * h.amount * mult);
      }
      if (div > 0) { total += div; get().addLog(`${player.name} +$${div.toLocaleString()} dividends`); }
      return { ...player, cash: player.cash + div };
    });
    if (total > 0) set({ players: updated });
  },

  accrueInterest: () => {
    const { players } = get();
    let any = false;
    const updated = players.map((player) => {
      if (!player.loans.length) return player;
      const newLoans = player.loans.map((loan) => {
        const interest = Math.floor(loan.remaining * loan.interestRate * 0.25);
        if (interest > 0) {
          any = true;
          get().addLog(`${player.name} interest +$${interest.toLocaleString()}`);
        }
        return { ...loan, remaining: loan.remaining + interest };
      });
      return { ...player, loans: newLoans };
    });
    if (any) set({ players: updated });
  },

  syncCreditWithReputation: () => {
    set({
      players: get().players.map((p) => {
        const target = 50 + Math.round((p.reputation - 50) * 0.4);
        const next = p.creditRating + Math.sign(target - p.creditRating);
        return { ...p, creditRating: Math.max(20, Math.min(95, next)) };
      }),
    });
  },

  advancePhaseIfNeeded: () => {
    const { phase, phaseRounds } = get();
    const cfg = getPhaseConfig(phase);
    if (phaseRounds < cfg.minRounds) {
      set({ phaseRounds: phaseRounds + 1 });
      return;
    }
    const over = phaseRounds - cfg.minRounds;
    if (over >= 3 || Math.random() < 0.4 + over * 0.15) {
      const np = nextPhase(phase);
      const ncfg = getPhaseConfig(np);
      set({ phase: np, phaseRounds: 1 });
      get().addLog(`📉 Phase → ${ncfg.label}`);
      get().addLog(`   ${ncfg.description}`);
    } else set({ phaseRounds: phaseRounds + 1 });
  },

  triggerEvent: () => {
    if (Math.random() > 0.72) {
      get().addLog('No major market event this round.');
      return;
    }
    const { phase, companies, players } = get();
    const event = pickWeightedEvent(GAME_EVENTS, phase);
    get().addLog(`⚡ EVENT: ${event.title}`);
    get().addLog(`   ${event.description}`);
    const apply = (c: Company) => {
      let n = { ...c };
      if (event.effects.sharePriceMult) {
        n.sharePrice = Math.max(5, Math.round(c.sharePrice * event.effects.sharePriceMult));
        n.valuation = n.sharePrice * n.totalShares;
      }
      if (event.effects.cashFlowMult) n.cashFlow = Math.max(10, Math.round(c.cashFlow * event.effects.cashFlowMult));
      if (event.effects.reputationDelta) n.reputation = Math.max(0, Math.min(100, c.reputation + event.effects.reputationDelta));
      if (event.effects.securityDelta) n.securityLevel = Math.max(1, Math.min(10, c.securityLevel + event.effects.securityDelta));
      return n;
    };
    let updatedCompanies = companies;
    let updatedPlayers = players;
    if (event.target === 'global') {
      updatedCompanies = companies.map(apply);
      if (event.effects.creditRatingDelta) {
        updatedPlayers = players.map((p) => ({
          ...p,
          creditRating: Math.max(20, Math.min(95, p.creditRating + (event.effects.creditRatingDelta ?? 0))),
        }));
      }
    } else if (event.target === 'sector' && event.sector) {
      updatedCompanies = companies.map((c) => (c.sector === event.sector ? apply(c) : c));
    }
    set({ companies: updatedCompanies, players: updatedPlayers });
    get().recalculateControl();
  },

  checkVictory: () => {
    const { turn, players, status } = get();
    if (status !== 'playing' || turn < 12) return;
    const scores = players.map((p) => ({ id: p.id, name: p.name, score: get().getScore(p.id) })).sort((a, b) => b.score - a.score);
    const [leader, second] = scores;
    if (turn >= 20 || (leader.score > second.score * 1.35 && turn >= 12)) {
      set({ status: 'finished', winnerId: leader.id });
      get().addLog(`🏆 ${leader.name} wins with $${(leader.score / 1e6).toFixed(1)}M score`);
    }
  },

  runBotTurn: () => {
    let guard = 0;
    while (get().actionPointsRemaining > 0 && guard < 7) {
      guard++;
      const bot = get().players[get().currentPlayerIndex];
      if (!bot?.isBot) break;
      for (const cid of bot.controlledCompanyIds) {
        const c = get().companies.find((x) => x.id === cid);
        if (c && c.securityLevel < 6 && bot.cash > 2e6 && Math.random() > 0.55 && get().raiseSecurity(cid)) continue;
      }
      if (bot.intelligenceLevel < 5 && bot.cash > 4e6 && Math.random() > 0.65 && get().upgradeIntelligence()) continue;
      if (Math.random() > 0.55) {
        for (const t of [...get().companies].sort(() => Math.random() - 0.5)) {
          const known = get().getKnownSecrets(bot.id, t.id);
          const high = known.find((s) => !s.leaked && s.severity >= 7);
          if (high && Math.random() > 0.4) { if (get().leakSecret(t.id, high.id)) break; }
          else if (Math.random() > 0.5 && get().performEspionage(t.id)) break;
        }
      }
      const scored = get().companies.map((c) => {
        const owned = get().getPlayerShares(bot.id, c.id);
        const ownership = (owned / c.totalShares) * 100;
        const valueScore = c.cashFlow / Math.max(c.sharePrice, 1);
        const controlBonus = ownership >= 30 && ownership < 50 ? 3 : ownership > 0 ? 1.4 : 1;
        return { company: c, score: valueScore * controlBonus * (0.75 + Math.random() * 0.5), owned };
      }).sort((a, b) => b.score - a.score);
      let acted = false;
      for (const { company, owned } of scored) {
        if (get().actionPointsRemaining <= 0) break;
        const qty = owned > 0 && owned < company.totalShares * 0.5 ? 50 : 10;
        if (bot.cash >= company.sharePrice * qty && get().buyShares(company.id, qty)) { acted = true; break; }
        if (bot.cash < 2.5e6 && bot.loans.length < 2 && get().takeLoan(2e6)) { acted = true; break; }
      }
      if (!acted && bot.shares.length && Math.random() > 0.7) {
        const h = bot.shares[Math.floor(Math.random() * bot.shares.length)];
        get().sellShares(h.companyId, Math.min(30, h.amount));
      } else if (!acted) break;
    }
    const bot = get().players[get().currentPlayerIndex];
    if (bot?.isBot) get().addLog(`${bot.name} finished its turn.`);
  },

  nextTurn: () => {
    const state = get();
    if (state.status === 'finished') return;
    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
    const isNewRound = nextIndex === 0;
    if (isNewRound) {
      state.accrueInterest();
      state.payDividends();
      state.syncCreditWithReputation();
      state.advancePhaseIfNeeded();
      state.triggerEvent();
      state.addLog(`=== Round ${state.turn + 1} begins ===`);
      state.checkVictory();
      if (get().status === 'finished') return;
    }
    const nextPlayer = state.players[nextIndex];
    set({ currentPlayerIndex: nextIndex, turn: isNewRound ? state.turn + 1 : state.turn, actionPointsRemaining: 3 });
    state.addLog(`--- ${nextPlayer.name}'s turn ---`);
    if (nextPlayer.isBot) {
      setTimeout(() => {
        get().runBotTurn();
        setTimeout(() => {
          const cur = get();
          if (cur.status === 'playing' && cur.players[cur.currentPlayerIndex]?.id === nextPlayer.id) get().nextTurn();
        }, 400);
      }, 240);
    }
  },
}));
