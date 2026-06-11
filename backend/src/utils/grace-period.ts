export function isGracePeriodPassed(issueCreatedAt: Date, gracePeriodHours: number): boolean {
  const ageMs = Date.now() - issueCreatedAt.getTime();
  const graceMs = gracePeriodHours * 60 * 60 * 1000;
  return ageMs > graceMs;
}
