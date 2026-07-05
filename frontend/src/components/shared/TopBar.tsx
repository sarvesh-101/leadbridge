"use client";

import { useState, useRef } from "react";
import { Search, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import { RealtimeStatusDot } from "./RealtimeStatusDot";
import { NotificationDropdown } from "./NotificationDropdown";
import { useRouter } from "next/navigation";

interface TopBarProps {
  onSearch?: (query: string) => void;
}

export function TopBar({ onSearch }: TopBarProps) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchRef.current?.value.trim()) {
      router.push(`/dashboard/leads?search=${encodeURIComponent(searchRef.current.value.trim())}`);
      searchRef.current.value = "";
    }
  }

  return (
    <header className="h-14 bg-[#111118] border-b border-[#2A2A3A] flex items-center justify-between px-6 shrink-0">
      {/* Search */}
      <div className="relative w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B6B8A]" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search leads... (Enter to go)"
          onChange={(e) => onSearch?.(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#1A1A24] border border-[#2A2A3A] text-[13px] text-[#F0F0F8] placeholder-[#3A3A52] focus:outline-none focus:border-[#4F6EF7] focus:ring-1 focus:ring-[#4F6EF7] transition-colors"
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Real-time status */}
        <RealtimeStatusDot />

        {/* Notifications */}
        <NotificationDropdown />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#1A1A24] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4F6EF7] to-[#4F6EF7]/60 flex items-center justify-center">
              <span className="text-white text-[12px] font-semibold">
                {(user?.name || user?.businessName || "U")[0].toUpperCase()}
              </span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[13px] font-medium text-[#F0F0F8] leading-tight">
                {user?.businessName || user?.name || "User"}
              </p>
              <p className="text-[11px] text-[#6B6B8A] capitalize">{user?.role}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#6B6B8A] hidden sm:block" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-[#2A2A3A] bg-[#111118] shadow-lg z-20 py-1">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#6B6B8A] hover:bg-[#1A1A24] hover:text-[#F0F0F8] transition-colors">
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#6B6B8A] hover:bg-[#1A1A24] hover:text-[#F0F0F8] transition-colors">
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <hr className="my-1 border-[#2A2A3A]" />
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#F43F5E] hover:bg-[#1A1A24] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
