'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { IcDownload } from '@/components/icons/Icons';
import {
  type DateRange,
  type DateRangePreset,
  PRESET_LABELS,
  formatRangeLabel,
  getPresetRange,
} from '@/lib/dateRange';
import { getAccessToken } from '@/lib/api';

interface Props {
  // Path on the API. The component appends ?from=YYYY-MM-DD&to=YYYY-MM-DD
  // (preserving any existing query string).
  endpoint: string;
  // Filename hint (without extension) used when the response doesn't carry
  // a Content-Disposition (most browsers will use the server's filename).
  filename: string;
  // Button text label.
  label?: string;
  // Optional extra query params merged onto the request.
  extraParams?: Record<string, string>;
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

export function ReportDownloadButton({ endpoint, filename, label = 'Download report', extraParams }: Props) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange>(() => getPresetRange('last30'));
  const [customStart, setCustomStart] = useState(range.startDate);
  const [customEnd, setCustomEnd] = useState(range.endDate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomStart(range.startDate);
    setCustomEnd(range.endDate);
  }, [range.startDate, range.endDate]);

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
      setRange({ startDate: customStart, endDate: customEnd, preset: 'custom' });
      return;
    }
    setRange(getPresetRange(preset));
  }

  async function download() {
    setBusy(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      params.set('from', range.startDate);
      params.set('to', range.endDate);
      for (const [k, v] of Object.entries(extraParams ?? {})) {
        if (v) params.set(k, v);
      }
      const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}${params.toString()}`;

      const token = getAccessToken();
      const res = await fetch(url, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Download failed (${res.status})`);
      }
      const blob = await res.blob();

      // Try to honor Content-Disposition; otherwise use our hint.
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="?([^"]+)"?/);
      const downloadName = m?.[1] || `${filename}-${range.startDate}-${range.endDate}.pdf`;

      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <Button variant="neutral" onClick={() => setOpen((o) => !o)}>
        <IcDownload size={14} /> {label}
      </Button>
      {open && (
        <div className="absolute z-30 mt-2 right-0 w-[320px] bg-white border border-stone-200 rounded-lg shadow-lg p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-500 mb-2">
            Report period
          </div>
          <div className="grid grid-cols-2 gap-1 mb-3">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => pickPreset(p)}
                className={`text-left text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                  range.preset === p
                    ? 'bg-teal-50 text-teal-700 font-medium'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {range.preset === 'custom' && (
            <div className="border-t border-stone-100 pt-3 space-y-2 mb-3">
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
                onClick={() => {
                  if (!customStart || !customEnd || customEnd < customStart) return;
                  setRange({ startDate: customStart, endDate: customEnd, preset: 'custom' });
                }}
                className="w-full h-8 text-xs font-medium bg-stone-100 text-stone-700 rounded-md hover:bg-stone-200"
              >
                Apply custom range
              </button>
            </div>
          )}

          <div className="border-t border-stone-100 pt-3">
            <div className="text-[11px] text-stone-500 mb-1">Selected</div>
            <div className="text-xs font-medium text-stone-800 mb-3">
              {formatRangeLabel(range)} <span className="text-stone-400">({range.startDate} → {range.endDate})</span>
            </div>

            {err && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-md p-2 mb-2">
                {err}
              </div>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={download}
              className="w-full h-9 text-sm font-medium bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:bg-teal-400"
            >
              {busy ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
