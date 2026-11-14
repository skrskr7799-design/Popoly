import { create } from 'zustand';
import type {
  GameState,
  Player,
  Company,
  Loan,
  CompanySecret,
  EconomyPhase,
  Sector,
} from '../entities/types';
import { INITIAL_COMPANIES } from '../data/companies';
import { GAME_EVENTS, pickWeightedEvent } from '../data/events';
import { getPhaseConfig, nextPhase } from '../data/economy';
import { SECTOR_ABILITIES, adjacencySynergyScore } from '../data/sectors';
import { personalityForBotIndex } from '../data/bots';
import { tr } from '../i18n';

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
        tr('log_game_init'),
        tr('log_phase', { label: tr('phase_innovation_boom'), desc: tr('phaseDesc_innovation_boom') }),
        tr('log_systems_live'),
        tr('log_turn', { name: players[0]?.name ?? 'You' }),
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
    const { companies } = get();
    let sectorBonus = 0;
    const controlledSectors = new Set<Sector>();
    for (const cid of player.controlledCompanyIds) {
      const c = companies.find((x) => x.id === cid);
      if (!c) continue;
      controlledSectors.add(c.sector);
      sectorBonus += SECTOR_ABILITIES[c.sector].controlScoreBonus;
    }
    const synergy = adjacencySynergyScore(controlledSectors);
    return get().getNetWorth(playerId) + player.controlledCompanyIds.length * 3_000_000 + player.reputation * 40_000 + sectorBonus + synergy;
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
    if (player.cash < cost) {
      state.addLog(tr('log_need_cash', { name: player.name, cost: cost.toLocaleString() }));
      return false;
    }
    const updatedPlayers = players.map((p) => {
      if (p.id !== player.id) return p;
      const existing = p.shares.find((s) => s.companyId === companyId);
      const newShares = existing
        ? p.shares.map((s) => (s.companyId === companyId ? { ...s, amount: s.amount + amount } : s))
        : [...p.shares, { companyId, amount }];
      return { ...p, cash: p.cash - cost, shares: newShares };
    });
    const updatedCompanies = companies.map((c) =>
      c.id === companyId ? applyPriceImpact(c, amount, true, phase) : c
    );
    set({
      players: updatedPlayers,
      companies: updatedCompanies,
      actionPointsRemaining: actionPointsRemaining - 1,
    });
    get().recalculateControl();
    get().addLog(tr('log_bought', { name: player.name, amount, company: company.name }));
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
      const newShares = p.shares
        .map((s) => (s.companyId === companyId ? { ...s, amount: s.amount - amount } : s))
        .filter((s) => s.amount > 0);
      return { ...p, cash: p.cash + proceeds, shares: newShares };
    });
    const updatedCompanies = companies.map((c) =>
      c.id === companyId ? applyPriceImpact(c, amount, false, phase) : c
    );
    set({
      players: updatedPlayers,
      companies: updatedCompanies,
      actionPointsRemaining: actionPointsRemaining - 1,
    });
    get().recalculateControl();
    get().addLog(tr('log_sold', { name: player.name, amount, company: company.name }));
    return true;
  },

  takeLoan: (amount) => {
    const state = get();
    const { currentPlayerIndex, players, actionPointsRemaining, phase } = state;
    const player = players[currentPlayerIndex];
    if (!player || amount < 500_000 || actionPointsRemaining < 1) return false;
    const currentDebt = player.loans.reduce((sum, l) => sum + l.remaining, 0);
    if (currentDebt + amount > getMaxDebt(player.creditRating, player.reputation)) {
      state.addLog(tr('log_credit_limit', { name: player.name }));
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
      players: players.map((p) =>
        p.id === player.id ? { ...p, cash: p.cash + amount, loans: [...p.loans, loan] } : p
      ),
      actionPointsRemaining: actionPointsRemaining - 1,
    });
    get().addLog(
      tr('log_loan', {
        name: player.name,
        amount: amount.toLocaleString(),
        rate: (rate * 100).toFixed(1),
      })
    );
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
        const newLoans = p.loans
          .map((l) => (l.id === loanId ? { ...l, remaining: l.remaining - repayAmount } : l))
          .filter((l) => l.remaining > 0);
        return { ...p, cash: p.cash - repayAmount, loans: newLoans };
      }),
    });
    get().addLog(tr('log_repay', { name: player.name, amount: repayAmount.toLocaleString() }));
    return true;
  },

  upgradeIntelligence: () => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    if (!player || state.actionPointsRemaining < 1) return false;
    if (player.intelligenceLevel >= 8) return false;
    const cost = player.intelligenceLevel * 1_200_000;
    if (player.cash < cost) {
      state.addLog(tr('log_need', { cost: cost.toLocaleString() }));
      return false;
    }
    set({
      players: state.players.map((p) =>
        p.id === player.id
          ? { ...p, cash: p.cash - cost, intelligenceLevel: p.intelligenceLevel + 1 }
          : p
      ),
      actionPointsRemaining: state.actionPointsRemaining - 1,
    });
    get().addLog(tr('log_intel_up', { name: player.name, level: player.intelligenceLevel + 1 }));
    return true;
  },

  raiseSecurity: (companyId) => {
    const state = get();
    const player = state.players[state.currentPlayerIndex];
    const company = state.companies.find((c) => c.id === companyId);
    if (!player || !company || state.actionPointsRemaining < 1) return false;
    const ownership = state.getOwnershipPercent(player.id, companyId);
    if (ownership < 25 && company.controlledBy !== player.id) {
      state.addLog(tr('log_need_ownership'));
      return false;
    }
    if (company.securityLevel >= 9) return false;
    const cost = 600_000 + company.securityLevel * 250_000;
    if (player.cash < cost) return false;
    set({
      companies: state.companies.map((c) =>
        c.id === companyId ? { ...c, securityLevel: Math.min(10, c.securityLevel + 1) } : c
      ),
      players: state.players.map((p) =>
        p.id === player.id ? { ...p, cash: p.cash - cost } : p
      ),
      actionPointsRemaining: state.actionPointsRemaining - 1,
    });
    get().addLog(tr('log_raise_sec', { name: player.name, company: company.name }));
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
    if (player.cash < cost) {
      state.addLog(tr('log_need', { cost: cost.toLocaleString() }));
      return false;
    }
    const cfg = getPhaseConfig(phase);
    const sectorAb = SECTOR_ABILITIES[company.sector];
    let controllerSpy = 0;
    for (const cid of player.controlledCompanyIds) {
      const cc = companies.find((x) => x.id === cid);
      if (cc) controllerSpy += SECTOR_ABILITIES[cc.sector].controllerSpyBonus;
    }
    const chance = Math.max(
      0.08,
      Math.min(
        0.88,
        0.28 +
          (player.intelligenceLevel * 12 - company.securityLevel * 11) / 100 +
          cfg.espionageChanceMod +
          sectorAb.spyTargetMod +
          controllerSpy
      )
    );
    set({
      players: players.map((p) => (p.id === player.id ? { ...p, cash: p.cash - cost } : p)),
      actionPointsRemaining: actionPointsRemaining - 1,
    });
    if (Math.random() > chance) {
      if (Math.random() < 0.35 + company.securityLevel * 0.04) {
        set({
          players: get().players.map((p) =>
            p.id === player.id ? { ...p, reputation: Math.max(0, p.reputation - 6) } : p
          ),
        });
        get().addLog(tr('log_op_detected', { name: player.name, company: company.name }));
      } else {
        get().addLog(tr('log_op_fail', { name: player.name, company: company.name }));
      }
      return false;
    }
    const unknown = company.secrets.filter(
      (s) => !s.leaked && !(s.discoveredBy ?? []).includes(player.id)
    );
    if (!unknown.length) {
      get().addLog(tr('log_no_secrets', { company: company.name }));
      return true;
    }
    const sorted = [...unknown].sort((a, b) => b.severity - a.severity);
    const pick =
      player.intelligenceLevel >= 4
        ? sorted[0]
        : sorted[Math.floor(Math.random() * sorted.length)];
    set({
      companies: get().companies.map((c) =>
        c.id !== companyId
          ? c
          : {
              ...c,
              secrets: c.secrets.map((s) =>
                s.id === pick.id
                  ? { ...s, discoveredBy: [...(s.discoveredBy ?? []), player.id] }
                  : s
              ),
            }
      ),
    });
    get().addLog(
      tr('log_found_secret', {
        name: player.name,
        sev: pick.severity,
        company: company.name,
      })
    );
    get().addLog(`   "${tr(pick.description)}"`);
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
        if (p.id === player.id)
          return { ...p, cash: p.cash - 250_000, reputation: Math.min(100, p.reputation + 3) };
        if (company.controlledBy && p.id === company.controlledBy)
          return {
            ...p,
            reputation: Math.max(0, p.reputation - Math.round(secret.severity * 1.8)),
          };
        return p;
      }),
      actionPointsRemaining: state.actionPointsRemaining - 1,
    });
    get().addLog(
      tr('log_leak', { name: player.name, company: company.name, sev: secret.severity })
    );
    get().recalculateControl();
    return true;
  },

  payDividends: () => {
    const { players, companies, phase } = get();
    const phaseMult = getPhaseConfig(phase).dividendMult;
    let total = 0;
    const updated = players.map((player) => {
      let div = 0;
      for (const h of player.shares) {
        const c = companies.find((x) => x.id === h.companyId);
        if (!c || c.cashFlow <= 0) continue;
        const sectorMult = SECTOR_ABILITIES[c.sector].dividendMult;
        div += Math.floor((c.cashFlow / c.totalShares) * h.amount * phaseMult * sectorMult);
      }
      if (div > 0) {
        total += div;
        get().addLog(tr('log_dividends', { name: player.name, amount: div.toLocaleString() }));
      }
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
          get().addLog(
            tr('log_interest', { name: player.name, amount: interest.toLocaleString() })
          );
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
      set({ phase: np, phaseRounds: 1 });
      get().addLog(tr('log_phase_change', { label: tr('phase_' + np) }));
      get().addLog(`   ${tr('phaseDesc_' + np)}`);
    } else set({ phaseRounds: phaseRounds + 1 });
  },

  triggerEvent: () => {
    if (Math.random() > 0.72) {
      get().addLog(tr('log_no_event'));
      return;
    }
    const { phase, companies, players } = get();
    const event = pickWeightedEvent(GAME_EVENTS, phase);
    get().addLog(tr('log_event', { title: tr('event_' + event.id + '_title') }));
    get().addLog(`   ${tr('event_' + event.id + '_desc')}`);
    const apply = (c: Company) => {
      let n = { ...c };
      if (event.effects.sharePriceMult) {
        n.sharePrice = Math.max(5, Math.round(c.sharePrice * event.effects.sharePriceMult));
        n.valuation = n.sharePrice * n.totalShares;
      }
      if (event.effects.cashFlowMult)
        n.cashFlow = Math.max(10, Math.round(c.cashFlow * event.effects.cashFlowMult));
      if (event.effects.reputationDelta)
        n.reputation = Math.max(0, Math.min(100, c.reputation + event.effects.reputationDelta));
      if (event.effects.securityDelta)
        n.securityLevel = Math.max(1, Math.min(10, c.securityLevel + event.effects.securityDelta));
      return n;
    };
    let updatedCompanies = companies;
    let updatedPlayers = players;
    if (event.target === 'global') {
      updatedCompanies = companies.map(apply);
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
      updatedCompanies = companies.map((c) => (c.sector === event.sector ? apply(c) : c));
    }
    set({ companies: updatedCompanies, players: updatedPlayers });
    get().recalculateControl();
  },

  checkVictory: () => {
    const { turn, players, status } = get();
    if (status !== 'playing' || turn < 12) return;
    const scores = players
      .map((p) => ({ id: p.id, name: p.name, score: get().getScore(p.id) }))
      .sort((a, b) => b.score - a.score);
    const [leader, second] = scores;
    if (turn >= 20 || (leader.score > second.score * 1.35 && turn >= 12)) {
      set({ status: 'finished', winnerId: leader.id });
      get().addLog(
        tr('log_win', { name: leader.name, score: (leader.score / 1e6).toFixed(1) })
      );
    }
  },

  runBotTurn: () => {
    let guard = 0;
    const persona = personalityForBotIndex(get().currentPlayerIndex);
    while (get().actionPointsRemaining > 0 && guard < 7) {
      guard++;
      const bot = get().players[get().currentPlayerIndex];
      if (!bot?.isBot) break;
      for (const cid of bot.controlledCompanyIds) {
        const c = get().companies.find((x) => x.id === cid);
        if (
          c &&
          c.securityLevel < 6 &&
          bot.cash > 2e6 &&
          Math.random() > 0.55 / persona.defenseFocus &&
          get().raiseSecurity(cid)
        )
          continue;
      }
      if (
        bot.intelligenceLevel < 5 &&
        bot.cash > 4e6 &&
        Math.random() > 0.65 / persona.spyFocus &&
        get().upgradeIntelligence()
      )
        continue;
      if (Math.random() > 0.55 / Math.max(0.3, persona.spyFocus)) {
        for (const t of [...get().companies].sort(() => Math.random() - 0.5)) {
          const known = get().getKnownSecrets(bot.id, t.id);
          const high = known.find((s) => !s.leaked && s.severity >= 7);
          if (high && Math.random() > 0.4 / Math.max(0.3, persona.leakAggression)) {
            if (get().leakSecret(t.id, high.id)) break;
          } else if (
            Math.random() > 0.5 / Math.max(0.3, persona.spyFocus) &&
            get().performEspionage(t.id)
          )
            break;
        }
      }
      const scored = get()
        .companies.map((c) => {
          const owned = get().getPlayerShares(bot.id, c.id);
          const ownership = (owned / c.totalShares) * 100;
          const valueScore = c.cashFlow / Math.max(c.sharePrice, 1);
          const controlBonus =
            ownership >= 30 && ownership < 50 ? 3 : ownership > 0 ? 1.4 : 1;
          return {
            company: c,
            score:
              valueScore *
              controlBonus *
              persona.marketAggression *
              (0.75 + Math.random() * 0.5),
            owned,
          };
        })
        .sort((a, b) => b.score - a.score);
      let acted = false;
      for (const { company, owned } of scored) {
        if (get().actionPointsRemaining <= 0) break;
        const qty = owned > 0 && owned < company.totalShares * 0.5 ? 50 : 10;
        if (bot.cash >= company.sharePrice * qty && get().buyShares(company.id, qty)) {
          acted = true;
          break;
        }
        if (
          bot.cash < 2.5e6 &&
          bot.loans.length < 2 &&
          Math.random() < 0.45 * persona.leverageAppetite &&
          get().takeLoan(2e6)
        ) {
          acted = true;
          break;
        }
      }
      if (!acted && bot.shares.length && Math.random() > 0.7 / Math.max(0.3, persona.tradeActivity)) {
        const h = bot.shares[Math.floor(Math.random() * bot.shares.length)];
        get().sellShares(h.companyId, Math.min(30, h.amount));
      } else if (!acted) break;
    }
    const bot = get().players[get().currentPlayerIndex];
    if (bot?.isBot) get().addLog(tr('log_bot_done', { name: bot.name }));
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
      state.addLog(tr('log_round', { n: state.turn + 1 }));
      state.checkVictory();
      if (get().status === 'finished') return;
    }
    const nextPlayer = state.players[nextIndex];
    set({
      currentPlayerIndex: nextIndex,
      turn: isNewRound ? state.turn + 1 : state.turn,
      actionPointsRemaining: 3,
    });
    state.addLog(tr('log_turn', { name: nextPlayer.name }));
    if (nextPlayer.isBot) {
      setTimeout(() => {
        get().runBotTurn();
        setTimeout(() => {
          const cur = get();
          if (cur.status === 'playing' && cur.players[cur.currentPlayerIndex]?.id === nextPlayer.id)
            get().nextTurn();
        }, 400);
      }, 240);
    }
  },
}));
