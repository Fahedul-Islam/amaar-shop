'use client';
import { useEffect, useRef, useState } from 'react';
import {
  type DateRange,
  type DateRangePreset,
  PRESET_LABELS,
  formatRangeLabel,
  getPresetRange,
} from '@/lib/dateRange';

interface Props {
  value: DateRange;
  onChange: (next: DateRange) => void;
  // Optional: pages without a comparison mode (e.g. Profit & Ads) omit both
  // and the compare toggle is hidden rather than rendered inert.
  compare?: boolean;
  onCompareChange?: (next: boolean) => void;
}

const PRESETS: DateRangePreset[] = [
  'today',
  'yesterday',
  'last7',
  'last30',
  'last90',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'custom',
];

export function DateRangePicker({ value, onChange, compare, onCompareChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate);
  const [customEnd, setCustomEnd] = useState(value.endDate);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomStart(value.startDate);
    setCustomEnd(value.endDate);
  }, [value.startDate, value.endDate]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function pickPreset(preset: DateRangePreset) {
    if (preset === 'custom') {
      onChange({ startDate: customStart, endDate: customEnd, preset: 'custom' });
      return;
    }
    const next = getPresetRange(preset);
    onChange(next);
    setOpen(false);
  }

  function applyCustom() {
    if (!customStart || !customEnd) return;
    if (customEnd < customStart) return;
    onChange({ startDate: customStart, endDate: customEnd, preset: 'custom' });
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 h-10 px-3 rounded-md border border-stone-200 bg-white text-sm text-stone-700 hover:bg-stone-50 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="font-medium">{formatRangeLabel(value)}</span>
        <span className="text-stone-400">{value.startDate} → {value.endDate}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 right-0 w-[320px] bg-white border border-stone-200 rounded-lg shadow-lg p-3">
          <div className="grid grid-cols-2 gap-1 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => pickPreset(p)}
                className={`text-left text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                  value.preset === p
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {value.preset === 'custom' && (
            <div className="border-t border-stone-100 pt-3 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-stone-500 w-10">From</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="flex-1 h-8 px-2 text-xs border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-stone-500 w-10">To</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="flex-1 h-8 px-2 text-xs border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <button
                type="button"
                onClick={applyCustom}
                className="w-full mt-1 h-8 text-xs font-medium bg-teal-600 text-white rounded-md hover:bg-teal-700"
              >
                Apply
              </button>
            </div>
          )}

          {onCompareChange && (
            <label className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100 cursor-pointer">
              <input
                type="checkbox"
                checked={!!compare}
                onChange={(e) => onCompareChange(e.target.checked)}
                className="h-3.5 w-3.5 accent-teal-600"
              />
              <span className="text-xs text-stone-700">Compare with previous period</span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
