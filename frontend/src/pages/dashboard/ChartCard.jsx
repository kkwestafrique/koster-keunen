// Extracted verbatim from Dashboard.jsx during its component-decomposition
// refactor -- this file's body is an exact copy of the original inline
// function, unchanged, just moved and exported. See
// src/pages/Dashboard.jsx for why: 14 dedicated hooks already
// externalize the real data-fetching logic, so this file's actual
// disease was size (1,022 lines, one giant component), not mixed
// responsibilities -- the fix is splitting the render tree into
// smaller components, not a domain/application/infrastructure layer
// split like the bulk-upload and transactions feature modules got.

import { useTranslation } from 'react-i18next';

export default function ChartCard({ title, controls, children, testId, isEmpty }) {
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
