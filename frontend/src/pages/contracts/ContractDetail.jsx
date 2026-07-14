import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import StandardBadge from '@/components/common/StandardBadge';
import { ChevronLeft } from 'lucide-react';
import { useContract } from '@/hooks/useContracts';

// Read-only contract detail. Contracts are transactional records: no edit
// action is offered here by design — corrections happen upstream, not by
// mutating signed contract data.
export default function ContractDetail() {
  const { t } = useTranslation();
  const { id: contractCode } = useParams();
  const navigate = useNavigate();
  const { data: contract, isLoading } = useContract(contractCode);

  if (isLoading || !contract) {
    return (
      <AppLayout hideDefaultHeader>
        <p className="text-[#7089b4]">{t('common.loading')}</p>
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
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('contractDetail.title')}</h1>

      <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6 mb-6" data-testid="contract-detail-header">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-black text-[#032b71]">
            {contract.actors?.contact_name || t('contractDetail.noSupplier')}
          </h2>
          <StandardBadge standard={contract.standard} />
        </div>
        <div className="flex flex-wrap gap-x-12 gap-y-3">
          <DetailField label={t('contractDetail.contractId')} value={contract.contract_code} />
          <DetailField label={t('contracts.year')} value={contract.year} />
          <DetailField label={t('contracts.type')} value={contract.contract_type} />
          <DetailField label={t('contracts.country')} value={contract.actors?.country} />
          <DetailField label={t('contracts.signatureDate')} value={contract.signature_date} />
          <DetailField label={t('contracts.totalQuantityExpected')} value={contract.total_quantity_expected != null ? `${contract.total_quantity_expected} Kg` : null} />
          <DetailField label={t('contractWizard.currency')} value={contract.currency} />
          <DetailField label={t('contractWizard.advanceAmountPaid')} value={contract.advance_amount_paid} />
          <DetailField label={t('contractWizard.advancePercent')} value={contract.advance_percent != null ? `${contract.advance_percent}%` : null} />
        </div>
      </div>

      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6" data-testid="contract-detail-products">
        <h3 className="text-sm font-black text-[#032b71] mb-3">{t('contractWizard.products')}</h3>
        {products.length === 0 ? (
          <p className="text-sm text-[#7089b4]">{t('common.noRecordsFound')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#7089b4] border-b border-[#cfd8e6]">
                <th className="py-2">{t('contractWizard.product')}</th>
                <th className="py-2">{t('contractWizard.expectedQuantity')}</th>
                <th className="py-2">{t('contractWizard.unit')}</th>
                <th className="py-2">{t('contractWizard.price')}</th>
              </tr>
            </thead>
            <tbody>
              {products.map((row, idx) => (
                <tr key={idx} className="border-b border-[#f0f0f0] text-[#032b71]">
                  <td className="py-2">{row.product}</td>
                  <td className="py-2">{row.expected_quantity}</td>
                  <td className="py-2">{row.unit}</td>
                  <td className="py-2">{row.price || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {contract.comments && (
          <div className="mt-4">
            <span className="text-xs text-[#7089b4]">{t('contractWizard.comments')}</span>
            <p className="text-sm text-[#032b71]">{contract.comments}</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
