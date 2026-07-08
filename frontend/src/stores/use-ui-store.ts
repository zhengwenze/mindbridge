import { create } from "zustand";

type ThemeMode = "light";

interface UiState {
  sidebarCollapsed: boolean;
  themeMode: ThemeMode;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  themeMode: "light",
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed })
}));
