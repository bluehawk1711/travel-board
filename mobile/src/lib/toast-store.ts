import { create } from 'zustand';

export type ToastType = 'error' | 'success' | 'info';

export interface ToastState {
  message: string | null;
  type: ToastType;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  type: 'info',
  showToast: (message, type = 'info') => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, type });
    hideTimer = setTimeout(() => {
      set({ message: null });
    }, 3_000);
  },
  hideToast: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message: null });
  },
}));
