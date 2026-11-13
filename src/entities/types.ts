/**
 * Core game entity types for Popoly: Tech Dominion
 * This is the source of truth for data shapes.
 */

export type Sector =
  | 'platform'
  | 'ai_compute'
  | 'infrastructure'
  | 'biotech'
  | 'energy'
  | 'space'
  | 'hardware'
  | 'data';

export type EconomyPhase =
  | 'innovation_boom'
  | 'hypergrowth'
  | 'bubble'
  | 'correction'
  | 'recovery';

export interface ShareHolding {
  companyId: string;
  amount: number;
}

export interface Loan {
  id: string;
  from: string; // 'bank' or playerId
  to: string;   // playerId
  principal: number;
  interestRate: number;
  remaining: number;
  dueTurn?: number;
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  cash: number;
  shares: ShareHolding[];
  controlledCompanyIds: string[];
  reputation: number;
  intelligenceLevel: number;
  creditRating: number;
  loans: Loan[];
  modifiers: Record<string, number>;
}

export interface CompanySecret {
  id: string;
  type: 'scandal' | 'tech' | 'financial' | 'personal' | 'other';
  severity: number; // 1-10
  description: string;
  discoveredBy?: string[];
  leaked: boolean;
}

export interface Company {
  id: string;
  name: string;
  sector: Sector;
  totalShares: number;
  sharePrice: number;
  valuation: number;
  developmentLevel: number;
  securityLevel: number;
  reputation: number;
  cashFlow: number;
  controlledBy: string | null;
  secrets: CompanySecret[];
  technologies: string[];
}

export interface GameState {
  turn: number;
  phase: EconomyPhase;
  players: Player[];
  companies: Company[];
  currentPlayerIndex: number;
  actionPointsRemaining: number;
  log: string[];
  status: 'setup' | 'playing' | 'finished';
}
