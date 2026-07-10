import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import ActorHeaderCard from '@/components/common/ActorHeaderCard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ChevronLeft } from 'lucide-react';
import { useActor } from '@/hooks/useActors';

export default function ActorDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: actor, isLoading } = useActor(id);
  const [active, setActive] = useState(true);

  if (isLoading || !actor) {
    return (
      <AppLayout hideDefaultHeader>
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
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('actorProfile.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div>
          <ActorHeaderCard
            name={actor.contact_name}
            logoUrl={actor.logo_url}
            pills={[actor.standard || 'Sustainable']}
            fields={[
              { label: t('actorProfile.actorType'), value: actor.actor_type },
              { label: t('actorProfile.traceabilityCode'), value: actor.traceability_code },
              { label: t('actorProfile.charterSigned'), value: actor.charter_signed ? 'Yes' : 'No' },
            ]}
          />

          <Tabs defaultValue="details">
            <TabsList className="bg-transparent border-b border-[#cfd8e6] p-0 rounded-none h-auto gap-6 justify-start">
              <TabsTrigger
                value="details"
                data-testid="actor-tab-details"
                className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold"
              >
                {t('actorProfile.actorDetails')}
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                data-testid="actor-tab-transactions"
                className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold"
              >
                {t('actorProfile.transactions')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="pt-5">
              <p className="text-xs text-[#7089b4] mb-1">{t('actorProfile.actorDescription')}</p>
              <p className="text-sm text-[#032b71] mb-5">{actor.description || '-'}</p>

              <h3 className="text-sm font-black text-[#032b71] mb-3">{t('actorProfile.address')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                <DetailField label={t('actorProfile.country')} value={actor.country} testId="actor-field-country" />
                <DetailField label={t('actorProfile.stateRegion')} value={actor.state_region} testId="actor-field-state" />
                <DetailField label={t('actorProfile.lga')} value={actor.lga_municipality} testId="actor-field-lga" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                <DetailField label={t('actorProfile.village')} value={actor.village} testId="actor-field-village" />
              </div>

              <h3 className="text-sm font-black text-[#032b71] mb-3">{t('actorProfile.contactInformation')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DetailField label={t('actorProfile.contactFullName')} value={actor.contact_name} testId="actor-field-contact-name" />
                <DetailField label={t('actorProfile.contactEmail')} value={actor.contact_email} testId="actor-field-email" />
                <DetailField label={t('actorProfile.contactNumber')} value={actor.contact_phone} testId="actor-field-phone" />
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="pt-5">
              <p className="text-sm text-[#7089b4]">{t('common.noRecordsFound')}</p>
            </TabsContent>
          </Tabs>
        </div>

        <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5 flex items-center justify-between gap-4" data-testid="actor-connection-panel">
          <div>
            <p className="text-sm font-bold text-[#032b71]">{t('actorProfile.enableDisableConnection')}</p>
            <p className="text-xs text-[#219653] font-medium mt-1">{t('actorProfile.statusActive')}</p>
          </div>
          <Switch checked={active} onCheckedChange={setActive} data-testid="actor-connection-toggle" />
        </div>
      </div>
    </AppLayout>
  );
}
