import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';

import { AnalyzingIndicator } from '@/components/ui/AnalyzingIndicator';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useChatStore, type ChatMessage } from '@/store/chatStore';
import { cn } from '@/utils/cn';

const RESOLUTION_CLASS: Record<'executed' | 'failed' | 'rejected', string> = {
  executed: 'text-success',
  rejected: 'text-muted-foreground',
  failed: 'text-danger',
};

function ProposedActionBlock({ orgId, message }: { orgId: string; message: ChatMessage }) {
  const resolvingActionId = useChatStore((state) => state.resolvingActionId);
  const confirmAction = useChatStore((state) => state.confirmAction);
  const rejectAction = useChatStore((state) => state.rejectAction);

  if (!message.proposedAction) return null;
  const actionId = message.proposedAction.action_id;
  const isResolving = resolvingActionId === actionId;

  if (message.resolution) {
    return <p className={cn('mt-2 text-xs font-medium', RESOLUTION_CLASS[message.resolution.status])}>{message.resolution.note}</p>;
  }

  return (
    <div className="mt-2 flex gap-2">
      <Button size="sm" variant="primary" isLoading={isResolving} onClick={() => confirmAction(orgId, actionId)}>
        Confirmar
      </Button>
      <Button size="sm" variant="secondary" disabled={isResolving} onClick={() => rejectAction(orgId, actionId)}>
        Rechazar
      </Button>
    </div>
  );
}

function MessageBubble({ orgId, message }: { orgId: string; message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser ? 'bg-ai/10 text-foreground' : 'bg-card text-foreground',
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {!isUser && <ProposedActionBlock orgId={orgId} message={message} />}
      </div>
    </div>
  );
}

export function AthlosBot({ orgId }: { orgId: string }) {
  const isOpen = useChatStore((state) => state.isOpen);
  const toggle = useChatStore((state) => state.toggle);
  const close = useChatStore((state) => state.close);
  const messages = useChatStore((state) => state.messages);
  const isSending = useChatStore((state) => state.isSending);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const pendingPrompt = useChatStore((state) => state.pendingPrompt);
  const clearPendingPrompt = useChatStore((state) => state.clearPendingPrompt);

  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, isSending]);

  // Un botón "Explicame esto" en otra pantalla dejó un mensaje pre-armado —
  // se precarga en el input (no se auto-envía) para que la persona vea qué
  // va a preguntar antes de mandarlo.
  useEffect(() => {
    if (pendingPrompt) {
      setDraft(pendingPrompt);
      clearPendingPrompt();
    }
  }, [pendingPrompt, clearPendingPrompt]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    void sendMessage(orgId, text);
  };

  const hasPendingAction = messages.some((m) => m.proposedAction && !m.resolution);

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={isOpen ? 'Cerrar AthlosBot' : 'Abrir AthlosBot'}
        className="focus-ring fixed bottom-20 right-6 z-40 flex size-12 items-center justify-center rounded-full bg-ai text-white shadow-elevated transition-colors hover:bg-ai/90"
      >
        <Bot className="size-5" aria-hidden="true" />
        {hasPendingAction && !isOpen && (
          <span className="absolute right-0 top-0 size-3 rounded-full border-2 border-bg bg-warning" aria-hidden="true" />
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-36 right-6 z-[110] flex h-[32rem] w-96 max-w-[calc(100vw-3rem)] flex-col rounded-lg border border-border bg-panel shadow-elevated">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-ai" aria-hidden="true" />
              <span className="text-sm font-semibold text-foreground">AthlosBot</span>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Cerrar"
              className="focus-ring rounded-sm text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Preguntame cómo funciona cualquier módulo, pedime datos reales de un jugador o un partido,
                pedime un reporte descargable, o pedime cambiar algo (te lo voy a mostrar antes de aplicarlo).
              </p>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} orgId={orgId} message={message} />
            ))}
            {isSending && <AnalyzingIndicator label="Pensando…" />}
          </div>

          <div className="flex items-center gap-2 border-t border-border p-3">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Escribí tu mensaje…"
              disabled={isSending}
            />
            <Button size="icon" onClick={handleSend} disabled={isSending || !draft.trim()} aria-label="Enviar">
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
