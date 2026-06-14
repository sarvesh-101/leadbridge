import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  leadDetailPanelOpen: boolean;
  selectedLeadId: string | null;
  notifications: NotificationItem[];
  toggleSidebar: () => void;
  openLeadDetail: (leadId: string) => void;
  closeLeadDetail: () => void;
  addNotification: (notification: NotificationItem) => void;
  clearNotifications: () => void;
}

export interface NotificationItem {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  timestamp: Date;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  leadDetailPanelOpen: false,
  selectedLeadId: null,
  notifications: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  openLeadDetail: (leadId) =>
    set({ leadDetailPanelOpen: true, selectedLeadId: leadId }),

  closeLeadDetail: () =>
    set({ leadDetailPanelOpen: false, selectedLeadId: null }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications].slice(0, 50),
    })),

  clearNotifications: () => set({ notifications: [] }),
}));
