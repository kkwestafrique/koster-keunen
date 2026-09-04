import React, { createContext, useContext, useState, useCallback } from 'react';

// Real gap found via independent audit (UF1): the Dashboard shows KPI
// numbers with no contextual description or action prompt, and there
// was no onboarding guidance anywhere for a new organization's first
// real login.
//
// Deliberately not a third-party tour library (react-joyride, driver.js,
// etc.) -- built with the same primitives already used throughout the
// app (Tailwind, the existing card/button styling) rather than adding a
// new dependency, giving full control to match the app's own design
// system exactly instead of a generic library look.
//
// Each step targets a real element via its existing data-testid
// (already present throughout the app from the start of this project),
// not a new selector convention invented just for this.
const TourContext = createContext(null);

export const DASHBOARD_TOUR_STEPS = [
  { targetTestId: null, titleKey: 'tour.welcomeTitle', bodyKey: 'tour.welcomeBody' },
  { targetTestId: 'stat-local-partners', titleKey: 'tour.statsTitle', bodyKey: 'tour.statsBody', groupTestIds: ['stat-local-partners', 'stat-aggregators', 'stat-producer-orgs', 'stat-beekeepers'] },
  { targetTestId: 'dashboard-tabs', titleKey: 'tour.tabsTitle', bodyKey: 'tour.tabsBody' },
  { targetTestId: 'dashboard-filter-year', titleKey: 'tour.filtersTitle', bodyKey: 'tour.filtersBody' },
  { targetTestId: 'sidebar', titleKey: 'tour.navTitle', bodyKey: 'tour.navBody' },
];

export function TourProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [steps, setSteps] = useState([]);

  const startTour = useCallback((tourSteps) => {
    setSteps(tourSteps);
    setStepIndex(0);
    setIsActive(true);
  }, []);

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= steps.length) {
        setIsActive(false);
        return i;
      }
      return i + 1;
    });
  }, [steps.length]);

  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);
  const skip = useCallback(() => setIsActive(false), []);

  return (
    <TourContext.Provider value={{ isActive, stepIndex, steps, startTour, next, back, skip }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}
