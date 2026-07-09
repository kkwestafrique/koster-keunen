import React from 'react';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export default function AppLayout({ title, children }) {
  return (
    <div className="min-h-screen bg-[#f9fafc]">
      <Sidebar />
      <div className="ml-64">
        <TopBar title={title} />
        <main className="p-8" data-testid="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
