'use client';
import * as React from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/client/api';
import { cn } from '@/lib/utils';
import { useGame } from './GameProvider';

interface Msg { role: 'user' | 'coach'; content: string }
const PROMPTS = ['What should I do today?', "I'm feeling stuck and tired", 'How is my streak?', 'What should I improve?', 'Boss strategy?'];
export function CoachChat({ initial }: { initial: Msg[] }) {
  const game = useGame();
  const [msgs, setMsgs] = React.useState<Msg[]>(initial), [text, setText] = React.useState(''), [busy, setBusy] = React.useState(false);
  const end = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);
  async function send(m: string) {
    const message = m.trim(); if (!message || busy) return;
    setMsgs((x) => [...x, { role: 'user', content: message }]); setText(''); setBusy(true); game.play('click');
    try { const r = await api<{ reply: string }>('/api/coach', { body: { message } }); setMsgs((x) => [...x, { role: 'coach', content: r.reply }]); }
    catch (e) { setMsgs((x) => [...x, { role: 'coach', content: (e as Error).message }]); game.play('error'); } finally { setBusy(false); }
  }
  return (
    <div className="card flex h-[calc(100dvh-15rem)] min-h-[26rem] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-5" role="log" aria-live="polite" aria-label="Conversation with your coach">
        {msgs.length === 0 && <div className="mx-auto mt-10 max-w-sm text-center"><Sparkles className="mx-auto h-8 w-8 text-gold" aria-hidden /><p className="mt-3 font-display text-lg">Your coach knows your board, your stats and your streak.</p><p className="mt-1 text-sm text-parchment-muted">Ask for a plan, a pep talk, or what to improve.</p></div>}
        {msgs.map((m, i) => (<div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}><p className={cn('max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed', m.role === 'user' ? 'rounded-br-md bg-gold/15 text-parchment' : 'rounded-bl-md border border-hairline bg-surface-raised text-parchment')}>{m.content}</p></div>))}
        {busy && <div className="flex justify-start"><p className="rounded-2xl rounded-bl-md border border-hairline bg-surface-raised px-4 py-2.5 text-sm text-parchment-dim" aria-label="The coach is typing">Thinking<span className="animate-pulse">…</span></p></div>}
        <div ref={end} />
      </div>
      <div className="border-t border-hairline p-3">
        <div className="mb-2 flex flex-wrap gap-1.5">{PROMPTS.map((p) => <button key={p} type="button" disabled={busy} onClick={() => send(p)} className="rounded-full border border-hairline px-3 py-1 text-xs text-parchment-muted hover:border-gold-dim hover:text-parchment disabled:opacity-50">{p}</button>)}</div>
        <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="flex gap-2"><label htmlFor="coach-msg" className="sr-only">Message your coach</label><input id="coach-msg" value={text} onChange={(e) => setText(e.target.value)} maxLength={600} placeholder="Ask your coach…" className="h-11 flex-1 rounded-lg border border-hairline bg-ink-soft px-4 text-sm placeholder:text-parchment-dim focus:border-gold-dim" autoComplete="off" /><Button type="submit" variant="gold" size="icon" className="h-11 w-11" disabled={busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button></form>
        <p className="mt-2 text-[11px] text-parchment-dim">A game coach, not a doctor or therapist. If you are struggling, please talk to someone you trust.</p>
      </div>
    </div>
  );
}
