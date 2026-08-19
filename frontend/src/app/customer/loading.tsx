import { Loader2 } from "lucide-react";

export default function CustomerLoading() {
  return (
    <div className="min-h-screen bg-[#0A0F0C] aurora-backdrop">
      {/* Header skeleton */}
      <div className="sticky top-0 z-10 bg-[#0A0F0C]/80 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] animate-pulse" />
          <div className="flex-1 space-y-1">
            <div className="h-3 w-24 bg-white/[0.06] rounded animate-pulse" />
            <div className="h-2 w-16 bg-[#101713] rounded animate-pulse" />
          </div>
          <div className="w-8 h-8 rounded-lg bg-white/[0.06] animate-pulse" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Welcome card skeleton */}
        <div className="p-5 rounded-2xl app-card animate-pulse">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-40 bg-white/[0.06] rounded" />
              <div className="h-3 w-24 bg-[#101713] rounded" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-9 rounded-xl bg-[#101713]" />
            <div className="flex-1 h-9 rounded-xl bg-[#101713]" />
            <div className="flex-1 h-9 rounded-xl bg-[#101713]" />
          </div>
        </div>

        {/* Booking card skeleton */}
        <div className="p-5 rounded-2xl app-card animate-pulse">
          <div className="flex justify-between mb-4">
            <div className="space-y-1">
              <div className="h-4 w-20 bg-white/[0.06] rounded" />
              <div className="h-3 w-32 bg-[#101713] rounded" />
            </div>
            <div className="h-6 w-24 bg-white/[0.06] rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-[#101713]">
              <div className="h-4 w-24 bg-white/[0.06] rounded mb-2" />
              <div className="h-3 w-16 bg-[#101713] rounded" />
            </div>
            <div className="p-3 rounded-xl bg-[#101713]">
              <div className="h-4 w-20 bg-white/[0.06] rounded mb-2" />
              <div className="h-3 w-16 bg-[#101713] rounded" />
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#101713]">
            <div className="h-3 w-full bg-[#101713] rounded" />
          </div>
        </div>

        {/* Property skeleton */}
        <div className="p-5 rounded-2xl app-card animate-pulse">
          <div className="h-4 w-28 bg-white/[0.06] rounded mb-4" />
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#101713]">
              <div className="h-8 w-16 bg-white/[0.06] rounded mx-auto mb-1" />
              <div className="h-3 w-12 bg-[#101713] rounded mx-auto" />
            </div>
            <div className="p-3 rounded-xl bg-[#101713]">
              <div className="h-8 w-12 bg-white/[0.06] rounded mx-auto mb-1" />
              <div className="h-3 w-16 bg-[#101713] rounded mx-auto" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
