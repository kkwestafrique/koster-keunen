import posthog from 'posthog-js';

// PostHog product analytics. Real key comes from REACT_APP_POSTHOG_KEY,
// host from REACT_APP_POSTHOG_HOST — set both in your local .env file and
// in Vercel's Environment Variables for production. Never commit the
// actual key value to the repo.
export function initPostHog() {
  const key = process.env.REACT_APP_POSTHOG_KEY;
  if (!key) {
    console.info('[PostHog] No API key configured — analytics disabled (placeholder mode).');
    return;
  }

  posthog.init(key, {
    api_host: process.env.REACT_APP_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only', // only tracks profiles for logged-in users
    capture_pageview: true,
  });
}

export function trackEvent(eventName, properties = {}) {
  if (process.env.REACT_APP_POSTHOG_KEY) {
    posthog.capture(eventName, properties);
  } else {
    console.info('[PostHog placeholder] event:', eventName, properties);
  }
}

// Call after successful login so subsequent events are tied to that user
// rather than an anonymous session.
export function identifyUser(userId, traits = {}) {
  if (process.env.REACT_APP_POSTHOG_KEY) {
    posthog.identify(userId, traits);
  }
}

// Call on logout so the next person on this device doesn't inherit the
// previous user's identity/session in analytics.
export function resetIdentity() {
  if (process.env.REACT_APP_POSTHOG_KEY) {
    posthog.reset();
  }
}
