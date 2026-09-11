import { addMinutes, format } from 'date-fns';
import { pl } from 'date-fns/locale';

export const MONTHS_PL = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
] as const;

export const WEEKDAYS_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'] as const;

export const WEEKDAY_NAMES_PL = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
] as const;

export function mondayWeekdayIndex(date: Date): number {
  const sundayIndexed = date.getDay();
  return sundayIndexed === 0 ? 6 : sundayIndexed - 1;
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function combineDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return `${MONTHS_PL[monthIndex].toUpperCase()} ${year}`;
}

export function formatDayLong(date: string): string {
  return format(parseISODate(date), 'd MMMM yyyy', { locale: pl });
}

export function formatTimeRange(startTime: string, endTime: string | null): string {
  return endTime ? `${startTime}–${endTime}` : startTime;
}

export function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const next = new Date(year, monthIndex + delta, 1);
  return { year: next.getFullYear(), monthIndex: next.getMonth() };
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function monthRange(year: number, monthIndex: number): { start: string; end: string } {
  const last = daysInMonth(year, monthIndex);
  const month = String(monthIndex + 1).padStart(2, '0');
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(last).padStart(2, '0')}`,
  };
}

export function buildMonthGrid(year: number, monthIndex: number): (number | null)[] {
  const first = new Date(year, monthIndex, 1);
  const sundayIndexed = first.getDay();
  const mondayIndexed = sundayIndexed === 0 ? 6 : sundayIndexed - 1;
  const last = daysInMonth(year, monthIndex);
  const cells: (number | null)[] = [];

  for (let i = 0; i < mondayIndexed; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= last; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function addMinutesToTime(time: string, minutes: number): string {
  const base = combineDateTime('2000-01-01', time);
  return format(addMinutes(base, minutes), 'HH:mm');
}

export function currentSeasonWindow(from: Date = new Date()): {
  name: string;
  startDate: string;
  endDate: string;
} {
  const year = from.getFullYear();
  const month = from.getMonth() + 1;
  const startYear = month >= 8 ? year : year - 1;
  return {
    name: `Sezon ${startYear}/${startYear + 1}`,
    startDate: `${startYear}-08-01`,
    endDate: `${startYear + 1}-07-31`,
  };
}
