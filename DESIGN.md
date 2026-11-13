# Popoly: Tech Dominion — Design Document

**Version:** 0.1  
**Last updated:** 2026-11-13  
**Status:** Living document — source of truth for development

---

## 1. Vision

**Popoly** is a hardcore economic strategy browser game set in the near-future Big Tech world (≈ 2032–2040).

Players are rival tech moguls competing for dominance through companies, shares, capital, reputation, and corporate espionage.

It is **not** a classic Monopoly clone.  
It is a deep, calculation-heavy game where friends will fight, scheme, and hate each other by the end of the session.

**Core pillars:**
- Deep, dynamic economy
- Meaningful player agency and calculation
- High-stakes corporate warfare (including dirty secrets)
- Hybrid victory conditions
- Beautiful, modern UI
- Architecture ready for future multiplayer + optional blockchain layer

---

## 2. Target Experience

- 2–4 players (bots for now, multiplayer later)
- Session length: 60–120+ minutes (hardcore)
- High skill ceiling
- Strong social deduction + economic pressure
- "I lost because of a bad decision, not because of pure luck"

---

## 3. Theme & Setting

**Year:** ~2035  
**World:** Hyper-connected global tech ecosystem.  
AI, compute, biotech, space infrastructure, energy, data and platforms are the new oil.

Players control tech empires.  
Companies are living entities with shares, talent, reputation, technologies and vulnerabilities.

---

## 4. Core Entities

### 4.1 Player
- Cash
- Portfolio of shares
- Owned / controlled companies
- Reputation score
- Intelligence Network level + active operations
- Credit rating / outstanding loans
- Personal modifiers (from events, scandals, achievements)

### 4.2 Company
- Type / Sector (Platform, AI & Compute, Infrastructure, Biotech, Energy, Space, Hardware, Data...)
- Share structure (total shares, free float, controlled by whom)
- Development level / Tech tree progress
- Current valuation
- Cash flow / Dividend policy
- Security level (affects espionage difficulty)
- Reputation / Public trust
- Special abilities / Technologies unlocked
- Hidden secrets (can be discovered via high-level espionage)

### 4.3 Shares
- Fungible within a company
- Price is dynamic
- Ownership % determines control and voting power
- Dividends

### 4.4 Economy State
Global phases that shift the entire game:
1. Innovation Boom
2. Hypergrowth
3. Bubble
4. Correction / Crash
5. Recovery

Affects: interest rates, valuations, building costs, talent availability, espionage effectiveness, event probabilities.

---

## 5. Key Systems

### 5.1 Hybrid Board / Structure
Not a classic ring.  
More open / sector-based hybrid system that supports deep strategy while keeping spatial/positional tension.

(Exact topology to be refined in next design pass)

### 5.2 Actions & Turn Structure
Players have limited **Action Points / Attention** per turn.  
Most power comes from economic and intelligence decisions, not pure movement luck.

Possible action categories:
- Corporate development
- Market operations (buy/sell shares, IPO, secondary offerings)
- Financing (loans, bonds, player-to-player credit)
- Intelligence operations
- Diplomacy / deals
- Defensive actions

### 5.3 Espionage & Counter-Espionage
High investment → high reward.

Can uncover:
- Corporate secrets
- Personal scandals of key figures (CEO affairs, conflicts of interest, hidden connections to rivals, etc.)
- Technology leaks
- Upcoming moves

Successful deep ops can:
- Crash stock price
- Destroy reputation
- Cause talent flight
- Trigger regulatory attention
- Break partnerships

Failed or detected ops can backfire heavily.

Security level of a company strongly affects cost and success chance.

### 5.4 Reputation System
Affects:
- Cost and availability of credit
- Willingness of other players to deal
- Talent retention
- Event outcomes
- Share price resilience

Scandals, successful products, ethical choices, and public perception all matter.

### 5.5 Financing
- Bank / Central Reserve loans (dynamic interest)
- Player-to-player loans & convertible notes
- Corporate bonds
- Credit rating system

### 5.6 Victory Conditions (Hybrid)
Multiple paths, scored together:
- Survival / last empire standing
- Final net worth + influence
- Control of key strategic technologies / sectors
- Achievement of major milestones (e.g. first AGI-related breakthrough under your control)

Exact scoring formula will be balanced later.

---

## 6. Blockchain Integration (Optional Layer)

**Principle:** Core game is 100% playable and complete **off-chain**.

Optional on-chain features (future):
- Minting of significant companies / empires / legendary technologies as NFTs or tokens
- Persistent on-chain reputation and achievements
- Secondary market for rare assets between sessions
- Special "Decentralized League" mode
- Transparent major corporate actions (optional)

This fits the Big Tech near-future theme without forcing crypto UX on every player.

---

## 7. Technical Architecture

### Stack
- **Vite + React 19 + TypeScript**
- **Zustand** — game state
- **Tailwind CSS** + custom design system
- **Framer Motion** — animations
- **lucide-react** — icons

### Principles
- Strong typing for all game entities
- Pure game logic separated from UI
- Easy to add bots
- Architecture prepared for multiplayer (authoritative state later)
- Clean separation for future blockchain adapter

### Folder Structure (target)
```
src/
  core/           # Pure game logic, rules, economy simulation
  entities/       # Types & factories for Player, Company, etc.
  systems/        # Espionage, Market, Reputation, Economy phases...
  store/          # Zustand stores
  components/     # UI
  hooks/
  data/           # Static data (sectors, events, technologies...)
  utils/
  App.tsx
```

---

## 8. Development Phases

**Phase 0** (current): Project setup + this design document  
**Phase 1**: Core data models + basic turn loop + simple UI shell  
**Phase 2**: Companies, shares, basic market  
**Phase 3**: Economy phases + financing  
**Phase 4**: Espionage system  
**Phase 5**: Reputation + events  
**Phase 6**: Bots  
**Phase 7**: Polish, balance, hybrid board visualization  
**Phase 8**: Multiplayer foundation  
**Phase 9**: Optional blockchain layer

---

## 9. Open Questions / Next Design Pass

- Exact topology of the hybrid board/map
- Detailed Action Point economy
- Concrete list of company sectors and their unique mechanics
- Balancing formulas for share price, interest rates, espionage success
- How personal scandals mechanically resolve
- Exact hybrid victory scoring

---

**This document is the source of truth.**  
All major design decisions should be reflected here before implementation.
