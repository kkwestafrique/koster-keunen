import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
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
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useContractYears } from '@/hooks/useContracts';

function StatCard({ label, value, testId }) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1 justify-center flex-1"
    >
      <span className="text-[28px] font-bold text-[#032b71]">{value ?? '—'}</span>
      <span className="text-xs text-[#5a6f9a]">{label}</span>
    </div>
  );
}

function ChartCard({ title, controls, children, testId, isEmpty }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid={testId}
      className="bg-white border border-[#cfd8e6] rounded-[5px] p-4 flex-1 min-w-[300px]"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#032b71]">{title}</h3>
        {controls}
      </div>
      {/* Real bug found via independent audit (BUG-33): a chart with
          zero real data rendered as a blank card with no visible
          content and no explanation -- indistinguishable from a
          loading state or a genuine bug. Fixed once here, shared by
          every chart on this page. */}
      {/* Real gap found via independent audit (A1): SVG charts had no
          accessible name at all -- a screen reader announces raw,
          meaningless SVG markup instead of what the chart actually
          shows. Wrapping the real chart content (not the empty-state
          text, which is already plain, readable text) in role="img"
          with the same title already shown visually tells assistive
          tech to treat the whole chart as one described image rather
          than trying to narrate its internal SVG structure. Fixed once
          here, shared by every chart on this page. */}
      {isEmpty ? (
        <div className="flex items-center justify-center h-[260px] text-sm text-[#5a6f9a]" data-testid={`${testId}-empty`}>
          {t('common.noDataAvailable')}
        </div>
      ) : (
        <div role="img" aria-label={typeof title === 'string' ? title : undefined}>
          {children}
        </div>
      )}
    </div>
  );
}

const ACTOR_TYPE_COLORS = {
  'Producer Organisation': '#0f48aa',
  Aggregator: '#2d9cdb',
  'Local Partner': '#6fcf97',
  Buyer: '#f2c94c',
};

const HIVE_COLORS = { Traditional: '#0f48aa', Modern: '#9fb6dd', Other: '#c5cae9' };
const GENDER_COLORS = { Male: '#0f48aa', Female: '#9fb6dd', Other: '#219653' };

const CATEGORY_TRANSLATION_KEY = {
  'Producer Organisation': 'dashboard.categoryProducerOrganisation',
  Aggregator: 'dashboard.categoryAggregator',
  'Local Partner': 'dashboard.categoryLocalPartner',
  Buyer: 'dashboard.categoryBuyer',
  Traditional: 'dashboard.categoryTraditional',
  Modern: 'dashboard.categoryModern',
  Other: 'dashboard.categoryOther',
  Male: 'dashboard.categoryMale',
  Female: 'dashboard.categoryFemale',
};

