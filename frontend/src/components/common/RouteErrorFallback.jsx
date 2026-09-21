import React from 'react';
import { useNavigate } from 'react-router-dom';

// Real gap found via a bug-prevention audit (Section 29: blast radius):
// the app previously had exactly one error boundary, wrapping
// everything (see index.js). A render bug in any single, unrelated
// page -- a chart, a modal, a form -- took down the entire
// application for that user, not just the broken feature. They
// couldn't even navigate to a different, working page without a full
// reload, since React unmounts the whole subtree under the nearest
// boundary, and the only one that existed was at the very top.
//
// This is that route-level boundary's fallback. It's used per-route
// (see ProtectedRoute in App.js), so a crash in one page's content is
// now contained to that page -- the router itself, and every other
// route, stays mounted and working. "Go to Dashboard" is a real route
// change, not a page reload, so it actually recovers instantly rather
// than reloading the whole app bundle.
//
// Honest limitation, not silently glossed over: because each page
// currently renders its own Sidebar/TopBar internally (via AppLayout)
// rather than a shared, outer layout wrapping page content, a crash
// still takes that page's own sidebar down with it -- this fallback
// has no sidebar of its own. Fully fixing that would mean restructuring
// every page to stop rendering AppLayout itself and instead rely on a
// single, shared layout outside all per-route content -- a much larger
// change than is appropriate to make as part of this fix. What this
// does fix is the more serious part: the user is never fully stuck,
// since the router and every other route remain genuinely usable.
export default function RouteErrorFallback() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9fafc] px-6 text-center">
      <h1 className="text-lg font-black text-[#0f48aa] mb-2">This page ran into a problem</h1>
      <p className="text-sm text-[#7089b4] mb-4 max-w-sm">
        We've logged this error and will look into it. The rest of the app is unaffected.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/')}
          className="bg-[#0f48aa] text-white px-4 py-2 rounded-[5px] text-sm font-medium"
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => window.location.reload()}
          className="bg-white border border-[#0f48aa] text-[#0f48aa] px-4 py-2 rounded-[5px] text-sm font-medium"
        >
          Refresh this page
        </button>
      </div>
    </div>
  );
}
