import type { BossContext, BriefingContext, CoachContext, CoachTurn, DMResult, DungeonMaster, QuestContext, QuestDraft, WeeklyReportContext } from '@/lib/types';
import { LlmDungeonMaster, anthropicTransport, openaiTransport, type LlmTransport } from './llm';
import { OfflineDungeonMaster } from './offline';
import { CRISIS_REPLY, looksLikeCrisis } from './sanitize';

/**
 * "Hybrid, auto-upgrades": if an LLM provider is configured it is tried first for every call;
 * on ANY failure (bad key, rate limit, timeout, malformed output) we silently use the offline
 * engine instead, so the game never breaks and never blocks on a third party.
 */
export class HybridDungeonMaster implements DungeonMaster {
  readonly name: string;
  private readonly offline = new OfflineDungeonMaster();
  private readonly primary: LlmDungeonMaster | null;
  constructor(transport: LlmTransport | null, private readonly warn: (msg: string) => void = (m) => console.warn(m)) {
    this.primary = transport ? new LlmDungeonMaster(transport) : null;
    this.name = this.primary ? `hybrid(${this.primary.name} → offline)` : 'offline';
  }
  get usesLlm() { return this.primary !== null; }
  secretQuest(ctx: QuestContext): QuestDraft { return this.offline.secretQuest(ctx); }

  private async attempt<T>(label: string, llm: (p: LlmDungeonMaster) => Promise<DMResult<T>>, off: () => Promise<DMResult<T>>): Promise<DMResult<T>> {
    if (this.primary) {
      try { return await llm(this.primary); }
      catch (e) { this.warn(`[dungeon-master] ${label} via ${this.primary.name} failed, using offline engine: ${(e as Error).message.slice(0, 160)}`); }
    }
    return off();
  }
  generateDailyQuests(ctx: QuestContext) { return this.attempt('quests', (p) => p.generateDailyQuests(ctx), () => this.offline.generateDailyQuests(ctx)); }
  generateBriefing(ctx: BriefingContext) { return this.attempt('briefing', (p) => p.generateBriefing(ctx), () => this.offline.generateBriefing(ctx)); }
  generateBoss(ctx: BossContext) { return this.attempt('boss', (p) => p.generateBoss(ctx), () => this.offline.generateBoss(ctx)); }
  generateWeeklyReport(ctx: WeeklyReportContext) { return this.attempt('weekly report', (p) => p.generateWeeklyReport(ctx), () => this.offline.generateWeeklyReport(ctx)); }
  async coach(ctx: CoachContext, history: CoachTurn[], message: string): Promise<DMResult<string>> {
    if (looksLikeCrisis(message)) return { value: CRISIS_REPLY, source: 'offline', provider: 'safety' }; // never route a crisis through a model
    return this.attempt('coach', (p) => p.coach(ctx, history, message), () => this.offline.coach(ctx, history, message));
  }
}

type Env = Record<string, string | undefined>;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
/**
 * Picks the Dungeon Master from the environment.
 *  • No keys           → offline engine (zero setup, zero cost).
 *  • Keys present      → first of Anthropic → OpenAI → Gemini, automatically ("hybrid, auto-upgrades").
 *  • DM_PROVIDER=offline|anthropic|openai|gemini|ollama forces a choice. Ollama (local models) is never auto-selected.
 * Whatever is chosen, any failure at call time falls back to the offline engine.
 */
export function getDungeonMaster(env: Env = process.env, fetchImpl?: typeof fetch): HybridDungeonMaster {
  const forced = env.DM_PROVIDER?.trim().toLowerCase();
  const a = env.ANTHROPIC_API_KEY?.trim(), o = env.OPENAI_API_KEY?.trim(), g = env.GEMINI_API_KEY?.trim();
  const pick = (v?: string) => v?.trim() || undefined;
  const make: Record<string, () => LlmTransport | null> = {
    anthropic: () => (a ? anthropicTransport({ apiKey: a, model: pick(env.ANTHROPIC_MODEL), fetchImpl }) : null),
    openai: () => (o ? openaiTransport({ apiKey: o, model: pick(env.OPENAI_MODEL), baseUrl: pick(env.OPENAI_BASE_URL), reasoningEffort: pick(env.OPENAI_REASONING_EFFORT), fetchImpl }) : null),
    gemini: () => (g ? openaiTransport({ apiKey: g, label: 'gemini', baseUrl: GEMINI_BASE, model: pick(env.GEMINI_MODEL) ?? 'gemini-3.8-flash', reasoningEffort: pick(env.GEMINI_REASONING_EFFORT), fetchImpl }) : null),
    ollama: () => openaiTransport({ apiKey: 'ollama', label: 'ollama', baseUrl: pick(env.OLLAMA_BASE_URL) ?? 'http://localhost:11434/v1', model: pick(env.OLLAMA_MODEL) ?? 'llama3.1', timeoutMs: 60_000, fetchImpl }),
  };
  if (forced === 'offline') return new HybridDungeonMaster(null);
  if (forced && make[forced]) return new HybridDungeonMaster(make[forced]());
  for (const k of ['anthropic', 'openai', 'gemini']) { const t = make[k](); if (t) return new HybridDungeonMaster(t); }
  return new HybridDungeonMaster(null);
}
