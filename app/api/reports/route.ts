import { api } from '@/lib/server/api';
import { generateReport, listReports } from '@/lib/server/reports';
import { todayInTz, weekStartMonday } from '@/lib/game/dates';
export const GET = api(async ({ db, p }) => ({ reports: await listReports(db, p.character.id) }));
/** (Re)generates the report for the current, in-progress week. */
export const POST = api(async ({ db, p, dm }) => ({ report: await generateReport(db, p, dm, weekStartMonday(todayInTz(p.profile.timezone))) }));
