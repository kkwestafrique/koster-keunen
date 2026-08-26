import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Trash2 } from 'lucide-react';
import { PRODUCTS, UNITS, STANDARDS } from '@/data/regions';
import { useCreateTransaction, useConsumeStockBatch, useAvailableBatches } from '@/hooks/useTransactions';
import { useActingActor } from '@/hooks/useActors';
import { useToast } from '@/hooks/use-toast';
import BatchPickerModal from '@/components/common/BatchPickerModal';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

const EMPTY_DESTINATION_ROW = { converted_product: '', quantity: '', unit: 'Kg' };

// Process stock form (Transactions > Processing). Per the live-site audit:
// Standard -> Source product -> Source quantity (triggers the "Add batch
// details" picker, drawing from Raw Material stock — ONE shared source per
// transaction) -> Converted product/Quantity/Unit rows -> "Add more" (adds
// DESTINATION rows only, not additional source rows — confirmed by the
// audit's exact wording) -> Transaction date.
//
// Merging is a distinct mode of this same form, not a separate flow: per
// the audit it's "pure consolidation" of multiple batches of the EXACT
// SAME product (no transformation) — so when Merging is selected, the
// destination product is locked to match the source product rather than
// letting a different one be picked.
//
// quantity_lost is the difference between total source batch quantity
// consumed and total destination quantity produced — a real domain
// concept, not a form bug. Correctly ends up at (or near) 0 for a clean
// merge, which is why the detail page only shows the loss warning for
// Processing, not Merging.
export default function ProcessStockForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const createTransaction = useCreateTransaction();
  const consumeBatch = useConsumeStockBatch();
  const { isReadOnly } = useActingActor();

  const [mode, setMode] = useState('Processing'); // 'Processing' | 'Merging'
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

  const handleModeChange = (v) => {
    setMode(v);
    // Merging locks destination product to the source product -- clear any
    // previously picked (different) converted product so nothing stale
    // gets submitted if someone switches modes mid-form.
    setForm((f) => ({
      ...f,
      destinations: f.destinations.map((r) => ({ ...r, converted_product: v === 'Merging' ? f.source_product : '' })),
    }));
  };

  const setDestination = (idx, patch) =>
    setForm((f) => ({ ...f, destinations: f.destinations.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));

  const handleStandardChange = (v) => { setForm((f) => ({ ...f, standard: v })); setSelectedBatches([]); };
  const handleSourceProductChange = (v) => {
    setForm((f) => ({
      ...f,
      source_product: v,
      // Merging: destination always mirrors the source, kept in sync here too.
      destinations: mode === 'Merging' ? f.destinations.map((r) => ({ ...r, converted_product: v })) : f.destinations,
    }));
    setSelectedBatches([]);
  };
  const handleSourceQuantityChange = (v) => { setForm((f) => ({ ...f, source_quantity: v })); setSelectedBatches([]); };

  const valid = form.standard && form.source_product && form.source_quantity
    && form.transaction_date && selectedBatches.length > 0
    && form.destinations.every((r) => r.converted_product && r.quantity);

  // Real dead-end found live: picking a Standard + Product combination
  // with zero real Raw Material stock behind it (e.g. "Sustainable" when
  // the only real stock on hand is "Conventional") let someone fill in a
  // plausible-looking quantity, but "Add batch details" would silently
  // find nothing -- the submit button just stayed disabled with no
  // visible explanation why. Surfacing that check directly on the main
  // form, immediately, rather than requiring the modal to be opened
  // first to discover it.
  const { data: availableForStandard = [] } = useAvailableBatches({
    product: form.source_product, standard: form.standard, stockType: 'Raw Material',
  });
  const noStockForSelection = !!form.source_product && !!form.standard
    && selectedBatches.length === 0 && availableForStandard.length === 0;

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
        transaction_type: mode,
        standard: form.standard,
        transaction_date: form.transaction_date,
        quantity_lost,
        // Real data-hygiene problem found live: this used to rely on the
        // table's own column default, which is 'Pending' -- but stock is
        // consumed/created immediately on insert for Processing
        // regardless of status (sync_transaction_to_stock only gates on
        // status for Received), and the UI deliberately never shows a
        // status badge for Processing at all (direction !== 'Processing'
        // check in TransactionDetail.jsx). So every Processing
        // transaction sat in the database claiming to be "Pending"
        // forever, misleading anyone who queried it directly or looked
        // at the Activity Log later. Explicitly setting 'Approved' here
        // makes the stored data honestly match what already happens in
        // practice, matching the same explicit pattern Send already
        // uses for the same reason.
        status: 'Approved',
      });
      const groupId = createdRows[0]?.transaction_group_id;
      for (const b of selectedBatches) {
        await consumeBatch.mutateAsync({ stockId: b.stockId, quantity: b.quantity, transactionGroupId: groupId });
      }
      toast({ title: t('processForm.created') });
      navigate('/process');
    } catch (err) {
      toast({ title: t('processForm.createFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('processForm.title')}</h1>

      {isReadOnly ? (
        <div className="bg-[#fdecea] border border-[#f3b8b3] rounded-[5px] p-6 max-w-lg" data-testid="process-form-readonly-block">
          <p className="text-sm text-[#ba550c] font-bold mb-3">{t('common.readOnlyActorTooltip')}</p>
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/process')}>
            {t('contractWizard.back')}
          </Button>
        </div>
      ) : (
      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 max-w-3xl flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[#7089b4]">{t('processForm.mode')}</Label>
          <RadioGroup value={mode} onValueChange={handleModeChange} className="flex gap-6" data-testid="process-mode">
            <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
              <RadioGroupItem value="Processing" data-testid="process-mode-processing" /> {t('processForm.title')}
            </label>
            <label className="flex items-center gap-2 text-sm text-[#032b71] cursor-pointer">
              <RadioGroupItem value="Merging" data-testid="process-mode-merging" /> {t('processForm.merging')}
            </label>
          </RadioGroup>
        </div>

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

            {noStockForSelection && (
              <p className="text-xs text-[#ba550c]" data-testid="process-no-stock-warning">
                {t('processForm.noStockForSelection', { standard: form.standard, product: form.source_product })}
              </p>
            )}

            {form.destinations.map((row, idx) => (
              <div key={idx} className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-end" data-testid={`process-destination-row-${idx}`}>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[#7089b4] text-xs">{mode === 'Merging' ? t('processForm.product') : t('processForm.convertedProduct')}</Label>
                  {mode === 'Merging' ? (
                    <div className="h-10 flex items-center px-3 text-sm text-[#032b71] bg-[#f4f6fa] rounded-md border border-input" data-testid={`process-destination-product-${idx}`}>
                      {form.source_product || '—'}
                    </div>
                  ) : (
                    <Select value={row.converted_product} onValueChange={(v) => setDestination(idx, { converted_product: v })}>
                      <SelectTrigger data-testid={`process-destination-product-${idx}`}><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
                      <SelectContent>
                        {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
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
      )}
    </AppLayout>
  );
}
