import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import StandardBadge from '@/components/common/StandardBadge';
import { ChevronLeft } from 'lucide-react';
import DetailPageSkeleton from '@/components/common/DetailPageSkeleton';
import { useStock, useTransactionForStock } from '@/hooks/useStocks';
import ChangeHistoryDialog from '@/components/common/ChangeHistoryDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatDateTime } from '@/lib/dateFormat';

// Gap 2: there was no way to click into a single stock batch to see its
// own full detail -- lists only. Also surfaces something that was never
// shown anywhere before: which real transaction actually created this
// batch (destination_stock_id has always existed on transactions, just
// never displayed).
export default function StockDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { data: stock, isLoading } = useStock(id);
  usePageTitle(stock?.product);
  const { data: originTransaction } = useTransactionForStock(id);
  const { canViewChangeHistory } = usePermissions();

  if (isLoading) return <AppLayout hideDefaultHeader><DetailPageSkeleton testId="stock-detail-skeleton" /></AppLayout>;
  if (!stock) return <AppLayout hideDefaultHeader><p className="text-[#5a6f9a]">{t('common.notFound')}</p></AppLayout>;

  return (
    <AppLayout hideDefaultHeader>
      <button
        data-testid="stock-detail-back"
        className="flex items-center gap-1 text-sm text-[#5a6f9a] hover:text-[#032b71] mb-4"
        onClick={() => navigate(-1)}
      >
        <ChevronLeft className="h-4 w-4" /> {t('common.back')}
      </button>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-black text-[#0f48aa]">{stock.product}</h1>
          <StandardBadge standard={stock.standard} />
        </div>
        {canViewChangeHistory && (
          <ChangeHistoryDialog tableName="stocks" recordId={stock.id} testId="stock-change-history-trigger" />
        )}
      </div>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 max-w-2xl">
        <div className="grid grid-cols-2 gap-5 mb-5">
          <DetailField label={t('stocks.batch')} value={stock.batch_reference} testId="stock-detail-batch-reference" />
          <DetailField label={t('stocks.stockType')} value={stock.stock_type} testId="stock-detail-stock-type" />
          <DetailField
            label={t('stocks.quantityAvailable')}
            value={`${stock.quantity_available} ${stock.unit || 'Kg'}`}
            testId="stock-detail-quantity"
          />
          <DetailField label={t('stocks.village')} value={stock.villages?.name} testId="stock-detail-village" />
          <DetailField
            label={t('stocks.createdOn')}
            value={stock.created_at ? formatDateTime(stock.created_at) : '-'}
            testId="stock-detail-created-on"
          />
        </div>

        <div className="border-t border-[#f0f0f0] pt-5">
          <p className="text-xs font-bold text-[#5a6f9a] mb-2">{t('stocks.origin')}</p>
          {originTransaction ? (
            <button
              data-testid="stock-detail-origin-transaction"
              className="text-sm text-[#0f48aa] font-medium hover:underline"
              onClick={() => navigate(`/transactions/${originTransaction.direction.toLowerCase()}/${originTransaction.transaction_code}`)}
            >
              {t('stocks.viewOriginTransaction', { code: originTransaction.transaction_code })}
            </button>
          ) : (
            <p className="text-sm text-[#5a6f9a]">{t('stocks.noOriginTransaction')}</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
