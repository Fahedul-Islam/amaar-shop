export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'last90'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  preset: DateRangePreset;
}

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7: 'Last 7 days',
  last30: 'Last 30 days',
  last90: 'Last 90 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  thisYear: 'This year',
  custom: 'Custom range',
};

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getPresetRange(preset: DateRangePreset, today: Date = new Date()): DateRange {
  const t = startOfDay(today);
  switch (preset) {
    case 'today':
      return { startDate: toIso(t), endDate: toIso(t), preset };
    case 'yesterday': {
      const y = new Date(t);
      y.setDate(y.getDate() - 1);
      return { startDate: toIso(y), endDate: toIso(y), preset };
    }
    case 'last7': {
      const start = new Date(t);
      start.setDate(start.getDate() - 6);
      return { startDate: toIso(start), endDate: toIso(t), preset };
    }
    case 'last30': {
      const start = new Date(t);
      start.setDate(start.getDate() - 29);
      return { startDate: toIso(start), endDate: toIso(t), preset };
    }
    case 'last90': {
      const start = new Date(t);
      start.setDate(start.getDate() - 89);
      return { startDate: toIso(start), endDate: toIso(t), preset };
    }
    case 'thisMonth': {
      const start = new Date(t.getFullYear(), t.getMonth(), 1);
      return { startDate: toIso(start), endDate: toIso(t), preset };
    }
    case 'lastMonth': {
      const start = new Date(t.getFullYear(), t.getMonth() - 1, 1);
      const end = new Date(t.getFullYear(), t.getMonth(), 0);
      return { startDate: toIso(start), endDate: toIso(end), preset };
    }
    case 'thisYear': {
      const start = new Date(t.getFullYear(), 0, 1);
      return { startDate: toIso(start), endDate: toIso(t), preset };
    }
    case 'custom':
    default:
      return { startDate: toIso(t), endDate: toIso(t), preset: 'custom' };
  }
}

// getPreviousPeriod returns the equivalent prior window — same length, ending
// the day before startDate. e.g. last 30 days → the 30 days before that.
export function getPreviousPeriod(range: { startDate: string; endDate: string }): { startDate: string; endDate: string } {
  const start = new Date(range.startDate + 'T00:00:00');
  const end = new Date(range.endDate + 'T00:00:00');
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (days - 1));

  return { startDate: toIso(prevStart), endDate: toIso(prevEnd) };
}

export function formatRangeLabel(range: DateRange): string {
  if (range.preset !== 'custom') return PRESET_LABELS[range.preset];
  return `${range.startDate} → ${range.endDate}`;
}

export function daysInRange(range: { startDate: string; endDate: string }): number {
  const start = new Date(range.startDate + 'T00:00:00');
  const end = new Date(range.endDate + 'T00:00:00');
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}
