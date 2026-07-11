import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import StandardBadge from '@/components/common/StandardBadge';
import { ChevronLeft } from 'lucide-react';
import { useTransaction } from '@/hooks/useTransactions';

// Read-only transaction detail. Transactions are transactional records: no
// edit action is offered here by design, matching ContractDetail's approach —
// corrections happen upstream (a new entry), not by mutating recorded history.
// Fields shown differ by direction, since Received/Processing/Send each
// capture different data (per the live-site audit — these are structurally
// different forms, not one shape with unused fields).
export default function TransactionDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: tx, isLoading } = useTransaction(id);

  if (isLoading || !tx) {
    return (
      <AppLayout hideDefaultHeader>
        <p className="text-[#7089b4]">{t('common.loading')}</p>
      </AppLayout>
    );
  }

  const counterpart = tx.beekeepers?.full_name || tx.actors?.contact_name || t('contractDetail.noSupplier');

  return (
    <AppLayout hideDefaultHeader>
      <button
        data-testid="back-button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm font-bold text-[#0f48aa] mb-3 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> {t('actorProfile.back')}
      </button>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('transactionDetail.title')}</h1>

      <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6 mb-6" data-testid="transaction-detail-header">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-xl font-black text-[#032b71]">{counterpart}</h2>
          {tx.standard && <StandardBadge standard={tx.standard} />}
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#ebf6ff] text-[#0f48aa] border border-[#cfd8e6]">
            {tx.direction}
          </span>
        </div>

        <div className="flex flex-wrap gap-x-12 gap-y-3">
          <DetailField label={t('transactions.date')} value={tx.transaction_date} />

          {tx.direction === 'Processing' ? (
            <>
              <DetailField label={t('processForm.sourceProduct')} value={tx.source_product} />
              <DetailField label={t('processForm.sourceQuantity')} value={tx.source_quantity != null ? `${tx.source_quantity} ${tx.unit || ''}` : null} />
              <DetailField label={t('contractWizard.product')} value={tx.product} />
              <DetailField label={t('transactions.quantityDelivered')} value={tx.quantity != null ? `${tx.quantity} ${tx.unit || ''}` : null} />
            </>
          ) : (
            <>
              <DetailField label={t('contractWizard.product')} value={tx.product} />
              <DetailField label={t('transactions.quantityDelivered')} value={tx.quantity != null ? `${tx.quantity} ${tx.unit || ''}` : null} />
            </>
          )}

          {tx.direction !== 'Processing' && (
            <>
              <DetailField label={t('contractWizard.currency')} value={tx.currency} />
              <DetailField label={t('transactions.totalAmount')} value={tx.total_amount != null ? tx.total_amount.toLocaleString() : null} />
            </>
          )}

          {tx.direction === 'Received' && tx.beekeepers && (
            <DetailField label={t('beekeepersList.village')} value={tx.beekeepers.villages?.name} />
          )}

          {tx.direction === 'Send' && (
            <>
              <DetailField label={t('sendForm.invoiceNumber')} value={tx.invoice_number} />
              <DetailField label={t('sendForm.blNumber')} value={tx.bl_number} />
              <DetailField label={t('contracts.country')} value={tx.actors?.country} />
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
