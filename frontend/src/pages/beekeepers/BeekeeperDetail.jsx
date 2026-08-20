import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ChevronLeft } from 'lucide-react';
import { useBeekeeper } from '@/hooks/useBeekeepers';
import HeaderCard from './HeaderCard';
import DetailsTab from './DetailsTab';
import OverviewTab from './OverviewTab';
import TransactionsTab from './TransactionsTab';

// Gap 23 (Low): this file had grown to 652 lines across four page-level
// components (HeaderCard, DetailsTab, OverviewTab, TransactionsTab) all
// living in one file. Split into sibling files -- HeaderCard.jsx,
// DetailsTab.jsx, OverviewTab.jsx, TransactionsTab.jsx, all in this same
// folder -- matching the existing convention already used elsewhere in
// this codebase (CompanyProfile.jsx / SharingPanel.jsx). Pure extraction:
// every extracted file's logic and JSX is unchanged from what was here
// before, just moved. This file is now only the page shell: route param,
// loading state, and the tab structure.
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
    <AppLayout hideDefaultHeader>
      <button
        data-testid="back-button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm font-bold text-[#0f48aa] mb-3 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> {t('actorProfile.back')}
      </button>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('beekeeperDetail.title')}</h1>

      <HeaderCard bk={bk} />

      <Tabs defaultValue="details">
        <TabsList className="bg-transparent border-b border-[#cfd8e6] p-0 rounded-none h-auto gap-6 justify-start">
          <TabsTrigger value="details" data-testid="bk-tab-details" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold">
            {t('beekeeperDetail.beekeeperDetails')}
          </TabsTrigger>
          <TabsTrigger value="overview" data-testid="bk-tab-overview" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold">
            {t('beekeeperDetail.overview')}
          </TabsTrigger>
          <TabsTrigger value="transactions" data-testid="bk-tab-transactions" className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold">
            {t('actorProfile.transactions')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="pt-5">
          <DetailsTab bk={bk} />
        </TabsContent>
        <TabsContent value="overview" className="pt-5">
          <OverviewTab bk={bk} />
        </TabsContent>
        <TabsContent value="transactions" className="pt-5">
          <TransactionsTab beekeeperId={bk.id} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
