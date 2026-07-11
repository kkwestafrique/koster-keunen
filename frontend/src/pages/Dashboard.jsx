import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAllActorsLite, useActorTypeCounts } from '@/hooks/useActors';
import { useBeekeeperAggregates } from '@/hooks/useBeekeepers';
import { useConstants } from '@/hooks/useConstants';
import { COUNTRIES } from '@/data/regions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

function StatCard({ label, value, testId }) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1 justify-center flex-1"
    >
      <span className="text-[28px] font-bold text-[#032b71]">{value ?? '—'}</span>
      <span className="text-xs text-[#7089b4]">{label}</span>
    </div>
  );
}

function ChartCard({ title, controls, children, testId }) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-[#cfd8e6] rounded-[5px] p-4 flex-1 min-w-[300px]"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[#032b71]">{title}</h3>
        {controls}
      </div>
      {children}
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
const GENDER_COLORS = { Male: '#0f48aa', Female: '#9fb6dd' };

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
  const { profile } = useAuth();
  const { data: actors = [] } = useAllActorsLite();
  const { data: actorCounts } = useActorTypeCounts();
  const { data: bkAgg } = useBeekeeperAggregates();
  const { data: countries = [] } = useConstants('country');
  const [tab, setTab] = useState('supply');
  const [country, setCountry] = useState('');
  const [actorFilter, setActorFilter] = useState('');
  const [year, setYear] = useState('2026');

  const currentActor = actors.find((a) => a.id === profile?.current_actor_id);

  const actorTypeData = actorCounts
    ? Object.entries(actorCounts.byType)
        .filter(([, v]) => v > 0)
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
                  : 'bg-[#e8ecf3] text-[#7089b4] border-transparent'
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
                  : 'bg-[#e8ecf3] text-[#7089b4] border-transparent'
              }`}
            >
              {t('dashboard.transactionOverview')}
            </button>
          </div>

          {/* Filter bar */}
          <div className="bg-white border border-[#cfd8e6] rounded-b-[5px] px-8 py-4 flex flex-col gap-2">
            <span className="text-[13px] text-[#7089b4]">
              {t('dashboard.filterHint')}
            </span>
            <div className="flex gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#032b71]">{t('dashboard.country')}</span>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger data-testid="dashboard-filter-country" className="w-[180px] bg-white border-[#cfd8e6]">
                    <SelectValue placeholder={t('dashboard.allCountry')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('dashboard.allCountry')}</SelectItem>
                    {(countries.length > 0
                      ? countries.map((c) => ({ key: c.id, value: c.value, label: c.label }))
                      : COUNTRIES.map((c) => ({ key: c, value: c, label: c }))
                    ).map((c) => (
                      <SelectItem key={c.key} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#032b71]">{t('dashboard.actors')}</span>
                <Select value={actorFilter} onValueChange={setActorFilter}>
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
                    {['2026', '2025', '2024'].map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
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
              <ChartCard title={t("dashboard.actorTypeDistribution")} testId="chart-actor-types">
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

              <ChartCard title={t("dashboard.totalHivesInstalled")} testId="chart-hives">
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

              <ChartCard title={t("dashboard.beekeepersOverview")} testId="chart-gender">
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
            <div
              className="bg-white border border-[#cfd8e6] rounded-[5px] p-10 text-center text-sm text-[#7089b4]"
              data-testid="dashboard-transactions-placeholder"
            >
              {t('common.noRecordsFound')}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
