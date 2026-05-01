'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  listReports, updateReport, setShopSuspended,
  type AdminReportRow, type ReportStatus,
} from '@/lib/adminApi';
import { formatDateTime } from '@/lib/format';
import {
  PageHeader, PageBody, SectionCard, ShopMark, Tab,
  Pagination, Spinner, EmptyState,
} from '../ui';
import { Button } from '@/components/ui/Button';
import { IcX } from '@/components/icons/Icons';

const PAGE_SIZE = 25;

const TABS: { id: 'all' | ReportStatus; label: string; api: string }[] = [
  { id: 'all',       label: 'All',        api: '' },
  { id: 'open',      label: 'New',        api: 'open' },
  { id: 'reviewing', label: 'Looking into',api: 'reviewing' },
  { id: 'resolved',  label: 'Resolved',   api: 'resolved' },
  { id: 'dismissed', label: 'Dismissed',  api: 'dismissed' },
];

// Plain-English labels for the underlying enum values — the design brief
// asked for "naming a normal admin can understand".
const REASON_LABELS: Record<string, string> = {
  counterfeit:   'Fake / counterfeit goods',
  scam:          'Scam — never delivered',
  inappropriate: 'Inappropriate content',
  poor_quality:  'Very poor product quality',
  harassment:    'Harassment by shop owner',
  other:         'Other',
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  open:      'New — needs review',
  reviewing: 'Looking into it',
  resolved:  'Resolved',
  dismissed: 'Dismissed',
};

const STATUS_TONE: Record<ReportStatus, string> = {
  open:      'bg-red-100 text-red-700',
  reviewing: 'bg-amber-100 text-amber-700',
  resolved:  'bg-emerald-100 text-emerald-700',
  dismissed: 'bg-stone-200 text-stone-600',
};

export default function AdminReportsPage() {
  const [tab, setTab] = useState<typeof TABS[number]['id']>('open');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminReportRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({
    open: 0, reviewing: 0, resolved: 0, dismissed: 0,
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<AdminReportRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t = TABS.find((x) => x.id === tab)!;
      const res = await listReports({ status: t.api, page, page_size: PAGE_SIZE });
      setRows(res.data.reports);
      setCounts(res.data.counts);
      setTotal(res.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <>
      <PageHeader title="Customer reports" crumbs={['Home', 'Reports']} />
      <PageBody>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <SectionCard padBody={false}>
          <div className="flex items-center border-b border-stone-200 px-4 pt-1 flex-wrap">
            {TABS.map((t) => (
              <Tab
                key={t.id}
                label={t.label}
                badge={t.id === 'all'
                  ? counts.open + counts.reviewing + counts.resolved + counts.dismissed
                  : counts[t.id] ?? 0}
                active={tab === t.id}
                onClick={() => { setTab(t.id); setPage(1); }}
              />
            ))}
          </div>

          {loading ? (
            <Spinner />
          ) : rows.length === 0 ? (
            <EmptyState message="No reports in this view." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 text-stone-500 text-left">
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Shop reported</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">What's wrong</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Reporter</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">When</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer"
                      onClick={() => setActive(r)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <ShopMark name={r.shop_name} size={28} />
                          <span className="font-medium text-stone-900">{r.shop_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <div className="font-medium text-stone-900">
                          {REASON_LABELS[r.reason] || r.reason}
                        </div>
                        <div className="text-xs text-stone-500 line-clamp-1">{r.description}</div>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {r.reporter_name || r.reporter_phone || (
                          <span className="text-stone-400 italic">Anonymous</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_TONE[r.status]
                          }`}
                        >
                          {STATUS_LABEL[r.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-stone-500">
                        {formatDateTime(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </SectionCard>

        {active && (
          <ReportDrawer
            report={active}
            onClose={() => setActive(null)}
            onChanged={async () => {
              await refresh();
              setActive(null);
            }}
          />
        )}
      </PageBody>
    </>
  );
}

// ReportDrawer is the side panel that opens when an admin clicks a report row.
// It shows the full report and lets the admin take one of three actions:
// look into it, dismiss as not actionable, or resolve (with optional shop suspension).
function ReportDrawer({
  report,
  onClose,
  onChanged,
}: {
  report: AdminReportRow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [note, setNote] = useState(report.admin_note || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = async (status: ReportStatus, options: { suspendShop?: boolean } = {}) => {
    setBusy(status);
    setError(null);
    try {
      if (options.suspendShop) {
        await setShopSuspended(report.shop_id, true);
      }
      await updateReport(report.id, { status, admin_note: note.trim() });
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-5 py-4 border-b border-stone-200 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold flex-1">Report details</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <IcX size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Shop */}
          <div className="flex items-center gap-3">
            <ShopMark name={report.shop_name} size={40} />
            <div>
              <div className="font-semibold text-stone-900">{report.shop_name}</div>
              <a
                href={`/s/${report.shop_slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-teal-600 hover:underline"
              >
                amaarshop.com/s/{report.shop_slug}
              </a>
            </div>
          </div>

          {/* Reason */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Reason
            </div>
            <div className="font-medium text-stone-900">
              {REASON_LABELS[report.reason] || report.reason}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
              What the customer said
            </div>
            <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50 border border-stone-100 rounded-md p-3">
              {report.description}
            </p>
          </div>

          {/* Reporter */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Reporter
            </div>
            {report.reporter_name || report.reporter_phone ? (
              <div className="text-sm text-stone-700">
                {report.reporter_name && <div>{report.reporter_name}</div>}
                {report.reporter_phone && (
                  <a href={`tel:${report.reporter_phone}`} className="text-teal-600 hover:underline">
                    {report.reporter_phone}
                  </a>
                )}
              </div>
            ) : (
              <div className="text-sm text-stone-400 italic">Anonymous report</div>
            )}
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1">
              Filed
            </div>
            <div className="text-sm text-stone-700">{formatDateTime(report.created_at)}</div>
          </div>

          {/* Admin note */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">
              Internal note (optional — only admins see this)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What did you find when you looked into it?"
              className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-100 resize-none"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2.5">
              {error}
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="border-t border-stone-200 sticky bottom-0 bg-white">
          <div className="px-5 py-3 grid grid-cols-1 gap-2">
            {report.status !== 'reviewing' && (
              <Button
                variant="neutral"
                disabled={!!busy}
                onClick={() => change('reviewing')}
              >
                {busy === 'reviewing' ? 'Saving…' : "I'm looking into this"}
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!!busy}
              onClick={() => change('resolved')}
            >
              {busy === 'resolved' ? 'Saving…' : 'Resolved — no further action'}
            </Button>
            <Button
              variant="danger"
              disabled={!!busy}
              onClick={() => {
                if (confirm(
                  `Suspend ${report.shop_name} and mark report as resolved? The shop's listings will be hidden until you unsuspend.`,
                )) {
                  change('resolved', { suspendShop: true });
                }
              }}
            >
              {busy === 'resolved' ? '…' : 'Suspend the shop & resolve'}
            </Button>
            <Button
              variant="ghost"
              disabled={!!busy}
              onClick={() => change('dismissed')}
            >
              {busy === 'dismissed' ? 'Saving…' : 'Dismiss — not a real issue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
