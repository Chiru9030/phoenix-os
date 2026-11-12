// Offline Dungeon Master content. Hand-written so the app is genuinely playable with NO API key.
export interface Template { title: string; description: string; tags: string[] }
export interface Voice { npc: string; place: string; foes: string[]; epithets: string[]; warnings: string[] }

export const VOICES: Record<string, Voice> = {
  general: { npc: 'The Chronicler', place: 'the Kingdom of Beginnings', foes: ['Procrastination Wraith', 'Doubt Golem', 'Distraction Imp', 'Snooze Dragon', 'Comfort Troll'], epithets: ['Ashen', 'Hollow', 'Gilded', 'Whispering', 'Iron-Bound'], warnings: ['It feeds on postponed plans.', 'It grows stronger every day you say "tomorrow".', 'It cannot be argued with, only outworked.'] },
  fitness: { npc: 'Coach Titan', place: 'the Iron Citadel', foes: ['Plateau Behemoth', 'Excuse Hydra', 'Fatigue Colossus', 'Skipped-Leg-Day Ogre'], epithets: ['Rusted', 'Thunder-Maned', 'Granite', 'Sweat-Starved'], warnings: ['It weighs exactly as much as your excuses.', 'It only respects the reps you actually finish.', 'It folds against consistency, never against intensity alone.'] },
  placement: { npc: 'Recruiter Vex', place: 'the Placement Kingdom', foes: ['Rejection Wyrm', 'ATS Sentinel', 'Whiteboard Phantom', 'Imposter Specter'], epithets: ['Unblinking', 'Keyword-Hungry', 'Polite but Merciless', 'Pale'], warnings: ['It rejects in silence.', 'It asks the one question you skipped.', 'It is weakest to prepared, specific answers.'] },
  startup: { npc: 'Investor Raven', place: 'the Wilds of Zero-to-One', foes: ['Runway Reaper', 'Feature-Creep Chimera', 'Perfectionism Sphinx', 'Pivot Fog'], epithets: ['Burn-Rate', 'Venture-Cold', 'Many-Tabbed', 'Unshipped'], warnings: ['It eats unshipped work.', 'It multiplies every time you add scope.', 'It dies to a small thing that works.'] },
  upsc: { npc: 'Examiner Kael', place: 'the Syllabus Labyrinth', foes: ['Syllabus Hydra', 'Current-Affairs Leviathan', 'Answer-Writing Sphinx', 'Revision Revenant'], epithets: ['Endless', 'Seven-Headed', 'Ink-Stained', 'Patient'], warnings: ['It grows a new head for every topic you skip.', 'It rewards depth only after it has punished speed.', 'It cannot be rushed, only outlasted.'] },
  exam: { npc: 'Professor Lumen', place: 'the Study Fortress', foes: ['Last-Minute Cram Demon', 'Past-Paper Wraith', 'Blank-Page Specter', 'Midnight Distraction Imp'], epithets: ['Sleepless', 'Dog-Eared', 'Overcaffeinated', 'Looming'], warnings: ['It strikes hardest the night before.', 'It is weakest to topics you have already fortified.', 'It vanishes when your notes are in order.'] },
};
export const voiceFor = (slug: string): Voice => VOICES[slug] ?? VOICES.general;

const T = (title: string, description: string, tags: string[]): Template => ({ title, description, tags });

