import React from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import DetailField from '@/components/common/DetailField';
import ActorHeaderCard from '@/components/common/ActorHeaderCard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActor } from '@/hooks/useActors';

export default function CompanyProfile() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { data: currentActor } = useActor(profile?.current_actor_id);
  const actor = currentActor || {};

  const completeness = actor.profile_completeness ?? 0;
  const teamMembers = actor.team_members || [];

  return (
    <AppLayout hideDefaultHeader>
      <h1 className="text-lg font-black text-[#0f48aa] mb-4">{t('actorProfile.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div>
          <ActorHeaderCard
            name={actor.contact_name || '—'}
            logoUrl={actor.logo_url}
            pills={['Sustainable', 'Organic']}
            fields={[
              { label: t('actorProfile.actorType'), value: actor.actor_type },
              { label: t('actorProfile.traceabilityCode'), value: actor.traceability_code },
              { label: t('actorProfile.charterSigned'), value: 'Yes' },
              { label: t('actorProfile.connectId'), value: actor.connect_id },
            ]}
            action={
              <Button
                data-testid="company-profile-edit-button"
                variant="outline"
                className="border-[#0f48aa] text-[#0f48aa] bg-white hover:bg-[#f5f5f5]"
              >
                <Pencil className="h-4 w-4 mr-1" /> {t('actorProfile.edit')}
              </Button>
            }
          />

          <Tabs defaultValue="details">
            <TabsList className="bg-transparent border-b border-[#cfd8e6] p-0 rounded-none h-auto gap-6 justify-start">
              <TabsTrigger
                value="details"
                data-testid="company-tab-details"
                className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold"
              >
                {t('actorProfile.actorDetails')}
              </TabsTrigger>
              <TabsTrigger
                value="team"
                data-testid="company-tab-team"
                className="pb-3 rounded-none border-b-2 border-transparent data-[state=active]:border-[#0f48aa] data-[state=active]:bg-transparent data-[state=active]:text-[#0f48aa] data-[state=active]:shadow-none text-[#7089b4] font-bold flex items-center gap-2"
              >
                {t('actorProfile.teamMembers')}
                <span className="bg-[#0f48aa] text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {teamMembers.length}
                </span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="pt-5">
              <p className="text-xs text-[#7089b4] mb-1">{t('actorProfile.actorDescription')}</p>
              <p className="text-sm text-[#032b71] mb-5">{actor.description || '-'}</p>

              <h3 className="text-sm font-black text-[#032b71] mb-3">{t('actorProfile.address')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                <DetailField label={t('actorProfile.country')} value={actor.country} />
                <DetailField label={t('actorProfile.stateRegion')} value={actor.state_region} />
                <DetailField label={t('actorProfile.lga')} value={actor.lga_municipality} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                <DetailField label={t('actorProfile.village')} value={actor.village} />
              </div>

              <h3 className="text-sm font-black text-[#032b71] mb-3">{t('actorProfile.contactInformation')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <DetailField label={t('actorProfile.contactFullName')} value={actor.contact_name} />
                <DetailField label={t('actorProfile.contactEmail')} value={actor.contact_email} />
                <DetailField label={t('actorProfile.contactNumber')} value={actor.contact_phone} />
              </div>
            </TabsContent>

            <TabsContent value="team" className="pt-5">
              {teamMembers.length === 0 ? (
                <p className="text-sm text-[#7089b4]">{t('common.noRecordsFound')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {teamMembers.map((m) => (
                    <li key={m.id} className="text-sm text-[#032b71]">{m.name} — {m.role}</li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="bg-[#eaf2ff] border border-[#cfd8e6] rounded-[5px] p-5" data-testid="profile-completion-panel">
          <p className="text-sm font-bold text-[#032b71] mb-2">{t('actorProfile.profileCompleted')}</p>
          <p className="text-3xl font-black text-[#0f48aa] mb-3">{completeness}%</p>
          <Progress value={completeness} className="bg-[#c5cae9] [&>div]:bg-[#0f48aa] h-2" />
        </div>
      </div>
    </AppLayout>
  );
}
