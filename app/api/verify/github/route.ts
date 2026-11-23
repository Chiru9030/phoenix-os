import { z } from 'zod';
import { api, body } from '@/lib/server/api';
import { todayInTz } from '@/lib/game/dates';

const VerifyGithubSchema = z.object({
  username: z.string().trim().min(1).max(39),
});

export const POST = api(async ({ req, p }) => {
  const { username } = await body(req, VerifyGithubSchema);
  const today = todayInTz(p.profile.timezone);

  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public`, {
      headers: {
        'User-Agent': 'Phoenix-OS-Verification',
        Accept: 'application/vnd.github.v3+json',
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return { verified: false, count: 0, message: `Could not verify GitHub user "${username}". Check username spelling.` };
    }

    const events: any[] = await res.json();
    const todayEvents = events.filter((e) => {
      if (e.type !== 'PushEvent' || !e.created_at) return false;
      const eventDate = e.created_at.slice(0, 10);
      return eventDate === today;
    });

    let commitCount = 0;
    let recentRepo = '';

    for (const ev of todayEvents) {
      const commits = ev.payload?.commits ?? [];
      commitCount += commits.length;
      if (!recentRepo && ev.repo?.name) recentRepo = ev.repo.name;
    }

    if (commitCount > 0) {
      return {
        verified: true,
        count: commitCount,
        recentRepo,
        message: `Verified! Found ${commitCount} GitHub commit${commitCount > 1 ? 's' : ''} pushed today to ${recentRepo}.`,
      };
    }

    return {
      verified: false,
      count: 0,
      message: `No public commits found for ${username} today (${today}). Push a commit and verify again!`,
    };
  } catch (err) {
    return { verified: false, count: 0, message: `Verification failed: ${(err as Error).message}` };
  }
});
