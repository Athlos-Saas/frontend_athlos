import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  confirmAssistantAction,
  rejectAssistantAction,
  sendAssistantMessage,
  type AssistantActionResult,
  type AssistantMessage,
  type AssistantProposedAction,
} from '@/lib/backendApi';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposedAction?: AssistantProposedAction;
  resolution?: { status: 'executed' | 'failed' | 'rejected'; note: string };
}

interface ChatState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  messages: ChatMessage[];
  isSending: boolean;
  resolvingActionId: string | null;
  sendMessage: (orgId: string, text: string) => Promise<void>;
  confirmAction: (orgId: string, actionId: string) => Promise<void>;
  rejectAction: (orgId: string, actionId: string) => Promise<void>;
}

let counter = 0;
const nextId = () => `chat-${(counter += 1)}`;

function resolutionNote(result: Pick<AssistantActionResult, 'status' | 'error'>): string {
  if (result.status === 'executed') return 'Listo, aplicado.';
  if (result.status === 'rejected') return 'Rechazado.';
  return `No se pudo aplicar: ${result.error ?? 'error desconocido'}`;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      close: () => set({ isOpen: false }),
      messages: [],
      isSending: false,
      resolvingActionId: null,

      sendMessage: async (orgId, text) => {
        const userMessage: ChatMessage = { id: nextId(), role: 'user', content: text };
        set((state) => ({ messages: [...state.messages, userMessage], isSending: true }));

        const history: AssistantMessage[] = get().messages.map((m) => ({ role: m.role, content: m.content }));

        try {
          const result = await sendAssistantMessage(orgId, text, history);
          const assistantMessage: ChatMessage = {
            id: nextId(),
            role: 'assistant',
            content: result.reply,
            proposedAction: result.proposed_action ?? undefined,
          };
          set((state) => ({ messages: [...state.messages, assistantMessage], isSending: false }));
        } catch (error) {
          const errorMessage: ChatMessage = {
            id: nextId(),
            role: 'assistant',
            content: `No se pudo enviar el mensaje: ${error instanceof Error ? error.message : 'error desconocido'}`,
          };
          set((state) => ({ messages: [...state.messages, errorMessage], isSending: false }));
        }
      },

      confirmAction: async (orgId, actionId) => {
        set({ resolvingActionId: actionId });
        try {
          const result = await confirmAssistantAction(orgId, actionId);
          applyResolution(set, actionId, result);
        } catch (error) {
          applyResolution(set, actionId, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'error desconocido',
          });
        } finally {
          set({ resolvingActionId: null });
        }
      },

      rejectAction: async (orgId, actionId) => {
        set({ resolvingActionId: actionId });
        try {
          const result = await rejectAssistantAction(orgId, actionId);
          applyResolution(set, actionId, result);
        } catch (error) {
          applyResolution(set, actionId, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'error desconocido',
          });
        } finally {
          set({ resolvingActionId: null });
        }
      },
    }),
    {
      name: 'athlos-chat',
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
);

function applyResolution(
  set: (partial: Partial<ChatState> | ((state: ChatState) => Partial<ChatState>)) => void,
  actionId: string,
  result: Pick<AssistantActionResult, 'status' | 'error'>,
) {
  set((state) => ({
    messages: state.messages.map((message) =>
      message.proposedAction?.action_id === actionId
        ? { ...message, resolution: { status: result.status, note: resolutionNote(result) } }
        : message,
    ),
  }));
}
