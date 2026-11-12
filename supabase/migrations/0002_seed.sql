-- PROJECT PHOENIX OS — game content seed (idempotent; safe to re-run)

insert into campaigns (slug, name, description, icon, theme_color) values
  ('general',   'The Adventurer''s Path', 'A balanced journey of self-improvement across every stat.', 'compass', '#D4A94E'),
  ('fitness',   'Fitness Campaign',       'Forge your body. Strength and Health quests lead the path.', 'dumbbell', '#C9503F'),
  ('placement', 'Placement Campaign',     'Resumes, interviews and offers on the road to a job.', 'briefcase', '#7C6FE8'),
  ('startup',   'Startup Campaign',       'Build something from nothing. Creativity and Finance lead.', 'rocket', '#F0C869'),
  ('upsc',      'UPSC Campaign',          'A long siege for civil-service aspirants.', 'landmark', '#6FA287'),
  ('exam',      'Exam Campaign',          'A focused sprint toward an upcoming exam season.', 'graduation-cap', '#9B8FFF')
on conflict (slug) do nothing;

insert into npcs (campaign_id, name, role, description, portrait_seed)
select id, 'The Chronicler', 'Narrator', 'Keeper of your story. Writes the chapter you are living.', 'chronicler' from campaigns where slug='general' union all
select id, 'Sir Reginald, Knight of Discipline', 'Mentor', 'A knight who trains willpower instead of swords.', 'reginald' from campaigns where slug='general' union all
select id, 'Recruiter Vex', 'Gatekeeper', 'Guards the gates of every application. Hard to impress.', 'vex' from campaigns where slug='placement' union all
select id, 'Mentor Aria', 'Ally', 'A former candidate who guides others through the Placement Kingdom.', 'aria' from campaigns where slug='placement' union all
select id, 'Coach Titan', 'Mentor', 'Trains bodies into fortresses. Means every word of encouragement.', 'titan' from campaigns where slug='fitness' union all
select id, 'Investor Raven', 'Gatekeeper', 'Decides who gets funded and who returns to the drawing board.', 'raven' from campaigns where slug='startup' union all
select id, 'Examiner Kael', 'Gatekeeper', 'Sets the Prelims Gate and the Mains Citadel. Speaks only in syllabus.', 'kael' from campaigns where slug='upsc' union all
select id, 'Professor Lumen', 'Mentor', 'Illuminates exactly the concept you are about to be tested on.', 'lumen' from campaigns where slug='exam';

