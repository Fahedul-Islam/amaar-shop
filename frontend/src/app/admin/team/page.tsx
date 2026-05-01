'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  listAdmins, listUsers, setUserAdmin,
  type AdminTeamMember, type AdminUserRow,
} from '@/lib/adminApi';
import { formatDate } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  PageHeader, PageBody, SectionCard, StatusBadge, Spinner, EmptyState,
} from '../ui';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IcSearch, IcPlus, IcX } from '@/components/icons/Icons';

const PERMISSIONS_INFO = [
  {
    group: 'Shops',
    items: [
      'View every shop on the platform',
      'Suspend or unsuspend a shop',
    ],
  },
  {
    group: 'Users',
    items: [
      'View every user account',
      'Promote or remove other admins',
    ],
  },
  {
    group: 'Orders & products',
    items: [
      'See orders across all shops',
      'Hide or show any product (moderation)',
    ],
  },
  {
    group: 'Reports',
    items: [
      'See marketplace insights',
      'See money & payout reports',
    ],
  },
];

export default function AdminTeamPage() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [results, setResults] = useState<AdminUserRow[]>([]);
  const [searching, setSearching] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const team = await listAdmins();
      setAdmins(team);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load admin team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearching(true);
    try {
      // Use the existing user list endpoint, restricted to non-admin matches.
      const res = await listUsers({ q: searchInput.trim(), page: 1, page_size: 10 });
      setResults(res.data.filter((u) => !u.is_admin));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const promote = async (u: AdminUserRow) => {
    if (!confirm(`Make ${u.email} an admin? They will get full access to the admin panel.`)) return;
    setBusyId(u.id);
    try {
      await setUserAdmin(u.id, true);
      setShowAdd(false);
      setSearchInput('');
      setResults([]);
      await refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to promote user');
    } finally {
      setBusyId(null);
    }
  };

  const demote = async (m: AdminTeamMember) => {
    if (!confirm(`Remove admin access from ${m.email}? They'll keep their account but lose admin privileges.`)) return;
    setBusyId(m.id);
    try {
      await setUserAdmin(m.id, false);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Action failed';
      alert(msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Admin team"
        crumbs={['Home', 'Admin team']}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <IcPlus size={14} /> Add admin
          </Button>
        }
      />
      <PageBody>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Admin members list */}
          <div className="lg:col-span-2">
            <SectionCard title="People with admin access" padBody={false}>
              {loading ? (
                <Spinner />
              ) : admins.length === 0 ? (
                <EmptyState message="No admins yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-stone-50 text-stone-500 text-left">
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Person</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Role</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider">Joined as admin</th>
                        <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((m) => {
                        const isMe = user?.id === m.id;
                        return (
                          <tr key={m.id} className="border-t border-stone-100 hover:bg-stone-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 grid place-items-center font-semibold text-xs">
                                  {m.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-stone-900 flex items-center gap-2">
                                    {m.email}
                                    {isMe && (
                                      <span className="text-[10px] uppercase tracking-wider text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                                        You
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge tone={m.is_super_admin ? 'admin' : 'owner'}>
                                {m.role}
                              </StatusBadge>
                            </td>
                            <td className="px-4 py-3 text-xs text-stone-500">
                              {formatDate(m.created_at)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {m.is_super_admin ? (
                                <span className="text-xs text-stone-400">Cannot remove</span>
                              ) : isMe ? (
                                <span className="text-xs text-stone-400">That's you</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  disabled={busyId === m.id}
                                  onClick={() => demote(m)}
                                >
                                  {busyId === m.id ? '…' : 'Remove access'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>

          {/* What admins can do */}
          <SectionCard title="What admins can do">
            <div className="text-xs text-stone-500 mb-3 leading-relaxed">
              Anyone listed here can sign in to this admin panel and use every feature below.
              Promote people carefully.
            </div>
            <div className="space-y-3">
              {PERMISSIONS_INFO.map((g) => (
                <div key={g.group}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
                    {g.group}
                  </div>
                  <ul className="text-sm text-stone-700 space-y-1">
                    {g.items.map((it) => (
                      <li key={it} className="flex items-start gap-2">
                        <span className="text-teal-600 flex-shrink-0">✓</span>
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Add-admin modal */}
        {showAdd && (
          <div
            className="fixed inset-0 bg-black/40 z-50 grid place-items-center p-4"
            onClick={() => setShowAdd(false)}
          >
            <div
              className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center px-5 py-4 border-b border-stone-200">
                <h2 className="text-base font-semibold flex-1">Add an admin</h2>
                <button
                  onClick={() => setShowAdd(false)}
                  className="text-stone-400 hover:text-stone-700"
                >
                  <IcX size={18} />
                </button>
              </div>
              <div className="p-5">
                <div className="text-sm text-stone-600 mb-4">
                  Find an existing user by email, then make them an admin. Only people who have
                  already signed up can be promoted.
                </div>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                  <div className="flex-1">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="primary" disabled={searching}>
                    <IcSearch size={14} /> {searching ? 'Searching…' : 'Search'}
                  </Button>
                </form>

                {searching ? null : results.length > 0 ? (
                  <div className="border border-stone-200 rounded-lg overflow-hidden">
                    {results.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2.5 border-b border-stone-100 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-600 grid place-items-center font-semibold text-xs">
                          {u.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-stone-900 truncate">
                            {u.email}
                          </div>
                          <div className="text-xs text-stone-500">
                            {u.is_owner ? `Shop owner: ${u.shop_name}` : 'No shop'}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={busyId === u.id}
                          onClick={() => promote(u)}
                        >
                          {busyId === u.id ? '…' : 'Make admin'}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : searchInput && !searching ? (
                  <div className="text-sm text-stone-500 text-center py-6">
                    No matching users found. The person needs to sign up first.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
