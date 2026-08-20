import React, { useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import StandardBadge from '@/components/common/StandardBadge';
import StatusBadge from '@/components/common/TransactionStatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ChevronLeft, Paperclip } from 'lucide-react';
import { useTransaction, useTransactionBatchSelections, useApproveTransaction, useRejectTransaction } from '@/hooks/useTransactions';
import { uploadMediaFile, supabase, MEDIA_ACCEPT_ATTR } from '@/lib/supabaseClient';
import ChangeHistoryDialog from '@/components/common/ChangeHistoryDialog';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useActingActor } from '@/hooks/useActors';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

// NOTE: this audit was text-only (no screenshots, unlike Contracts), so
// exact pixel layout here is less certain than elsewhere in this rebuild —
// built to the documented field/section structure using established
// visual patterns from the rest of the app (DetailField, StandardBadge,
// warning-banner styling) rather than a screenshot-verified layout.
// Worth a direct check against the live site before treating this as
// pixel-final the way Contracts was.

function BatchChips({ batches, testId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!batches || batches.length === 0) return <span className="text-sm text-[#7089b4]">—</span>;
  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {batches.map((b, idx) =>
        b.stockId ? (
          <button
            key={idx}
            type="button"
            data-testid={`${testId}-link-${idx}`}
            onClick={() => navigate(`/stocks/detail/${b.stockId}`)}
            className="inline-flex items-center gap-1 bg-[#ebf6ff] border border-[#cfd8e6] rounded-full px-3 py-1 text-xs text-[#0f48aa] hover:underline hover:border-[#0f48aa] transition-colors cursor-pointer"
          >
            {b.label} {b.quantity != null && <span className="font-bold">{b.quantity} {b.unit || 'Kg'}</span>}
          </button>
        ) : (
          <span key={idx} className="inline-flex items-center gap-1 bg-[#ebf6ff] border border-[#cfd8e6] rounded-full px-3 py-1 text-xs text-[#032b71]">
            {b.label} {b.quantity != null && <span className="font-bold">{b.quantity} {b.unit || 'Kg'}</span>}
          </span>
        )
      )}
    </div>
  );
}

