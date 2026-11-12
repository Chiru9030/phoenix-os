// Everything a player types (task titles, notes, chat) is UNTRUSTED when it reaches a model, and
// everything a model returns is UNTRUSTED when it reaches the database or the UI.
export function cleanText(input: unknown, max: number): string {
  return String(input ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, max);
}
/** Model prose → plain text: no markdown decoration, no HTML, bounded length. */
export function cleanModelText(input: unknown, max: number): string {
  return cleanText(String(input ?? '').replace(/<[^>]*>/g, '').replace(/^#{1,6}\s*/gm, '').replace(/[*_`~]{1,3}/g, ''), max);
}
export function parseJsonLoose(raw: string): unknown {
  const t = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch { /* try to extract the outermost object */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('Model did not return JSON');
}
const CRISIS = /\b(kill myself|end my life|suicid\w*|want to die|self[- ]?harm|hurt myself|no reason to live|don'?t want to be alive)\b/i;
export const looksLikeCrisis = (msg: string) => CRISIS.test(msg);
export const CRISIS_REPLY =
  "I'm really glad you told me, and I'm taking it seriously. This is bigger than any quest, and you deserve real human support right now. " +
  'If you might act on these thoughts or feel unsafe, please contact your local emergency number or a crisis line in your country right away, or reach someone you trust and tell them how you feel tonight. ' +
  "You don't have to carry this alone. Your streak, your XP and your stats can wait; you matter more than all of them. I'll be here when you're ready to talk about the rest.";
