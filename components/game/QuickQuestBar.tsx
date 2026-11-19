'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sparkles, Zap, ChevronDown, ChevronUp, Bot, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Badge } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/client/api';
import { useGame } from './GameProvider';
import type { QuestType } from '@/lib/types';
import { cn } from '@/lib/utils';

const PRESETS = [
  { label: '💻 Coding Sprint', prompt: 'Software development, leetcode algorithms and coding practice' },
  { label: '📚 Exam & Study', prompt: 'Intensive study session, notes revision and active recall' },
  { label: '💪 Gym & Fitness', prompt: 'Strength workout, cardio, mobility stretching and hydration' },
  { label: '🎯 Deep Work', prompt: 'High-leverage focused deep work on core project milestone' },
  { label: '🧹 Reset & Organize', prompt: 'Declutter workspace, organize tasks and clear inbox' },
];

export function QuickQuestBar({ className }: { className?: string }) {
  const router = useRouter();
  const game = useGame();
  const [title, setTitle] = React.useState('');
  const [type, setType] = React.useState<QuestType>('side');
  const [busy, setBusy] = React.useState(false);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [aiBusy, setAiBusy] = React.useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean || busy) return;
    setBusy(true);
    game.play('click');
    try {
      await api('/api/quests', {
        body: { title: clean, type },
      });
      setTitle('');
      game.play('complete');
      game.toast({ tone: 'gold', title: `Quest added: "${clean}"` });
      router.refresh();
    } catch (err) {
      game.play('error');
      game.toast({ tone: 'ember', title: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function handleAiGenerate(promptText: string) {
    const text = promptText.trim();
    if (!text || aiBusy) return;
    setAiBusy(true);
    game.play('click');
    try {
      const res = await api<{ ok: boolean; message?: string }>('/api/quests/ai-generate', {
        body: { prompt: text },
      });
      game.play('achievement');
      game.toast({
        tone: 'arcane',
        title: 'Quests Generated!',
        body: res.message ?? 'New AI quests have been added to your board.',
      });
      setAiPrompt('');
      setAiOpen(false);
      router.refresh();
    } catch (err) {
      game.play('error');
      game.toast({ tone: 'ember', title: (err as Error).message });
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className={cn('space-y-3 rounded-2xl border border-gold/20 bg-surface/80 p-4 shadow-sm backdrop-blur-md transition-all', className)}>
      <form onSubmit={handleAdd} className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="⚡ Add a quest for today... (e.g. Study 45 min, 20 pushups, Debug auth API)"
            className="h-10 pl-3 pr-24 text-sm"
            maxLength={160}
            disabled={busy}
          />
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <button
              type="button"
              onClick={() => setType((t) => (t === 'main' ? 'side' : t === 'side' ? 'daily_challenge' : 'main'))}
              className="rounded px-2 py-0.5 text-[10px] font-semibold text-gold-bright hover:bg-gold/10"
              title="Click to toggle Quest Type (Main / Side / Challenge)"
            >
              {type === 'main' ? 'Main (70 XP)' : type === 'daily_challenge' ? 'Challenge (25 XP)' : 'Side (30 XP)'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="gold" size="sm" loading={busy} disabled={!title.trim()}>
            <Plus className="h-4 w-4" />
            Add
          </Button>

          <Button
            type="button"
            variant={aiOpen ? 'arcane' : 'outline'}
            size="sm"
            onClick={() => setAiOpen(!aiOpen)}
            className="gap-1.5"
          >
            <Sparkles className="h-4 w-4 text-arcane-bright" />
            <span className="hidden sm:inline">AI Generate</span>
            {aiOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </form>

      {/* AI Quest Generator Drawer */}
      {aiOpen && (
        <div className="animate-in fade-in slide-in-from-top-2 rounded-xl border border-arcane/30 bg-ink-soft/90 p-4 duration-200">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-arcane-bright" />
            <p className="font-display text-sm font-semibold text-parchment">
              AI Quest Generator
            </p>
            <Badge tone="arcane" className="ml-auto text-[10px]">
              Dungeon Master
            </Badge>
          </div>
          <p className="mt-1 text-xs text-parchment-muted">
            Tell the AI what you want to achieve today, or pick a preset to immediately generate 3 structured quests:
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                disabled={aiBusy}
                onClick={() => handleAiGenerate(p.prompt)}
                className="rounded-full border border-hairline bg-surface-raised px-2.5 py-1 text-xs text-parchment-muted transition-colors hover:border-gold hover:text-gold-bright"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Or type a custom goal (e.g. Master React Server Components today)"
              className="h-9 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAiGenerate(aiPrompt);
                }
              }}
              disabled={aiBusy}
            />
            <Button
              type="button"
              variant="arcane"
              size="sm"
              loading={aiBusy}
              disabled={!aiPrompt.trim()}
              onClick={() => handleAiGenerate(aiPrompt)}
            >
              <Target className="h-3.5 w-3.5" />
              Generate
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
