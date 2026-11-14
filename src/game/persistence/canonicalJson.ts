function canonicalValue(value: unknown, seen: Set<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON does not support non-finite numbers.');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') {
    throw new TypeError(`Canonical JSON cannot encode a value of type ${typeof value}.`);
  }
  if (seen.has(value)) throw new TypeError('Canonical JSON cannot encode cyclic structures.');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalValue(item, seen)).join(',')}]`;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canonical JSON only supports plain objects and arrays.');
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => {
      if (record[key] === undefined) throw new TypeError(`Canonical JSON cannot encode undefined property "${key}".`);
      return `${JSON.stringify(key)}:${canonicalValue(record[key], seen)}`;
    }).join(',')}}`;
  } finally {
    seen.delete(value);
  }
}

/** Serializes JSON-compatible data with recursively sorted object keys. */
export function canonicalJson(value: unknown): string {
  return canonicalValue(value, new Set<object>());
}
