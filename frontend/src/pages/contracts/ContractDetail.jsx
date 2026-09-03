import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import RequiredLabel from '@/components/common/RequiredLabel';
import StandardBadge from '@/components/common/StandardBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Pencil, Plus } from 'lucide-react';
import { useContract, useUpdateContractGroup, useContractDeliveries, useCreateContractDelivery, useContractFulfillment } from '@/hooks/useContracts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import FormattedNumberInput from '@/components/common/FormattedNumberInput';
import { uploadMediaFile, MEDIA_ACCEPT_ATTR } from '@/lib/supabaseClient';
import ChangeHistoryDialog from '@/components/common/ChangeHistoryDialog';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useActingActor } from '@/hooks/useActors';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { formatDate } from '@/lib/dateFormat';

const today = () => new Date().toISOString().slice(0, 10);

// Update-contract modal: matches the live site exactly — Year/Actor/
// Standard are read-only (greyed), only per-line-item Expected quantity/
// Maximum price, the attached file, Advance amount paid, and Updated on
// can change. This is a MODAL overlay, not the wizard reopened.
function UpdateContractModal({ open, onOpenChange, contract, fulfillment = {} }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { supplyChainId } = useAuth();
  const updateGroup = useUpdateContractGroup();
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [newFile, setNewFile] = useState(null);
  const [products, setProducts] = useState(() => contract.products.map((p) => ({ ...p })));
  const [advanceAmountPaid, setAdvanceAmountPaid] = useState(Number(contract.advance_amount_paid ?? 0).toFixed(2));
  const [updatedOn, setUpdatedOn] = useState(today());

  const setProductField = (idx, key, val) =>
    setProducts((rows) => rows.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

  // Real gap found via independent audit: "Contracts editable below
  // already-delivered quantity" -- this only ever checked that the new
  // value was a positive number, never checked it against what had
  // genuinely already been delivered (the fulfillment tracking built
  // earlier this session). Someone could set Expected quantity to 5 Kg
  // even after 50 Kg had already been recorded delivered against that
  // same line, producing an obviously broken "50/5 Kg (1000%)" display.
  // fulfillment is keyed by contract row id (see useContractFulfillment)
  // and only ever populated for Send-type contracts -- Received-type
  // fulfillment isn't tracked yet, so this correctly never blocks
  // editing those, matching what's actually trackable today.
  const belowDelivered = products.some((r) => {
    const delivered = fulfillment[r.id] || 0;
    return delivered > 0 && Number(r.expected_quantity) < delivered;
  });

  const hasInvalidFields = products.some(
    (r) => r.expected_quantity === '' || Number(r.expected_quantity) <= 0 || isNaN(Number(r.expected_quantity))
      || r.price === '' || Number(r.price) <= 0 || isNaN(Number(r.price))
  ) || belowDelivered;

  const handleSave = async () => {
    setSaving(true);
    try {
      let attachment_url;
      if (newFile) {
        attachment_url = await uploadMediaFile(newFile, 'contracts', supplyChainId);
      }
      await updateGroup.mutateAsync({
        contractCode: contract.contract_code,
        products,
        advance_amount_paid: advanceAmountPaid,
        attachment_url,
        updated_at: updatedOn,
      });
      toast({ title: t('contractDetail.updated') });
      onOpenChange(false);
    } catch (err) {
      toast({ title: t('contractDetail.updateFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-white max-h-[90vh] overflow-y-auto" data-testid="update-contract-modal">
        <DialogHeader>
          <DialogTitle className="text-[#032b71] font-black">{t('contractDetail.updateContract')}</DialogTitle>
          <DialogDescription className="sr-only">{t('contractDetail.updateContract')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 mb-2">
          <DetailField label={t('contracts.year')} value={contract.year} testId="update-contract-year" />
          <DetailField label={t('contractWizard.supplier')} value={contract.actors?.contact_name} testId="update-contract-actor" />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#5a6f9a]">{t('contracts.standard')}</span>
            <StandardBadge standard={contract.standard} />
          </div>
        </div>

        {products.map((row, idx) => (
          <div key={row.id} className="flex flex-col gap-2 border-t border-[#cfd8e6] pt-3 mt-2" data-testid={`update-contract-row-${idx}`}>
            <p className="font-bold text-[#032b71]">{row.product}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <RequiredLabel required>{t('contractDetail.expectedQuantityKg')}</RequiredLabel>
                <FormattedNumberInput
                  testId={`update-contract-qty-${idx}`}
                  value={row.expected_quantity}
                  onChange={(v) => setProductField(idx, 'expected_quantity', v)}
                  errorMessage={t('contractDetail.invalidQuantity')}
                />
                {(() => {
                  const delivered = fulfillment[row.id] || 0;
                  return delivered > 0 && Number(row.expected_quantity) < delivered && (
                    <p className="text-xs text-[#ba550c]" data-testid={`update-contract-below-delivered-${idx}`}>
                      {t('contractDetail.belowDelivered', { delivered })}
                    </p>
                  );
                })()}
              </div>
              <div className="flex flex-col gap-1.5">
                <RequiredLabel required>{t('contractDetail.maximumPricePerKg')}</RequiredLabel>
                <FormattedNumberInput
                  testId={`update-contract-price-${idx}`}
                  value={row.price}
                  onChange={(v) => setProductField(idx, 'price', v)}
                  errorMessage={t('contractDetail.invalidPrice')}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="flex flex-col gap-1.5 border-t border-[#cfd8e6] pt-3 mt-2">
          <RequiredLabel required={false}>{t('contractWizard.uploadContract')}</RequiredLabel>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" className="border-[#0f48aa] text-[#0f48aa] shrink-0" onClick={() => fileInputRef.current?.click()}>
              {t('contractWizard.uploadFile')}
            </Button>
            <span className="text-sm text-[#5a6f9a] truncate">{newFile?.name || t('forms.noFileChosen')}</span>
            <input ref={fileInputRef} type="file" accept={MEDIA_ACCEPT_ATTR} className="hidden" onChange={(e) => setNewFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('contractWizard.advanceAmountPaid')}</RequiredLabel>
            <Input
              type="number" min="0"
              data-testid="update-contract-advance"
              value={advanceAmountPaid}
              onChange={(e) => setAdvanceAmountPaid(e.target.value)}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (!isNaN(n)) setAdvanceAmountPaid(n.toFixed(2));
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <RequiredLabel required>{t('contractDetail.updatedOn')}</RequiredLabel>
            <Input
              type="date"
              data-testid="update-contract-updated-on"
              value={updatedOn}
              onChange={(e) => setUpdatedOn(e.target.value)}
              min="1900-01-01"
              max="2100-12-31"
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="button" data-testid="update-contract-submit" disabled={saving || hasInvalidFields} onClick={handleSave} className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]">
            {saving ? t('forms.saving') : t('contractDetail.updateContract')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Adding a delivery notification was never observed on the live site --
// the audit explicitly could not find an add-action on the one contract
// it checked (which had none recorded yet). This is a best-effort design
// built from the fields that WERE observed (Product / Delivering
// quantity / Expected delivery date / Comment), not a replicated flow.
// Documented assumptions, not facts:
//  - Gated to Admin/Member (canEdit) -- matches how contracts themselves
//    are created, and matches the RLS policy on this table's INSERT,
//    which independently enforces the same restriction.
//  - Deliberately does NOT touch stocks or transactions. "Expected
//    delivery date" / "Delivering quantity" read as a forward-looking
//    notice of something coming, not a receipt event -- the separate
//    Transactions module already handles actual receipts.
//  - No approval step, matching how Contracts/Actors work (only
//    Transactions and Claims were observed to have an explicit
//    approval workflow).
//  - Product is chosen from THIS contract's own product lines, so a
//    delivery can't be logged against something the contract never
//    actually covers.
function DeliveryNotificationTab({ contractGroupId, contractProducts, canAdd }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: deliveries = [] } = useContractDeliveries(contractGroupId);
  const createDelivery = useCreateContractDelivery();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product: '', delivering_quantity: '', expected_delivery_date: '', comment: '' });
  const [saving, setSaving] = useState(false);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const isValid = form.product && form.delivering_quantity && form.expected_delivery_date;

  const resetAndClose = () => {
    setOpen(false);
    setForm({ product: '', delivering_quantity: '', expected_delivery_date: '', comment: '' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await createDelivery.mutateAsync({
        contractGroupId,
        product: form.product,
        deliveringQuantity: Number(form.delivering_quantity),
        expectedDeliveryDate: form.expected_delivery_date,
        comment: form.comment,
      });
      toast({ title: t('contractDetail.deliveryAdded') });
      resetAndClose();
    } catch (err) {
      toast({ title: t('contractDetail.deliveryAddFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white border border-[#cfd8e6] rounded-b-[5px] border-t-0 p-6" data-testid="contract-detail-deliveries">
      {canAdd && (
        <div className="flex justify-end mb-4">
          <Button
            type="button"
            variant="outline"
            data-testid="add-delivery-trigger"
            className="border-[#0f48aa] text-[#0f48aa] bg-white hover:bg-[#f5f5f5]"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> {t('contractDetail.addDelivery')}
          </Button>
          <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : resetAndClose())}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-[#032b71] font-black">{t('contractDetail.addDelivery')}</DialogTitle>
                <DialogDescription className="sr-only">{t('contractDetail.addDelivery')}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <RequiredLabel required>{t('contractWizard.product')}</RequiredLabel>
                  <Select value={form.product} onValueChange={set('product')}>
                    <SelectTrigger className="bg-white" data-testid="delivery-product"><SelectValue placeholder={t('contractWizard.product')} /></SelectTrigger>
                    <SelectContent>
                      {contractProducts.map((p, idx) => (
                        <SelectItem key={p.product || idx} value={p.product}>{p.product}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <RequiredLabel required>{t('contractDetail.deliveringQuantity')}</RequiredLabel>
                  <FormattedNumberInput
                    testId="delivery-quantity"
                    value={form.delivering_quantity}
                    onChange={set('delivering_quantity')}
                    errorMessage={t('contractDetail.invalidQuantity')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <RequiredLabel required>{t('contractDetail.expectedDeliveryDate')}</RequiredLabel>
                  <Input type="date" className="bg-white" data-testid="delivery-date" min="1900-01-01" max="2100-12-31" value={form.expected_delivery_date} onChange={(e) => set('expected_delivery_date')(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <RequiredLabel required={false}>{t('contractWizard.comments')}</RequiredLabel>
                  <Textarea data-testid="delivery-comment" value={form.comment} onChange={(e) => set('comment')(e.target.value)} />
                </div>
              </div>
              <DialogFooter className="mt-2">
                <Button variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={resetAndClose}>{t('common.cancel')}</Button>
                <Button data-testid="delivery-save" disabled={saving || !isValid} onClick={handleSave} className="bg-[#0f48aa] text-white hover:bg-[#0d3c8f]">
                  {saving ? t('forms.saving') : t('common.save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      {deliveries.length === 0 ? (
        <p className="text-sm text-[#5a6f9a]" data-testid="contract-deliveries-empty">{t('contractDetail.noDeliveryNotificationsFound')}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#5a6f9a] border-b border-[#cfd8e6]">
              <th className="py-2">{t('contractWizard.product')}</th>
              <th className="py-2">{t('contractDetail.deliveringQuantity')}</th>
              <th className="py-2">{t('contractDetail.expectedDeliveryDate')}</th>
              <th className="py-2">{t('contractWizard.comments')}</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id} className="border-b border-[#f0f0f0] text-[#032b71]">
                <td className="py-2">{d.product}</td>
                <td className="py-2">{d.delivering_quantity}</td>
                <td className="py-2">{formatDate(d.expected_delivery_date)}</td>
                <td className="py-2">{d.comment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ContractDetail() {
  const { t } = useTranslation();
  const { id: contractCode } = useParams();
  const navigate = useNavigate();
  const { data: contract, isLoading } = useContract(contractCode);
  const { canEdit, canViewChangeHistory } = usePermissions();
  const [updateOpen, setUpdateOpen] = useState(false);
  const { isReadOnly, currentActor } = useActingActor();
  // Real bug found live: contracts.owning_actor_id is the only actor
  // who can ever edit one -- confirmed directly against RLS (write
  // policies were already correctly scoped this way). canEdit alone is
  // purely role-based (Admin/Member) with no ownership check, so once
  // the counterparty on a contract could finally SEE it (the fix for
  // "sent to Wax Agg but not showing"), an Admin/Member on their side
  // would have seen a fully-enabled Edit button that silently failed
  // the moment they tried to save -- the same dead-end pattern found
  // and fixed repeatedly elsewhere in the app today. canEdit now also
  // requires genuine ownership before showing anything editable.
  const isOwner = contract?.owning_actor_id === currentActor?.actor_id;
  const canActuallyEdit = canEdit && isOwner;
  // Contract fulfillment tracking, Send-type contracts only -- Received
  // contracts are fulfilled by an automatically-generated transaction on
  // the receiving side, not anything created manually, so there's no
  // clean link to show progress from yet (a separate, harder problem).
  // Called here, before any early return, since React Hooks must run in
  // the same order on every render -- contract can be undefined while
  // still loading, so this tolerates that with optional chaining rather
  // than being called conditionally after the loading/not-found guards.
  const contractProductIds = contract?.contract_type === 'Send' && Array.isArray(contract?.products)
    ? contract.products.map((p) => p.id)
    : [];
  const { data: fulfillment = {} } = useContractFulfillment(contractProductIds);

  if (isLoading) {
    return (
      <AppLayout hideDefaultHeader>
        <p className="text-[#5a6f9a]">{t('common.loading')}</p>
      </AppLayout>
    );
  }
  if (!contract) {
    return (
      <AppLayout hideDefaultHeader>
        <button
          data-testid="back-button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-bold text-[#0f48aa] mb-3 hover:underline"
        >
          <ChevronLeft className="h-4 w-4" /> {t('actorProfile.back')}
        </button>
        <p className="text-[#5a6f9a]" data-testid="contract-not-found">{t('common.noContractsFound')}</p>
      </AppLayout>
    );
  }

  const products = Array.isArray(contract.products) ? contract.products : [];

  return (
    <AppLayout hideDefaultHeader>
      <button
        data-testid="back-button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm font-bold text-[#0f48aa] mb-3 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> {t('actorProfile.back')}
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-black text-[#0f48aa]">{t('contractDetail.title')}</h1>
        <div className="flex items-center gap-3">
          {contract.updated_at && (
            <span className="text-xs italic text-[#5a6f9a]" data-testid="contract-last-updated">
              {t('contractDetail.lastUpdatedOn')}: {formatDate(contract.updated_at)}
            </span>
          )}
          {canViewChangeHistory && (
            <ChangeHistoryDialog tableName="contracts" groupId={contract.contract_group_id} testId="contract-change-history-trigger" />
          )}
          {canActuallyEdit && (
            <Button
              data-testid="update-contract-button"
              className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isReadOnly}
              title={isReadOnly ? t('common.readOnlyActorTooltip') : undefined}
              onClick={() => setUpdateOpen(true)}
            >
              <Pencil className="h-4 w-4 mr-1" /> {t('contractDetail.updateContract')}
            </Button>
          )}
        </div>
      </div>

      {/* 3-column header grid matching the audit exactly: Contract Id/Year/
          Contract type, then Name of Supplier/Country/Signature date, then
          Standard/Advance amount paid/Advance(%), then Comments full width. */}
      <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6 mb-6" data-testid="contract-detail-header">
        <div className="grid grid-cols-3 gap-x-8 gap-y-4">
          <DetailField label={t('contractDetail.contractId')} value={contract.contract_code} />
          <DetailField label={t('contracts.year')} value={contract.year} />
          <DetailField label={t('contracts.type')} value={contract.contract_type} />

          <DetailField label={t('contractWizard.supplier')} value={contract.actors?.contact_name || t('contractDetail.noSupplier')} />
          <DetailField label={t('contracts.country')} value={contract.actors?.country} />
          <DetailField label={t('contracts.signatureDate')} value={formatDate(contract.signature_date)} />

          <div className="flex flex-col gap-1">
            <span className="text-xs text-[#5a6f9a]">{t('contracts.standard')}</span>
            <StandardBadge standard={contract.standard} />
          </div>
          <DetailField label={t('contractWizard.advanceAmountPaid')} value={contract.advance_amount_paid != null ? `${contract.advance_amount_paid} ${contract.currency || ''}` : null} />
          <DetailField label={t('contractWizard.advancePercent')} value={contract.advance_percent != null ? `${contract.advance_percent}%` : null} />

          <div className="col-span-3">
            <DetailField label={t('contractWizard.comments')} value={contract.comments || '-'} />
          </div>
        </div>
      </div>

      <Tabs defaultValue="products">
        <TabsList className="bg-transparent border-b border-[#cfd8e6] p-0 rounded-none h-auto gap-6 justify-start mb-0">
          <TabsTrigger value="products" data-testid="contract-tab-products" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#5a6f9a] font-bold">
            {t('contractDetail.productDetails')}
          </TabsTrigger>
          <TabsTrigger value="deliveries" data-testid="contract-tab-deliveries" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#5a6f9a] font-bold">
            {t('contractDetail.deliveryNotification')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <div className="bg-white border border-[#cfd8e6] rounded-b-[5px] border-t-0 p-6" data-testid="contract-detail-products">
            {products.length === 0 ? (
              <p className="text-sm text-[#5a6f9a]">{t('common.noRecordsFound')}</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#5a6f9a] border-b border-[#cfd8e6]">
                      <th className="py-2">{t('contractWizard.product')}</th>
                      <th className="py-2">{t('contractWizard.expectedQuantity')}</th>
                      <th className="py-2">{t('contractDetail.maximumPricePerKg')}</th>
                      {contract.contract_type === 'Send' && (
                        <th className="py-2">{t('contractDetail.delivered')}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((row, idx) => {
                      const delivered = fulfillment[row.id] || 0;
                      const expected = Number(row.expected_quantity) || 0;
                      const pct = expected > 0 ? Math.min(100, Math.round((delivered / expected) * 100)) : 0;
                      return (
                        <tr key={row.id || idx} className="border-b border-[#f0f0f0] text-[#032b71]">
                          <td className="py-2">{row.product}</td>
                          <td className="py-2">{row.expected_quantity} {row.unit}</td>
                          <td className="py-2">{row.price != null ? `${row.price} ${contract.currency || ''}` : '—'}</td>
                          {contract.contract_type === 'Send' && (
                            <td className="py-2" data-testid={`contract-fulfillment-${row.id}`}>
                              {delivered} / {row.expected_quantity} {row.unit} ({pct}%)
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="grid grid-cols-3 gap-4 bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-4 mt-4" data-testid="contract-detail-totals">
                  <DetailField label={t('contractWizard.totalQuantityExpected')} value={contract.total_quantity_expected} />
                  <DetailField label={t('contractWizard.totalContractAmount')} value={products.reduce((s, p) => s + (Number(p.expected_quantity) || 0) * (Number(p.price) || 0), 0).toLocaleString()} />
                  <DetailField
                    label={t('contractWizard.percentageYellowWax')}
                    value={(() => {
                      const total = contract.total_quantity_expected || 0;
                      const yellow = products.filter((p) => p.product === 'Beeswax-Yellow').reduce((s, p) => s + (Number(p.expected_quantity) || 0), 0);
                      return total > 0 ? Math.round((yellow / total) * 100) : '—';
                    })()}
                  />
                </div>
              </>
            )}

            <div className="mt-4">
              <span className="text-xs text-[#5a6f9a]">{t('contractWizard.attachedFile')}</span>
              <p className="text-sm text-[#032b71]">
                {contract.attachment_url
                  ? <a href={contract.attachment_url} target="_blank" rel="noreferrer" className="text-[#0f48aa] underline">{t('contractWizard.attachedFile')}</a>
                  : t('contractWizard.noAttachedFiles')}
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="deliveries">
          <DeliveryNotificationTab contractGroupId={contract.contract_group_id} contractProducts={products} canAdd={canActuallyEdit && !isReadOnly} />
        </TabsContent>
      </Tabs>

      <UpdateContractModal open={updateOpen} onOpenChange={setUpdateOpen} contract={contract} fulfillment={fulfillment} />
    </AppLayout>
  );
}