-- Story: a chapter OPENS when its unlock_criteria is met; it COMPLETES when the next one opens.
insert into story_chapters (campaign_id, chapter_number, title, narrative, unlock_criteria, reward_gold, reward_item_key)
select c.id, v.n, v.title, v.narr, v.crit::jsonb, v.gold, v.item from campaigns c join (values
 ('general',1,'Chapter I — The Beginning','You wake as a level 1 Adventurer with an unwritten story. The Chronicler watches from the margins, waiting to see whether you open the book again tomorrow. Every quest you finish from here is a line only you are writing.','{"type":"always"}',0,null),
 ('general',2,'Chapter II — Rise of Discipline','Sir Reginald appears at your side. "Streaks are not about one great day," he says. "They are about not breaking on an ordinary one." Seven days in a row opened this door.','{"type":"streak","value":7}',50,null),
 ('general',3,'Chapter III — Master of Knowledge','Intelligence begins to outpace the rest of your stat sheet. The Chronicler notes it plainly: you have started reading, practising and thinking like someone building toward something specific.','{"type":"stat_threshold","stat":"intelligence","value":25}',100,'knowledge_scroll'),
 ('general',4,'Chapter IV — The Internship Trials','Recruiter Vex sends the first real mission your way. It is unglamorous and exact. The Trials are measured not in hours worked but in problems actually solved.','{"type":"level","value":10}',150,null),
 ('general',5,'Chapter V — Placement Kingdom','You enter the Kingdom of Placement. A difficult interview approaches. Complete today''s coding mission to earn the Sword of Confidence.','{"type":"level","value":18}',300,'sword_of_confidence'),
 ('fitness',1,'Chapter I — First Steps Into Iron','Coach Titan hands you a bar with no plates on it. "Master the empty bar before you ask for weight." Every workout from here builds a body that used to make excuses.','{"type":"always"}',0,null),
 ('fitness',2,'Chapter II — The Plateau Trench','Progress stalls. This is the trench every adventurer crosses, where results stop being visible but effort must continue anyway. Titan says nothing. He just keeps counting your reps.','{"type":"streak","value":14}',100,null),
 ('fitness',3,'Chapter III — Peak Ascension','The plateau breaks. Strength stops being a number and starts being something people notice. Coach Titan finally smiles.','{"type":"stat_threshold","stat":"strength","value":40}',250,'golden_badge'),
 ('placement',1,'Chapter I — The Resume Forge','Mentor Aria hands you a blank page. "Every line has to be true and every line has to earn its place." The Forge is where your story gets its first honest draft.','{"type":"always"}',0,null),
 ('placement',2,'Chapter II — Interview Gauntlet','Recruiter Vex opens the Gauntlet. Questions come fast, some fair, some not. You are not expected to win every round, only to keep walking after the ones you lose.','{"type":"level","value":8}',120,null),
 ('placement',3,'Chapter III — Offer Letter Throne','The Throne room is quieter than you expected. Mentor Aria is waiting. However this chapter ends, you did not skip a single step to get here.','{"type":"level","value":15}',300,'sword_of_confidence'),
 ('startup',1,'Chapter I — The Idea Spark','Investor Raven does not care about your idea yet. "Ideas are free. Show me you can ship." This chapter is about turning a notion into a first working thing.','{"type":"always"}',0,null),
 ('startup',2,'Chapter II — Building in the Wilds','No roadmap survives contact with real users. This chapter has no fixed shape, only the discipline to keep building while everything around you changes.','{"type":"streak","value":10}',100,null),
 ('startup',3,'Chapter III — First Customer''s Blessing','Someone besides you and Raven finally uses the thing you built. It is small. It is real. Raven allows herself a nod.','{"type":"stat_threshold","stat":"finance","value":20}',250,'golden_badge'),
 ('upsc',1,'Chapter I — The Syllabus Labyrinth','Examiner Kael hands you a syllabus the size of a small library. "Most who enter get lost in it. Your job is to build a map."','{"type":"always"}',0,null),
 ('upsc',2,'Chapter II — Prelims Gate','The Gate does not care how much you know, only what you can retrieve under pressure, quickly and correctly. This chapter rewards volume and speed.','{"type":"streak","value":21}',150,null),
 ('upsc',3,'Chapter III — Mains Citadel','The Citadel rewards depth where the Gate rewarded speed. Kael reads your answers slowly now. He is not looking for a fact. He is looking for a mind.','{"type":"stat_threshold","stat":"wisdom","value":45}',300,'legendary_book'),
 ('exam',1,'Chapter I — The Study Fortress','Professor Lumen walks the walls with you. "Every topic you fortify now is a wall the exam cannot breach later."','{"type":"always"}',0,null),
 ('exam',2,'Chapter II — Midterm Skirmish','A smaller battle before the real one. Lumen watches what you do with a setback here: panic, or adjust.','{"type":"level","value":6}',100,null),
 ('exam',3,'Chapter III — Finals Reckoning','Every wall you built in the Fortress is tested at once. Lumen has nothing left to teach you. This chapter is yours alone.','{"type":"level","value":12}',250,'golden_badge')
) as v(slug,n,title,narr,crit,gold,item) on v.slug = c.slug
on conflict (campaign_id, chapter_number) do nothing;

