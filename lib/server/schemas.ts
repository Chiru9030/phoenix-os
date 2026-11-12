import { z } from 'zod';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const GoalSchema = z.object({
  title: z.string().trim().min(1, 'Give the goal a title').max(160),
  notes: z.string().trim().max(400).optional(),
  tags: z.array(z.string()).max(4).optional(),
  questType: z.enum(['main', 'side', 'boss_fight']).default('main'),
  dueDate: date.nullish(),
});
export const HabitSchema = z.object({
  title: z.string().trim().min(1, 'Give the habit a title').max(120),
  tags: z.array(z.string()).max(4).optional(),
  questType: z.enum(['main', 'side', 'daily_challenge']).default('side'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([0, 1, 2, 3, 4, 5, 6]),
});
export const RewardSchema = z.object({ label: z.string().trim().min(1).max(80), goldCost: z.number().int().min(10).max(100000) });
export const IdSchema = z.object({ id: z.string().uuid() });
