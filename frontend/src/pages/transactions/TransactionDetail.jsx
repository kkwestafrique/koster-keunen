import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import StandardBadge from '@/components/common/StandardBadge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Paperclip } from 'lucide-react';
import { useTransaction, useTransactionBatchSelections, useApproveTransaction, useRejectTransaction } from '@/hooks/useTransactions';
import { uploadMediaFile, supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// NOTE: this audit was text-only (no screenshots, unlike Contracts), so
// exact pixel layout here is less certain than elsewhere in this rebuild —
// built to the documented field/section structure using established
// visual patterns from the rest of the app (DetailField, StandardBadge,
// warning-banner styling) rather than a screenshot-verified layout.
// Worth a direct check against the live site before treating this as
// pixel-final the way Contracts was.

const STATUS_COLORS = {
  Pending: { bg: '#fffaec', border: '#f2e4b3', text: '#79730a' },
  Approved: { bg: '#eafaf0', border: '#b8e6c9', text: '#219653' },
  Rejected: { bg: '#fdecea', border: '#f3b8b3', text: '#ba550c' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Pending;
  return (
    <span
      className="text-xs font-bold px-2.5 py-1 rounded-full border"
      style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
      data-testid="transaction-status-badge"
    >
      {status}
    </span>
  );
}

function BatchChips({ batches, testId }) {
  const { t } = useTranslation();
  if (!batches || batches.length === 0) return <span className="text-sm text-[#7089b4]">—</span>;
  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {batches.map((b, idx) => (
        <span key={idx} className="inline-flex items-center gap-1 bg-[#ebf6ff] border border-[#cfd8e6] rounded-full px-3 py-1 text-xs text-[#032b71]">
          {b.label} {b.quantity != null && <span className="font-bold">{b.quantity} {b.unit || 'Kg'}</span>}
        </span>
      ))}
    </div>
  );
}

export default function TransactionDetail() {
  const { t } = useTranslation();
  const { id: transactionCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supplyChainId } = useAuth();
  const { data: tx, isLoading } = useTransaction(transactionCode);
  const { data: sourceBatches = [] } = useTransactionBatchSelections(tx?.transaction_group_id);
  const approveTransaction = useApproveTransaction();
  const rejectTransaction = useRejectTransaction();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  if (isLoading || !tx) {
    return (
      <AppLayout hideDefaultHeader>
        <p className="text-[#7089b4]">{t('common.loading')}</p>
      </AppLayout>
    );
  }

  const isMerging = tx.transaction_type === 'Merging';
  const counterpartLabel = tx.beekeeper_id ? t('transactionDetail.beekeeper') : t('transactionDetail.actor');
  const counterpartName = tx.beekeepers?.full_name || tx.actors?.contact_name || t('contractDetail.noSupplier');

  const sourceBatchChips = sourceBatches.map((s) => ({
    label: s.stocks?.batch_reference,
    quantity: s.quantity_selected,
    unit: s.stocks?.unit,
  }));
  const destinationBatchChips = (tx.products || [])
    .filter((p) => p.destination_batch)
    .map((p) => ({ label: p.destination_batch, quantity: p.quantity, unit: p.unit }));

  const handleApprove = async () => {
    try {
      await approveTransaction.mutateAsync(tx.transaction_group_id);
      toast({ title: t('transactionDetail.approved') });
    } catch (err) {
      toast({ title: t('transactionDetail.approveFailed'), description: err.message, variant: 'destructive' });
    }
  };
  const handleReject = async () => {
    try {
      await rejectTransaction.mutateAsync(tx.transaction_group_id);
      toast({ title: t('transactionDetail.rejected') });
    } catch (err) {
      toast({ title: t('transactionDetail.rejectFailed'), description: err.message, variant: 'destructive' });
    }
  };
  const handleAttachFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMediaFile(file, 'transactions', supplyChainId);
      await supabase.from('transactions').update({ attachment_url: url }).eq('transaction_group_id', tx.transaction_group_id);
      toast({ title: t('transactionDetail.fileAttached') });
    } catch (err) {
      toast({ title: t('transactionDetail.attachFailed'), description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

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
        <h1 className="text-lg font-black text-[#0f48aa]">{t('transactionDetail.title')}</h1>
        {tx.direction !== 'Processing' && <StatusBadge status={tx.status} />}
      </div>

      {tx.direction === 'Received' && tx.status === 'Pending' && (
        <div className="bg-[#fffaec] border border-[#f2e4b3] rounded-[5px] p-4 mb-6 flex items-center justify-between" data-testid="transaction-pending-banner">
          <p className="text-sm text-[#79730a] font-bold">{t('transactionDetail.notYetApproved')}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-[#ba550c] text-[#ba550c]" data-testid="transaction-reject" onClick={handleReject}>
              {t('transactionDetail.rejectTransaction')}
            </Button>
            <Button size="sm" className="bg-[#0f48aa] text-white hover:bg-[#0d3d91]" data-testid="transaction-approve" onClick={handleApprove}>
              {t('transactionDetail.approveTransaction')}
            </Button>
          </div>
        </div>
      )}

      <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6 mb-6" data-testid="transaction-detail-header">
        <div className="flex flex-wrap gap-x-12 gap-y-3 mb-4">
          <DetailField label={t('transactions.date')} value={tx.transaction_date} />
          <DetailField label={t('transactionDetail.loggedDate')} value={tx.created_at?.slice(0, 10)} />
          <DetailField label={t('processForm.transactionType')} value={isMerging ? t('processForm.merging') : tx.direction} />
        </div>
        <div className="flex flex-col gap-1 mb-4">
          <span className="text-xs text-[#7089b4]">{t('contracts.standard')}</span>
          <div className="flex items-center gap-3">
            <StandardBadge standard={tx.standard} />
            {tx.direction === 'Received' && (
              <>
                <Button
                  type="button" variant="outline" size="sm"
                  className="border-[#0f48aa] text-[#0f48aa]"
                  data-testid="transaction-attach-file"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-3 w-3 mr-1" /> {uploading ? t('forms.saving') : t('transactionDetail.attachFile')}
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />
                {tx.attachment_url && (
                  <a href={tx.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-[#0f48aa] underline">
                    {t('contractWizard.attachedFile')}
                  </a>
                )}
              </>
            )}
          </div>
        </div>

        {tx.direction === 'Received' && (
          <div className="flex flex-wrap gap-x-12 gap-y-3">
            <DetailField label={counterpartLabel} value={counterpartName} />
            {tx.beekeeper_id && <DetailField label={t('beekeepersList.village')} value={tx.beekeepers?.villages?.name} />}
            <DetailField label={t('transactionDetail.products')} value={(tx.products || []).map((p) => `${p.product} (${p.quantity} ${p.unit})`).join(', ')} />
            <DetailField label={t('contractWizard.currency')} value={tx.currency} />
            <DetailField label={t('transactions.totalAmount')} value={tx.total_amount != null ? Number(tx.total_amount).toLocaleString() : null} />
          </div>
        )}

        {tx.direction === 'Send' && (
          <>
            <h3 className="text-sm font-black text-[#032b71] mt-4 mb-2">{t('transactionDetail.destinationDetails')}</h3>
            <div className="flex flex-wrap gap-x-12 gap-y-3 mb-3">
              <DetailField label={t('transactionDetail.actor')} value={tx.actors?.contact_name} />
              <DetailField label={t('actorProfile.actorType')} value={tx.actors?.country} />
              <DetailField label={t('contractWizard.product')} value={tx.product} />
              <DetailField label={t('sendForm.quantityRequired')} value={tx.total_quantity != null ? `${tx.total_quantity} Kg` : null} />
              <DetailField label={t('transactions.totalAmount')} value={tx.total_amount != null ? `${Number(tx.total_amount).toLocaleString()} ${tx.currency || ''}` : null} />
            </div>
            <p className="text-xs text-[#7089b4] mb-1">{t('transactionDetail.destinationBatches')}</p>
            <BatchChips batches={destinationBatchChips} testId="transaction-destination-batches" />
          </>
        )}

        {tx.direction === 'Processing' && (
          <>
            <h3 className="text-sm font-black text-[#032b71] mt-4 mb-2">{t('transactionDetail.destinationDetails')}</h3>
            <div className="flex flex-wrap gap-x-12 gap-y-3 mb-3">
              <DetailField label={isMerging ? t('processForm.product') : t('processForm.convertedProduct')} value={tx.product} />
              <DetailField label={isMerging ? t('processForm.mergedQuantity') : t('receiveForm.quantity')} value={tx.total_quantity != null ? `${tx.total_quantity} Kg` : null} />
            </div>
            <p className="text-xs text-[#7089b4] mb-1">{t('transactionDetail.destinationBatches')}</p>
            <BatchChips batches={destinationBatchChips} testId="transaction-destination-batches" />

            {!isMerging && tx.quantity_lost > 0 && (
              <div className="bg-[#fdecea] border border-[#f3b8b3] rounded-[5px] p-3 mt-4" data-testid="transaction-quantity-lost-warning">
                <p className="text-sm text-[#ba550c] font-bold">
                  {t('transactionDetail.quantityLost', { quantity: tx.quantity_lost })}
                </p>
              </div>
            )}
          </>
        )}

        {(tx.direction === 'Send' || tx.direction === 'Processing') && (
          <>
            <h3 className="text-sm font-black text-[#032b71] mt-4 mb-2">{t('transactionDetail.sourceDetails')}</h3>
            <div className="flex flex-wrap gap-x-12 gap-y-3 mb-3">
              {tx.direction === 'Processing' && <DetailField label={t('processForm.sourceProduct')} value={tx.source_product} />}
              <DetailField
                label={tx.direction === 'Processing' ? t('processForm.sourceQuantity') : t('transactionDetail.sourceQuantity')}
                value={tx.direction === 'Processing' ? (tx.source_quantity != null ? `${tx.source_quantity} Kg` : null) : (tx.total_quantity != null ? `${tx.total_quantity} Kg` : null)}
              />
            </div>
            <p className="text-xs text-[#7089b4] mb-1">{t('transactionDetail.sourceBatches')}</p>
            <BatchChips batches={sourceBatchChips} testId="transaction-source-batches" />
          </>
        )}
      </div>
    </AppLayout>
  );
}
