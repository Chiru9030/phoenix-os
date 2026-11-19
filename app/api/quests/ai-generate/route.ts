import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { generateAiQuests } from '@/lib/server/quests';

const AiGenerateSchema = z.object({
  prompt: z.string().trim().min(2, 'Please enter at least 2 characters for your focus goal').max(160),
});

export const POST = api(async ({ req, db, p, dm }) => {
  const { prompt } = await body(req, AiGenerateSchema);
  const quests = await generateAiQuests(db, p, dm, prompt);
  return { ok: true, quests, message: `The Dungeon Master generated ${quests.length} quests tailored to your goal.` };
});
