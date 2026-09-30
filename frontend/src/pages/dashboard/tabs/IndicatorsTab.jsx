// Extracted verbatim from Dashboard.jsx's own inline ternary branch during
// its component-decomposition refactor (see StatCard.jsx for why). The JSX
// body below is an EXACT copy of the original -- every prop this component
// takes is a value the original file already had in scope at that point;
// nothing was recomputed or renamed.

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend, ComposedChart, Line } from 'recharts';
import { useTranslation } from 'react-i18next';
import ChartCard from '../ChartCard';
import StatCard from '../StatCard';

export default function IndicatorsTab({ indicatorsQuality, indicatorsYearly, indicatorsLocalPartners, beekeepersInvolved, beekeepersTrends, financeRevenue, financeContracts, year, country }) {
  const { t } = useTranslation();
  return (
            <div className="flex flex-col gap-6" data-testid="dashboard-indicators-page">
              {/* Builds the Indicators page's 6.1 "Quantity & Quality"
                  section basics from the Power BI handoff document:
                  Standard split donut, Total Beeswax card, Yellow
                  Beeswax card (both with year-over-year), and the
                  country ratio table. The rest of 6.1 (Completion rate
                  donut, the 6-year trend chart, the Local Partners'
                  Performance table) and all of 6.2/6.3 are separate,
                  later pieces, not part of this batch. */}
              {indicatorsQuality && (
                <div className="flex flex-wrap gap-4" data-testid="indicators-cards-row">
                  <StatCard label={t('dashboard.indicators.totalBeeswax')} value={`${indicatorsQuality.totalBeeswax.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`} testId="indicators-total-beeswax" />
                  <div className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1 justify-center" data-testid="indicators-total-beeswax-yoy">
                    <span className={`text-sm font-bold ${indicatorsQuality.totalBeeswaxYoy >= 0 ? 'text-[#1e8e3e]' : 'text-[#ba550c]'}`}>
                      {indicatorsQuality.totalBeeswaxYoy >= 0 ? '▲' : '▼'} {Math.abs(Math.round(indicatorsQuality.totalBeeswaxYoy * 100))}%
                    </span>
                    <span className="text-xs text-[#5a6f9a]">{t('dashboard.indicators.vsLastYear')}</span>
                  </div>
                  <StatCard label={t('dashboard.indicators.yellowBeeswax')} value={`${indicatorsQuality.totalYellow.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg (${Math.round(indicatorsQuality.yellowRatio * 100)}%)`} testId="indicators-yellow-beeswax" />
                  <div className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1 justify-center" data-testid="indicators-yellow-beeswax-yoy">
                    <span className={`text-sm font-bold ${indicatorsQuality.yellowYoy >= 0 ? 'text-[#1e8e3e]' : 'text-[#ba550c]'}`}>
                      {indicatorsQuality.yellowYoy >= 0 ? '▲' : '▼'} {Math.abs(Math.round(indicatorsQuality.yellowYoy * 100))}%
                    </span>
                    <span className="text-xs text-[#5a6f9a]">{t('dashboard.indicators.vsLastYear')}</span>
                  </div>
                </div>
              )}

              {indicatorsQuality && Object.keys(indicatorsQuality.byStandard).length > 0 && (
                <ChartCard title={t('dashboard.indicators.standardSplitTitle')} testId="indicators-standard-donut">
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={Object.entries(indicatorsQuality.byStandard).map(([name, value]) => ({ name, value }))}
                        dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}
                      >
                        {Object.keys(indicatorsQuality.byStandard).map((name) => (
                          <Cell key={name} fill={{ Sustainable: '#1e8e3e', Organic: '#0f48aa', Conventional: '#ba550c' }[name] || '#cfd8e6'} />
                        ))}
                      </Pie>
                      <Legend />
                      <Tooltip formatter={(v) => `${Number(v).toLocaleString()} kg`} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {indicatorsQuality && indicatorsQuality.countryTable.length > 0 && (
                <div className="flex flex-wrap gap-4 items-stretch">
                  {/* Real gap closed, confirmed via a real screenshot
                      of the source dashboard: this pie chart (total
                      quantity share by country) was previously left
                      out for lack of a concrete spec -- the text
                      handoff document's own words said it "wasn't
                      fully specified in conversation." */}
                  <ChartCard title={t('dashboard.indicators.countryPieTitle')} testId="indicators-country-pie">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={indicatorsQuality.countryTable.map((row) => ({ name: row.country, value: row.total }))}
                          dataKey="value" nameKey="name" innerRadius={0} outerRadius={90} isAnimationActive={false}
                          label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                        >
                          {indicatorsQuality.countryTable.map((row, i) => (
                            <Cell key={row.country} fill={['#0f48aa', '#ba550c', '#1e8e3e', '#7a4a1e', '#e8b93a', '#5a6f9a', '#032b71'][i % 7]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => `${Number(v).toLocaleString()} kg`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-4 flex-1 min-w-[300px]" data-testid="indicators-country-table">
                    <h3 className="text-sm font-bold text-[#032b71] mb-3">{t('dashboard.indicators.countryTableTitle')}</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[#5a6f9a] border-b border-[#cfd8e6]">
                          <th className="py-2 font-medium">{t('dashboard.indicators.country')}</th>
                          <th className="py-2 font-medium text-right">{t('dashboard.indicators.yellowKg')}</th>
                          <th className="py-2 font-medium text-right">{t('dashboard.indicators.yellowRatio')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {indicatorsQuality.countryTable.map((row) => (
                          <tr key={row.country} className="border-b border-[#f5f5f5] last:border-0" data-testid={`indicators-country-row-${row.country}`}>
                            <td className="py-2 font-medium text-[#032b71]">{row.country}</td>
                            <td className="py-2 text-right text-[#5a6f9a]">{row.yellow.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="py-2 text-right text-[#032b71] font-medium">{Math.round(row.ratio * 100)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Completion Rate donut. Real, documented bug in the
                  source project's own first attempt at this, avoided
                  here from the start: building the two donut slices
                  from raw Qty/Contract values directly gives a
                  meaningless ~49/51 split, since a donut normalizes
                  its own slice values to sum to 100% of themselves --
                  not the same as a true "% of contract" reading. Uses
                  Completion Rate / Completion Rate Remaining instead,
                  which correctly sum to exactly 100%. Reuses
                  seasonPurchases.pctTotal (already fetched on this
                  page) rather than a new query, since "Completion
                  Rate" and that value are the same calculation.
                  Deliberately does not include the source's own
                  per-Local-Partner slicer -- its own document flags
                  that as never confirmed working even in the original
                  project. */}
              {seasonPurchases && (
                <div className="flex flex-wrap gap-4 items-stretch">
                  <StatCard label={t('dashboard.indicators.contractTotal')} value={`${seasonPurchases.contractTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`} testId="indicators-contract-card" />
                  <ChartCard title={t('dashboard.indicators.completionRateTitle')} testId="indicators-completion-donut">
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: t('dashboard.indicators.achieved'), value: Math.min(seasonPurchases.pctTotal, 1) },
                            { name: t('dashboard.indicators.remaining'), value: Math.max(1 - seasonPurchases.pctTotal, 0) },
                          ]}
                          dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} isAnimationActive={false}
                        >
                          <Cell fill="#0f48aa" />
                          <Cell fill="#e8ecf3" />
                        </Pie>
                        <Legend />
                        <Tooltip formatter={(v) => `${Math.round(v * 100)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <p className="text-center text-2xl font-black text-[#032b71] -mt-4">{Math.round(seasonPurchases.pctTotal * 100)}%</p>
                  </ChartCard>
                </div>
              )}

              {/* Yearly Quantité/Contrat/Qualité trend, last 6 real
                  years with data -- deliberately independent of this
                  page's own Year filter, per the source document's own
                  "Edit interactions -> None" setup for this specific
                  chart. "Contrat" is a hollow, outlined bar rendered
                  behind "Quantité" (a solid bar), using a negative
                  barGap to force full overlap rather than the usual
                  side-by-side clustering -- so when the two values are
                  close, it reads as one bar with a visible target
                  line, matching the "bar-in-bar" effect the source
                  needed a much more involved two-layered-visual
                  workaround to achieve in Power BI. */}
              {indicatorsYearly && indicatorsYearly.length > 0 && (
                <ChartCard title={t('dashboard.indicators.yearlyTrendTitle')} testId="indicators-yearly-chart">
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={indicatorsYearly} barGap="-100%" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis yAxisId="kg" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <Tooltip formatter={(v, name) => (name === t('dashboard.indicators.qualite') ? `${Math.round(v * 100)}%` : `${Number(v).toLocaleString()} kg`)} />
                      <Legend />
                      <Bar yAxisId="kg" dataKey="contract" name={t('dashboard.indicators.contrat')} fill="transparent" stroke="#032b71" strokeWidth={1.5} />
                      <Bar yAxisId="kg" dataKey="qty" name={t('dashboard.indicators.quantite')} fill="#0f48aa" />
                      <Line yAxisId="pct" type="monotone" dataKey="qualite" name={t('dashboard.indicators.qualite')} stroke="#ba550c" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {/* Local Partners' Performance table (Top 20). Real
                  business rules matched exactly from the source
                  document: ranked/filtered to Top 20 by CONTRACT
                  quantity (not delivered); Evolution (rank change) is
                  based on DELIVERED quantity instead, explicitly
                  different from the ranking basis; % Cire Jaune is
                  each actor's own ratio, not a company-wide share.
                  Flags use this app's own real, confirmed country
                  spellings, not the source's own unverified list. */}
              {indicatorsLocalPartners && indicatorsLocalPartners.length > 0 && (
                <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-4 overflow-x-auto" data-testid="indicators-local-partners-table">
                  <h3 className="text-sm font-bold text-[#032b71] mb-3">{t('dashboard.indicators.localPartnersTitle')}</h3>
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="text-left text-xs text-[#5a6f9a] border-b border-[#cfd8e6]">
                        <th className="py-2 font-medium"></th>
                        <th className="py-2 font-medium">{t('dashboard.indicators.actorName')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.evolution')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.season.contratKg')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.deliveredKg')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.pctAppro')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.season.pctContrat')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.yellowKg')}</th>
                        <th className="py-2 font-medium text-right">{t('dashboard.indicators.yellowRatio')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorsLocalPartners.map((row) => (
                        <tr key={row.actorId} className="border-b border-[#f5f5f5] last:border-0" data-testid={`indicators-lp-row-${row.actorId}`}>
                          <td className="py-2">
                            <img src={row.flagUrl} alt={row.country || ''} className="h-4 w-6 object-cover rounded-sm" />
                          </td>
                          <td className="py-2 font-medium text-[#032b71]">{row.name}</td>
                          <td className={`py-2 text-right font-medium ${row.evolution > 0 ? 'text-[#1e8e3e]' : row.evolution < 0 ? 'text-[#ba550c]' : 'text-[#5a6f9a]'}`}>
                            {row.evolution > 0 ? '▲' : row.evolution < 0 ? '▼' : '–'} {row.evolution !== 0 ? Math.abs(row.evolution) : ''}
                          </td>
                          <td className="py-2 text-right text-[#5a6f9a]">{row.contract.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 text-right text-[#032b71]">{row.qty.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 text-right text-[#5a6f9a]">{Math.round(row.pctAppro * 100)}%</td>
                          <td className="py-2 text-right text-[#032b71] font-medium">{Math.round(row.pctContrat * 100)}%</td>
                          <td className="py-2 text-right text-[#5a6f9a]">{row.qtyYellow.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 text-right text-[#5a6f9a]">{Math.round(row.pctYellow * 100)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Beekeepers Involved section -- confirmed via a real
                  screenshot of the source dashboard, previously marked
                  "Not started" in the original text handoff document
                  with no real spec to build from at all. "Involved"
                  matches the same definition used for "Achieved" on
                  the Season page: real delivery activity in the
                  selected year, not just existing in the system. */}
              {beekeepersInvolved && (
                <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5 flex flex-col gap-4" data-testid="beekeepers-involved-basics">
                  <h3 className="text-sm font-bold text-[#032b71]">{t('dashboard.beekeepers.title')}</h3>
                  <div className="flex flex-wrap gap-6 items-start">
                    <div className="flex flex-col gap-3 flex-1 min-w-[280px]">
                      <div className="flex items-center gap-2" data-testid="bk-total">
                        <span className="text-2xl font-black text-[#032b71]">{beekeepersInvolved.total.count.toLocaleString()}</span>
                        <span className={`text-xs font-bold ${beekeepersInvolved.total.delta >= 0 ? 'text-[#1e8e3e]' : 'text-[#ba550c]'}`}>
                          {beekeepersInvolved.total.delta >= 0 ? '▲' : '▼'} {Math.abs(beekeepersInvolved.total.delta)}
                        </span>
                        <span className="text-xs text-[#5a6f9a]">{t('dashboard.beekeepers.totalInvolved')}</span>
                      </div>
                      <div className="border-t border-dashed border-[#cfd8e6] pt-3 flex flex-col gap-2 pl-3">
                        {[
                          { label: t('dashboard.beekeepers.involvedWax'), data: beekeepersInvolved.wax, testId: 'wax' },
                          { label: t('dashboard.beekeepers.involvedYellow'), data: beekeepersInvolved.yellow, testId: 'yellow' },
                          { label: t('dashboard.beekeepers.involvedBrown'), data: beekeepersInvolved.brown, testId: 'brown' },
                          { label: t('dashboard.beekeepers.involvedCrude'), data: beekeepersInvolved.crude, testId: 'crude' },
                          { label: t('dashboard.beekeepers.involvedHoney'), data: beekeepersInvolved.honey, testId: 'honey' },
                        ].map((row) => (
                          <div key={row.testId} className="flex items-center gap-2" data-testid={`bk-${row.testId}`}>
                            <span className="text-base font-bold text-[#032b71]">{row.data.count.toLocaleString()}</span>
                            <span className={`text-xs font-bold ${row.data.delta >= 0 ? 'text-[#1e8e3e]' : 'text-[#ba550c]'}`}>
                              {row.data.delta >= 0 ? '▲' : '▼'} {Math.abs(row.data.delta)}
                            </span>
                            <span className="text-xs text-[#5a6f9a]">{row.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <ResponsiveContainer width={160} height={140}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: t('dashboard.beekeepers.female'), value: beekeepersInvolved.genderCounts.Female },
                            { name: t('dashboard.beekeepers.male'), value: beekeepersInvolved.genderCounts.Male },
                          ]}
                          dataKey="value" nameKey="name" innerRadius={35} outerRadius={55} isAnimationActive={false}
                        >
                          <Cell fill="#1e8e3e" />
                          <Cell fill="#0f48aa" />
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="flex flex-col gap-3">
                      <div className="bg-[#f5f5f5] border border-[#cfd8e6] rounded-[5px] px-4 py-3 text-center" data-testid="bk-youth">
                        <span className="text-lg font-black text-[#032b71] block">{Math.round(beekeepersInvolved.youthRatio * 100)}%</span>
                        <span className="text-xs text-[#5a6f9a]">{t('dashboard.beekeepers.youth')}</span>
                      </div>
                      <div className="flex flex-col gap-1" data-testid="bk-charter">
                        <span className="text-xs text-[#5a6f9a]">{t('dashboard.beekeepers.charterSigned')}</span>
                        <div className="w-40 h-3 bg-[#e8ecf3] rounded-full overflow-hidden">
                          <div className="h-full bg-[#0f48aa]" style={{ width: `${Math.round(beekeepersInvolved.charterSignedRatio * 100)}%` }} />
                        </div>
                        <span className="text-sm font-bold text-[#032b71]">{beekeepersInvolved.charterSignedCount.toLocaleString()} ({Math.round(beekeepersInvolved.charterSignedRatio * 100)}%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Batch 3: Villages/Groupements, 6-year gender trend,
                  hive-type breakdown -- confirmed via the same real
                  screenshot. "Groupement" mapped to
                  linked_producer_organisation_id (documented directly
                  in useBeekeepersTrends.js), this app's real
                  equivalent of a farmer group/cooperative. */}
              {beekeepersTrends && (
                <div className="flex flex-wrap gap-4">
                  <div className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1" data-testid="bk-villages-card">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-[#032b71]">{beekeepersTrends.villages.count.toLocaleString()}</span>
                      <span className={`text-xs font-bold ${beekeepersTrends.villages.delta >= 0 ? 'text-[#1e8e3e]' : 'text-[#ba550c]'}`}>
                        {beekeepersTrends.villages.delta >= 0 ? '▲' : '▼'} {Math.abs(beekeepersTrends.villages.delta)}
                      </span>
                    </div>
                    <span className="text-xs text-[#5a6f9a]">{t('dashboard.beekeepers.villagesInvolved')}</span>
                  </div>
                  <div className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1" data-testid="bk-groupements-card">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black text-[#032b71]">{beekeepersTrends.groupements.count.toLocaleString()}</span>
                      <span className={`text-xs font-bold ${beekeepersTrends.groupements.delta >= 0 ? 'text-[#1e8e3e]' : 'text-[#ba550c]'}`}>
                        {beekeepersTrends.groupements.delta >= 0 ? '▲' : '▼'} {Math.abs(beekeepersTrends.groupements.delta)}
                      </span>
                    </div>
                    <span className="text-xs text-[#5a6f9a]">{t('dashboard.beekeepers.groupementsInvolved')}</span>
                  </div>
                </div>
              )}

              {beekeepersTrends && beekeepersTrends.genderTrend.length > 0 && (
                <ChartCard title={t('dashboard.beekeepers.genderTrendTitle')} testId="bk-gender-trend-chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={beekeepersTrends.genderTrend} margin={{ left: 8, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e8ecf3" />
                      <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <YAxis tick={{ fontSize: 12, fill: '#5a6f9a' }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="men" name={t('dashboard.beekeepers.male')} stackId="gender" fill="#0f48aa" />
                      <Bar dataKey="women" name={t('dashboard.beekeepers.female')} stackId="gender" fill="#1e8e3e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              )}

              {beekeepersTrends && beekeepersTrends.hives.total > 0 && (
                <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5 flex flex-wrap gap-6 items-center" data-testid="bk-hives-section">
                  <div className="flex flex-wrap gap-4 flex-1 min-w-[280px]">
                    <StatCard label={t('dashboard.beekeepers.hivesTraditional1')} value={beekeepersTrends.hives.traditional1.toLocaleString()} testId="bk-hives-t1" />
                    <StatCard label={t('dashboard.beekeepers.hivesTraditional2')} value={beekeepersTrends.hives.traditional2.toLocaleString()} testId="bk-hives-t2" />
                    <StatCard label={t('dashboard.beekeepers.hivesModern')} value={beekeepersTrends.hives.modern.toLocaleString()} testId="bk-hives-modern" />
                    <StatCard label={t('dashboard.beekeepers.hivesOther')} value={beekeepersTrends.hives.other.toLocaleString()} testId="bk-hives-other" />
                  </div>
                  <ResponsiveContainer width={180} height={160}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: t('dashboard.beekeepers.hivesTraditional1'), value: beekeepersTrends.hives.traditional1 },
                          { name: t('dashboard.beekeepers.hivesTraditional2'), value: beekeepersTrends.hives.traditional2 },
                          { name: t('dashboard.beekeepers.hivesModern'), value: beekeepersTrends.hives.modern },
                          { name: t('dashboard.beekeepers.hivesOther'), value: beekeepersTrends.hives.other },
                        ]}
                        dataKey="value" nameKey="name" innerRadius={0} outerRadius={65} isAnimationActive={false}
                      >
                        <Cell fill="#ba550c" />
                        <Cell fill="#0f48aa" />
                        <Cell fill="#1e8e3e" />
                        <Cell fill="#5a6f9a" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Finance section, Batch 4: hives per beekeeper,
                  land-use breakdown, hive-type-holder %, and average
                  income/price/quantity per beekeeper split by wax vs
                  honey -- confirmed via the same real screenshot. */}
              {financeRevenue && (
                <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5 flex flex-col gap-4" data-testid="finance-revenue-section">
                  <h3 className="text-sm font-bold text-[#032b71]">{t('dashboard.finance.title')}</h3>
                  <div className="flex flex-wrap gap-6 items-start">
                    <StatCard label={t('dashboard.finance.hivesPerBeekeeper')} value={financeRevenue.hivesPerBeekeeper.toFixed(1)} testId="finance-hives-per-bk" />

                    <div className="flex flex-col gap-1.5 min-w-[200px]" data-testid="finance-land-use">
                      <span className="text-xs text-[#5a6f9a] font-medium">{t('dashboard.finance.landUseTitle')}</span>
                      {[
                        { key: 'mango', label: t('dashboard.finance.landMango') },
                        { key: 'cashew', label: t('dashboard.finance.landCashew') },
                        { key: 'shea', label: t('dashboard.finance.landShea') },
                        { key: 'forest', label: t('dashboard.finance.landForest') },
                        { key: 'other', label: t('dashboard.finance.landOther') },
                      ].map((row) => (
                        <div key={row.key} className="flex items-center justify-between text-xs" data-testid={`finance-land-${row.key}`}>
                          <span className="text-[#5a6f9a]">{row.label}</span>
                          <span className="font-bold text-[#032b71]">{Math.round((financeRevenue.landUse[row.key] || 0) * 100)}%</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col gap-1.5 min-w-[220px]" data-testid="finance-hive-holders">
                      <span className="text-xs text-[#5a6f9a] font-medium">{t('dashboard.finance.hiveHoldersTitle')}</span>
                      {[
                        { key: 'traditional1', label: t('dashboard.beekeepers.hivesTraditional1') },
                        { key: 'traditional2', label: t('dashboard.beekeepers.hivesTraditional2') },
                        { key: 'modern', label: t('dashboard.beekeepers.hivesModern') },
                        { key: 'other', label: t('dashboard.beekeepers.hivesOther') },
                      ].map((row) => (
                        <div key={row.key} className="flex items-center gap-2 text-xs" data-testid={`finance-holder-${row.key}`}>
                          <span className="text-[#5a6f9a] w-24">{row.label}</span>
                          <div className="flex-1 h-2 bg-[#e8ecf3] rounded-full overflow-hidden">
                            <div className="h-full bg-[#0f48aa]" style={{ width: `${Math.round((financeRevenue.hiveTypeHolderRatio[row.key] || 0) * 100)}%` }} />
                          </div>
                          <span className="font-bold text-[#032b71] w-9 text-right">{Math.round((financeRevenue.hiveTypeHolderRatio[row.key] || 0) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 border-t border-dashed border-[#cfd8e6] pt-4">
                    {[
                      { data: financeRevenue.wax, title: t('dashboard.finance.revenueWaxTitle'), testId: 'wax' },
                      { data: financeRevenue.honey, title: t('dashboard.finance.revenueHoneyTitle'), testId: 'honey' },
                    ].map((group) => (
                      <div key={group.testId} className="bg-[#f5f5f5] border border-[#cfd8e6] rounded-[5px] p-4 flex flex-col gap-2 flex-1 min-w-[240px]" data-testid={`finance-revenue-${group.testId}`}>
                        <span className="text-xs text-[#5a6f9a] font-bold">{group.title}</span>
                        <span className="text-xl font-black text-[#032b71]">{Math.round(group.data.avgIncome).toLocaleString()} XOF</span>
                        <div className="flex gap-4 text-xs text-[#5a6f9a]">
                          <span>{Math.round(group.data.pricePerKg).toLocaleString()} XOF/{t('dashboard.finance.perKg')}</span>
                          <span>{group.data.avgQty.toFixed(1)} {t('dashboard.finance.kgPerBeekeeper')}</span>
                        </div>
                        {group.data.missingRates.length > 0 && (
                          <p className="text-xs text-[#ba550c]" data-testid={`finance-missing-rates-${group.testId}`}>
                            {t('dashboard.season.missingRatesWarning', { currencies: group.data.missingRates.join(', ') })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Finance section, Batch 5: contract value vs actual
                  purchase value (both in XOF), advance payment, and
                  average price paid to Local Partners specifically --
                  confirmed via the same real screenshot. Completes the
                  Finance section. Real, honest gap: "Prime qualité"
                  (quality premium) has no underlying field anywhere in
                  this app's schema -- checked both contracts and
                  transactions directly before concluding this. Left
                  out entirely rather than invented from nothing. */}
              {financeContracts && (
                <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-5 flex flex-col gap-4" data-testid="finance-contracts-section">
                  <h3 className="text-sm font-bold text-[#032b71]">{t('dashboard.finance.contractVsActualTitle')}</h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="bg-[#f5f5f5] border border-[#cfd8e6] rounded-[5px] p-4 flex flex-col gap-1 min-w-[200px]" data-testid="finance-contract-value">
                      <span className="text-xs text-[#5a6f9a]">{t('dashboard.finance.contractValue')}</span>
                      <span className="text-xl font-black text-[#032b71]">{Math.round(financeContracts.contractValue).toLocaleString()} XOF</span>
                      <span className="text-xs text-[#5a6f9a] mt-1">{t('dashboard.finance.advance')}: {Math.round(financeContracts.advance).toLocaleString()} XOF ({Math.round(financeContracts.advancePctOfContract * 100)}%)</span>
                    </div>
                    <div className="bg-[#f5f5f5] border border-[#cfd8e6] rounded-[5px] p-4 flex flex-col gap-1 min-w-[200px]" data-testid="finance-realized-value">
                      <span className="text-xs text-[#5a6f9a]">{t('dashboard.finance.realizedValue')}</span>
                      <span className="text-xl font-black text-[#032b71]">{Math.round(financeContracts.realizedValue).toLocaleString()} XOF</span>
                      <span className="text-xs text-[#5a6f9a] mt-1">{t('dashboard.finance.advance')}: {Math.round(financeContracts.advance).toLocaleString()} XOF ({Math.round(financeContracts.advancePctOfRealized * 100)}%)</span>
                    </div>
                    <div className="bg-[#0f48aa] rounded-[5px] p-4 flex flex-col items-center justify-center gap-1 min-w-[140px]" data-testid="finance-completion-rate">
                      <span className="text-2xl font-black text-white">{Math.round(financeContracts.completionRate * 100)}%</span>
                      <span className="text-xs text-white/80 text-center">{t('dashboard.finance.completionRate')}</span>
                    </div>
                    <StatCard label={t('dashboard.finance.avgPriceLocalPartners')} value={`${Math.round(financeContracts.avgPriceLocalPartners).toLocaleString()} XOF/${t('dashboard.finance.perKg')}`} testId="finance-avg-price-lp" />
                  </div>
                  {financeContracts.missingRates.length > 0 && (
                    <p className="text-xs text-[#ba550c]" data-testid="finance-contracts-missing-rates">
                      {t('dashboard.season.missingRatesWarning', { currencies: financeContracts.missingRates.join(', ') })}
                    </p>
                  )}
                </div>
              )}
            </div>
  );
}
