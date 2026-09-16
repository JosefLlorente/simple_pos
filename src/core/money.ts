/** Money is integer cents everywhere past the form field. */

export function parseMoney(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Amount is required');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error('Enter a valid amount like 12.50');
  }
  const [whole, frac = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export function asCents(value: unknown, fallback = 0): number {
  if (typeof value === 'bigint') value = Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (Number.isInteger(rounded)) return rounded;
  }
  return fallback;
}

export function formatMoney(cents: number, symbol = '$'): string {
  if (!Number.isInteger(cents)) throw new Error('Amount must be integer cents');
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${symbol}${(abs / 100).toFixed(2)}`;
}

export function lineTotal(priceCents: number, qty: number): number {
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    throw new Error('Invalid price');
  }
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Invalid quantity');
  return priceCents * qty;
}

export function cartTotal(lines: { price: number; qty: number }[]): number {
  return lines.reduce((sum, line) => sum + lineTotal(line.price, line.qty), 0);
}

export function nextStock(stock: number, qty: number): number {
  if (!Number.isInteger(stock) || stock < 0) throw new Error('Invalid stock');
  if (!Number.isInteger(qty) || qty <= 0) throw new Error('Invalid quantity');
  if (qty > stock) throw new Error('Insufficient stock');
  return stock - qty;
}

export function changeDue(total: number, paid: number): number {
  if (!Number.isInteger(total) || total < 0) throw new Error('Invalid total');
  if (!Number.isInteger(paid) || paid < 0) throw new Error('Invalid amount paid');
  if (paid < total) throw new Error('Amount paid is less than total');
  return paid - total;
}
