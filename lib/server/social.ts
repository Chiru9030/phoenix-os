import { z } from 'zod';
import { cleanText } from '@/lib/ai/sanitize';
import { HEAD, HttpError, countOf, maybe, must, type Db } from './util';
import type { Player } from './player';
import { grantProgress, runAwards } from './progress';
import { notify } from './notify';
import { loadEffects } from './progress';

export interface GuildRow { id: string; name: string; description: string | null; icon: string | null; created_by: string | null; created_at: string }
export interface GuildQuestRow { id: string; guild_id: string; title: string; description: string | null; target_value: number; current_value: number; xp_reward: number; gold_reward: number; status: 'active' | 'completed' | 'expired'; starts_at: string; ends_at: string }

export const GuildSchema = z.object({ name: z.string().trim().min(3, 'Guild names need 3+ characters').max(32), description: z.string().trim().max(200).optional(), icon: z.enum(['shield', 'flame', 'swords', 'crown', 'compass', 'sparkles']).default('shield') });
const GUILD_QUESTS: [string, string][] = [
  ['The Great Hunt', 'Together, earn enough XP to bring down the beast stalking the guild lands.'],
  ['Siege of Procrastination Keep', 'Storm the keep with a week of combined effort.'],
  ['The Long March', 'A steady, shared push. Every member\'s quest adds a step.'],
  ['Festival of Forges', 'Every finished quest strikes one more blow on the guild\'s anvil.'],
];
const MAX_MEMBERS = 30;

export async function ensureGuildQuest(db: Db, guildId: string): Promise<GuildQuestRow | null> {
  const now = new Date();
  await db.from('guild_quests').update({ status: 'expired' }).eq('guild_id', guildId).eq('status', 'active').lt('ends_at', now.toISOString());
  const active = await must<GuildQuestRow[]>(db.from('guild_quests').select('*').eq('guild_id', guildId).eq('status', 'active').limit(1));
  if (active.length) return active[0];
  const members = await countOf(db.from('guild_members').select('character_id', HEAD).eq('guild_id', guildId));
  const [title, description] = GUILD_QUESTS[Math.floor(now.getTime() / (7 * 86_400_000)) % GUILD_QUESTS.length];
  const res = await db.from('guild_quests').insert({ guild_id: guildId, title, description, target_value: 1200 * Math.max(1, members), xp_reward: 300, gold_reward: 100, ends_at: new Date(now.getTime() + 7 * 86_400_000).toISOString() }).select('*').single();
  return (res.data as GuildQuestRow) ?? null;
}

/** Target scales with membership (1,200 XP per member), never dropping below progress already made. */
async function syncGuildTarget(db: Db, guildId: string) {
  const [q, members] = await Promise.all([ensureGuildQuest(db, guildId), countOf(db.from('guild_members').select('character_id', HEAD).eq('guild_id', guildId))]);
  if (q) await db.from('guild_quests').update({ target_value: Math.max(q.current_value, 1200 * Math.max(1, members)) }).eq('id', q.id).eq('status', 'active');
}

