'use client';

import React from 'react';
import { cn } from '../lib/utils';

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded bg-muted/80', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export function EditorSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading email editor and session draft..."
      className="flex flex-col gap-4 w-full"
    >
      <div className="rounded-lg border border-border bg-bg p-4 flex flex-col gap-4 shadow-sm">
        {/* Toolbar skeleton */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
          <Skeleton className="h-5 w-32" />
        </div>

        {/* Subject skeleton */}
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>

        {/* Body skeleton */}
        <div className="flex flex-col gap-2 mt-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-48 w-full" />
        </div>

        {/* Footer info skeleton */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

export function ScoreMeterSkeleton() {
  return (
    <div
      role="status"
      aria-label="Computing email risk assessment..."
      className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-14" />
        </div>
      </div>

      {/* Segmented bar skeleton */}
      <div className="grid grid-cols-10 gap-1.5 h-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-full rounded-sm" />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function DiffSkeleton() {
  return (
    <div
      role="status"
      aria-label="Generating real-time AI safe rewrite..."
      className="flex flex-col gap-4 w-full p-6 animate-pulse"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-40 w-full rounded" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-40 w-full rounded" />
        </div>
      </div>
    </div>
  );
}
