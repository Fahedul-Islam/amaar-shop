'use client';
import { useEffect, useState } from 'react';
import {
  getFeeRule, updateFeeRule, FEE_RULE_TYPE_OPTIONS, humanLabelFeeRule,
  type FeeRule, type FeeRuleType,
} from '@/lib/billingApi';
import { formatDate } from '@/lib/format';
import { PageHeader, PageBody, SectionCard, Spinner } from '../../ui';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function AdminFeeRulePage() {
  const [rule, setRule] = useState<FeeRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit-state — separate so the user can change values without committing.
  const [type, setType] = useState<FeeRuleType>('percentage');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getFeeRule()
      .then((r) => {
        setRule(r);
        setType(r.rule_type);
        // Show a sensible cleaned value (strip "5.0000" -> "5"). The numeric
        // input still accepts decimals.
        setValue(r.value.replace(/\.?0+$/, ''));
        setDescription(r.description || '');
      })
      .catch((e) => setError(e?.message || 'Failed to load fee rule'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await updateFeeRule({ rule_type: type, value, description });
      setRule(r);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Platform fee rule" crumbs={['Home', 'Settings', 'Fee rule']} />
      <PageBody>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        <div className="bg-teal-50 border border-teal-200 text-teal-900 text-sm rounded-md p-3 mb-4 leading-relaxed">
          <strong>How this works:</strong> Shops collect cash from buyers (COD). Every {' '}
          <strong>14 days</strong> they owe AmaarShop a platform fee. Choose how the fee is
          calculated below — your change applies <strong>immediately</strong> to all unbilled
          orders. Past payments are not affected.
        </div>

        {loading || !rule ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Current rule */}
            <SectionCard title="Current rule">
              <div className="text-2xl font-bold tracking-tight text-stone-900">
                {humanLabelFeeRule(rule)}
              </div>
              <div className="text-xs text-stone-500 mt-1">
                Last changed {formatDate(rule.updated_at)}
              </div>
              {rule.description && (
                <p className="text-sm text-stone-700 mt-3 bg-stone-50 border border-stone-100 p-3 rounded-md">
                  {rule.description}
                </p>
              )}
            </SectionCard>

            {/* Editor */}
            <div className="lg:col-span-2">
              <SectionCard title="Change rule">
                <form onSubmit={submit} className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      How is the fee calculated?
                    </label>
                    <div className="grid gap-2">
                      {FEE_RULE_TYPE_OPTIONS.map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            type === opt.id
                              ? 'border-teal-600 bg-teal-50'
                              : 'border-stone-200 bg-white hover:border-stone-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="rule_type"
                            value={opt.id}
                            checked={type === opt.id}
                            onChange={() => setType(opt.id)}
                            className="mt-1 accent-teal-600"
                          />
                          <div>
                            <div className="font-medium text-stone-900 text-sm">{opt.label}</div>
                            <div className="text-xs text-stone-500 mt-0.5">{opt.help}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Input
                    label={
                      type === 'percentage'
                        ? 'Percentage (e.g. 5 = 5%)'
                        : 'Amount in BDT per order (e.g. 10)'
                    }
                    type="number"
                    inputMode="decimal"
                    step="0.0001"
                    min="0"
                    max={type === 'percentage' ? 100 : undefined}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1.5">
                      Description (optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="e.g. Standard platform fee"
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:border-teal-500 focus:ring-teal-100 resize-none"
                    />
                  </div>

                  {/* Live preview */}
                  <div className="text-sm bg-stone-50 border border-stone-100 rounded-md p-3">
                    <span className="text-stone-500">Sellers will see:</span>{' '}
                    <strong>
                      {humanLabelFeeRule({
                        rule_type: type,
                        value: value || '0',
                        updated_at: rule.updated_at,
                      })}
                    </strong>
                  </div>

                  {saved && (
                    <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2.5">
                      Saved. New rule applies to all unbilled orders.
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button type="submit" variant="primary" disabled={saving}>
                      {saving ? 'Saving…' : 'Save rule'}
                    </Button>
                  </div>
                </form>
              </SectionCard>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
