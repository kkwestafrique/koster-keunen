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
import { useCreateTransaction, useConsumeStockBatch } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';
import BatchPickerModal from '@/components/common/BatchPickerModal';

const EMPTY_DESTINATION_ROW = { converted_product: '', quantity: '', unit: 'Kg' };

// Process stock form (Transactions > Processing). Per the live-site audit:
// Standard -> Source product -> Source quantity (triggers the "Add batch
// details" picker, drawing from Raw Material stock — ONE shared source per
// transaction) -> Converted product/Quantity/Unit rows -> "Add more" (adds
// DESTINATION rows only, not additional source rows — confirmed by the
// audit's exact wording) -> Transaction date.
//
// quantity_lost (surfaced on the detail page in a later step) is the
// difference between total source batch quantity consumed and total
// destination quantity produced — a real domain concept, not a form bug.
export default function ProcessStockForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createTransaction = useCreateTransaction();
  const consumeBatch = useConsumeStockBatch();

  const [saving, setSaving] = useState(false);
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [form, setForm] = useState({
    standard: '',
    source_product: '',
    source_quantity: '',
    destinations: [{ ...EMPTY_DESTINATION_ROW }],
    transaction_date: '',
  });

  const setDestination = (idx, patch) =>
    setForm((f) => ({ ...f, destinations: f.destinations.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));

  const handleStandardChange = (v) => { setForm((f) => ({ ...f, standard: v })); setSelectedBatches([]); };
  const handleSourceProductChange = (v) => { setForm((f) => ({ ...f, source_product: v })); setSelectedBatches([]); };
  const handleSourceQuantityChange = (v) => { setForm((f) => ({ ...f, source_quantity: v })); setSelectedBatches([]); };

  const valid = form.standard && form.source_product && form.source_quantity
    && form.transaction_date && selectedBatches.length > 0
    && form.destinations.every((r) => r.converted_product && r.quantity);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const totalSourceSelected = selectedBatches.reduce((s, b) => s + Number(b.quantity), 0);
      const totalDestination = form.destinations.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
      const quantity_lost = totalSourceSelected - totalDestination;

      const createdRows = await createTransaction.mutateAsync({
        products: form.destinations.map((r) => ({
          product: r.converted_product,
          quantity: r.quantity,
          unit: r.unit,
          source_product: form.source_product,
          source_quantity: form.source_quantity,
        })),
        direction: 'Processing',
        standard: form.standard,
        transaction_date: form.transaction_date,
        quantity_lost,
      });
      const groupId = createdRows[0]?.transaction_group_id;
      for (const b of selectedBatches) {
        await consumeBatch.mutateAsync({ stockId: b.stockId, quantity: b.quantity, transactionGroupId: groupId });
      }
      toast({ title: t('processForm.created') });
      navigate('/process');
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
          <Select value={form.standard} onValueChange={handleStandardChange}>
            <SelectTrigger data-testid="process-standard"><SelectValue placeholder={t('contractWizard.selectStandard')} /></SelectTrigger>
            <SelectContent>
              {STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {form.standard && (
          <>
            <div className="grid grid-cols-2 gap-4 border-b border-[#cfd8e6] pb-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('processForm.sourceProduct')}</Label>
                <Select value={form.source_product} onValueChange={handleSourceProductChange}>
                  <SelectTrigger data-testid="process-source-product"><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[#7089b4]">{t('processForm.sourceQuantity')}</Label>
                <Input type="number" min="0" data-testid="process-source-quantity" value={form.source_quantity} onChange={(e) => handleSourceQuantityChange(e.target.value)} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="process-add-batch-details"
                  disabled={!form.source_product || !form.source_quantity}
                  className="w-fit border-[#0f48aa] text-[#0f48aa] mt-1"
                  onClick={() => setBatchPickerOpen(true)}
                >
                  {selectedBatches.length > 0 ? t('batchPicker.editSelection') : t('batchPicker.title')}
                </Button>
                {selectedBatches.length > 0 && (
                  <p className="text-xs text-[#7089b4]" data-testid="process-batch-summary">
                    {t('batchPicker.batchesSelected', { count: selectedBatches.length, total: selectedBatches.reduce((s, b) => s + Number(b.quantity), 0) })}
                  </p>
                )}
              </div>
            </div>

            {form.destinations.map((row, idx) => (
              <div key={idx} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end" data-testid={`process-destination-row-${idx}`}>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4] text-xs">{t('processForm.convertedProduct')}</Label>
                  <Select value={row.converted_product} onValueChange={(v) => setDestination(idx, { converted_product: v })}>
                    <SelectTrigger><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                    <SelectContent>
                      {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4] text-xs">{t('receiveForm.quantity')}</Label>
                  <Input type="number" min="0" value={row.quantity} onChange={(e) => setDestination(idx, { quantity: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4] text-xs">{t('contractWizard.unit')}</Label>
                  <Select value={row.unit} onValueChange={(v) => setDestination(idx, { unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {form.destinations.length > 1 && (
                  <Button type="button" variant="ghost" className="text-[#ba550c]" onClick={() => setForm((f) => ({ ...f, destinations: f.destinations.filter((_, i) => i !== idx) }))}>
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
              onClick={() => setForm((f) => ({ ...f, destinations: [...f.destinations, { ...EMPTY_DESTINATION_ROW }] }))}
            >
              <Plus className="h-4 w-4 mr-1" /> {t('receiveForm.addMoreProduct')}
            </Button>

            <div className="flex flex-col gap-1.5 max-w-sm">
              <Label className="text-[#7089b4]">{t('receiveForm.transactionDate')}</Label>
              <Input type="date" data-testid="process-date" value={form.transaction_date} onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))} />
            </div>

            <div className="flex justify-between mt-2">
              <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/process')}>
                {t('contractWizard.back')}
              </Button>
              <Button type="button" data-testid="process-submit" disabled={!valid || saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" onClick={handleSubmit}>
                {saving ? t('forms.saving') : t('processForm.submit')}
              </Button>
            </div>

            <BatchPickerModal
              open={batchPickerOpen}
              onOpenChange={setBatchPickerOpen}
              product={form.source_product}
              standard={form.standard}
              stockType="Raw Material"
              requiredQuantity={form.source_quantity}
              testIdPrefix="process-batch-picker"
              onConfirm={(selections) => setSelectedBatches(selections)}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
}
