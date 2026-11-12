-- ════════════════════════════════════════════════════════════════════════
-- PROJECT PHOENIX OS — schema (run once in Supabase → SQL Editor)
-- Design rule: GAME STATE IS SERVER-AUTHORITATIVE. Browsers get read-only
-- access to their own rows; every mutation goes through Next.js API routes
-- using the service-role key, so XP/gold/levels cannot be edited client-side.
-- Only user-authored content (habits, goals, notifications, own profile)
-- is directly writable by its owner.
-- ════════════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

-- ── Profiles (1:1 with auth.users) ───────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  timezone text not null default 'Asia/Kolkata',
  notification_prefs jsonb not null default '{"morning_quests":true,"boss_reminders":true,"streak_protection":true,"daily_summary":true}',
  sound_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    lower(regexp_replace(split_part(coalesce(new.email,'player'),'@',1), '[^a-zA-Z0-9]', '', 'g')) || '_' || substr(md5(random()::text), 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,'Adventurer'),'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  ) on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ── Campaigns ───────────────────────────────────────────────────────────
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon text,
  theme_color text
);

-- ── Characters ──────────────────────────────────────────────────────────
create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles(id) on delete cascade,
  name text not null,
  character_class text not null default 'Adventurer',
  level int not null default 1,
  current_xp int not null default 0,
  lifetime_xp bigint not null default 0,
  gold int not null default 100 check (gold >= 0),
  avatar_seed text not null default substr(md5(random()::text), 1, 8),
  active_campaign_id uuid references campaigns(id),
  focus_stats text[] not null default '{}',
  difficulty text not null default 'normal' check (difficulty in ('gentle','normal','hardcore')),
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_characters_updated on characters;
create trigger trg_characters_updated before update on characters for each row execute function set_updated_at();

create table if not exists character_stats (
  character_id uuid primary key references characters(id) on delete cascade,
  strength numeric(9,2) not null default 0, intelligence numeric(9,2) not null default 0, wisdom numeric(9,2) not null default 0,
  discipline numeric(9,2) not null default 0, charisma numeric(9,2) not null default 0, health numeric(9,2) not null default 0,
  creativity numeric(9,2) not null default 0, coding_skill numeric(9,2) not null default 0, communication numeric(9,2) not null default 0,
  finance numeric(9,2) not null default 0
);

