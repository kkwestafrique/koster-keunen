// PostHog product analytics — placeholder API key, swap in real key via REACT_APP_POSTHOG_KEY
export function initPostHog() {
  const key = process.env.REACT_APP_POSTHOG_KEY;
  if (!key) {
    console.info('[PostHog] No API key configured — analytics disabled (placeholder mode).');
    return;
  }
  // When a real key is provided, install posthog-js and initialize here:
  // import posthog from 'posthog-js';
  // posthog.init(key, { api_host: process.env.REACT_APP_POSTHOG_HOST });
}

export function trackEvent(eventName, properties = {}) {
  console.info('[PostHog placeholder] event:', eventName, properties);
}
