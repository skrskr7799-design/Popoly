# Popoly: Tech Dominion — Design Document

**Version:** 0.3  
**Last updated:** 2026-11-13  
**Status:** Living document — source of truth

---

## 1. Vision

Hardcore economic strategy set in near-future Big Tech (~2035).  
Players are rival tech moguls competing through companies, shares, capital, reputation, and corporate espionage.

Not a Monopoly clone. Deep calculation, high agency, friends will fight.

**Pillars:** deep economy · meaningful decisions · corporate warfare (including dirt) · hybrid victory · modern UI · multiplayer-ready architecture · optional future blockchain layer

---

## 2. Target Experience

- 2–4 players (bots now, multiplayer later)
- 60–120+ min hardcore sessions
- High skill ceiling
- "I lost because of decisions, not pure luck"

---

## 3. Implemented Systems (current build)

### Market
- 8 companies across 8 sectors
- Buy / sell shares (costs 1 AP)
- Dynamic prices (flow impact, phase-scaled)
- Control at ≥50% ownership
- Dividends from company cashFlow each new round

### Financing
- Bank loans ($1M / $2M / $5M)
- Interest depends on credit rating + reputation + economy phase
- Debt limits scale with credit + reputation
- Interest accrues each round
- Repay anytime (no AP cost currently)

### Reputation & Credit
- Player reputation affects loan rates and max debt
- Credit rating slowly drifts toward reputation
- Company reputation hit by scandals and some events
- Leaking dirt damages company + controlling player reputation

### Economy Phases
Cycle: Innovation Boom → Hypergrowth → Bubble → Correction → Recovery → …

Each phase modifies:
- Interest rate multiplier
- Price impact of buys/sells
- Dividend effectiveness
- Espionage success bias

Phases advance on a soft timer (min rounds + chance).

### Events
Weighted random events at most new rounds.  
Sector-targeted and global. Some prefer specific phases.  
Effects: share price, cashFlow, reputation, security, credit rating.

### Espionage
- Intelligence Network level (upgradeable)
- Run Op: pay cash + 1 AP, roll vs company security
- Success uncovers a secret (higher intel prefers higher severity)
- Failure can be detected → personal reputation loss
- LEAK: publish known secret → heavy price / rep / cashFlow damage; controller also hurt
- Raise Security: defend controlled or ≥25% owned companies

### Bots
- Score companies by cashFlow/price and control proximity
- Take loans when cash-constrained
- Upgrade intel, spy, leak high-severity secrets
- Raise security on controlled companies
- Auto-play their turns

### Victory (hybrid)
Score = Net Worth + control bonus + reputation bonus  
Checks from round 12. Decisive lead or hard stop around round 20.  
Winner screen with ranking.

---

## 4. Action Point Economy (current)

Default 3 AP per turn.

Costs 1 AP:
- Buy shares
- Sell shares
- Take loan
- Upgrade Intelligence
- Run Espionage Op
- Leak secret
- Raise Security

End Turn returns control to next player (bots auto-resolve).

---

## 5. Still Open / Next Design Passes

- Hybrid board / positional layer (sectors as map nodes, adjacency, influence)
- Player-to-player loans and negotiated deals UI
- Stronger bot personalities / difficulty tiers
- Economy phase UI clarity and manual transition rules if desired
- More company differentiation (unique abilities per sector)
- Multiplayer (authoritative state)
- Optional blockchain layer (mint empires, persistent reputation)

---

## 6. Technical

- Vite + React 19 + TypeScript
- Zustand store
- Tailwind CSS v4
- Data-driven events, secrets, phase config

Folder intent:
```
src/
  data/       companies, events, secrets, economy phases
  entities/   types
  store/      gameStore (rules + state)
  components/ (to be split further)
  App.tsx     shell UI
```

---

## 7. Balance Notes (v0.3)

- Starting cash: $10M
- Leak severity 1–10 scales price hit, company rep, cashFlow, controller rep
- Intel upgrade cost scales with level
- Espionage cost scales with target security; higher intel reduces cost slightly and improves odds
- Victory not checked before round 12 to allow development

Tune by playing 4-player bot games and adjusting multipliers in `economy.ts`, leak formulas, and event weights.

---

**This document is the source of truth.** Update it when systems change.
