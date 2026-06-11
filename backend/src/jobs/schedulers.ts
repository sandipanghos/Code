import cron from 'node-cron';
import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import { GithubPollerService } from '../services/github-poller.service.js';
import { ProposalMonitorService } from '../services/proposal-monitor.service.js';

export function startSchedulers() {
  const pollerInterval = `*/${env.POLL_INTERVAL_MINUTES} * * * *`;
  const monitorInterval = `*/${env.PROPOSAL_CHECK_INTERVAL_MINUTES} * * * *`;

  // Issue poller
  cron.schedule(pollerInterval, async () => {
    logger.info('Running GitHub issue poller');
    try {
      await GithubPollerService.poll();
    } catch (err) {
      logger.error(err, 'Poller error');
    }
  });

  // Proposal monitor
  cron.schedule(monitorInterval, async () => {
    logger.info('Running proposal monitor');
    try {
      await ProposalMonitorService.check();
    } catch (err) {
      logger.error(err, 'Monitor error');
    }
  });

  logger.info(
    { pollerInterval, monitorInterval },
    'Schedulers started'
  );
}
