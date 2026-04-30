'use client';
import { useState, type MouseEvent } from 'react';

export interface LineChartPoint {
  x: string; // raw label (e.g. ISO date)
  y: number;
}

interface Props {
  data: LineChartPoint[];
  compareData?: LineChartPoint[];
  height?: number;
  formatY: (n: number) => string;
  formatX: (s: string) => string;
  formatTooltipX?: (s: string) => string;
  color?: string;
  compareColor?: string;
  currentLabel?: string;
  compareLabel?: string;
}

// LineChart renders a labeled line chart designed for non-technical users.
// Y-axis grid + tick labels, X-axis date ticks, hover tooltip, and an
// optional dashed overlay for a comparison period.
export function LineChart({
  data,
  compareData,
  height = 220,
  formatY,
  formatX,
  formatTooltipX,
  color = '#0D9488',
  compareColor = '#A8A29E',
  currentLabel = 'Current',
  compareLabel = 'Previous',
}: Props) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 720;
  const H = height;
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 32;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  if (data.length === 0) {
    return <div className="text-sm text-stone-500 py-10 text-center">No data yet.</div>;
  }

  const allValues = [...data.map((p) => p.y), ...(compareData?.map((p) => p.y) ?? [])];
  const yMax = niceMax(Math.max(1, ...allValues));
  const yTicks = 4;

  const xPos = (i: number, len: number) => padL + (i / Math.max(1, len - 1)) * innerW;
  const yPos = (v: number) => padT + innerH - (v / yMax) * innerH;

  const linePath = (d: LineChartPoint[]) =>
    d.length ? 'M' + d.map((p, i) => `${xPos(i, d.length)},${yPos(p.y)}`).join(' L') : '';

  const fillPath = (d: LineChartPoint[]) => {
    if (d.length === 0) return '';
    const baseY = padT + innerH;
    const verts = d.map((p, i) => `${xPos(i, d.length)},${yPos(p.y)}`).join(' L');
    return `M${xPos(0, d.length)},${baseY} L${verts} L${xPos(d.length - 1, d.length)},${baseY} Z`;
  };

  const xTickIndices = pickTickIndices(data.length, 5);
  const compareSameLength = compareData && compareData.length === data.length;
  const gradientId = `linechart-grad-${color.replace('#', '')}`;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    if (px < padL || px > W - padR) {
      setHover(null);
      return;
    }
    const idx = Math.round(((px - padL) / innerW) * Math.max(1, data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  }

  const tooltipDate = hover !== null ? data[hover].x : '';
  const tooltipLeftPct = hover !== null ? (xPos(hover, data.length) / W) * 100 : 0;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {Array.from({ length: yTicks + 1 }, (_, i) => (yMax * i) / yTicks).map((v, i) => (
          <g key={`y-${i}`}>
            <line x1={padL} y1={yPos(v)} x2={W - padR} y2={yPos(v)} stroke="#F5F5F4" />
            <text
              x={padL - 8}
              y={yPos(v) + 3}
              fontSize="10"
              fill="#A8A29E"
              textAnchor="end"
            >
              {formatY(v)}
            </text>
          </g>
        ))}

        {compareData && compareData.length > 0 && (
          <path
            d={linePath(compareData)}
            fill="none"
            stroke={compareColor}
            strokeWidth="1.75"
            strokeDasharray="5 4"
          />
        )}

        <path d={fillPath(data)} fill={`url(#${gradientId})`} />
        <path d={linePath(data)} fill="none" stroke={color} strokeWidth="2" />

        {xTickIndices.map((i) => (
          <text
            key={`x-${i}`}
            x={xPos(i, data.length)}
            y={H - 10}
            fontSize="10"
            fill="#78716C"
            textAnchor="middle"
          >
            {formatX(data[i].x)}
          </text>
        ))}

        {hover !== null && (
          <>
            <line
              x1={xPos(hover, data.length)}
              y1={padT}
              x2={xPos(hover, data.length)}
              y2={padT + innerH}
              stroke="#D6D3D1"
              strokeDasharray="2 2"
            />
            {compareSameLength && compareData && (
              <circle
                cx={xPos(hover, data.length)}
                cy={yPos(compareData[hover].y)}
                r="3.5"
                fill="white"
                stroke={compareColor}
                strokeWidth="1.5"
              />
            )}
            <circle
              cx={xPos(hover, data.length)}
              cy={yPos(data[hover].y)}
              r="4.5"
              fill="white"
              stroke={color}
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {hover !== null && (
        <div
          className="absolute pointer-events-none bg-stone-900 text-white text-xs rounded-md px-2.5 py-1.5 shadow-lg whitespace-nowrap z-10"
          style={{
            left: `${tooltipLeftPct}%`,
            top: 4,
            transform: 'translate(-50%, 0)',
          }}
        >
          <div className="font-semibold">
            {formatTooltipX ? formatTooltipX(tooltipDate) : formatX(tooltipDate)}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-stone-300">{currentLabel}:</span>
            <span className="font-medium">{formatY(data[hover].y)}</span>
          </div>
          {compareSameLength && compareData && (
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: compareColor }}
              />
              <span className="text-stone-300">{compareLabel}:</span>
              <span className="font-medium">{formatY(compareData[hover].y)}</span>
              {compareTooltipDate(compareData[hover].x) && (
                <span className="text-stone-400 ml-1">
                  ({compareTooltipDate(compareData[hover].x)})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {compareData && compareData.length > 0 && (
        <div className="flex justify-end gap-4 text-[11px] text-stone-500 mt-1.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-4 h-[2px]" style={{ background: color }} />
            {currentLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-4 border-t-[2px] border-dashed"
              style={{ borderColor: compareColor }}
            />
            {compareLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function compareTooltipDate(iso: string): string | null {
  try {
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return null;
  }
}

// niceMax rounds the upper bound up to a "round" number (1, 2, 5 × 10^n)
// so axis tick labels read as 0, 250, 500, 750, 1000 instead of arbitrary
// fractional values.
function niceMax(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const mag = Math.pow(10, exp);
  const norm = n / mag;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * mag;
}

function pickTickIndices(len: number, count: number): number[] {
  if (len <= count) return Array.from({ length: len }, (_, i) => i);
  const step = (len - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * step));
}
