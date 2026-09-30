import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useTour, DASHBOARD_TOUR_STEPS } from '@/contexts/TourContext';
import { useMarkOnboardingSeen } from '@/hooks/useMyProfile';
import { useAllActorsLite, useActorTypeCounts } from '@/hooks/useActors';
import { useBeekeeperAggregates } from '@/hooks/useBeekeepers';
import { useDashboardTransactionSummary } from '@/hooks/useTransactions';
import { useCountries } from '@/hooks/useReferenceData';
import { COUNTRIES } from '@/data/regions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useContractYears } from '@/hooks/useContracts';
import { useSeasonMetrics } from '@/hooks/useSeasonMetrics';
import { useSeasonPurchases } from '@/hooks/useSeasonPurchases';
import { useSeasonMonthly } from '@/hooks/useSeasonMonthly';
import { useSeasonStocks } from '@/hooks/useSeasonStocks';
import { useIndicatorsQuality } from '@/hooks/useIndicatorsQuality';
import { useIndicatorsYearly } from '@/hooks/useIndicatorsYearly';
import { useIndicatorsLocalPartners } from '@/hooks/useIndicatorsLocalPartners';
import { useBeekeepersInvolved } from '@/hooks/useBeekeepersInvolved';
import { useBeekeepersTrends } from '@/hooks/useBeekeepersTrends';
import { useFinanceRevenue } from '@/hooks/useFinanceRevenue';
import { useFinanceContracts } from '@/hooks/useFinanceContracts';
import StatCard from './dashboard/StatCard';
import ChartCard from './dashboard/ChartCard';
import TransactionsTab from './dashboard/tabs/TransactionsTab';
import SeasonTab from './dashboard/tabs/SeasonTab';
import IndicatorsTab from './dashboard/tabs/IndicatorsTab';

const ACTOR_TYPE_COLORS = {
  'Producer Organisation': '#0f48aa',
  Aggregator: '#2d9cdb',
  'Local Partner': '#6fcf97',
  Buyer: '#f2c94c',
};

const HIVE_COLORS = { Traditional: '#0f48aa', Modern: '#9fb6dd', Other: '#c5cae9' };
const GENDER_COLORS = { Male: '#0f48aa', Female: '#9fb6dd', Other: '#219653' };

