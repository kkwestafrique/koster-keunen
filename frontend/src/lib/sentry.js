import * as Sentry from '@sentry/react';

// Sentry error tracking. Real DSN comes from REACT_APP_SENTRY_DSN — set this
// in your local .env file and in Vercel's Environment Variables for
// production. Never commit the actual DSN value to the repo.
export function initSentry() {
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) {
    console.info('[Sentry] No DSN configured — error tracking disabled (placeholder mode).');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // 100% of transactions traced. Fine at current traffic levels; revisit
    // (lower this, e.g. to 0.1-0.2) if trace volume becomes a cost concern
    // as usage grows.
    tracesSampleRate: 1.0,
    integrations: [Sentry.browserTracingIntegration()],
  });
}

export function captureException(error, context) {
  if (process.env.REACT_APP_SENTRY_DSN) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  } else {
    console.error('[Sentry placeholder] captured exception:', error, context);
  }
}
