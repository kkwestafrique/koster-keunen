// Sentry error tracking — placeholder DSN, swap in real DSN via REACT_APP_SENTRY_DSN
export function initSentry() {
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) {
    console.info('[Sentry] No DSN configured — error tracking disabled (placeholder mode).');
    return;
  }
  // When a real DSN is provided, install @sentry/react and initialize here:
  // import * as Sentry from '@sentry/react';
  // Sentry.init({ dsn, tracesSampleRate: 1.0 });
}

export function captureException(error) {
  console.error('[Sentry placeholder] captured exception:', error);
}
