import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { timelineCommentQueue } from '../jobs/queues.js';
import { createOctokit } from '../utils/octokit.js';
import { env } from '../utils/env.js';

export class ProposalMonitorService {
  static async check() {
    const pendingProposals = await prisma.proposal.findMany({
      where: { status: 'PENDING' },
      include: {
        user: { select: { githubUsername: true, githubTokenEnc: true } },
        issue: { select: { githubIssueNumber: true } },
      },
    });

    await Promise.allSettled(
      pendingProposals.map((proposal) => ProposalMonitorService.checkProposal(proposal))
    );
  }

  private static async checkProposal(proposal: {
    id: string;
    user: { githubUsername: string | null; githubTokenEnc: string | null };
    issue: { githubIssueNumber: number };
  }) {
    const octokit = createOctokit(proposal.user.githubTokenEnc ?? env.GITHUB_TOKEN);

    const { data: issue } = await octokit.issues.get({
      owner: env.GITHUB_REPO_OWNER,
      repo: env.GITHUB_REPO_NAME,
      issue_number: proposal.issue.githubIssueNumber,
    });

    const isAssignedToUser =
      proposal.user.githubUsername &&
      issue.assignees?.some((a) => a.login === proposal.user.githubUsername);

    if (isAssignedToUser) {
      logger.info({ proposalId: proposal.id }, 'Proposal selected!');

      await prisma.proposal.update({
        where: { id: proposal.id },
        data: { status: 'SELECTED', selectedAt: new Date() },
      });

      await timelineCommentQueue.add('post-timeline', {
        proposalId: proposal.id,
        userId: proposal.user.githubUsername ?? '',
        githubIssueNumber: proposal.issue.githubIssueNumber,
      });
    }
  }
}
