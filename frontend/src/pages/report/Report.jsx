import React from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';

export default function Report() {
  const { t } = useTranslation();

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('nav.report')}</h1>
      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-10 text-center text-sm text-[#7089b4]">
        {t('common.noRecordsFound')}
      </div>
    </AppLayout>
  );
}