export default function Dashboard() {
  const { t } = useTranslation();
  usePageTitle(t('dashboard.title'));
  const { profile } = useAuth();
  const { isActive: tourActive, startTour } = useTour();
  const markOnboardingSeen = useMarkOnboardingSeen();
  // Real gap closed: has_seen_onboarding and the tour's own visual
  // engine were both built earlier, but nothing ever actually started
  // the tour -- confirmed with Babs this should auto-start on a real
  // user's first login, using the exact value already stored in the
  // database (not localStorage, so it stays consistent across
  // devices). Only fires when the value is explicitly false, not on
  // every render or while profile is still loading (null/undefined).
  useEffect(() => {
    if (profile?.has_seen_onboarding === false) {
      startTour(DASHBOARD_TOUR_STEPS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.has_seen_onboarding]);
  // Marks it seen the moment the tour actually ends (completed or
  // skipped) -- watches isActive's own true-to-false transition rather
  // than hooking into next()/skip() directly, so this works
  // regardless of which one the person used to end it.
  const wasTourActive = React.useRef(false);
  useEffect(() => {
    if (wasTourActive.current && !tourActive && profile?.id) {
      markOnboardingSeen.mutate(profile.id);
    }
    wasTourActive.current = tourActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourActive]);
  const { data: actors = [] } = useAllActorsLite();
  const [tab, setTab] = useState('season');
  const [country, setCountry] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [year, setYear] = useState('2026');
  const { data: contractYears = [] } = useContractYears();
  // Always include the current default even before the query resolves,
  // and even if there happen to be zero contracts yet for some year.
  const yearOptions = [...new Set([2026, 2025, 2024, ...contractYears])].sort((a, b) => b - a);

  const { data: actorCounts, isLoading: actorCountsLoading } = useActorTypeCounts({ country });
  const { data: bkAgg, isLoading: bkAggLoading } = useBeekeeperAggregates({ country });
  const { data: txSummary } = useDashboardTransactionSummary({ year });
  const { data: seasonMetrics } = useSeasonMetrics({ year });
  const { data: seasonPurchases } = useSeasonPurchases({ year });
  const { data: seasonMonthly } = useSeasonMonthly({ year });
  const { data: seasonStocks } = useSeasonStocks({ year });
  const { data: indicatorsQuality } = useIndicatorsQuality({ year });
  const { data: indicatorsYearly } = useIndicatorsYearly();
  const { data: indicatorsLocalPartners } = useIndicatorsLocalPartners({ year });
  const { data: beekeepersInvolved } = useBeekeepersInvolved({ year });
  const { data: beekeepersTrends } = useBeekeepersTrends({ year });
  const { data: financeRevenue } = useFinanceRevenue({ year });
  const { data: financeContracts } = useFinanceContracts({ year });
  const { data: countries = [] } = useCountries();

  const currentActor = actors.find((a) => a.id === profile?.current_actor_id);

  return (
    <AppLayout hideDefaultHeader>
      <div className="bg-[#f9fafc] px-0 -m-8 mb-0 pb-8">
        {/* Header block */}
        <div className="bg-[#f9fafc] px-8 py-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-black text-[#0f48aa]" data-testid="dashboard-title">
              {t('dashboard.title')}
            </h1>
            <p className="text-[15px] text-[#032b71]" data-testid="dashboard-welcome">
              {t('dashboard.greeting', {
                name: profile?.username || 'there',
                company: currentActor?.contact_name || 'your organisation',
              })}
            </p>
          </div>

          <div className="flex flex-wrap gap-6">
            <StatCard
              label={t('dashboard.localPartners')}
              value={actorCounts?.byType?.['Local Partner']}
              isLoading={actorCountsLoading}
              testId="stat-local-partners"
            />
            <StatCard
              label={t('dashboard.aggregators')}
              value={actorCounts?.byType?.Aggregator}
              isLoading={actorCountsLoading}
              testId="stat-aggregators"
            />
            <StatCard
              label={t('dashboard.producerOrganisations')}
              value={actorCounts?.byType?.['Producer Organisation']}
              isLoading={actorCountsLoading}
              testId="stat-producer-orgs"
            />
            <StatCard label={t('dashboard.beekeepersLabel')} value={bkAgg?.total} isLoading={bkAggLoading} testId="stat-beekeepers" />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8">
          <div className="flex" data-testid="dashboard-tabs">
            <button
              data-testid="dashboard-tab-season"
              onClick={() => setTab('season')}
              className={`px-4 h-10 text-sm font-bold border-b-2 transition-colors ${
                tab === 'season'
                  ? 'bg-white text-[#0f48aa] border-[#0f48aa]'
                  : 'bg-[#e8ecf3] text-[#5a6f9a] border-transparent'
              }`}
            >
              {t('dashboard.supplyChainOverview')}
            </button>
            <button
              data-testid="dashboard-tab-indicators"
              onClick={() => setTab('indicators')}
              className={`px-4 h-10 text-sm font-bold border-b-2 transition-colors ${
                tab === 'indicators'
                  ? 'bg-white text-[#0f48aa] border-[#0f48aa]'
                  : 'bg-[#e8ecf3] text-[#5a6f9a] border-transparent'
              }`}
            >
              {t('dashboard.indicatorsTab')}
            </button>
            <button
              data-testid="dashboard-tab-transactions"
              onClick={() => setTab('transactions')}
              className={`px-4 h-10 text-sm font-bold border-b-2 transition-colors ${
                tab === 'transactions'
                  ? 'bg-white text-[#0f48aa] border-[#0f48aa]'
                  : 'bg-[#e8ecf3] text-[#5a6f9a] border-transparent'
              }`}
            >
              {t('dashboard.transactionOverview')}
            </button>
          </div>

          {/* Filter bar */}
          <div className="bg-white border border-[#cfd8e6] rounded-b-[5px] px-8 py-4 flex flex-col gap-2">
            <span className="text-[13px] text-[#5a6f9a]">
              {tab === 'transactions' ? t('dashboard.filterHintTransactions') : t('dashboard.filterHint')}
            </span>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#032b71]">{t('dashboard.country')}</span>
                <Select value={country || 'all'} onValueChange={(v) => setCountry(v === 'all' ? '' : v)}>
                  <SelectTrigger data-testid="dashboard-filter-country" className="w-[180px] bg-white border-[#cfd8e6]">
                    <SelectValue placeholder={t('dashboard.allCountry')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('dashboard.allCountry')}</SelectItem>
                    {(countries.length > 0
                      ? countries.map((c) => ({ key: c.name, value: c.name, label: c.name }))
                      : COUNTRIES.map((c) => ({ key: c, value: c, label: c }))
                    ).map((c) => (
                      <SelectItem key={c.key} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#032b71]">{t('dashboard.actors')}</span>
                <Select value={actorFilter || 'all'} onValueChange={(v) => setActorFilter(v === 'all' ? '' : v)}>
                  <SelectTrigger data-testid="dashboard-filter-actor-type" className="w-[180px] bg-white border-[#cfd8e6]">
                    <SelectValue placeholder={t('dashboard.allActors')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('dashboard.allActors')}</SelectItem>
                    {Object.keys(ACTOR_TYPE_COLORS).map((tName) => (
                      <SelectItem key={tName} value={tName}>{tName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#032b71]">{t('dashboard.year')}</span>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger data-testid="dashboard-filter-year" className="w-[140px] bg-white border-[#cfd8e6]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="px-8 pt-6">
          {tab === 'transactions' ? (
            <TransactionsTab txSummary={txSummary} />
          ) : tab === 'season' ? (
            <SeasonTab
              seasonMetrics={seasonMetrics}
              seasonPurchases={seasonPurchases}
              seasonMonthly={seasonMonthly}
              seasonStocks={seasonStocks}
              countries={countries}
              year={year}
            />
          ) : (
            <IndicatorsTab
              indicatorsQuality={indicatorsQuality}
              indicatorsYearly={indicatorsYearly}
              indicatorsLocalPartners={indicatorsLocalPartners}
              beekeepersInvolved={beekeepersInvolved}
              beekeepersTrends={beekeepersTrends}
              financeRevenue={financeRevenue}
              financeContracts={financeContracts}
              year={year}
              country={country}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
