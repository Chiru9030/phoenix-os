'use client';

import * as React from 'react';
import { Bot, Brain, MessageSquare, Send, Sparkles, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/primitives';
import { api } from '@/lib/client/api';
import { useGame } from './GameProvider';
import { cn } from '@/lib/utils';

export interface AIDungeonMasterCardProps {
  narrative?: string | null;
  generatedBy?: string | null;
  className?: string;
}

const QUICK_PROMPTS = [
  { label: '⚡ Plan my day', prompt: 'Where should I start today and in what order?' },
  { label: '🛡️ Overcoming friction', prompt: 'I feel low energy and unmotivated. Give me a push.' },
  { label: '🎯 Next best move', prompt: 'What is the highest-leverage quest on my board right now?' },
];

export function AIDungeonMasterCard({ narrative, generatedBy, className }: { narrative?: string | null; generatedBy?: string | null; className?: string }) {
  const game = useGame();
  const [chatOpen, setChatOpen] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [messages, setMessages] = React.useState<{ role: 'user' | 'coach'; content: string }[]>([]);
  const [busy, setBusy] = React.useState(false);

  const isLlm = generatedBy && generatedBy !== 'offline' && generatedBy !== 'pending';

  async function sendMessage(textToSend: string) {
    const text = textToSend.trim();
    if (!text || busy) return;
    setBusy(true);
    game.play('click');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    try {
      const res = await api<{ reply: string; source: string }>('/api/coach', {
        body: { message: text },
      });
      game.play('coin');
      setMessages((prev) => [...prev, { role: 'coach', content: res.reply }]);
    } catch (err) {
      game.play('error');
      setMessages((prev) => [
        ...prev,
        { role: 'coach', content: `The Dungeon Master whispers: ${(err as Error).message}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="AI Dungeon Master Dispatch" className={cn('overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-surface to-surface-raised p-5 shadow-md backdrop-blur-md transition-all hover:border-gold/50', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/40 bg-gold/10 text-gold-bright shadow-sm">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-parchment flex items-center gap-2">
              Dungeon Master Dispatch
              <span className="inline-flex items-center gap-1 rounded-full border border-arcane/40 bg-arcane/15 px-2 py-0.5 text-[10px] font-medium text-arcane-bright">
                <Sparkles className="h-3 w-3" />
                {isLlm ? 'AI-Powered' : 'Active DM'}
              </span>
            </h2>
            <p className="text-[11px] text-parchment-dim">
              Your real-time guide, strategist, and quest master
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setChatOpen(!chatOpen)}
          className="gap-1.5 border-gold/30 text-xs text-gold-bright hover:bg-gold/10"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {chatOpen ? 'Close Dialogue' : 'Consult Master'}
        </Button>
      </div>

      {narrative && (
        <div className="mt-3.5 rounded-xl border border-hairline/40 bg-ink-soft/60 p-3.5 text-sm leading-relaxed text-parchment-muted">
          <p className="italic">{narrative}</p>
        </div>
      )}

      {/* Quick Prompts Bar */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-medium text-parchment-dim flex items-center gap-1">
          <Wand2 className="h-3 w-3 text-gold" /> Ask:
        </span>
        {QUICK_PROMPTS.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={busy}
            onClick={() => {
              if (!chatOpen) setChatOpen(true);
              sendMessage(q.prompt);
            }}
            className="rounded-lg border border-hairline/60 bg-surface px-2.5 py-1 text-xs text-parchment-muted transition-colors hover:border-gold hover:text-gold-bright hover:bg-gold/5"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Interactive Chat Expansion */}
      {chatOpen && (
        <div className="mt-4 animate-in fade-in slide-in-from-top-2 rounded-xl border border-arcane/30 bg-ink/90 p-4 duration-200">
          <div className="flex items-center justify-between border-b border-hairline pb-2 mb-3">
            <span className="text-xs font-semibold text-arcane-bright flex items-center gap-1.5">
              <Bot className="h-4 w-4" /> Live Dialogue
            </span>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="text-[10px] text-parchment-dim hover:text-parchment"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-60 space-y-2.5 overflow-y-auto pr-1 text-xs">
            {messages.length === 0 ? (
              <p className="text-center py-4 text-parchment-dim italic">
                Ask the Dungeon Master for a plan, a push, or custom quest ideas.
              </p>
            ) : (
              messages.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'rounded-xl p-3 leading-relaxed',
                    m.role === 'user'
                      ? 'ml-8 bg-surface-raised border border-hairline text-parchment'
                      : 'mr-8 bg-arcane/15 border border-arcane/30 text-parchment-muted'
                  )}
                >
                  <p className="font-semibold text-[10px] mb-1 text-parchment-dim">
                    {m.role === 'user' ? 'You' : 'Dungeon Master'}
                  </p>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ))
            )}
            {busy && (
              <div className="mr-8 rounded-xl bg-arcane/10 border border-arcane/20 p-2.5 text-xs text-arcane-bright animate-pulse">
                The Dungeon Master is reading the weave...
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="mt-3 flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything... (e.g. How do I balance study and workout today?)"
              className="h-9 text-xs"
              disabled={busy}
            />
            <Button type="submit" variant="gold" size="sm" loading={busy} disabled={!input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
