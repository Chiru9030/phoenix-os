import { z } from 'zod';
import { api, body, queryId } from '@/lib/server/api';
import { createQuickQuest, deletePendingQuest } from '@/lib/server/quests';
import { loadDay } from '@/lib/server/daily';
import { todayInTz } from '@/lib/game/dates';
import { QUEST_TYPES } from '@/lib/types';

const CreateQuestSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(160),
  type: z.enum(QUEST_TYPES).optional(),
  tags: z.array(z.string()).optional(),
  description: z.string().trim().max(300).optional(),
});

export const GET = api(async ({ db, p }) => {
  const today = todayInTz(p.profile.timezone);
  const day = await loadDay(db, p, today);
  return { quests: day.quests };
});

export const POST = api(async ({ req, db, p }) => {
  const input = await body(req, CreateQuestSchema);
  const quest = await createQuickQuest(db, p, input);
  return { ok: true, quest };
});

export const DELETE = api(async ({ req, db, p }) => {
  const id = queryId(req);
  await deletePendingQuest(db, p, id);
  return { ok: true };
});
