// Extracted verbatim from Dashboard.jsx during its component-decomposition
// refactor -- this file's body is an exact copy of the original inline
// function, unchanged, just moved and exported. See
// src/pages/Dashboard.jsx for why: 14 dedicated hooks already
// externalize the real data-fetching logic, so this file's actual
// disease was size (1,022 lines, one giant component), not mixed
// responsibilities -- the fix is splitting the render tree into
// smaller components, not a domain/application/infrastructure layer
// split like the bulk-upload and transactions feature modules got.

// A loading pulse now looks visibly different from a stuck '—', so
// this class of bug is at least diagnosable instead of silent.
export default function StatCard({ label, value, testId, isLoading }) {
  return (
    <div
      data-testid={testId}
      className="bg-white border border-[#cfd8e6] rounded-[5px] px-6 py-5 flex flex-col gap-1 justify-center flex-1"
    >
      {isLoading ? (
        <span className="h-[34px] w-16 rounded bg-[#eef1f6] animate-pulse" data-testid={`${testId}-loading`} />
      ) : (
        <span className="text-[28px] font-bold text-[#032b71]">{value ?? '—'}</span>
      )}
      <span className="text-xs text-[#5a6f9a]">{label}</span>
    </div>
  );
}
