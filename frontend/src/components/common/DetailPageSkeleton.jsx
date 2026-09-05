import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Real gap from the performance audit: every detail page (Actor,
// Beekeeper, Stock, Contract, Transaction) blocked its entire content
// area with plain "Loading..." text while its data fetched, instead of
// something that mirrors the real layout. Matches the common shape
// shared by all of them -- a breadcrumb, a title, a header card, and a
// content area below -- closely enough to avoid the "waiting for the
// app to build itself" feeling, without needing a pixel-perfect
// skeleton unique to every individual page's own specific layout.
export default function DetailPageSkeleton({ testId = 'detail-skeleton' }) {
  return (
    <div className="flex flex-col gap-4" data-testid={testId}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-6 w-48" />
      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white border border-[#cfd8e6] rounded-[5px] p-6 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
