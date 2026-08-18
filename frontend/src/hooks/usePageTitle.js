import { useEffect } from 'react';

const APP_NAME = 'Koster Keunen MIS';

// Gap 15: every page previously showed the exact same browser tab title,
// making tabs indistinguishable and browser history unusable -- the same
// weakness the real platform's own audit flagged. Restores the previous
// title on unmount so navigating away doesn't leave a stale title behind.
export function usePageTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
