import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DataTable from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Trash2, Plus } from 'lucide-react';
import { useExchangeRates, useUpsertExchangeRate, useDeleteExchangeRate } from '@/hooks/useExchangeRates';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import MissingFieldsHint from '@/components/common/MissingFieldsHint';

// New page supporting the Season page's currency-converted "Amount of
// Purchase" card (see useSeasonPurchases.js). XOF is deliberately not
// enterable here at all -- XOF-to-XOF is always rate 1, handled
// directly in code -- closing the exact gap the source Power BI
// document flags in its own manually-maintained version (XOF rows
// missing, silently dropping transactions from the total).
const CURRENCIES = ['USD', 'NGN', 'GHS', 'SLL'];
const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EMPTY_FORM = { currency: '', year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1), rate_to_xof: '' };

export default function ExchangeRates() {
  const { t } = useTranslation();
  usePageTitle(t('exchangeRates.title'));
  const { toast } = useToast();
  const { canDelete } = usePermissions();
  const { data: rates = [], isLoading, isError, refetch } = useExchangeRates();
  const upsertRate = useUpsertExchangeRate();
  const deleteRate = useDeleteExchangeRate();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  // Defaults to the first currency that actually has at least one real
  // rate recorded, rather than always defaulting to USD regardless of
  // whether any USD rate has ever been entered -- avoids opening the
  // page onto an empty chart when a different currency is the one
  // actually in use.
  const [chartCurrency, setChartCurrency] = useState(null);
  const effectiveChartCurrency = chartCurrency || rates.find((r) => CURRENCIES.includes(r.currency))?.currency || CURRENCIES[0];

  // Real month-to-month trend for the selected currency, in real
  // chronological order (the table above sorts newest-first, which
  // would read backwards on a trend line). Fills the full range between
  // the earliest and latest recorded month with null for any month that
  // has no real rate on file, rather than only plotting the months that
  // exist -- recharts leaves a real, visible gap in the line for a null
  // point instead of silently connecting straight across a missing
  // month as if the rate had moved smoothly between two dates that
  // are actually several months apart.
  const chartData = useMemo(() => {
    const currencyRates = rates.filter((r) => r.currency === effectiveChartCurrency);
    if (currencyRates.length === 0) return [];
    const byKey = new Map(currencyRates.map((r) => [`${r.year}-${r.month}`, Number(r.rate_to_xof)]));
    const sorted = [...currencyRates].sort((a, b) => (a.year - b.year) || (a.month - b.month));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const points = [];
    let y = first.year;
    let m = first.month;
    while (y < last.year || (y === last.year && m <= last.month)) {
      points.push({ label: `${SHORT_MONTHS[m - 1]} ${y}`, rate: byKey.get(`${y}-${m}`) ?? null });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return points;
  }, [rates, effectiveChartCurrency]);

  const missingFields = [
    !form.currency && t('exchangeRates.currency'),
    !form.rate_to_xof && t('exchangeRates.rate'),
  ].filter(Boolean);
  const valid = form.currency && form.year && form.month && form.rate_to_xof && Number(form.rate_to_xof) > 0;

  const handleSave = async () => {
    try {
      await upsertRate.mutateAsync({
        currency: form.currency,
        year: Number(form.year),
        month: Number(form.month),
        rate_to_xof: Number(form.rate_to_xof),
      });
      toast({ title: t('exchangeRates.saved') });
      setFormOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast({ title: t('exchangeRates.saveFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    const id = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteRate.mutateAsync(id);
      toast({ title: t('exchangeRates.deleteSuccess') });
    } catch (err) {
      toast({ title: t('exchangeRates.deleteFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'currency', label: t('exchangeRates.currency') },
    { key: 'year', label: t('exchangeRates.year') },
    { key: 'month', label: t('exchangeRates.month'), render: (row) => MONTHS.find((m) => m.value === row.month)?.label || row.month },
    { key: 'rate_to_xof', label: t('exchangeRates.rateToXof'), render: (row) => Number(row.rate_to_xof).toLocaleString() },
    ...(canDelete ? [{
      key: 'actions',
      label: '',
      render: (row) => (
        <Button type="button" variant="ghost" size="sm" data-testid={`exchange-rate-delete-${row.id}`} onClick={() => setDeleteTarget(row)} className="text-[#ba550c]">
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    }] : []),
  ];

  return (
    <AppLayout hideDefaultHeader>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-black text-[#0f48aa]">{t('exchangeRates.title')}</h1>
          <p className="text-sm text-[#5a6f9a] mt-1">{t('exchangeRates.description')}</p>
        </div>
        <Button type="button" data-testid="exchange-rate-add" onClick={() => { setForm(EMPTY_FORM); setFormOpen(true); }} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
          <Plus className="h-4 w-4 mr-1" /> {t('exchangeRates.addRate')}
        </Button>
      </div>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-4 mb-4" data-testid="exchange-rate-trend-card">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-[#032b71]">{t('exchangeRates.trendTitle')}</h3>
          <Select value={effectiveChartCurrency} onValueChange={setChartCurrency}>
            <SelectTrigger className="w-[140px]" data-testid="exchange-rate-trend-currency"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[220px] text-sm text-[#5a6f9a]" data-testid="exchange-rate-trend-empty">
            {t('exchangeRates.trendEmpty')}
          </div>
        ) : (
          <div role="img" aria-label={t('exchangeRates.trendTitle')}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                <YAxis tick={{ fontSize: 12, fill: '#5a6f9a' }} domain={['auto', 'auto']} />
                <Tooltip formatter={(v) => (v == null ? t('exchangeRates.trendEmpty') : Number(v).toLocaleString())} />
                <Line type="monotone" dataKey="rate" name={t('exchangeRates.rateToXof')} stroke="#0f48aa" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <DataTable
        testId="exchange-rates-table"
        columns={columns}
        rows={rates}
        total={rates.length}
        page={1}
        pageSize={Math.max(rates.length, 1)}
        loading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyMessage={t('exchangeRates.empty')}
      />

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0f48aa]">{t('exchangeRates.addRate')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exrate-currency" className="text-[#5a6f9a]">{t('exchangeRates.currency')}</Label>
              <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                <SelectTrigger id="exrate-currency" data-testid="exrate-currency"><SelectValue placeholder={t('exchangeRates.selectCurrency')} /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exrate-year" className="text-[#5a6f9a]">{t('exchangeRates.year')}</Label>
              <Input id="exrate-year" type="number" data-testid="exrate-year" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exrate-month" className="text-[#5a6f9a]">{t('exchangeRates.month')}</Label>
              <Select value={form.month} onValueChange={(v) => setForm((f) => ({ ...f, month: v }))}>
                <SelectTrigger id="exrate-month" data-testid="exrate-month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="exrate-rate" className="text-[#5a6f9a]">{t('exchangeRates.rateToXof')}</Label>
              <Input id="exrate-rate" type="number" step="0.0001" data-testid="exrate-rate" value={form.rate_to_xof} onChange={(e) => setForm((f) => ({ ...f, rate_to_xof: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <div className="flex flex-col items-end gap-1">
              <Button type="button" data-testid="exrate-submit" disabled={!valid || upsertRate.isPending} onClick={handleSave} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
                {upsertRate.isPending ? t('forms.saving') : t('common.save')}
              </Button>
              <MissingFieldsHint missingFields={missingFields} testId="exrate-missing-fields" />
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#0f48aa]">{t('exchangeRates.confirmDeleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[#5a6f9a]">{t('exchangeRates.confirmDeleteBody')}</p>
          <DialogFooter>
            <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button type="button" data-testid="exrate-confirm-delete" onClick={handleDelete} className="bg-[#ba550c] text-white hover:bg-[#a34a0a]">
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
