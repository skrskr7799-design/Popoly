export interface RandomState {
  /** Unsigned 32-bit PRNG state. */
  value: number;
}

/** Initializes a non-zero xorshift32 state from any integer seed. */
export function createRandomState(seed: number): RandomState {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError('Random seed must be a safe integer.');
  }
  const value = seed >>> 0;
  return { value: value === 0 ? 0x6d2b79f5 : value };
}

/** Pure xorshift32 step. Same state always produces the same result and next state. */
export function nextRandom(state: RandomState): { value: number; nextState: RandomState } {
  let x = state.value >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  const next = x >>> 0;
  return {
    value: next / 0x1_0000_0000,
    nextState: { value: next },
  };
}

export function randomInteger(
  state: RandomState,
  minInclusive: number,
  maxInclusive: number,
): { value: number; nextState: RandomState } {
  if (!Number.isInteger(minInclusive) || !Number.isInteger(maxInclusive) || maxInclusive < minInclusive) {
    throw new RangeError('Random integer bounds must be ordered integers.');
  }
  const result = nextRandom(state);
  const range = maxInclusive - minInclusive + 1;
  return {
    value: minInclusive + Math.floor(result.value * range),
    nextState: result.nextState,
  };
}