export interface GuildView {
  guild: GuildRow; role: 'leader' | 'officer' | 'member';
  members: { characterId: string; name: string; level: number; lifetimeXp: number; role: string; isMe: boolean }[];
  quest: GuildQuestRow | null; canClaim: boolean; claimed: boolean; lastCompleted: GuildQuestRow | null;
}
export async function guildOverview(db: Db, p: Player): Promise<GuildView | null> {
  const me = await maybe<{ guild_id: string; role: GuildView['role'] }>(db.from('guild_members').select('guild_id,role').eq('character_id', p.character.id).maybeSingle());
  if (!me) return null;
  const [guild, mem, quest] = await Promise.all([
    must<GuildRow>(db.from('guilds').select('*').eq('id', me.guild_id).single()),
    must<{ role: string; characters: { id: string; name: string; level: number; lifetime_xp: number } | null }[]>(db.from('guild_members').select('role, characters(id,name,level,lifetime_xp)').eq('guild_id', me.guild_id)),
    ensureGuildQuest(db, me.guild_id),
  ]);
  const completed = await must<GuildQuestRow[]>(db.from('guild_quests').select('*').eq('guild_id', me.guild_id).eq('status', 'completed').order('ends_at', { ascending: false }).limit(1));
  const last = completed[0] ?? null;
  const claimed = last ? (await countOf(db.from('guild_quest_claims').select('guild_quest_id', HEAD).eq('guild_quest_id', last.id).eq('character_id', p.character.id))) > 0 : false;
  return {
    guild, role: me.role, quest, lastCompleted: last, claimed, canClaim: !!last && !claimed,
    members: mem.filter((m) => m.characters).map((m) => ({ characterId: m.characters!.id, name: m.characters!.name, level: m.characters!.level, lifetimeXp: Number(m.characters!.lifetime_xp), role: m.role, isMe: m.characters!.id === p.character.id }))
      .sort((a, b) => b.lifetimeXp - a.lifetimeXp),
  };
}
export async function createGuild(db: Db, p: Player, input: z.infer<typeof GuildSchema>) {
  if (await maybe(db.from('guild_members').select('guild_id').eq('character_id', p.character.id).maybeSingle())) throw new HttpError(409, 'Leave your current guild first.');
  const g = await db.from('guilds').insert({ name: cleanText(input.name, 32), description: input.description ? cleanText(input.description, 200) : null, icon: input.icon, created_by: p.profile.id }).select('*').single();
  if (g.error) throw new HttpError(g.error.code === '23505' ? 409 : 500, g.error.code === '23505' ? 'That guild name is taken.' : g.error.message);
  await must(db.from('guild_members').insert({ guild_id: g.data.id, character_id: p.character.id, role: 'leader' }));
  await ensureGuildQuest(db, g.data.id);
  const awards = await runAwards(db, { characterId: p.character.id, userId: p.profile.id, campaignId: p.character.active_campaign_id });
  return { guild: g.data as GuildRow, awards };
}
export async function joinGuild(db: Db, p: Player, guildId: string) {
  const size = await countOf(db.from('guild_members').select('character_id', HEAD).eq('guild_id', guildId));
  if (size >= MAX_MEMBERS) throw new HttpError(409, 'That guild is full.');
  if (!(await maybe(db.from('guilds').select('id').eq('id', guildId).maybeSingle()))) throw new HttpError(404, 'Guild not found');
  const res = await db.from('guild_members').insert({ guild_id: guildId, character_id: p.character.id, role: 'member' });
  if (res.error) throw new HttpError(res.error.code === '23505' ? 409 : 500, res.error.code === '23505' ? 'Leave your current guild first.' : res.error.message);
  await syncGuildTarget(db, guildId);
  return runAwards(db, { characterId: p.character.id, userId: p.profile.id, campaignId: p.character.active_campaign_id });
}
export async function leaveGuild(db: Db, p: Player) {
  const me = await maybe<{ guild_id: string; role: string }>(db.from('guild_members').select('guild_id,role').eq('character_id', p.character.id).maybeSingle());
  if (!me) throw new HttpError(404, 'You are not in a guild.');
  await must(db.from('guild_members').delete().eq('character_id', p.character.id));
  const rest = await must<{ character_id: string }[]>(db.from('guild_members').select('character_id').eq('guild_id', me.guild_id).order('joined_at').limit(1));
  if (!rest.length) await db.from('guilds').delete().eq('id', me.guild_id);                          // last one out closes the guild
  else {
    if (me.role === 'leader') await db.from('guild_members').update({ role: 'leader' }).eq('guild_id', me.guild_id).eq('character_id', rest[0].character_id); // longest-serving member leads
    await syncGuildTarget(db, me.guild_id);
  }
}
export async function claimGuildQuest(db: Db, p: Player, questId: string) {
  const cid = p.character.id;
  const q = await maybe<GuildQuestRow>(db.from('guild_quests').select('*').eq('id', questId).maybeSingle());
  if (!q || q.status !== 'completed') throw new HttpError(400, 'That guild quest is not complete.');
  if (!(await maybe(db.from('guild_members').select('guild_id').eq('guild_id', q.guild_id).eq('character_id', cid).maybeSingle()))) throw new HttpError(403, 'You are not in that guild.');
  const ins = await must<unknown[]>(db.from('guild_quest_claims').upsert({ guild_quest_id: q.id, character_id: cid }, { onConflict: 'guild_quest_id,character_id', ignoreDuplicates: true }).select());
  if (!ins.length) throw new HttpError(409, 'You already claimed this reward.');
  const fx = await loadEffects(db, cid);
  const xp = Math.round(q.xp_reward * (1 + fx.guildQuestXpBonusPct / 100));
  const progress = await grantProgress(db, cid, { xp, gold: q.gold_reward });
  await db.from('xp_log').insert({ character_id: cid, source: 'guild_quest', amount: xp });
  await db.from('gold_transactions').insert({ character_id: cid, amount: q.gold_reward, reason: `Guild quest: ${q.title}`.slice(0, 120) });
  return { xp, gold: q.gold_reward, progress };
}