export const MAIN: Record<string, Template[]> = {
  general: [
    T('Do 90 minutes of deep work on your top priority', 'One block, one target, phone out of reach. This is the hinge of the day.', ['deep_work']),
    T('Finish the single most important task on your list', 'Not the easiest. The one that would make today a win on its own.', ['deep_work']),
    T('Complete a focused study block of 2 hours', 'Two hours, split however you like, as long as the work is real.', ['study']),
    T('Make visible progress on your biggest project', 'Ship, write, build or fix something you can point to tonight.', ['deep_work', 'creative']),
  ],
  fitness: [
    T("Complete today's full strength session", 'Warm up, hit every set you planned, log your numbers. The bar does not negotiate.', ['gym']),
    T('Hit a 45-minute training session', 'Any mix of lifting and conditioning, as long as you finish the clock.', ['gym']),
    T('Beat a previous personal number', 'One more rep, one more plate, one more minute. Pick the lift and own it.', ['gym']),
  ],
  placement: [
    T('Solve 3 coding problems and review your mistakes', 'Three problems, then a written note on each one you struggled with.', ['coding_practice']),
    T('Apply to 3 roles with tailored applications', 'Tailor each resume bullet to the posting. No mass-clicking.', ['internship']),
    T('Polish one section of your resume', 'Rewrite one section until every line shows impact, not duties.', ['writing']),
    T('Build one feature of your portfolio project', 'A visible, deployable improvement that a recruiter could actually click.', ['coding_practice', 'creative']),
  ],
  startup: [
    T('Ship one small improvement to your product', 'Small, real and live before midnight. Raven only respects shipped work.', ['deep_work', 'creative']),
    T('Talk to one real potential customer', 'Ask about their problem, not your solution. Write down their exact words.', ['networking']),
    T("Review this week's numbers and pick one lever", 'Revenue, users or burn: choose one metric and one action to move it.', ['finance']),
  ],
  upsc: [
    T('Complete 2 hours of GS syllabus reading with notes', 'Notes in your own words, not highlights. Build the map, one region at a time.', ['study']),
    T('Write one full answer in 150 words and self-review it', 'Timed, structured, then compared against a model answer.', ['writing', 'study']),
    T('Finish a full revision block of previously studied topics', 'Retrieval beats re-reading. Close the book and recall first.', ['study']),
  ],
  exam: [
    T('Finish 2 hours of past-paper practice', 'Timed conditions, then mark every answer honestly.', ['study']),
    T("Revise yesterday's notes and fix the gaps", 'Thirty minutes of recall, then patch what you could not remember.', ['study']),
    T('Teach one topic aloud for 10 minutes', 'If you can explain it to an empty room, you own it.', ['study', 'speaking']),
  ],
};

export const SIDE: Record<string, Template[]> = {
  general: [
    T('Read 20 pages of a book', 'Paper or screen, as long as the pages are not skimmed.', ['reading']),
    T('Go for a 20-minute walk', 'No headphones required. Let the day settle.', ['cardio']),
    T('Meditate for 10 minutes', 'Sit, breathe, return. Every wandering thought you notice is a rep.', ['meditation']),
    T('Write 3 lines in a journal', 'What happened, what you learned, what you want tomorrow.', ['writing']),
    T('Tidy your workspace for 10 minutes', 'A clear desk is a clear opening move for tomorrow.', ['admin']),
    T('Learn one new thing and write it down', 'A concept, a word, a shortcut. One sentence is enough.', ['study']),
    T('Stretch for 10 minutes', 'Hips, shoulders, back. Pay your body its small daily tax.', ['cardio']),
    T('Plan tomorrow in 5 minutes', 'Three tasks, in order. Future-you will say thanks.', ['admin']),
  ],
  fitness: [
    T('Do 10 minutes of mobility work', 'Joints first, ego second. This is how you keep training for years.', ['cardio']),
    T('Log everything you eat today', 'No judgement, just data. You cannot steer what you will not measure.', ['admin']),
    T('Walk 8,000 steps', 'Spread them out. The hidden volume of a good week lives here.', ['cardio']),
  ],
  placement: [
    T('Send 2 networking messages', 'Short, specific, human. Ask one question you actually want answered.', ['networking']),
    T('Practise one interview answer out loud', 'Out loud, timed, recorded if you dare. Thinking it does not count.', ['speaking']),
    T('Read one engineering or company blog post', 'Know the company you want before they ask why you want it.', ['reading']),
  ],
  startup: [
    T('Write down one idea and one reason it might fail', 'Both halves matter. The second half is where good founders live.', ['creative', 'writing']),
    T("Reach out to one person you'd learn from", 'A short note beats a perfect note you never send.', ['networking']),
  ],
  upsc: [
    T("Read the day's editorial and summarise it in 5 lines", 'Argument, evidence, implication, counterpoint, your take.', ['reading', 'writing']),
    T('Solve 20 MCQs and review every wrong answer', 'The wrong ones are the syllabus telling you where to go next.', ['study']),
  ],
  exam: [
    T('Do a 25-minute pomodoro on your weakest topic', 'Start with the one you are avoiding. That is the one that matters.', ['study']),
    T('Make 10 flashcards from today\'s material', 'Question on the front, answer in your own words on the back.', ['study', 'writing']),
  ],
};

