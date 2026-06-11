import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { issueNotifyQueue, proposalPostQueue } from '../jobs/queues.js';
import { isGracePeriodPassed } from '../utils/grace-period.js';
import { createOctokit } from '../utils/octokit.js';
import { env } from '../utils/env.js';

export class GithubPollerService {
  static async poll() {
    const users = await prisma.user.findMany({
      include: { watchedLabels: true, pollState: true },
    });

    await Promise.allSettled(users.map((user) => GithubPollerService.pollForUser(user)));
  }

  private static async pollForUser(user: {
    id: string;
    githubTokenEnc: string | null;
    watchedLabels: { labelName: string }[];
    pollState: { lastPolledAt: Date } | null;
    dailyLimit: number;
  }) {
    if (!user.watchedLabels.length) return;

    const octokit = createOctokit(user.githubTokenEnc ?? env.GITHUB_TOKEN);
    const since = user.pollState?.lastPolledAt ?? new Date(Date.now() - 60 * 60 * 1000);
    const watchedLabelNames = new Set(user.watchedLabels.map((l) => l.labelName));

    const { data: githubIssues } = await octokit.issues.listForRepo({
      owner: env.GITHUB_REPO_OWNER,
      repo: env.GITHUB_REPO_NAME,
      state: 'open',
      since: since.toISOString(),
      per_page: 50,
    });

    const matched = githubIssues.filter((issue) =>
      issue.labels.some((label) => {
        const name = typeof label === 'string' ? label : label.name;
        return name && watchedLabelNames.has(name);
      })
    );

    const todayNotifications = await prisma.notification.count({
      where: {
        userId: user.id,
        sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    });

    let notificationsSentToday = todayNotifications;

    for (const ghIssue of matched) {
      if (notificationsSentToday >= user.dailyLimit) {
        logger.info({ userId: user.id }, 'Daily notification limit reached');
        break;
      }

      if (!isGracePeriodPassed(new Date(ghIssue.created_at), env.GRACE_PERIOD_HOURS)) {
        continue;
      }

      const issue = await prisma.issue.upsert({
        where: { githubIssueNumber: ghIssue.number },
        create: {
          githubIssueNumber: ghIssue.number,
          title: ghIssue.title,
          url: ghIssue.html_url,
          labels: JSON.stringify(ghIssue.labels.map((l) => (typeof l === 'string' ? l : l.name))),
          createdAt: new Date(ghIssue.created_at),
        },
        update: {
          title: ghIssue.title,
          labels: JSON.stringify(ghIssue.labels.map((l) => (typeof l === 'string' ? l : l.name))),
        },
      });

      const alreadyNotified = await prisma.notification.findUnique({
        where: { userId_issueId: { userId: user.id, issueId: issue.id } },
      });

      if (!alreadyNotified) {
        await issueNotifyQueue.add('notify', { userId: user.id, issueId: issue.id });
        notificationsSentToday++;
      }

      // If "Help Wanted" label is present, queue proposal
      const isHelpWanted = ghIssue.labels.some((l) => {
        const name = typeof l === 'string' ? l : l.name;
        return name?.toLowerCase() === 'help wanted';
      });

      if (isHelpWanted) {
        const existingProposal = await prisma.proposal.findUnique({
          where: { userId_issueId: { userId: user.id, issueId: issue.id } },
        });

        if (!existingProposal) {
          await proposalPostQueue.add('post', {
            userId: user.id,
            issueId: issue.id,
            githubIssueNumber: ghIssue.number,
          });
        }
      }
    }

    // Update poll state
    await prisma.pollState.upsert({
      where: { userId: user.id },
      create: { userId: user.id, lastPolledAt: new Date() },
      update: { lastPolledAt: new Date() },
    });
  }
}
