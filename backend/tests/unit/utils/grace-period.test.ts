import { describe, it, expect } from 'vitest';
import { isGracePeriodPassed } from '../../../src/utils/grace-period.js';

describe('isGracePeriodPassed', () => {
  const HOURS_24 = 24;

  it('returns false for issues created less than 24 hours ago', () => {
    const recent = new Date(Date.now() - 23 * 60 * 60 * 1000);
    expect(isGracePeriodPassed(recent, HOURS_24)).toBe(false);
  });

  it('returns true for issues created more than 24 hours ago', () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(isGracePeriodPassed(old, HOURS_24)).toBe(true);
  });

  it('returns false for issues created exactly at the grace period boundary', () => {
    const exact = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isGracePeriodPassed(exact, HOURS_24)).toBe(false);
  });

  it('respects custom grace period hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(isGracePeriodPassed(twoHoursAgo, 1)).toBe(true);
    expect(isGracePeriodPassed(twoHoursAgo, 3)).toBe(false);
  });

  it('returns true for very old issues', () => {
    const old = new Date(2020, 1, 1);
    expect(isGracePeriodPassed(old, HOURS_24)).toBe(true);
  });
});
