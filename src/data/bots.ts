export type BotArchetype = 'raider' | 'spymaster' | 'conservative' | 'speculator';

export interface BotPersonality {
  id: BotArchetype;
  label: string;
  /** Weight for market aggression (buying / control pushes) */
  marketAggression: number;
  /** Weight for taking loans */
  leverageAppetite: number;
  /** Weight for intel upgrades and ops */
  spyFocus: number;
  /** Weight for raising security on controlled firms */
  defenseFocus: number;
  /** Weight for leaking when possible */
  leakAggression: number;
  /** Prefer selling / rotating */
  tradeActivity: number;
}

export const BOT_PERSONALITIES: Record<BotArchetype, BotPersonality> = {
  raider: {
    id: 'raider',
    label: 'Raider',
    marketAggression: 1.35,
    leverageAppetite: 1.25,
    spyFocus: 0.7,
    defenseFocus: 0.6,
    leakAggression: 0.9,
    tradeActivity: 0.7,
  },
  spymaster: {
    id: 'spymaster',
    label: 'Spymaster',
    marketAggression: 0.85,
    leverageAppetite: 0.7,
    spyFocus: 1.45,
    defenseFocus: 0.9,
    leakAggression: 1.4,
    tradeActivity: 0.5,
  },
  conservative: {
    id: 'conservative',
    label: 'Conservative',
    marketAggression: 0.75,
    leverageAppetite: 0.35,
    spyFocus: 0.55,
    defenseFocus: 1.4,
    leakAggression: 0.4,
    tradeActivity: 0.35,
  },
  speculator: {
    id: 'speculator',
    label: 'Speculator',
    marketAggression: 1.1,
    leverageAppetite: 1.1,
    spyFocus: 0.8,
    defenseFocus: 0.5,
    leakAggression: 0.85,
    tradeActivity: 1.35,
  },
};

const ORDER: BotArchetype[] = ['raider', 'spymaster', 'conservative', 'speculator'];

export function personalityForBotIndex(index: number): BotPersonality {
  // index 0 is usually human; bots start at 1
  const botOrdinal = Math.max(0, index - 1);
  return BOT_PERSONALITIES[ORDER[botOrdinal % ORDER.length]];
}
