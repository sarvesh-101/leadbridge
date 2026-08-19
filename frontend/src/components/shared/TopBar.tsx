"use client";

import { useState, useRef } from "react";
import { Menu, Search, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import { RealtimeStatusDot } from "./RealtimeStatusDot";
import { NotificationDropdown } from "./NotificationDropdown";
import { useRouter } from "next/navigation";

interface TopBarProps {
  onSearch?: (query: string) => void;
  onMenuToggle?: () => void;
}

export function TopBar({ onSearch, onMenuToggle }: TopBarProps) {
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
    <header className="h-14 bg-[#101713]/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-3 sm:px-6 shrink-0 sticky top-0 z-30">
      {/* Mobile hamburger + Search */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg hover:bg-white/[0.06] text-[#9FB0A6] hover:text-[#F0F7F3] transition-colors"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="relative w-48 sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9FB0A6]" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search leads... (Enter to go)"
            onChange={(e) => onSearch?.(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/[0.06] border border-white/10 text-[13px] text-[#F0F7F3] placeholder-[#6B7C73] focus:outline-none focus:border-[#34D399]/60 focus:ring-1 focus:ring-[#34D399]/30 transition-colors"
          />
        </div>
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
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#34D399] to-[#1B4332] flex items-center justify-center">
              <span className="text-[#0A0F0C] text-[12px] font-bold">
                {(user?.name || user?.businessName || "U")[0].toUpperCase()}
              </span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[13px] font-medium text-[#F0F7F3] leading-tight">
                {user?.businessName || user?.name || "User"}
              </p>
              <p className="text-[11px] text-[#9FB0A6] capitalize">{user?.role}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#9FB0A6] hidden sm:block" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-white/10 bg-[#101713] shadow-lg z-20 py-1">
                <button className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#9FB0A6] hover:bg-white/[0.06] hover:text-[#F0F7F3] transition-colors">
                  <User className="w-4 h-4" />
                  Profile
                </button>
                <button className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#9FB0A6] hover:bg-white/[0.06] hover:text-[#F0F7F3] transition-colors">
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
                <hr className="my-1 border-white/10" />
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#FB7185] hover:bg-white/[0.06] transition-colors"
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
