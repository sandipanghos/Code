import { createOctokit } from '../utils/octokit.js';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';

export class GuardService {
  static async canSubmitProposal(githubUsername: string, githubToken: string | null): Promise<boolean> {
    try {
      const octokit = createOctokit(githubToken ?? env.GITHUB_TOKEN);

      // Check if user has any open issues/PRs assigned and awaiting their action
      const { data: assignedIssues } = await octokit.issues.listForRepo({
        owner: env.GITHUB_REPO_OWNER,
        repo: env.GITHUB_REPO_NAME,
        assignee: githubUsername,
        state: 'open',
      });

      const hasActiveAssignment = assignedIssues.length > 0;

      if (hasActiveAssignment) {
        logger.info(
          { githubUsername, count: assignedIssues.length },
          'Guard blocked: user has active assignments'
        );
      }

      return !hasActiveAssignment;
    } catch (err) {
      logger.error(err, 'Guard check failed — blocking proposal for safety');
      return false;
    }
  }
}
