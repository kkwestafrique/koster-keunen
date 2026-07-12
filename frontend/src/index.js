import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import "@/lib/i18n";
import App from "@/App";
import { initSentry } from "@/lib/sentry";
import { initPostHog } from "@/lib/posthog";
import * as serviceWorkerRegistration from "@/serviceWorkerRegistration";

initSentry();
initPostHog();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ErrorFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f9fafc] px-6 text-center">
      <h1 className="text-lg font-black text-[#0f48aa] mb-2">Something went wrong</h1>
      <p className="text-sm text-[#7089b4] mb-4">
        We've logged this error and will look into it. Try refreshing the page.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-[#0f48aa] text-white px-4 py-2 rounded-[5px] text-sm font-medium"
      >
        Refresh
      </button>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);

serviceWorkerRegistration.register();
