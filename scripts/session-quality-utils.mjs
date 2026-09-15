export const REQUIRED_SCENARIOS = [
  'cold-boot', 'warm-cache', 'offline-boot', 'refresh-during-action', 'delayed-action',
  'rejected-action', 'stale-cloud-write', 'expired-play-session', 'background-and-return', 'multi-tab-write',
  'party-create-and-restore', 'invite-accept', 'expired-or-revoked-invite', 'friend-block-and-privacy', 'rpc-failover',
  'preflight-rejection', 'reorg-reconciliation', 'authority-session-expiry', 'managed-action-replay', 'portable-client-resume',
  'authority-budget-exhaustion', 'authority-emergency-pause', 'authority-low-balance',
  'managed-register-act-resume',
];

export function gradeSessionChecks(checks) {
  const passed = checks.filter((check) => check.ok).length;
  const ratio = checks.length ? passed / checks.length : 0;
  const grade = ratio === 1 ? 'A' : ratio >= 0.9 ? 'A-' : ratio >= 0.8 ? 'B' : ratio >= 0.7 ? 'C' : 'D';
  return { grade, passed, total: checks.length, ratio };
}

export function validateSessionContract(contract) {
  const errors = [];
  if (contract.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  for (const scenario of REQUIRED_SCENARIOS) if (!contract.requiredScenarios?.includes(scenario)) errors.push(`missing scenario: ${scenario}`);
  if (contract.budgets?.lostConfirmedActions !== 0) errors.push('lostConfirmedActions must be zero');
  if (contract.budgets?.duplicatePartyMemberships !== 0) errors.push('duplicatePartyMemberships must be zero');
  if (contract.privacy?.publicWalletDiscovery !== false) errors.push('public wallet discovery must remain disabled');
  return errors;
}
