import { api, body } from '@/lib/server/api';
import { OnboardSchema, createCharacter } from '@/lib/server/player';
export const POST = api(async ({ req, db, user }) => {
  const p = await createCharacter(db, user.id, await body(req, OnboardSchema));
  return { ok: true, name: p.character.name };
}, { player: false });
