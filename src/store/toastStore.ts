import { create } from 'zustand';

export type ToastVariant = 'default' | 'success' | 'warning' | 'danger';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

let counter = 0;
const nextId = () => `toast-${(counter += 1)}`;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toast(input: Omit<ToastItem, 'id'>) {
  const id = nextId();
  useToastStore.setState((state) => ({ toasts: [...state.toasts, { ...input, id }] }));
  return id;
}
