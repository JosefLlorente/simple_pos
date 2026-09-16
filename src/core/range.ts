import type { DateRange } from './types.ts';

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function rangePreset(
  preset: 'today' | 'week' | 'month',
  now = new Date(),
): DateRange {
  const start = startOfDay(now);
  if (preset === 'week') {
    const mondayOffset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - mondayOffset);
  }
  if (preset === 'month') start.setDate(1);
  return { from: start.toISOString(), to: endOfDay(now).toISOString() };
}

export function dayKey(isoOrDate: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  return localDay(new Date(isoOrDate));
}

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = startOfDay(new Date(from));
  const last = startOfDay(new Date(to));
  while (cursor.getTime() <= last.getTime()) {
    days.push(localDay(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}
