// All "days" in Phoenix are calendar days in the PLAYER'S timezone, as 'YYYY-MM-DD'.
const DAY_MS = 86_400_000;
export function safeTimezone(tz: string | null | undefined): string {
  try { new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC' }); return tz || 'UTC'; } catch { return 'UTC'; }
}
export function todayInTz(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: safeTimezone(tz), year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
const utc = (iso: string) => new Date(iso + 'T00:00:00Z').getTime();
export function daysBetween(a: string, b: string): number { return Math.round((utc(b) - utc(a)) / DAY_MS); }
export function addDays(iso: string, n: number): string { return new Date(utc(iso) + n * DAY_MS).toISOString().slice(0, 10); }
/** 0 = Sunday … 6 = Saturday */
export function dayOfWeekFor(iso: string): number { return new Date(utc(iso)).getUTCDay(); }
export function isWeekend(iso: string): boolean { const d = dayOfWeekFor(iso); return d === 0 || d === 6; }
const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export function dayName(iso: string): string { return NAMES[dayOfWeekFor(iso)]; }
export function weekStartMonday(iso: string): string { const d = dayOfWeekFor(iso); return addDays(iso, -((d + 6) % 7)); }
export function shortDay(iso: string): string { return NAMES[dayOfWeekFor(iso)].slice(0, 3); }
