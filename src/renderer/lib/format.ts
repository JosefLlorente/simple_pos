import { asCents, formatMoney, parseMoney } from '../../core/money.ts';

export { parseMoney };

export function money(cents: number, symbol: string): string {
  return formatMoney(asCents(cents), symbol);
}

export function imageSrc(filename: string | null): string | null {
  return filename ? `posimg://local/${encodeURIComponent(filename)}` : null;
}

export function today(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
