import type { MoneyCents } from './types';

const MAX_SAFE_CENTS = Number.MAX_SAFE_INTEGER;

export function moneyFromCents(value: number): MoneyCents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError('Money must be a safe integer number of cents.');
  }
  return value as MoneyCents;
}

export function moneyFromDollars(value: number): MoneyCents {
  if (!Number.isFinite(value)) {
    throw new RangeError('Dollar amount must be finite.');
  }
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_SAFE_CENTS) {
    throw new RangeError('Dollar amount exceeds the safe integer range.');
  }
  return moneyFromCents(cents);
}

export function addMoney(...values: MoneyCents[]): MoneyCents {
  const total = values.reduce((sum, value) => sum + value, 0);
  return moneyFromCents(total);
}

export function multiplyMoney(amount: MoneyCents, multiplier: number): MoneyCents {
  if (!Number.isFinite(multiplier)) {
    throw new RangeError('Money multiplier must be finite.');
  }
  return moneyFromCents(Math.round(amount * multiplier));
}

export function formatMoney(amount: MoneyCents): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount / 100);
}
