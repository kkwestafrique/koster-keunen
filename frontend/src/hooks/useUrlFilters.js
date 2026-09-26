import { useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

// Real gap found via the newest audit (M5): every list page's filters,
// search text, and current page lived in plain useState, which resets
// to nothing the moment the component remounts -- including the exact
// moment someone navigates into a detail row and presses Back. Losing
// a carefully-built filter combination on the single most common
// navigation action in the app (open a record, go back) is a real,
// repeated point of friction, not a cosmetic one.
//
// Syncs a whole set of filter values to the URL's query string instead
// of local state. Navigating Back restores the exact URL (browsers do
// this natively), which means the filters are restored automatically
// too, with no extra code needed on the list page's end beyond using
// this hook. Also makes a specific filtered view genuinely shareable
// via a real link -- a side benefit, not the reason this was built.
//
// `defaults` is an object like { search: '', page: 1, standard: '' } --
// the shape and default value for every field this page wants synced.
// A field is removed from the URL entirely when it's set back to its
// own default, keeping the URL clean rather than accumulating
// `?search=&standard=&page=1` for a view that's actually showing
// nothing filtered.
export function useUrlFilters(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = {};
  for (const key of Object.keys(defaults)) {
    const raw = searchParams.get(key);
    if (raw === null) {
      values[key] = defaults[key];
    } else {
      // Numeric defaults (e.g. page) coerce the URL's string value back
      // to a number -- URLSearchParams only ever stores strings.
      values[key] = typeof defaults[key] === 'number' ? Number(raw) : raw;
    }
  }

  // Real bug, reproduced before fixing: every list page's "Items per
  // page" handler makes two updates in one click -- setPageSize(n) then
  // setPage(1). React Router's functional setSearchParams((prev) => ...)
  // does NOT hand the second call the first call's result; both start
  // from the URL as of the last render. So the second update (page=1,
  // built from a URL with no pageSize) overwrote the first, and the
  // dropdown snapped straight back to 15 every time. Confirmed by
  // running this exact hook with react-router-dom 7.18.4 and the exact
  // BeekeepersList handler: selecting 30 left pageSize at 15.
  //
  // Fix: remember any update still pending from this same event, and
  // merge the next one into it instead of into the stale URL. Cleared as
  // soon as a render commits a new URL, so it never outlives the event.
  const pendingRef = useRef(null);
  const committedRef = useRef(searchParams);
  if (committedRef.current !== searchParams) {
    committedRef.current = searchParams;
    pendingRef.current = null;
  }

  const setValues = (updates) => {
    const next = new URLSearchParams(pendingRef.current ?? searchParams);
    for (const key of Object.keys(updates)) {
      const val = updates[key];
      const isDefault = val === defaults[key] || val === '' || val == null;
      if (isDefault) {
        next.delete(key);
      } else {
        next.set(key, String(val));
      }
    }
    pendingRef.current = next;
    setSearchParams(next, { replace: true });
  };

  return [values, setValues];
}
