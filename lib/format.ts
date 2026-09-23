import { WEEKDAYS_PL } from '@/lib/dates';
import type { EventType, TripDirection } from '@/lib/db/types';

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  training: 'Trening',
  match: 'Mecz',
};

export const EVENT_TYPE_EMOJI: Record<EventType, string> = {
  training: '🏐',
  match: '🏆',
};

export const TRIP_DIRECTION_LABEL: Record<TripDirection, string> = {
  outbound: 'Tam',
  return: 'Powrót',
  round_trip: 'Tam i z powrotem',
};

export function formatWeekdays(weekdays: number[]): string {
  return weekdays.map((day) => WEEKDAYS_PL[day] ?? '').filter(Boolean).join(', ');
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs === 1) return one;
  if (last >= 2 && last <= 4 && (abs < 12 || abs > 14)) return few;
  return many;
}

export function labeledCount(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}

export function formatAttendance(present: number, total: number): string {
  return `${present} / ${total}`;
}

export function formatMoney(amount: number): string {
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',');
  return `${rounded} zł`;
}

export function tripAmount(roundTripRate: number, direction: TripDirection | null): number {
  if (!roundTripRate) return 0;
  if (direction === 'outbound' || direction === 'return') return roundTripRate / 2;
  return roundTripRate;
}
