import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useBeekeeper } from '@/hooks/useBeekeepers';

export default function BeekeeperDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: bk, isLoading } = useBeekeeper(id);

  if (isLoading || !bk) {
    return (
      <AppLayout title={t('beekeeperDetail.title')}>
        <p className="text-[#7089b4]">{t('common.loading')}</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t('beekeeperDetail.title')}>
      <button
        data-testid="back-button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-[#7089b4] mb-4 hover:text-[#0f48aa]"
      >
        <ArrowLeft className="h-4 w-4" /> {t('actorProfile.back')}
      </button>

      <div className="bg-[#ebf6ff] border border-[#cfd8e6] rounded-[5px] p-6" data-testid="beekeeper-detail-card">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-md bg-white border border-[#cfd8e6] flex items-center justify-center">
              <span className="text-[#0f48aa] font-black text-xl">{bk.full_name?.[0]}</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-[#032b71]" data-testid="beekeeper-detail-name">{bk.full_name}</h2>
              <p className="text-sm text-[#7089b4]" data-testid="beekeeper-detail-code">{bk.traceability_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={bk.status} />
            <Button variant="outline" disabled className="border-[#0f48aa] text-[#0f48aa] bg-white">
              <Pencil className="h-4 w-4 mr-1" /> {t('actorProfile.edit')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <DetailField label={t('beekeepersList.gender')} value={bk.gender} testId="bk-field-gender" />
          <DetailField label={t('beekeepersList.village')} value={bk.villages?.name} testId="bk-field-village" />
          <DetailField label={t('actorProfile.actorType')} value={bk.actors?.contact_name} testId="bk-field-actor" />
          <DetailField label={t('beekeeperDetail.traditionalSingleHives')} value={bk.hives_traditional_single} testId="bk-field-hts" />
          <DetailField label={t('beekeeperDetail.traditionalDoubleHives')} value={bk.hives_traditional_double} testId="bk-field-htd" />
          <DetailField label={t('beekeeperDetail.modernHives')} value={bk.hives_modern} testId="bk-field-modern" />
          <DetailField label={t('beekeeperDetail.otherHives')} value={bk.hives_other} testId="bk-field-other" />
          <DetailField label={t('beekeeperDetail.totalHives')} value={bk.total_hives} testId="bk-field-total" />
          <DetailField label={t('beekeeperDetail.activeYears')} value={bk.active_years} testId="bk-field-years" />
        </div>
      </div>
    </AppLayout>
  );
}
