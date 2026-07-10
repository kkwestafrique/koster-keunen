import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export default function AppLayout({ title, hideDefaultHeader, children }) {
  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <Sidebar />
      <div className="ml-[240px]">
        <TopBar />
        <main data-testid="main-content">
          {!hideDefaultHeader && title && (
            <div className="px-8 pt-6 pb-2">
              <h2 className="text-lg font-black text-[#0f48aa]">{title}</h2>
            </div>
          )}
          <div className="p-8 pt-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