export default function TransactionDetail() {
  const { t } = useTranslation();
  const { id: transactionCode } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { supplyChainId } = useAuth();
  const { canApprove, canViewChangeHistory } = usePermissions();
  const { data: tx, isLoading } = useTransaction(transactionCode);
  const { data: sourceBatches = [] } = useTransactionBatchSelections(tx?.transaction_group_id);
  const approveTransaction = useApproveTransaction();
  const rejectTransaction = useRejectTransaction();
  const { isReadOnly } = useActingActor();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [rejecting, setRejecting] = useState(false);

  if (isLoading) {
    return (
      <AppLayout hideDefaultHeader>
        <p className="text-[#7089b4]">{t('common.loading')}</p>
      </AppLayout>
    );
  }
  if (!tx) {
    return (
      <AppLayout hideDefaultHeader>
        <p className="text-[#7089b4]" data-testid="transaction-not-found">{t('common.noRecordsFound')}</p>
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
    stockId: s.stocks?.id,
  }));
  const destinationBatchChips = (tx.products || [])
    .filter((p) => p.destination_batch)
    .map((p) => ({ label: p.destination_batch, quantity: p.quantity, unit: p.unit }));

  const handleApprove = async () => {
    try {
      await approveTransaction.mutateAsync(tx.transaction_group_id);
      toast({ title: t('transactionDetail.approved') });
    } catch (err) {
      toast({ title: t('transactionDetail.approveFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    }
  };
  const handleReject = async () => {
    if (!rejectReason) return;
    setRejecting(true);
    try {
      await rejectTransaction.mutateAsync({
        transactionGroupId: tx.transaction_group_id,
        reason: rejectReason,
        comment: rejectComment,
      });
      toast({ title: t('transactionDetail.rejected') });
      setRejectDialogOpen(false);
      setRejectReason('');
      setRejectComment('');
    } catch (err) {
      toast({ title: t('transactionDetail.rejectFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
    } finally {
      setRejecting(false);
    }
  };
  const handleAttachFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMediaFile(file, 'transactions', supplyChainId);
      const { error } = await supabase.rpc('attach_transaction_file', {
        p_transaction_group_id: tx.transaction_group_id,
        p_attachment_url: url,
      });
      if (error) throw error;
      toast({ title: t('transactionDetail.fileAttached') });
    } catch (err) {
      toast({ title: t('transactionDetail.attachFailed'), description: getFriendlyErrorMessage(err), variant: 'destructive' });
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
        <div className="flex items-center gap-3">
          {canViewChangeHistory && (
            <ChangeHistoryDialog tableName="transactions" groupId={tx.transaction_group_id} testId="transaction-change-history-trigger" />
          )}
          {tx.direction !== 'Processing' && <StatusBadge status={tx.status} />}
        </div>
      </div>

      {tx.direction === 'Received' && tx.status === 'Pending' && (
        <div className="bg-[#fffaec] border border-[#f2e4b3] rounded-[5px] p-4 mb-6 flex items-center justify-between" data-testid="transaction-pending-banner">
          <p className="text-sm text-[#79730a] font-bold">{t('transactionDetail.notYetApproved')}</p>
          {canApprove && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="border-[#ba550c] text-[#ba550c] disabled:opacity-50 disabled:cursor-not-allowed" data-testid="transaction-reject" disabled={isReadOnly} title={isReadOnly ? t('common.readOnlyActorTooltip') : undefined} onClick={() => setRejectDialogOpen(true)}>
                {t('transactionDetail.rejectTransaction')}
              </Button>
              <Button size="sm" className="bg-[#0f48aa] text-white hover:bg-[#0d3d91] disabled:opacity-50 disabled:cursor-not-allowed" data-testid="transaction-approve" disabled={isReadOnly} title={isReadOnly ? t('common.readOnlyActorTooltip') : undefined} onClick={handleApprove}>
                {t('transactionDetail.approveTransaction')}
              </Button>
            </div>
          )}
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
                  className="border-[#0f48aa] text-[#0f48aa] disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="transaction-attach-file"
                  disabled={uploading || isReadOnly}
                  title={isReadOnly ? t('common.readOnlyActorTooltip') : undefined}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-3 w-3 mr-1" /> {uploading ? t('forms.saving') : t('transactionDetail.attachFile')}
                </Button>
                <input ref={fileInputRef} type="file" accept={MEDIA_ACCEPT_ATTR} className="hidden" onChange={handleAttachFile} />
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
              <DetailField label={t('actorProfile.actorType')} value={tx.actors?.actor_type} />
              <DetailField label={t('contractWizard.product')} value={tx.product} />
              <DetailField label={t('sendForm.quantityRequired')} value={tx.total_quantity != null ? `${tx.total_quantity} Kg` : null} />
              <DetailField label={t('contractWizard.currency')} value={tx.currency} />
              <DetailField label={t('transactions.totalAmount')} value={tx.total_amount != null ? Number(tx.total_amount).toLocaleString() : null} />
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

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#032b71] font-black">{t('transactionDetail.rejectTransaction')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[#7089b4]">{t('transactionDetail.rejectReason')}</Label>
              <Select value={rejectReason} onValueChange={setRejectReason}>
                <SelectTrigger data-testid="reject-reason"><SelectValue placeholder={t('transactionDetail.selectRejectReason')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Wrong quantity">{t('transactionDetail.reasonWrongQuantity')}</SelectItem>
                  <SelectItem value="Wrong product">{t('transactionDetail.reasonWrongProduct')}</SelectItem>
                  <SelectItem value="Quality issue">{t('transactionDetail.reasonQualityIssue')}</SelectItem>
                  <SelectItem value="Not expected">{t('transactionDetail.reasonNotExpected')}</SelectItem>
                  <SelectItem value="Other">{t('transactionDetail.reasonOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[#7089b4]">{t('transactionDetail.rejectComment')}</Label>
              <Textarea
                data-testid="reject-comment"
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder={t('transactionDetail.rejectCommentPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" className="border-[#cfd8e6] text-[#032b71]" onClick={() => setRejectDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              data-testid="reject-confirm"
              disabled={!rejectReason || rejecting}
              onClick={handleReject}
              className="bg-[#ba550c] text-white hover:bg-[#a34a0a]"
            >
              {rejecting ? t('forms.saving') : t('transactionDetail.rejectTransaction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
