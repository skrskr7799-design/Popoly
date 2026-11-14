export function formatMoney(cents: number, compact = false): string {
  const millions = cents / 100_000_000;
  if (compact || Math.abs(millions) >= 1) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'USD', notation: 'standard',
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    }).format(millions * 1_000_000);
  }
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatMillions(cents: number): string {
  return `$${(cents / 100_000_000).toFixed(2)}m`;
}

export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatQuarter(quarter: number): string {
  const year = 2035 + Math.floor((quarter - 1) / 4);
  return `Q${((quarter - 1) % 4) + 1} · ${year}`;
}
