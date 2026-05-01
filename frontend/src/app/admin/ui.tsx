'use client';
import type { ReactNode } from 'react';

// PageHeader is the title + breadcrumb strip used at the top of every admin page.
export function PageHeader({
  title,
  crumbs,
  actions,
}: {
  title: string;
  crumbs?: string[];
  actions?: ReactNode;
}) {
  return (
    <div className="border-b border-stone-200 bg-white sticky top-0 z-10">
      <div className="px-6 md:px-8 py-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          {crumbs && crumbs.length > 0 && (
            <div className="text-xs text-stone-500 flex gap-1.5 items-center mb-0.5">
              {crumbs.map((c, i) => (
                <span key={i} className={i === crumbs.length - 1 ? 'text-stone-900' : ''}>
                  {c}
                  {i < crumbs.length - 1 && <span className="ml-1.5 text-stone-300">›</span>}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </div>
        {actions}
      </div>
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="px-6 md:px-8 py-6">{children}</div>;
}

export function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 relative overflow-hidden">
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent }} />
      )}
      <div className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight text-stone-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-stone-500 mt-1">{sub}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  padBody = true,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  padBody?: boolean;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      {(title || action) && (
        <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-3">
          {title && <h2 className="text-sm font-semibold text-stone-900">{title}</h2>}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className={padBody ? 'p-4' : ''}>{children}</div>
    </div>
  );
}

const TONES: Record<string, string> = {
  active:    'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped:   'bg-indigo-100 text-indigo-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-stone-200 text-stone-600',
  suspended: 'bg-red-100 text-red-700',
  hidden:    'bg-stone-200 text-stone-600',
  live:      'bg-emerald-100 text-emerald-700',
  inactive:  'bg-stone-200 text-stone-600',
  admin:     'bg-purple-100 text-purple-700',
  owner:     'bg-teal-100 text-teal-700',
  customer:  'bg-stone-100 text-stone-600',
};

export function StatusBadge({ tone, children }: { tone: string; children: ReactNode }) {
  const cls = TONES[tone] || 'bg-stone-100 text-stone-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

export function ShopMark({ name, size = 32 }: { name: string; size?: number }) {
  // Hue derived deterministically from the name so each shop has a stable color.
  const hue = Array.from(name).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: `linear-gradient(135deg, hsl(${hue}, 38%, 88%), hsl(${hue}, 30%, 78%))`,
        color: `hsl(${hue}, 42%, 28%)`,
        fontSize: size * 0.42,
      }}
      className="grid place-items-center font-bold flex-shrink-0"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function Tab({
  label,
  active,
  onClick,
  badge,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-9 px-1 mr-5 border-b-2 text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
        active
          ? 'border-teal-600 text-stone-900'
          : 'border-transparent text-stone-500 hover:text-stone-900'
      }`}
    >
      {label}
      {typeof badge === 'number' && (
        <span className="bg-stone-100 text-stone-600 text-[11px] px-1.5 py-0.5 rounded-full font-medium">
          {badge.toLocaleString('en-US')}
        </span>
      )}
    </button>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200 text-sm text-stone-500">
      <span>
        Showing {start}–{end} of {total.toLocaleString('en-US')}
      </span>
      <div className="flex gap-1.5">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-3 h-7 border border-stone-200 rounded-md text-xs hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          disabled={page >= lastPage}
          onClick={() => onPage(page + 1)}
          className="px-3 h-7 border border-stone-200 rounded-md text-xs hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center text-sm text-stone-500 py-12">{message}</div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600" />
    </div>
  );
}
