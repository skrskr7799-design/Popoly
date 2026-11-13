# Popoly: Tech Dominion — Design Document

**Version:** 0.4  
**Last updated:** 2026-11-13  
**Status:** Local single-player ideal pass complete — multiplayer deferred

---

## Vision

Hardcore economic strategy in near-future Big Tech (~2035).  
Rivals fight through companies, capital, reputation, and espionage.

---

## Implemented (local ideal)

### Market & control
- 8 companies / 8 sectors
- Buy/sell, dynamic prices (phase-scaled)
- Control ≥50%
- Dividends (phase × sector multipliers)

### Financing
- Bank loans; rates from credit + reputation + phase
- Debt caps; interest each round

### Economy phases
Innovation Boom → Hypergrowth → Bubble → Correction → Recovery  
Affects interest, price impact, dividends, spy odds. Soft transitions.

### Events
Weighted global/sector events; phase-biased weights.

### Espionage
Intel network, ops vs security, leaks damage price/rep/cashFlow/controller.  
Raise Security defense. Sector spy modifiers + controller bonuses.

### Sector abilities & hybrid map
Each sector has a named passive (dividends, control score, spy edge).  
Adjacency graph: controlling linked sectors adds synergy score.  
UI sector map shows abilities, links, controller.

### Bots
Personalities: Raider, Spymaster, Conservative (and Speculator data).  
Different weights for market, leverage, spy, defense, leaks, trading.

### Victory
Score = net worth + control + reputation + sector bonuses + adjacency synergy.  
From round 12; decisive lead or hard stop ~20.

---

## Explicitly deferred

- Multiplayer / authoritative server
- Player-to-player loans & deal UI
- Blockchain layer

---

## Still polishable (optional)

- Deeper positional map (spatial board beyond sector graph)
- More sector-unique active abilities
- Difficulty tiers / more bot archetypes
- UX density / accessibility
- Long-run balance pass after playtests

---

**Source of truth for design.** Update when systems change.
