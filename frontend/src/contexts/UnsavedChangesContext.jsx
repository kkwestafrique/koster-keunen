import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Real gap found via independent audit (UF4): partially completing a
// form and clicking Back or a sidebar link silently discarded
// everything typed, with no warning at all.
//
// Deliberately not built on react-router's useBlocker -- that requires
// a "data router" (created via createBrowserRouter), and this app uses
// the plain <BrowserRouter> component (confirmed directly in App.js).
// useBlocker throws at runtime outside a data router, and migrating
// the whole app's router setup is a much larger, riskier change than
// this one feature justifies. Instead: a shared flag any form can set
// while it has real unsaved input, checked by the sidebar's own link
// clicks and each form's own Back button, plus a native
// beforeunload warning for closing the tab, refreshing, or typing a
// new URL directly -- covering the three real ways this data was
// getting silently lost, without touching the router at all.
const UnsavedChangesContext = createContext(null);

export function UnsavedChangesProvider({ children }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (!hasUnsavedChanges) return;
      e.preventDefault();
      // Chrome requires returnValue to be set; the actual message shown
      // is controlled by the browser itself for security reasons, not
      // by this string, on every modern browser.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  return (
    <UnsavedChangesContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) throw new Error('useUnsavedChanges must be used within UnsavedChangesProvider');
  return ctx;
}

// Convenience hook for a specific in-app navigation attempt (a form's
// own Back button, a sidebar link): returns a function that checks the
// shared flag, shows a real confirmation if there's something to lose,
// and only proceeds if the person genuinely confirms leaving.
export function useConfirmedNavigate() {
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const { t } = useTranslation();
  return useCallback((proceed) => {
    if (hasUnsavedChanges && !window.confirm(t('forms.unsavedChangesWarning'))) {
      return;
    }
    setHasUnsavedChanges(false);
    proceed();
  }, [hasUnsavedChanges, setHasUnsavedChanges, t]);
}
