import create from "zustand";

export type AppTheme = "light" | "dark";

type AppState = {
  isLocked: boolean;
  theme: AppTheme;
  selectedAccountId: string | null;
  setLocked: (locked: boolean) => void;
  setTheme: (theme: AppTheme) => void;
  selectAccount: (id: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  isLocked: false,
  theme: "light",
  selectedAccountId: null,
  setLocked: (locked) => set({ isLocked: locked }),
  setTheme: (theme) => set({ theme }),
  selectAccount: (id) => set({ selectedAccountId: id }),
}));