create table if not exists streaks (
  character_id uuid primary key references characters(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_active_date date,
  freeze_tokens int not null default 1
);

create table if not exists character_skill_points (
  character_id uuid primary key references characters(id) on delete cascade,
  available_points int not null default 0,
  spent_points int not null default 0
);

-- ── User-authored real-life inputs the Dungeon Master turns into quests ──
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  tags text[] not null default '{}',
  quest_type text not null default 'side' check (quest_type in ('main','side','daily_challenge')),
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  notes text,
  tags text[] not null default '{}',
  quest_type text not null default 'main' check (quest_type in ('main','side','boss_fight')),
  due_date date,
  status text not null default 'active' check (status in ('active','done','dropped')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ── Quests & ledgers ────────────────────────────────────────────────────
create table if not exists quests (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  quest_date date not null default current_date,
  quest_type text not null check (quest_type in ('main','side','daily_challenge','boss_fight')),
  title text not null,
  description text not null,
  tags text[] not null default '{}',
  xp_reward int not null default 20,
  gold_reward int not null default 10,
  stat_rewards jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','completed','expired')),
  source text not null default 'offline' check (source in ('ai','offline','manual','event')),
  double_xp boolean not null default false,
  goal_id uuid references goals(id) on delete set null,
  habit_id uuid references habits(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_quests_char_date on quests(character_id, quest_date);
create unique index if not exists uq_quest_goal_day on quests(character_id, quest_date, goal_id) where goal_id is not null;
create unique index if not exists uq_quest_habit_day on quests(character_id, quest_date, habit_id) where habit_id is not null;

create table if not exists xp_log (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  source text not null, amount int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_xplog_char on xp_log(character_id, created_at desc);

create table if not exists gold_transactions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  amount int not null, reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_gold_char on gold_transactions(character_id, created_at desc);

create table if not exists rewards (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  gold_cost int not null check (gold_cost > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  reward_label text not null, gold_cost int not null,
  redeemed_at timestamptz not null default now()
);

-- ── Achievements / items / titles ───────────────────────────────────────
create table if not exists achievements (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, name text not null, description text not null,
  icon text not null default 'trophy', category text not null default 'general',
  criteria jsonb not null,
  reward_xp int not null default 0, reward_gold int not null default 0,
  reward_item_key text, reward_title_key text
);
create table if not exists character_achievements (
  character_id uuid not null references characters(id) on delete cascade,
  achievement_id uuid not null references achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (character_id, achievement_id)
);
create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, name text not null, description text not null,
  icon text not null default 'package',
  rarity text not null default 'common' check (rarity in ('common','uncommon','rare','epic','legendary')),
  item_type text not null default 'consumable' check (item_type in ('consumable','equipment','badge')),
  slot text check (slot in ('weapon','shield','tome','badge')),
  effect jsonb not null default '{}'
);
create table if not exists character_inventory (
  character_id uuid not null references characters(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  quantity int not null default 1,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (character_id, item_id)
);
create table if not exists titles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null, name text not null, description text
);
create table if not exists character_titles (
  character_id uuid not null references characters(id) on delete cascade,
  title_id uuid not null references titles(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  is_equipped boolean not null default false,
  primary key (character_id, title_id)
);

-- ── Skill tree ──────────────────────────────────────────────────────────
create table if not exists skill_nodes (
  id uuid primary key default gen_random_uuid(),
  branch text not null check (branch in ('strength','knowledge','communication','finance','creativity','leadership','focus')),
  key text unique not null, name text not null, description text not null,
  tier int not null default 1, cost int not null default 1,
  prerequisite_node_id uuid references skill_nodes(id),
  effect jsonb not null default '{}'
);
create table if not exists character_skills (
  character_id uuid not null references characters(id) on delete cascade,
  node_id uuid not null references skill_nodes(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (character_id, node_id)
);

-- ── Story ───────────────────────────────────────────────────────────────
create table if not exists story_chapters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  chapter_number int not null, title text not null, narrative text not null,
  unlock_criteria jsonb not null default '{"type":"always"}',
  reward_gold int not null default 0, reward_item_key text,
  unique (campaign_id, chapter_number)
);
create table if not exists character_story_progress (
  character_id uuid not null references characters(id) on delete cascade,
  chapter_id uuid not null references story_chapters(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked','unlocked','completed')),
  unlocked_at timestamptz, completed_at timestamptz,
  primary key (character_id, chapter_id)
);
create table if not exists npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  name text not null, role text, description text, portrait_seed text
);

-- ── Bosses, events, briefings, reports ──────────────────────────────────
create table if not exists boss_battles (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  name text not null, description text not null,
  difficulty text not null default 'normal' check (difficulty in ('normal','hard','very_hard','legendary')),
  max_hp int not null, current_hp int not null,
  xp_reward int not null, gold_reward int not null, item_reward_key text,
  is_hidden boolean not null default false,
  status text not null default 'active' check (status in ('active','defeated','fled')),
  started_at timestamptz not null default now(), expires_at timestamptz, completed_at timestamptz
);
create index if not exists idx_boss_char on boss_battles(character_id, status);
-- Only one active weekly (non-hidden) boss per character, even under concurrent requests.
create unique index if not exists uq_active_boss on boss_battles(character_id) where status = 'active' and not is_hidden;

create table if not exists random_events (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  event_date date not null default current_date,
  event_type text not null check (event_type in ('double_xp','secret_quest','treasure_chest','lucky_spin','hidden_boss','weekend_festival')),
  description text not null, effect jsonb not null default '{}',
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (character_id, event_date)
);
create table if not exists daily_briefings (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  briefing_date date not null,
  narrative text not null,
  generated_by text not null default 'offline',
  cleared_at timestamptz, -- set atomically by the first request to clear the whole board (pays the all-clear bonus once)
  created_at timestamptz not null default now(),
  unique (character_id, briefing_date)
);
create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  week_start date not null, week_end date not null,
  stat_deltas jsonb not null default '{}',
  metrics jsonb not null default '{}',
  summary text not null, weakness text, recommendation text,
  generated_by text not null default 'offline',
  created_at timestamptz not null default now(),
  unique (character_id, week_start)
);
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  notif_type text not null, title text not null, body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notif_user on notifications(user_id, created_at desc);
create table if not exists coaching_messages (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references characters(id) on delete cascade,
  role text not null check (role in ('user','coach')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_coach_char on coaching_messages(character_id, created_at);

-- ── Social (Phase 4) ────────────────────────────────────────────────────
create table if not exists guilds (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (char_length(name) between 3 and 32),
  description text, icon text default 'shield',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table if not exists guild_members (
  guild_id uuid not null references guilds(id) on delete cascade,
  character_id uuid not null unique references characters(id) on delete cascade,
  role text not null default 'member' check (role in ('leader','officer','member')),
  joined_at timestamptz not null default now(),
  primary key (guild_id, character_id)
);
create table if not exists guild_quests (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references guilds(id) on delete cascade,
  title text not null, description text,
  target_value int not null default 50, current_value int not null default 0,
  xp_reward int not null default 300, gold_reward int not null default 100,
  status text not null default 'active' check (status in ('active','completed','expired')),
  starts_at timestamptz not null default now(), ends_at timestamptz not null
);
create table if not exists guild_quest_claims (
  guild_quest_id uuid not null references guild_quests(id) on delete cascade,
  character_id uuid not null references characters(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (guild_quest_id, character_id)
);
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references characters(id) on delete cascade,
  addressee_id uuid not null references characters(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references characters(id) on delete cascade,
  opponent_id uuid not null references characters(id) on delete cascade,
  starts_at timestamptz not null default now(), ends_at timestamptz not null,
  stake_gold int not null default 0 check (stake_gold >= 0),
  status text not null default 'pending' check (status in ('pending','active','finished','declined')),
  winner_id uuid references characters(id),
  challenger_xp int, opponent_xp int,
  created_at timestamptz not null default now(),
  check (challenger_id <> opponent_id)
);

-- ── Leaderboard / aggregate functions (called server-side only) ─────────
create or replace function xp_between(p_character uuid, p_from timestamptz, p_to timestamptz)
returns bigint language sql stable as $$
  select coalesce(sum(amount), 0)::bigint from xp_log
  where character_id = p_character and created_at >= p_from and created_at < p_to and amount > 0;
$$;
create or replace function leaderboard_global(p_limit int default 50)
returns table(character_id uuid, name text, level int, current_xp int, lifetime_xp bigint, guild_name text, rank bigint)
language sql stable as $$
  select c.id, c.name, c.level, c.current_xp, c.lifetime_xp, g.name,
         rank() over (order by c.lifetime_xp desc, c.created_at asc)
  from characters c
  left join guild_members gm on gm.character_id = c.id left join guilds g on g.id = gm.guild_id
  where c.onboarded order by c.lifetime_xp desc, c.created_at asc limit p_limit;
$$;
create or replace function leaderboard_weekly(p_limit int default 50)
returns table(character_id uuid, name text, level int, weekly_xp bigint, guild_name text, rank bigint)
language sql stable as $$
  with w as (
    select character_id, sum(amount)::bigint as xp from xp_log
    where created_at >= now() - interval '7 days' and amount > 0 group by character_id)
  select c.id, c.name, c.level, w.xp, g.name, rank() over (order by w.xp desc)
  from w join characters c on c.id = w.character_id
  left join guild_members gm on gm.character_id = c.id left join guilds g on g.id = gm.guild_id
  order by w.xp desc limit p_limit;
$$;
create or replace function leaderboard_guilds(p_limit int default 50)
returns table(guild_id uuid, guild_name text, member_count bigint, total_level bigint, total_xp bigint, rank bigint)
language sql stable as $$
  select g.id, g.name, count(gm.character_id), coalesce(sum(c.level),0)::bigint, coalesce(sum(c.lifetime_xp),0)::bigint,
         rank() over (order by coalesce(sum(c.lifetime_xp),0) desc)
  from guilds g left join guild_members gm on gm.guild_id = g.id left join characters c on c.id = gm.character_id
  group by g.id, g.name order by coalesce(sum(c.lifetime_xp),0) desc limit p_limit;
$$;


-- ── Atomic game-state mutations (service_role only; the API calls these) ──
-- apply_progress: compare-and-set on (level, current_xp[, last_active_date]) so two quests
-- completed at the same instant can never overwrite each other. Returns false → caller retries.
create or replace function apply_progress(
  p_character uuid, p_expect_level int, p_expect_xp int, p_new_level int, p_new_xp int,
  p_xp_delta int, p_gold_delta int, p_stat_deltas jsonb, p_points_delta int,
  p_touch_streak boolean, p_expect_last date, p_streak_current int, p_streak_longest int, p_streak_freeze int, p_streak_date date
) returns boolean language plpgsql as $$
begin
  update characters set level = p_new_level, current_xp = p_new_xp, gold = gold + p_gold_delta, lifetime_xp = lifetime_xp + p_xp_delta
   where id = p_character and level = p_expect_level and current_xp = p_expect_xp
     and (not p_touch_streak or exists (select 1 from streaks s where s.character_id = p_character and s.last_active_date is not distinct from p_expect_last));
  if not found then return false; end if;
  update character_stats set
    strength = strength + coalesce((p_stat_deltas->>'strength')::numeric, 0),
    intelligence = intelligence + coalesce((p_stat_deltas->>'intelligence')::numeric, 0),
    wisdom = wisdom + coalesce((p_stat_deltas->>'wisdom')::numeric, 0),
    discipline = discipline + coalesce((p_stat_deltas->>'discipline')::numeric, 0),
    charisma = charisma + coalesce((p_stat_deltas->>'charisma')::numeric, 0),
    health = health + coalesce((p_stat_deltas->>'health')::numeric, 0),
    creativity = creativity + coalesce((p_stat_deltas->>'creativity')::numeric, 0),
    coding_skill = coding_skill + coalesce((p_stat_deltas->>'coding_skill')::numeric, 0),
    communication = communication + coalesce((p_stat_deltas->>'communication')::numeric, 0),
    finance = finance + coalesce((p_stat_deltas->>'finance')::numeric, 0)
   where character_id = p_character;
  if p_touch_streak then
    update streaks set current_streak = p_streak_current, longest_streak = p_streak_longest, freeze_tokens = p_streak_freeze, last_active_date = p_streak_date where character_id = p_character;
  end if;
  if p_points_delta <> 0 then update character_skill_points set available_points = available_points + p_points_delta where character_id = p_character; end if;
  return true;
end $$;

-- spend_gold: atomic, never goes negative. Returns the new balance, or -1 if the player cannot afford it.
create or replace function spend_gold(p_character uuid, p_amount int) returns int language plpgsql as $$
declare v int;
begin
  update characters set gold = gold - p_amount where id = p_character and gold >= p_amount and p_amount > 0 returning gold into v;
  return coalesce(v, -1);
end $$;

-- damage_boss: atomic damage; the single call that drops HP to 0 flips status and reports defeated_now.
create or replace function damage_boss(p_boss uuid, p_damage int)
returns table(current_hp int, max_hp int, defeated_now boolean) language plpgsql as $$
begin
  return query
  update boss_battles b set current_hp = greatest(0, b.current_hp - greatest(0, p_damage)),
         status = case when b.current_hp - greatest(0, p_damage) <= 0 then 'defeated' else b.status end,
         completed_at = case when b.current_hp - greatest(0, p_damage) <= 0 then now() else b.completed_at end
   where b.id = p_boss and b.status = 'active'
  returning b.current_hp, b.max_hp, (b.status = 'defeated');
end $$;

-- bump_guild_quest: atomic progress on the guild's active quest.
create or replace function bump_guild_quest(p_guild uuid, p_amount int)
returns table(quest_id uuid, title text, current_value int, target_value int, completed_now boolean) language plpgsql as $$
begin
  return query
  update guild_quests q set current_value = least(q.target_value, q.current_value + greatest(0, p_amount)),
         status = case when q.current_value + greatest(0, p_amount) >= q.target_value then 'completed' else q.status end
   where q.guild_id = p_guild and q.status = 'active' and q.ends_at > now()
  returning q.id, q.title, q.current_value, q.target_value, (q.status = 'completed');
end $$;

-- spend_skill_points: atomic; returns false if the player cannot afford the node.
create or replace function spend_skill_points(p_character uuid, p_cost int) returns boolean language plpgsql as $$
begin
  update character_skill_points set available_points = available_points - p_cost, spent_points = spent_points + p_cost
   where character_id = p_character and available_points >= p_cost and p_cost > 0;
  return found;
end $$;

-- grant_item: stackable consumables stack; gear/badges are unique. Returns {name, is_new} or null for an unknown key.
create or replace function grant_item(p_character uuid, p_item_key text, p_qty int default 1) returns jsonb language plpgsql as $$
declare v_item items%rowtype; v_had boolean;
begin
  select * into v_item from items where key = p_item_key;
  if not found then return null; end if;
  select exists(select 1 from character_inventory where character_id = p_character and item_id = v_item.id) into v_had;
  if v_item.item_type = 'consumable' then
    insert into character_inventory (character_id, item_id, quantity) values (p_character, v_item.id, greatest(1, p_qty))
    on conflict (character_id, item_id) do update set quantity = character_inventory.quantity + greatest(1, p_qty);
  else
    insert into character_inventory (character_id, item_id, quantity) values (p_character, v_item.id, 1) on conflict do nothing;
  end if;
  return jsonb_build_object('name', v_item.name, 'is_new', not v_had, 'type', v_item.item_type);
end $$;

-- ════════════ ROW LEVEL SECURITY ════════════
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Own profile only (other players are exposed via server-side queries).
drop policy if exists profiles_own_select on profiles;
create policy profiles_own_select on profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_own_update on profiles;
create policy profiles_own_update on profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Own character (read-only from the browser).
drop policy if exists characters_own_select on characters;
create policy characters_own_select on characters for select to authenticated using (user_id = (select auth.uid()));

-- Everything keyed by character_id: read-only for the owner.
do $$
declare t text;
begin
  foreach t in array array[
    'character_stats','streaks','character_skill_points','quests','xp_log','gold_transactions','reward_redemptions',
    'character_achievements','character_inventory','character_titles','character_skills','character_story_progress',
    'boss_battles','random_events','daily_briefings','weekly_reports','coaching_messages','guild_quest_claims'
  ] loop
    execute format('drop policy if exists %1$s_owner_select on %1$s', t);
    execute format($f$create policy %1$s_owner_select on %1$s for select to authenticated
      using (exists (select 1 from characters c where c.id = %1$s.character_id and c.user_id = (select auth.uid())))$f$, t);
  end loop;
  -- User-authored content: owner has full CRUD.
  foreach t in array array['habits','goals','rewards'] loop
    execute format('drop policy if exists %1$s_owner_all on %1$s', t);
    execute format($f$create policy %1$s_owner_all on %1$s for all to authenticated
      using (exists (select 1 from characters c where c.id = %1$s.character_id and c.user_id = (select auth.uid())))
      with check (exists (select 1 from characters c where c.id = %1$s.character_id and c.user_id = (select auth.uid())))$f$, t);
  end loop;
  -- Public game content: any signed-in user can read.
  foreach t in array array['campaigns','achievements','items','titles','skill_nodes','story_chapters','npcs','guilds','guild_members'] loop
    execute format('drop policy if exists %1$s_auth_select on %1$s', t);
    execute format('create policy %1$s_auth_select on %1$s for select to authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists notifications_owner_select on notifications;
create policy notifications_owner_select on notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists notifications_owner_update on notifications;
create policy notifications_owner_update on notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Guild quests visible to members; friendships/challenges visible to participants.
drop policy if exists guild_quests_member_select on guild_quests;
create policy guild_quests_member_select on guild_quests for select to authenticated using (exists (
  select 1 from guild_members gm join characters c on c.id = gm.character_id
  where gm.guild_id = guild_quests.guild_id and c.user_id = (select auth.uid())));
drop policy if exists friendships_party_select on friendships;
create policy friendships_party_select on friendships for select to authenticated using (exists (
  select 1 from characters c where c.user_id = (select auth.uid()) and c.id in (friendships.requester_id, friendships.addressee_id)));
drop policy if exists challenges_party_select on challenges;
create policy challenges_party_select on challenges for select to authenticated using (exists (
  select 1 from characters c where c.user_id = (select auth.uid()) and c.id in (challenges.challenger_id, challenges.opponent_id)));

-- ── Explicit grants (least privilege) ───────────────────────────────────
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant insert, update, delete on habits, goals, rewards to authenticated;
grant update on profiles, notifications to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
revoke execute on all functions in schema public from public, anon, authenticated;