export const DAILY: Template[] = [
  T('Drink 4 litres of water', 'Keep a bottle in sight and refill it twice. Hydration is a free stat.', ['hydration']),
  T('Be in bed before 11 PM', 'Tomorrow\'s energy is decided tonight. Phone away, lights down.', ['sleep']),
  T('No social media until noon', 'Own your first hours. Start the day on your agenda, not a feed.', ['admin', 'morning']),
  T('Wake up before your target time', 'The first win of the day is not hitting snooze.', ['wake_up_early', 'morning']),
  T('Take a 10-minute breathing break', 'Slow in, slower out. Reset the stress meter once today.', ['meditation']),
  T('Do 20 push-ups before lunch', 'Short and sharp. Make the body vote for the rest of the day.', ['gym', 'morning']),
  T('Message one friend or family member just to say hi', 'A small social rep. No agenda.', ['networking']),
  T('Spend 15 minutes reviewing your money', 'Check spending, log one expense category, close the tab.', ['finance']),
];
export const SECRET: Template[] = [
  T('Secret Quest: Do something creative for 15 minutes', 'A sketch, a riff, a paragraph, a doodle. No audience. Surprise yourself.', ['creative']),
  T('Secret Quest: Teach someone one thing you know', 'Explain a concept to a friend or to the wall. Teaching is the deepest rep.', ['speaking']),
  T('Secret Quest: Do one thing you have been avoiding', 'You know exactly which one. Ten minutes. Just begin.', ['admin']),
  T('Secret Quest: Take a screen-free walk', 'Twenty minutes, no phone. Let your mind wander on purpose.', ['cardio']),
];

export const GREETINGS = ['Good morning, {name}.', 'The dawn finds you, {name}.', 'Another day, another page, {name}.', 'Welcome back, {name}.', 'Rise, {name}.'];
export const OPENERS: Record<'main' | 'side' | 'daily_challenge' | 'boss_fight', string[]> = {
  main: ['The path forward runs straight through this task.', 'Every chapter has a hinge. This is yours.', 'If only one thing gets done today, let it be this.', 'This is the work your future self is counting on.'],
  side: ['A small detour that pays real dividends.', 'Easy to skip, costly to skip often.', 'A short errand with long-term interest.', 'Quick, honest, worth it.'],
  daily_challenge: ['A simple rule for today, hard only because it is easy to forget.', 'Today\'s challenge: small, strict, and surprisingly powerful.', 'The kind of win that compounds quietly.'],
  boss_fight: ['This is the big one.', 'The whole week has been building toward this fight.', 'Everything you have trained for lands on this single task.'],
};
export const CLOSERS = ['Finish it and the chapter turns.', '{npc} is watching to see whether you will.', 'Do it now, and the rest of the day gets lighter.', 'Start with ten minutes. Momentum does the rest.', 'No one else can earn this XP for you.'];
export const MOTIVATORS = ['Small, honest effort beats heroic plans.', 'Momentum is a fragile, valuable thing. Protect it.', 'You do not need motivation, only a first step.', 'Do the next right thing, then the next.'];
