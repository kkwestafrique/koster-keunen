import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CURRENCIES, PRODUCTS, STANDARDS } from '@/data/regions';
import { useAllActorsLite } from '@/hooks/useActors';
import { useCreateTransaction, useConsumeStockBatch } from '@/hooks/useTransactions';
import { useToast } from '@/hooks/use-toast';
import BatchPickerModal from '@/components/common/BatchPickerModal';

// Send stock form (Transactions > Send). Per the live-site audit, Send has
// NO Single/Multiple toggle — unlike Receive, it's a single flat form:
// Standard -> Destination actor -> Product -> Quantity required to deliver
// (triggers the "Add batch details" batch-picker, drawing from Final
// Product stock) -> Price -> Currency (auto-populates to NGN once an actor
// is chosen) -> Invoice number -> BL number -> Transaction date.
//
// A previous version of this form had a toggle + a bulk-upload "multiple"
// mode; that was built from an earlier reading of the audit before this
// finding was confirmed explicitly ("No Single/Multiple toggle for Send")
// and removed here.
export default function SendStockForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: actors = [] } = useAllActorsLite();
  const createTransaction = useCreateTransaction();
  const consumeBatch = useConsumeStockBatch();

  const [saving, setSaving] = useState(false);
  const [batchPickerOpen, setBatchPickerOpen] = useState(false);
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [form, setForm] = useState({
    standard: '',
    destination_actor_id: '',
    product: '',
    quantity: '',
    price: '',
    currency: '',
    invoice_number: '',
    bl_number: '',
    transaction_date: '',
  });

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  // Selecting a different product/standard invalidates any batches already
  // picked against the old combination.
  const handleProductChange = (v) => { setForm((f) => ({ ...f, product: v })); setSelectedBatches([]); };
  const handleStandardChange = (v) => { setForm((f) => ({ ...f, standard: v })); setSelectedBatches([]); };

  const valid = form.standard && form.destination_actor_id && form.product
    && form.quantity && form.transaction_date && selectedBatches.length > 0;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const [createdRow] = await createTransaction.mutateAsync({
        products: [{ product: form.product, quantity: form.quantity, price: form.price, unit: 'Kg' }],
        direction: 'Send',
        status: 'Approved',
        standard: form.standard,
        actor_id: form.destination_actor_id,
        currency: form.currency,
        invoice_number: form.invoice_number,
        bl_number: form.bl_number,
        transaction_date: form.transaction_date,
      });
      // Consume each selected batch against the newly created transaction
      // group — one call per batch, matching consume_stock_batch's atomic,
      // row-locked design.
      for (const b of selectedBatches) {
        await consumeBatch.mutateAsync({
          stockId: b.stockId,
          quantity: b.quantity,
          transactionGroupId: createdRow.transaction_group_id,
        });
      }
      toast({ title: t('sendForm.created') });
      navigate('/send');
    } catch (err) {
      toast({ title: t('sendForm.createFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('sendForm.title')}</h1>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('contractWizard.standard')}</Label>
            <Select value={form.standard} onValueChange={handleStandardChange}>
              <SelectTrigger data-testid="send-standard"><SelectValue placeholder={t('contractWizard.selectStandard')} /></SelectTrigger>
              <SelectContent>
                {STANDARDS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('sendForm.destinationActor')}</Label>
            <Select
              value={form.destination_actor_id}
              onValueChange={(v) => setForm((f) => ({ ...f, destination_actor_id: v, currency: f.currency || 'NGN' }))}
            >
              <SelectTrigger data-testid="send-actor"><SelectValue placeholder={t('forms.selectActor')} /></SelectTrigger>
              <SelectContent>
                {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.contact_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('contractWizard.product')}</Label>
            <Select value={form.product} onValueChange={handleProductChange}>
              <SelectTrigger data-testid="send-product"><SelectValue placeholder={t('contractWizard.selectProduct')} /></SelectTrigger>
              <SelectContent>
                {PRODUCTS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('sendForm.quantityRequired')}</Label>
            <Input type="number" min="0" data-testid="send-quantity" value={form.quantity} onChange={(e) => { set('quantity')(e.target.value); setSelectedBatches([]); }} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="send-add-batch-details"
              disabled={!form.product || !form.quantity}
              className="w-fit border-[#0f48aa] text-[#0f48aa] mt-1"
              onClick={() => setBatchPickerOpen(true)}
            >
              {selectedBatches.length > 0 ? t('batchPicker.editSelection') : t('batchPicker.title')}
            </Button>
            {selectedBatches.length > 0 && (
              <p className="text-xs text-[#7089b4]" data-testid="send-batch-summary">
                {t('batchPicker.batchesSelected', { count: selectedBatches.length, total: selectedBatches.reduce((s, b) => s + Number(b.quantity), 0) })}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('contractWizard.price')}</Label>
            <Input type="number" min="0" data-testid="send-price" value={form.price} onChange={(e) => set('price')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('contractWizard.currency')}</Label>
            <Select value={form.currency} onValueChange={set('currency')}>
              <SelectTrigger data-testid="send-currency"><SelectValue placeholder={t('contractWizard.selectCurrency')} /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('sendForm.invoiceNumber')}</Label>
            <Input data-testid="send-invoice" value={form.invoice_number} onChange={(e) => set('invoice_number')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('sendForm.blNumber')}</Label>
            <Input data-testid="send-bl" value={form.bl_number} onChange={(e) => set('bl_number')(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('receiveForm.transactionDate')}</Label>
            <Input type="date" data-testid="send-date" value={form.transaction_date} onChange={(e) => set('transaction_date')(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-between mt-6">
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/send')}>
            {t('contractWizard.back')}
          </Button>
          <Button type="button" data-testid="send-submit" disabled={!valid || saving} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" onClick={handleSubmit}>
            {saving ? t('forms.saving') : t('sendForm.submit')}
          </Button>
        </div>

        <BatchPickerModal
          open={batchPickerOpen}
          onOpenChange={setBatchPickerOpen}
          product={form.product}
          standard={form.standard}
          stockType="Final Product"
          requiredQuantity={form.quantity}
          testIdPrefix="send-batch-picker"
          onConfirm={(selections) => setSelectedBatches(selections)}
        />
      </div>
    </AppLayout>
  );
}
