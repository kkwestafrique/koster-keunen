import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CURRENCIES, PRODUCTS, STANDARDS } from '@/data/regions';
import { useActors, useActingActor } from '@/hooks/useActors';
import { useCreateTransaction, useConsumeStockBatch, useAvailableBatches } from '@/hooks/useTransactions';
import { useContractsForLinking } from '@/hooks/useContracts';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import BatchPickerModal from '@/components/common/BatchPickerModal';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

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
//
// Send used to be immediately Approved at creation with zero review --
// confirmed live as a real gap: any authenticated user could create one,
// and it instantly deducted real stock, for what's likely the single most
// financially consequential action in the app. A first fix required the
// SENDER'S OWN team to approve their own outgoing Send before it took
// effect -- real user testing found this genuinely backwards ("why
// should I approve something I already decided to send"), and the
// receiver's own separate approval of the incoming delivery was already
// the real review point. Current, corrected design: creation is
// Admin-only (the real control point), and takes effect immediately --
// stock deducts right away, and the receiver gets their own Pending item
// to review on their side, exactly like Receive already worked before
// any of this Send work started.
export default function SendStockForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isReadOnly, currentActor } = useActingActor();
  // Real gap found live: this used to call useActorDirectory(), which
  // deliberately browses every actor in the supply chain regardless of
  // connection status (a prior, intentional design decision) --
  // confirmed with Babs after real testing surfaced this as genuinely
  // confusing: switched to the same connections-only query Commercial
  // Partners already uses, so Send can only pick a destination you're
  // actually connected to. This hook already excludes the current
  // actor from its own results (it's yourself, not a "connection"), so
  // the separate self-exclusion filter from the last fix is no longer
  // needed here.
  const { data: actorData } = useActors({
    connectedOnly: true,
    currentActorId: currentActor?.actor_id,
    pageSize: 200,
  });
  const actors = actorData?.rows || [];
  const createTransaction = useCreateTransaction();
  const consumeBatch = useConsumeStockBatch();
  const { role } = usePermissions();
  const isAdmin = role === 'Admin';

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
    // Contract fulfillment tracking, optional -- most Sends won't have
    // a contract behind them at all.
    contract_id: '',
  });

  const { data: linkableContracts = [] } = useContractsForLinking('Send');

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  // Selecting a different product/standard invalidates any batches already
  // picked against the old combination.
  const handleProductChange = (v) => { setForm((f) => ({ ...f, product: v })); setSelectedBatches([]); };
  const handleStandardChange = (v) => { setForm((f) => ({ ...f, standard: v })); setSelectedBatches([]); };

  const valid = isAdmin && form.standard && form.destination_actor_id && form.product
    && form.quantity && form.transaction_date && selectedBatches.length > 0;

  // Same real dead-end found live in Process Stock, applies identically
  // here -- surfacing the check directly on the main form rather than
  // requiring the batch picker modal to be opened first to discover it.
  const { data: availableForStandard = [] } = useAvailableBatches({
    product: form.product, standard: form.standard, stockType: 'Final Product',
  });
  const noStockForSelection = !!form.product && !!form.standard
    && selectedBatches.length === 0 && availableForStandard.length === 0;
  const totalAvailableForStandard = availableForStandard.reduce((sum, b) => sum + Number(b.quantity_available || 0), 0);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const [createdRow] = await createTransaction.mutateAsync({
        products: [{ product: form.product, quantity: form.quantity, price: form.price, unit: 'Kg' }],
        direction: 'Send',
        // Real design flaw found via actual user testing: the earlier
        // version of this fix required the SENDER'S OWN team to
        // approve their own outgoing shipment before anything happened
        // -- confusing, and backwards from how shipping actually works
        // ("why should I approve something I already decided to send").
        // Admin-only creation (still enforced below) is the real
        // control point. The moment an Admin creates a Send, it's
        // final immediately -- stock deducts right away, and the
        // receiver gets their own Pending item to review. Their
        // approval of what arrived IS the real review step, matching
        // exactly how Receive already worked before any of this Send
        // work started.
        status: 'Approved',
        standard: form.standard,
        actor_id: form.destination_actor_id,
        currency: form.currency,
        invoice_number: form.invoice_number,
        bl_number: form.bl_number,
        transaction_date: form.transaction_date,
        contract_id: form.contract_id || null,
      });
      // Consume each selected batch immediately, matching Processing's
      // pattern -- there's no more Pending window to defer this behind.
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
      toast({ title: t('sendForm.createFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-6">{t('sendForm.title')}</h1>

      {isReadOnly ? (
        <div className="bg-[#fdecea] border border-[#f3b8b3] rounded-[5px] p-6 max-w-lg" data-testid="send-form-readonly-block">
          <p className="text-sm text-[#ba550c] font-bold mb-3">{t('common.readOnlyActorTooltip')}</p>
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => navigate('/send')}>
            {t('contractWizard.back')}
          </Button>
        </div>
      ) : (
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
            {form.standard && form.product && (
              <p className="text-xs text-[#7089b4]" data-testid="send-available-hint">
                {t('sendForm.availableHint', { quantity: totalAvailableForStandard })}
              </p>
            )}
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
            {noStockForSelection && (
              <p className="text-xs text-[#ba550c]" data-testid="send-no-stock-warning">
                {t('sendForm.noStockForSelection', { standard: form.standard, product: form.product })}
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
          <div className="flex flex-col gap-1.5">
            <Label className="text-[#7089b4]">{t('transactions.linkToContract')}</Label>
            <Select
              value={form.contract_id || 'none'}
              onValueChange={(v) => set('contract_id')(v === 'none' ? '' : v)}
            >
              <SelectTrigger data-testid="send-contract"><SelectValue placeholder={t('transactions.noContract')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('transactions.noContract')}</SelectItem>
                {linkableContracts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.contract_code} — {c.product} ({c.expected_quantity} {c.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!isAdmin && (
          <p className="text-xs text-[#ba550c] mt-2" data-testid="send-admin-only-warning">
            {t('sendForm.adminOnly')}
          </p>
        )}

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
      )}
    </AppLayout>
  );
}
