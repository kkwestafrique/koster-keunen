import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export default function AppLayout({ title, hideDefaultHeader, children }) {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#f9fafc]">
      {/* Real gap found via independent audit (A4): no skip-navigation
          link existed, forcing keyboard users to Tab through the full
          sidebar on every single page load before reaching real
          content. Standard pattern: visually hidden until it receives
          focus (first Tab press), then visible and usable. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:bg-white focus:text-[#0f48aa] focus:px-4 focus:py-2 focus:rounded-[5px] focus:border focus:border-[#0f48aa] focus:font-bold"
      >
        {t('common.skipToContent')}
      </a>
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
      {/* Real gap found via the newest audit (M2: no mobile layout at
          all). The 240px left margin used to be permanent regardless
          of screen size, even though the sidebar itself is now hidden
          below md -- that would have left a real 240px dead gap of
          empty space on a phone. Only applied at md and up, matching
          the sidebar's own breakpoint exactly. Padding also reduced on
          small screens, where the previous fixed 32px on both sides
          left meaningfully less room for real content on a narrow
          screen. */}
      <div className="md:ml-[240px]">
        <TopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main id="main-content" data-testid="main-content" tabIndex={-1}>
          {!hideDefaultHeader && title && (
            <div className="px-4 md:px-8 pt-6 pb-2">
              <h2 className="text-lg font-black text-[#0f48aa]">{title}</h2>
            </div>
          )}
          <div className="p-4 md:p-8 md:pt-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
