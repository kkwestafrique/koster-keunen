import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBeekeeperTransactions } from '@/hooks/useTransactions';
import { formatDate } from '@/lib/dateFormat';

// Extracted from BeekeeperDetail.jsx (Gap 23, Low) — see HeaderCard.jsx
// for the full extraction rationale. Pure extraction, no logic changed.
export default function TransactionsTab({ beekeeperId }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: transactions = [] } = useBeekeeperTransactions(beekeeperId);

  if (transactions.length === 0) {
    return <p className="text-sm text-[#5a6f9a]" data-testid="bk-transactions-empty">{t('common.noRecordsFound')}</p>;
  }

  return (
    <table className="w-full text-sm" data-testid="bk-transactions-table">
      <thead>
        <tr className="text-left text-[#5a6f9a] border-b border-[#cfd8e6]">
          <th className="py-2">{t('transactions.date')}</th>
          <th className="py-2">{t('contractWizard.product')}</th>
          <th className="py-2">{t('transactions.quantityDelivered')}</th>
          <th className="py-2">{t('transactions.totalAmount')}</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((tx) => (
          <tr
            key={tx.id}
            data-testid={`bk-transaction-row-${tx.id}`}
            className="border-b border-[#f0f0f0] text-[#032b71] cursor-pointer hover:bg-[#f5f5f5]"
            onClick={() => navigate(`/transactions/${tx.direction.toLowerCase()}/${tx.transaction_code}`)}
          >
            <td className="py-2">{formatDate(tx.transaction_date)}</td>
            <td className="py-2">{tx.product}</td>
            <td className="py-2">{tx.quantity} {tx.unit}</td>
            <td className="py-2">{tx.total_amount != null ? tx.total_amount.toLocaleString() : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