// ── friends ──
interface CharLite { id: string; name: string; level: number; user_id?: string }
export async function searchPlayers(db: Db, p: Player, q: string) {
  const term = q.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (term.length < 3) return [];
  const profs = await must<{ id: string; username: string }[]>(db.from('profiles').select('id,username').ilike('username', `${term}%`).neq('id', p.profile.id).limit(8));
  if (!profs.length) return [];
  const chars = await must<(CharLite & { user_id: string })[]>(db.from('characters').select('id,name,level,user_id').in('user_id', profs.map((x) => x.id)).eq('onboarded', true));
  return chars.map((c) => ({ characterId: c.id, name: c.name, level: c.level, username: profs.find((x) => x.id === c.user_id)?.username ?? '' }));
}
export async function friendOverview(db: Db, p: Player) {
  const me = p.character.id;
  const rows = await must<{ id: string; status: 'pending' | 'accepted'; requester_id: string; addressee_id: string; requester: CharLite | null; addressee: CharLite | null }[]>(
    db.from('friendships').select('id,status,requester_id,addressee_id,requester:characters!requester_id(id,name,level),addressee:characters!addressee_id(id,name,level)').or(`requester_id.eq.${me},addressee_id.eq.${me}`));
  const other = (r: (typeof rows)[number]) => (r.requester_id === me ? r.addressee : r.requester);
  const shape = (r: (typeof rows)[number]) => ({ id: r.id, characterId: other(r)?.id ?? '', name: other(r)?.name ?? 'Unknown', level: other(r)?.level ?? 1 });
  return {
    friends: rows.filter((r) => r.status === 'accepted').map(shape),
    incoming: rows.filter((r) => r.status === 'pending' && r.addressee_id === me).map(shape),
    outgoing: rows.filter((r) => r.status === 'pending' && r.requester_id === me).map(shape),
  };
}
export async function sendFriendRequest(db: Db, p: Player, targetCharacterId: string) {
  const me = p.character.id;
  if (targetCharacterId === me) throw new HttpError(400, 'You cannot befriend yourself.');
  const target = await maybe<CharLite & { user_id: string }>(db.from('characters').select('id,name,level,user_id').eq('id', targetCharacterId).eq('onboarded', true).maybeSingle());
  if (!target) throw new HttpError(404, 'Player not found');
  const existing = await must<unknown[]>(db.from('friendships').select('id').or(`and(requester_id.eq.${me},addressee_id.eq.${target.id}),and(requester_id.eq.${target.id},addressee_id.eq.${me})`));
  if (existing.length) throw new HttpError(409, 'You already have a pending or accepted friendship with that player.');
  await must(db.from('friendships').insert({ requester_id: me, addressee_id: target.id }));
  await notify(db, target.user_id, { type: 'social', title: 'New friend request', body: `${p.character.name} wants to be your ally.` });
}
export async function respondFriend(db: Db, p: Player, id: string, action: 'accept' | 'decline' | 'remove') {
  const me = p.character.id;
  const f = await maybe<{ id: string; status: string; requester_id: string; addressee_id: string }>(db.from('friendships').select('*').eq('id', id).maybeSingle());
  if (!f || (f.requester_id !== me && f.addressee_id !== me)) throw new HttpError(404, 'Friend request not found');
  if (action === 'accept') {
    if (f.addressee_id !== me || f.status !== 'pending') throw new HttpError(400, 'Nothing to accept');
    await must(db.from('friendships').update({ status: 'accepted' }).eq('id', id));
    const o = await maybe<{ user_id: string }>(db.from('characters').select('user_id').eq('id', f.requester_id).maybeSingle());
    if (o) await notify(db, o.user_id, { type: 'social', title: 'Friend request accepted', body: `${p.character.name} is now your ally.` });
  } else await must(db.from('friendships').delete().eq('id', id));
}