insert into items (key, name, description, icon, rarity, item_type, slot, effect) values
 ('knowledge_scroll','Knowledge Scroll','A scroll dense with notes from your own reading sessions. Use it for a burst of XP.','scroll','common','consumable',null,'{"use":{"xp":40}}'),
 ('focus_potion','Focus Potion','Drink before a Deep Work session for a surge of experience.','flask-conical','uncommon','consumable',null,'{"use":{"xp":60}}'),
 ('gold_pouch','Gold Pouch','A small pouch that jingles. Use it to claim the coins inside.','coins','common','consumable',null,'{"use":{"gold":60}}'),
 ('streak_charm','Streak Charm','A charm that mends one missed day. Use it to gain a Streak Freeze.','sparkles','rare','consumable',null,'{"use":{"freeze_token":1}}'),
 ('discipline_shield','Discipline Shield','Forged from unbroken streaks. Passive: +10% Discipline gains.','shield','rare','equipment','shield','{"stat_bonus_pct":{"discipline":10}}'),
 ('sword_of_persistence','Sword of Persistence','Earned, never bought. Passive: +5% XP on Main Quests and Boss Fights.','sword','epic','equipment','weapon','{"quest_type_xp_bonus_pct":{"main":5,"boss_fight":5}}'),
 ('legendary_book','Legendary Book','Said to contain everything you have ever learned, in order. Passive: +10% Wisdom, +5% Intelligence gains.','book-open','epic','equipment','tome','{"stat_bonus_pct":{"wisdom":10,"intelligence":5}}'),
 ('sword_of_confidence','Sword of Confidence','Forged in the Placement Kingdom. Passive: +10% Communication, +5% Charisma gains.','sword','legendary','equipment','weapon','{"stat_bonus_pct":{"communication":10,"charisma":5}}'),
 ('golden_badge','Golden Badge','A mark of a season completed, not just a day survived.','badge-check','legendary','badge','badge','{}')
on conflict (key) do nothing;

insert into titles (key, name, description) values
 ('the_beginner','The Beginner','Awarded for starting.'),
 ('the_consistent','The Consistent','Awarded for a 30 day streak.'),
 ('the_scholar','The Scholar','Awarded for reading fifty books.'),
 ('the_unbreakable','The Unbreakable','Awarded for defeating five bosses.'),
 ('phoenix_ascendant','Phoenix Ascendant','Awarded for reaching level 25.')
on conflict (key) do nothing;

insert into achievements (key, name, description, icon, category, criteria, reward_xp, reward_gold, reward_item_key, reward_title_key) values
 ('first_victory','First Victory','Complete your very first quest.','sparkles','general','{"type":"quest_completed_count","value":1}',25,20,null,'the_beginner'),
 ('seven_day_streak','Seven Day Streak','Stay active for 7 days in a row.','flame','streak','{"type":"streak","value":7}',0,50,'focus_potion',null),
 ('thirty_day_streak','Thirty Day Streak','Stay active for 30 days in a row.','flame','streak','{"type":"streak","value":30}',0,200,'discipline_shield','the_consistent'),
 ('hundred_workouts','Hundred Workouts','Complete 100 quests tagged gym.','dumbbell','fitness','{"type":"quest_completed_count","value":100,"tag":"gym"}',0,250,'sword_of_persistence',null),
 ('fifty_books','Fifty Books','Complete 50 quests tagged reading.','book','knowledge','{"type":"quest_completed_count","value":50,"tag":"reading"}',0,250,'legendary_book','the_scholar'),
 ('coding_master','Coding Master','Raise your Coding Skill stat to 60.','code','coding','{"type":"stat_threshold","stat":"coding_skill","value":60}',0,300,null,null),
 ('discipline_legend','Discipline Legend','Raise your Discipline stat to 60.','shield','discipline','{"type":"stat_threshold","stat":"discipline","value":60}',0,300,null,null),
 ('phoenix_reborn','Phoenix Reborn','Reach character level 25: a true rebirth.','flame','milestone','{"type":"level","value":25}',0,500,'golden_badge','phoenix_ascendant'),
 ('level_10','Seasoned Adventurer','Reach character level 10.','trending-up','milestone','{"type":"level","value":10}',0,100,'gold_pouch',null),
 ('first_boss','Boss Down','Defeat your first boss.','skull','combat','{"type":"boss_defeated_count","value":1}',0,100,'knowledge_scroll',null),
 ('boss_slayer','Boss Slayer','Defeat five bosses.','swords','combat','{"type":"boss_defeated_count","value":5}',0,300,'streak_charm','the_unbreakable'),
 ('skill_initiate','Skill Initiate','Unlock your first skill-tree node.','git-branch','skills','{"type":"skill_unlocked_count","value":1}',30,0,null,null),
 ('guild_joined','Guild Member','Join a guild.','users','social','{"type":"guild_member","value":1}',0,50,null,null)
