import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { PRODUCTS, UNITS, STANDARDS } from '@/data/regions';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';

const EMPTY_ROW = { source_product: '', source_quantity: '', converted_product: '', quantity: '', unit: 'Kg' };

// Process stock form (Transactions > Processing). Per the live-site audit:
// Standard -> Source product -> Source quantity -> Converted product ->
// Quantity -> Unit -> Add more -> Transaction date. No village/beekeeper
// cascade; the converted-product list is the full product list (independent
// of source).
export default function ProcessStockForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createTransaction = useCreateTransaction();

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    standard: '',
    rows: [{ ...EMPTY_ROW }],
    transaction_date: '',
  });

  const setRow = (idx, patch) =>
    setForm((f) => ({ ...f, rows: f.rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));

  const valid = form.standard && form.transaction_date
    && form.rows.every((r) => r.source_product && r.source_quantity && r.converted_product && r.quantity);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await createTransaction.mutateAsync({
        direction: 'Processing',
        standard: form.standard,
        products: form.rows,
        transaction_date: form.transaction_date,
      });
      toast({ title: t('processForm.created') });
      navigate('/transactions/processing');
    } catch (err) {
      toast({ title: t('processForm.createFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('processForm.title')}</h1>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 max-w-3xl flex flex-col gap-4">
        <div className="flex flex-col gap-1.5 max-w-sm">
          <Label className="text-[#7089b4]">{t('contractWizard.standard')}</Label>
          <Select value={form.standard} onValueChange={(v) => setForm((f) => ({ ...f, standard: v }))}>
            <SelectTrigger data-testid="process-standard"><SelectValue placeholder={t('contractWizard.selectStandard')} /></SelectTrigger>
            <SelectContent>
              {STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {form.standard && (
          <>
            {form.rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_2fr_1fr_1fr_auto] gap-3 items-end" data-testid={`process-row-${idx}`}>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4] text-xs">{t('processForm.sourceProduct')}</Label>
                  <Select value={row.source_product} onValueChange={(v) => setRow(idx, { source_product: v })}>
                    <SelectTrigger><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                    <SelectContent>
                      {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4] text-xs">{t('processForm.sourceQuantity')}</Label>
                  <Input type="number" min="0" value={row.source_quantity} onChange={(e) => setRow(idx, { source_quantity: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4] text-xs">{t('processForm.convertedProduct')}</Label>
                  <Select value={row.converted_product} onValueChange={(v) => setRow(idx, { converted_product: v })}>
                    <SelectTrigger><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                    <SelectContent>
                      {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4] text-xs">{t('receiveForm.quantity')}</Label>
                  <Input type="number" min="0" value={row.quantity} onChange={(e) => setRow(idx, { quantity: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4] text-xs">{t('contractWizard.unit')}</Label>
                  <Select value={row.unit} onValueChange={(v) => setRow(idx, { unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.rows.length > 1 && (
                  <Button type="button" variant="ghost" className="text-[#ba550c]" onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((_, i) => i !== idx) }))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              className="w-fit border-[#0f48aa] text-[#0f48aa]"
              data-testid="process-add-row"
              onClick={() => setForm((f) => ({ ...f, rows: [...f.rows, { ...EMPTY_ROW }] }))}
            >
              <Plus className="h-4 w-4 mr-1" /> {t('receiveForm.addMoreProduct')}
            </Button>

            <div className="flex flex-col gap-1.5 max-w-sm">
              <Label className="text-[#7089b4]">{t('receiveForm.transactionDate')}</Label>
              <Input type="date" data-testid="process-date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />
            </div>

            <div className="flex justify-between mt-2">
              <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/transactions/processing')}>
                {t('contractWizard.back')}
              </Button>
              <Button type="button" data-testid="process-submit" disabled={!valid || saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" onClick={handleSubmit}>
                {saving ? t('forms.saving') : t('processForm.submit')}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