// ── 1v1 XP duels ──
export const ChallengeSchema = z.object({ friendCharacterId: z.string().uuid(), days: z.number().int().min(1).max(14).default(7), stake: z.number().int().min(0).max(500).default(0) });
export interface ChallengeView { id: string; status: string; opponentName: string; iAmChallenger: boolean; stake: number; endsAt: string; myXp: number; theirXp: number; winnerIsMe: boolean | null; canAccept: boolean }

export async function settleChallenges(db: Db, p: Player) {
  const me = p.character.id, now = new Date().toISOString();
  const due = await must<{ id: string; challenger_id: string; opponent_id: string; starts_at: string; ends_at: string; stake_gold: number }[]>(
    db.from('challenges').select('*').eq('status', 'active').lt('ends_at', now).or(`challenger_id.eq.${me},opponent_id.eq.${me}`));
  for (const c of due) {
    const [a, b] = await Promise.all([c.challenger_id, c.opponent_id].map(async (id) => Number((await db.rpc('xp_between', { p_character: id, p_from: c.starts_at, p_to: c.ends_at })).data ?? 0)));
    const winner = a === b ? null : a > b ? c.challenger_id : c.opponent_id;
    const claimed = await must<unknown[]>(db.from('challenges').update({ status: 'finished', winner_id: winner, challenger_xp: a, opponent_xp: b }).eq('id', c.id).eq('status', 'active').select());
    if (!claimed.length) continue; // someone else settled it
    if (c.stake_gold > 0) {
      for (const id of winner ? [winner] : [c.challenger_id, c.opponent_id]) {
        const amount = winner ? c.stake_gold * 2 : c.stake_gold;
        await grantProgress(db, id, { gold: amount });
        await db.from('gold_transactions').insert({ character_id: id, amount, reason: winner ? 'Duel won' : 'Duel drawn: stake returned' });
      }
    }
    const users = await must<{ id: string; user_id: string; name: string }[]>(db.from('characters').select('id,user_id,name').in('id', [c.challenger_id, c.opponent_id]));
    for (const u of users) await notify(db, u.user_id, { type: 'social', title: 'Duel finished', body: winner === null ? 'It ended in a draw.' : winner === u.id ? 'You won the duel!' : 'You lost this duel. Rematch?' });
  }
}
export async function challengeOverview(db: Db, p: Player): Promise<ChallengeView[]> {
  await settleChallenges(db, p);
  const me = p.character.id;
  const rows = await must<{ id: string; status: string; challenger_id: string; opponent_id: string; starts_at: string; ends_at: string; stake_gold: number; winner_id: string | null; challenger_xp: number | null; opponent_xp: number | null; challenger: CharLite | null; opponent: CharLite | null }[]>(
    db.from('challenges').select('*, challenger:characters!challenger_id(id,name,level), opponent:characters!opponent_id(id,name,level)').or(`challenger_id.eq.${me},opponent_id.eq.${me}`).neq('status', 'declined').order('created_at', { ascending: false }).limit(12));
  return Promise.all(rows.map(async (c) => {
    const mine = c.challenger_id === me;
    let my = mine ? c.challenger_xp : c.opponent_xp, their = mine ? c.opponent_xp : c.challenger_xp;
    if (c.status === 'active') {
      const [a, b] = await Promise.all([c.challenger_id, c.opponent_id].map(async (id) => Number((await db.rpc('xp_between', { p_character: id, p_from: c.starts_at, p_to: new Date().toISOString() })).data ?? 0)));
      my = mine ? a : b; their = mine ? b : a;
    }
    return { id: c.id, status: c.status, opponentName: (mine ? c.opponent : c.challenger)?.name ?? 'Unknown', iAmChallenger: mine, stake: c.stake_gold, endsAt: c.ends_at, myXp: my ?? 0, theirXp: their ?? 0, winnerIsMe: c.status === 'finished' ? (c.winner_id === null ? null : c.winner_id === me) : null, canAccept: c.status === 'pending' && !mine };
  }));
}
export async function createChallenge(db: Db, p: Player, input: z.infer<typeof ChallengeSchema>) {
  const me = p.character.id, them = input.friendCharacterId;
  const ok = await must<unknown[]>(db.from('friendships').select('id').eq('status', 'accepted').or(`and(requester_id.eq.${me},addressee_id.eq.${them}),and(requester_id.eq.${them},addressee_id.eq.${me})`));
  if (!ok.length) throw new HttpError(403, 'You can only challenge friends.');
  if (input.stake > p.character.gold) throw new HttpError(402, 'You cannot afford that stake.');
  const open = await countOf(db.from('challenges').select('id', HEAD).in('status', ['pending', 'active']).or(`challenger_id.eq.${me},opponent_id.eq.${me}`));
  if (open >= 5) throw new HttpError(400, 'You have 5 open duels already.');
  const now = Date.now();
  await must(db.from('challenges').insert({ challenger_id: me, opponent_id: them, stake_gold: input.stake, starts_at: new Date(now).toISOString(), ends_at: new Date(now + input.days * 86_400_000).toISOString() }));
  const o = await maybe<{ user_id: string }>(db.from('characters').select('user_id').eq('id', them).maybeSingle());
  if (o) await notify(db, o.user_id, { type: 'social', title: 'You have been challenged', body: `${p.character.name} dares you to a ${input.days}-day XP duel.` });
}
export async function respondChallenge(db: Db, p: Player, id: string, accept: boolean) {
  const me = p.character.id;
  const c = await maybe<{ id: string; status: string; challenger_id: string; opponent_id: string; starts_at: string; ends_at: string; stake_gold: number }>(db.from('challenges').select('*').eq('id', id).eq('opponent_id', me).eq('status', 'pending').maybeSingle());
  if (!c) throw new HttpError(404, 'Challenge not found');
  if (!accept) { await must(db.from('challenges').update({ status: 'declined' }).eq('id', id)); return; }
  if (c.stake_gold > 0) { // escrow both stakes atomically-enough: refund if either side cannot pay
    const a = Number((await db.rpc('spend_gold', { p_character: c.challenger_id, p_amount: c.stake_gold })).data);
    if (a === -1) throw new HttpError(402, 'The challenger can no longer afford the stake.');
    const b = Number((await db.rpc('spend_gold', { p_character: me, p_amount: c.stake_gold })).data);
    if (b === -1) { await grantProgress(db, c.challenger_id, { gold: c.stake_gold }); throw new HttpError(402, 'You cannot afford the stake.'); }
    await db.from('gold_transactions').insert([{ character_id: c.challenger_id, amount: -c.stake_gold, reason: 'Duel stake' }, { character_id: me, amount: -c.stake_gold, reason: 'Duel stake' }]);
  }
  const len = new Date(c.ends_at).getTime() - new Date(c.starts_at).getTime(), now = Date.now();
  await must(db.from('challenges').update({ status: 'active', starts_at: new Date(now).toISOString(), ends_at: new Date(now + len).toISOString() }).eq('id', id).eq('status', 'pending'));
}

// ── leaderboards ──
export async function leaderboards(db: Db) {
  const [g, w, gl] = await Promise.all([db.rpc('leaderboard_global', { p_limit: 50 }), db.rpc('leaderboard_weekly', { p_limit: 50 }), db.rpc('leaderboard_guilds', { p_limit: 30 })]);
  for (const r of [g, w, gl]) if (r.error) throw new Error(r.error.message);
  return {
    global: (g.data ?? []) as { character_id: string; name: string; level: number; lifetime_xp: number; guild_name: string | null; rank: number }[],
    weekly: (w.data ?? []) as { character_id: string; name: string; level: number; weekly_xp: number; guild_name: string | null; rank: number }[],
    guilds: (gl.data ?? []) as { guild_id: string; guild_name: string; member_count: number; total_level: number; total_xp: number; rank: number }[],
  };
}
export async function browseGuilds(db: Db) {
  return must<{ id: string; name: string; description: string | null; icon: string | null; guild_members: { count: number }[] }[]>(db.from('guilds').select('id,name,description,icon,guild_members(count)').order('created_at', { ascending: false }).limit(30));
}