on conflict (key) do nothing;

insert into skill_nodes (branch, key, name, description, tier, cost, effect) values
 ('strength','str_t1_iron_habit','Iron Habit','+10% Strength gains.',1,1,'{"stat_bonus_pct":{"strength":10}}'),
 ('strength','str_t2_second_wind','Second Wind','+10% Health gains.',2,2,'{"stat_bonus_pct":{"health":10}}'),
 ('strength','str_t3_titan_form','Titan Form','+20% XP from Boss Fights.',3,3,'{"boss_xp_bonus_pct":20}'),
 ('knowledge','know_t1_fast_reader','Fast Reader','+10% Wisdom gains.',1,1,'{"stat_bonus_pct":{"wisdom":10}}'),
 ('knowledge','know_t2_deep_focus','Deep Focus','+15% Intelligence gains.',2,2,'{"stat_bonus_pct":{"intelligence":15}}'),
 ('knowledge','know_t3_polymath','Polymath','+10% XP on reading and deep-work quests.',3,3,'{"quest_tag_xp_bonus_pct":{"reading":10,"deep_work":10}}'),
 ('communication','comm_t1_icebreaker','Icebreaker','+10% Charisma gains.',1,1,'{"stat_bonus_pct":{"charisma":10}}'),
 ('communication','comm_t2_storyteller','Storyteller','+15% Communication gains.',2,2,'{"stat_bonus_pct":{"communication":15}}'),
 ('communication','comm_t3_diplomat','Diplomat','Guild quest contributions count 10% extra.',3,3,'{"guild_contribution_bonus_pct":10}'),
 ('finance','fin_t1_budgeter','Budgeter','+10% Gold from Daily Challenges.',1,1,'{"gold_bonus_pct_by_quest_type":{"daily_challenge":10}}'),
 ('finance','fin_t2_investor','Investor','Reward redemptions cost 10% less Gold.',2,2,'{"redemption_discount_pct":10}'),
 ('finance','fin_t3_tycoon','Tycoon','Weekend Festival Gold bonus is doubled.',3,3,'{"weekend_gold_multiplier":2}'),
 ('creativity','crea_t1_spark','Spark','+10% Creativity gains.',1,1,'{"stat_bonus_pct":{"creativity":10}}'),
 ('creativity','crea_t2_prototyper','Prototyper','+10% XP from Side Quests.',2,2,'{"quest_type_xp_bonus_pct":{"side":10}}'),
 ('creativity','crea_t3_visionary','Visionary','Random Events trigger 10 points more often.',3,3,'{"random_event_chance_bonus_pct":10}'),
 ('leadership','lead_t1_first_watch','First Watch','+10% XP from Main Quests.',1,1,'{"quest_type_xp_bonus_pct":{"main":10}}'),
 ('leadership','lead_t2_rallying_cry','Rallying Cry','Guild quest rewards +10% XP.',2,2,'{"guild_quest_xp_bonus_pct":10}'),
 ('leadership','lead_t3_warlord','Warlord','+10% XP from Boss Fights.',3,3,'{"quest_type_xp_bonus_pct":{"boss_fight":10}}'),
 ('focus','foc_t1_morning_ritual','Morning Ritual','+10% XP on morning and early-wake quests.',1,1,'{"quest_tag_xp_bonus_pct":{"morning":10,"wake_up_early":10}}'),
 ('focus','foc_t2_meditative_calm','Meditative Calm','+15% Wisdom gains.',2,2,'{"stat_bonus_pct":{"wisdom":15}}'),
 ('focus','foc_t3_unshakeable','Unshakeable','Streak Freeze tokens regenerate twice as fast.',3,3,'{"freeze_token_regen_multiplier":2}')
on conflict (key) do nothing;

update skill_nodes n set prerequisite_node_id = p.id from skill_nodes p
 where n.tier > 1 and p.branch = n.branch and p.tier = n.tier - 1 and n.prerequisite_node_id is null;