export default function Dashboard() {
  const { t } = useTranslation();
  usePageTitle(t('dashboard.title'));
  const { profile } = useAuth();
  const { data: actors = [] } = useAllActorsLite();
  const [tab, setTab] = useState('supply');
  const [country, setCountry] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [year, setYear] = useState('2026');
  const { data: contractYears = [] } = useContractYears();
  // Always include the current default even before the query resolves,
  // and even if there happen to be zero contracts yet for some year.
  const yearOptions = [...new Set([2026, 2025, 2024, ...contractYears])].sort((a, b) => b - a);

  const { data: actorCounts } = useActorTypeCounts({ country });
  const { data: bkAgg } = useBeekeeperAggregates({ country });
  const { data: txSummary } = useDashboardTransactionSummary({ year });
  const { data: countries = [] } = useCountries();

  const currentActor = actors.find((a) => a.id === profile?.current_actor_id);

  const actorTypeData = actorCounts
    ? Object.entries(actorCounts.byType)
        .filter(([name, v]) => v > 0 && (!actorFilter || name === actorFilter))
        .map(([name, value]) => ({ name, translatedName: t(CATEGORY_TRANSLATION_KEY[name] || name), value }))
    : [];

  const hiveData = bkAgg
    ? [
        { name: 'Traditional', translatedName: t('dashboard.categoryTraditional'), value: bkAgg.traditional },
        { name: 'Modern', translatedName: t('dashboard.categoryModern'), value: bkAgg.modern },
        { name: 'Other', translatedName: t('dashboard.categoryOther'), value: bkAgg.other },
      ].filter((d) => d.value > 0)
    : [];

  const genderData = bkAgg
    ? [
        { name: 'Male', translatedName: t('dashboard.categoryMale'), value: bkAgg.male },
        { name: 'Female', translatedName: t('dashboard.categoryFemale'), value: bkAgg.female },
        { name: 'Other', translatedName: t('dashboard.categoryOther'), value: bkAgg.genderOther },
      ].filter((d) => d.value > 0)
    : [];

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
              testId="stat-local-partners"
            />
            <StatCard
              label={t('dashboard.aggregators')}
              value={actorCounts?.byType?.Aggregator}
              testId="stat-aggregators"
            />
            <StatCard
              label={t('dashboard.producerOrganisations')}
              value={actorCounts?.byType?.['Producer Organisation']}
              testId="stat-producer-orgs"
            />
            <StatCard label={t('dashboard.beekeepers')} value={bkAgg?.total} testId="stat-beekeepers" />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8">
          <div className="flex" data-testid="dashboard-tabs">
            <button
              data-testid="dashboard-tab-supply"
              onClick={() => setTab('supply')}
              className={`px-4 h-10 text-sm font-bold border-b-2 transition-colors ${
                tab === 'supply'
                  ? 'bg-white text-[#0f48aa] border-[#0f48aa]'
                  : 'bg-[#e8ecf3] text-[#5a6f9a] border-transparent'
              }`}
            >
              {t('dashboard.supplyChainOverview')}
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
            <div className="flex gap-4">
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
          {tab === 'supply' ? (
            <div className="flex flex-wrap gap-6" data-testid="dashboard-charts-supply">
              <ChartCard
                title={t("dashboard.actorTypeDistribution")}
                testId="chart-actor-types"
                isEmpty={actorTypeData.length === 0 || actorTypeData.every((d) => !d.value)}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={actorTypeData} dataKey="value" nameKey="translatedName" innerRadius={55} outerRadius={90} isAnimationActive={false}>
                      {actorTypeData.map((entry) => (
                        <Cell key={entry.name} fill={ACTOR_TYPE_COLORS[entry.name] || '#cfd8e6'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title={t("dashboard.totalHivesInstalled")}
                testId="chart-hives"
                isEmpty={hiveData.length === 0 || hiveData.every((d) => !d.value)}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={hiveData} dataKey="value" nameKey="translatedName" innerRadius={55} outerRadius={90} isAnimationActive={false}>
                      {hiveData.map((entry) => (
                        <Cell key={entry.name} fill={HIVE_COLORS[entry.name] || '#cfd8e6'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard
                title={t("dashboard.beekeepersOverview")}
                testId="chart-gender"
                isEmpty={genderData.length === 0 || genderData.every((d) => !d.value)}
              >
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={genderData} dataKey="value" nameKey="translatedName" innerRadius={55} outerRadius={90} isAnimationActive={false}>
                      {genderData.map((entry) => (
                        <Cell key={entry.name} fill={GENDER_COLORS[entry.name] || '#cfd8e6'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          ) : (
            <div className="flex flex-wrap gap-6" data-testid="dashboard-charts-transactions">
              <ChartCard title={t('dashboard.transactionOverview')} testId="chart-transactions-by-direction">
                {txSummary && txSummary.total > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={[
                        { name: t('nav.received'), value: txSummary.byDirection.Received },
                        { name: t('nav.processing'), value: txSummary.byDirection.Processing },
                        { name: t('nav.send'), value: txSummary.byDirection.Send },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#0f48aa" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[#5a6f9a] text-center py-16">{t('common.noRecordsFound')}</p>
                )}
              </ChartCard>

              <ChartCard title={t('contractWizard.products')} testId="chart-transactions-by-product">
                {txSummary && txSummary.byProduct.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={txSummary.byProduct} layout="vertical" margin={{ left: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis type="category" dataKey="product" width={110} tick={{ fontSize: 11, fill: '#5a6f9a' }} />
                      <Tooltip />
                      <Bar dataKey="quantity" fill="#2d9cdb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[#5a6f9a] text-center py-16">{t('common.noRecordsFound')}</p>
                )}
              </ChartCard>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
