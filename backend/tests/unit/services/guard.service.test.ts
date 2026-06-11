import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the octokit utility before importing the service
vi.mock('../../../src/utils/octokit.js', () => ({
  createOctokit: vi.fn(),
}));

vi.mock('../../../src/utils/env.js', () => ({
  env: {
    GITHUB_TOKEN: 'mock-token',
    GITHUB_REPO_OWNER: 'Expensify',
    GITHUB_REPO_NAME: 'App',
  },
}));

import { GuardService } from '../../../src/services/guard.service.js';
import { createOctokit } from '../../../src/utils/octokit.js';

describe('GuardService.canSubmitProposal', () => {
  const mockOctokit = {
    issues: {
      listForRepo: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createOctokit).mockReturnValue(mockOctokit as never);
  });

  it('returns true when user has no assigned open issues', async () => {
    mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });
    const result = await GuardService.canSubmitProposal('testuser', null);
    expect(result).toBe(true);
  });

  it('returns false when user has at least one assigned issue', async () => {
    mockOctokit.issues.listForRepo.mockResolvedValue({
      data: [{ id: 1, title: 'Open issue', number: 42 }],
    });
    const result = await GuardService.canSubmitProposal('testuser', null);
    expect(result).toBe(false);
  });

  it('returns false when GitHub API throws an error', async () => {
    mockOctokit.issues.listForRepo.mockRejectedValue(new Error('API unavailable'));
    const result = await GuardService.canSubmitProposal('testuser', null);
    expect(result).toBe(false);
  });

  it('uses provided token over default', async () => {
    mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });
    await GuardService.canSubmitProposal('testuser', 'custom-token');
    expect(createOctokit).toHaveBeenCalledWith('custom-token');
  });

  it('falls back to env token when no token provided', async () => {
    mockOctokit.issues.listForRepo.mockResolvedValue({ data: [] });
    await GuardService.canSubmitProposal('testuser', null);
    expect(createOctokit).toHaveBeenCalledWith('mock-token');
  });
});
