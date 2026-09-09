const DAY_MS = 86_400_000;
const SEVERITY_WEIGHT = Object.freeze({ low: 1, medium: 3, high: 7, critical: 12 });

export function validateUXContract(contract = {}) {
  const errors = [];
  if (!/^\d+\.\d+\.\d+$/.test(contract.version || '')) errors.push('version must be semantic');
  if (!Number.isInteger(contract.automatedEvidence?.maxAgeDays) || contract.automatedEvidence.maxAgeDays < 1) errors.push('automated evidence maxAgeDays must be a positive integer');
  if (!Array.isArray(contract.automatedEvidence?.suites) || contract.automatedEvidence.suites.length < 3) errors.push('input, assistive, and touch evidence suites are required');
  const evidenceIds = (contract.automatedEvidence?.suites || []).map((suite) => suite.id);
  if (new Set(evidenceIds).size !== evidenceIds.length) errors.push('automated evidence suite ids must be unique');
  for (const suite of contract.automatedEvidence?.suites || []) {
    if (!suite.id || !Array.isArray(suite.requiredProjects) || !suite.requiredProjects.length) errors.push(`automated evidence suite ${suite.id || 'unknown'} needs required projects`);
  }
  if (!Array.isArray(contract.journeys) || contract.journeys.length < 2) errors.push('at least two journeys are required');
  const journeyIds = (contract.journeys || []).map((journey) => journey.id);
  if (new Set(journeyIds).size !== journeyIds.length) errors.push('journey ids must be unique');
  const budgetKeys = ['maxActions', 'maxBacktracks', 'maxErrors', 'maxFirstActionMs', 'maxCompletionMs', 'maxRecoveryMs'];
  for (const journey of contract.journeys || []) {
    if (!journey.id || !Array.isArray(journey.requiredEvents) || !journey.requiredEvents.length) errors.push(`journey ${journey.id || 'unknown'} needs required events`);
    for (const key of budgetKeys) if (!Number.isFinite(journey.budgets?.[key]) || journey.budgets[key] < 0) errors.push(`journey ${journey.id || 'unknown'} has invalid ${key}`);
  }
  const cohortMinimum = Object.values(contract.research?.minimumCohorts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (!Number.isInteger(contract.research?.minimumSessions) || contract.research.minimumSessions < cohortMinimum) errors.push('minimumSessions must cover every cohort minimum');
  if (!Array.isArray(contract.research?.requiredTaskIds) || !contract.research.requiredTaskIds.length) errors.push('research tasks are required');
  if (!Array.isArray(contract.frictionRules) || !contract.frictionRules.length) errors.push('friction rules are required');
  if (!Array.isArray(contract.copy?.scanRoots) || !contract.copy.scanRoots.length || !Array.isArray(contract.copy?.prohibited)) errors.push('copy governance is incomplete');
  return { ok: errors.length === 0, errors };
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeTelemetryEvent(raw = {}, index = 0) {
  const props = raw.props && typeof raw.props === 'object' ? raw.props : {};
  return {
    name: String(raw.name || raw.event || raw.event_name || ''),
    journeyId: String(raw.journey_id || props.journey_id || 'unknown'),
    sequence: finiteNumber(raw.journey_sequence ?? props.journey_sequence) ?? index + 1,
    timestamp: raw.timestamp || raw.timestampMs || raw.time || null,
    props: { ...raw, ...props },
  };
}

export function validateResearchSession(session = {}, contract = {}) {
  const errors = [];
  for (const field of contract.requiredFields || []) {
    if (!(field in session) || session[field] === '' || session[field] === null) errors.push(`missing ${field}`);
  }
  if (!Object.hasOwn(contract.minimumCohorts || {}, session.cohort)) errors.push(`unknown cohort: ${session.cohort || 'missing'}`);
  if (session.consentSafe !== true) errors.push('consentSafe must be true');
  if (!Number.isInteger(Number(session.delight)) || Number(session.delight) < 1 || Number(session.delight) > 5) errors.push('delight must be an integer from 1 to 5');
  if (!Number.isInteger(Number(session.returnIntent)) || Number(session.returnIntent) < 1 || Number(session.returnIntent) > 5) errors.push('returnIntent must be an integer from 1 to 5');
  if (!Number.isFinite(Date.parse(session.recordedAt))) errors.push('recordedAt must be an ISO date');
  if (session.tasks && typeof session.tasks === 'object') {
    for (const taskId of contract.requiredTaskIds || []) {
      if (!['pass', 'struggle', 'fail'].includes(session.tasks[taskId])) errors.push(`task ${taskId} must be pass, struggle, or fail`);
    }
  }
  const serialized = JSON.stringify(session);
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(serialized)) errors.push('contains an email address');
  if (/0x[a-f0-9]{40}\b/i.test(serialized)) errors.push('contains a wallet address');
  return { ok: errors.length === 0, errors };
}

export function summarizeResearch(sessions = [], contract = {}, now = new Date()) {
  const cutoff = now.getTime() - Number(contract.maxAgeDays || 30) * DAY_MS;
  const validated = sessions.map((session) => ({ session, result: validateResearchSession(session, contract) }));
  const valid = validated.filter(({ session, result }) => result.ok && Date.parse(session.recordedAt) >= cutoff).map(({ session }) => session);
  const cohorts = Object.fromEntries(Object.keys(contract.minimumCohorts || {}).map((cohort) => [cohort, valid.filter((session) => session.cohort === cohort).length]));
  const taskResults = Object.fromEntries((contract.requiredTaskIds || []).map((taskId) => {
    const values = valid.map((session) => session.tasks?.[taskId]).filter(Boolean);
    return [taskId, {
      attempted: values.length,
      pass: values.filter((value) => value === 'pass').length,
      struggle: values.filter((value) => value === 'struggle').length,
      fail: values.filter((value) => value === 'fail').length,
    }];
  }));
  const missingCohorts = Object.entries(contract.minimumCohorts || {}).filter(([cohort, minimum]) => (cohorts[cohort] || 0) < minimum).map(([cohort, minimum]) => ({ cohort, have: cohorts[cohort] || 0, need: minimum }));
  const completionRates = Object.values(taskResults).map((result) => result.attempted ? result.pass / result.attempted : null).filter((value) => value !== null);
  return {
    status: valid.length >= Number(contract.minimumSessions || 0) && missingCohorts.length === 0 ? 'current' : 'insufficient',
    validSessions: valid.length,
    totalSessions: sessions.length,
    invalidSessions: validated.filter(({ result }) => !result.ok).map(({ session, result }) => ({ id: session.id || 'unknown', errors: result.errors })),
    cohorts,
    missingCohorts,
    taskResults,
    taskPassRate: completionRates.length ? Number((completionRates.reduce((sum, value) => sum + value, 0) / completionRates.length).toFixed(3)) : null,
    delightAverage: average(valid.map((session) => session.delight)),
    returnIntentAverage: average(valid.map((session) => session.returnIntent)),
  };
}

function average(values) {
  const numbers = values.map(finiteNumber).filter((value) => value !== null);
  return numbers.length ? Number((numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(2)) : null;
}

function eventMatches(event, where = {}) {
  return Object.entries(where).every(([key, value]) => event.props[key] === value);
}

export function analyzeFriction(rawEvents = [], rules = []) {
  const events = rawEvents.map(normalizeTelemetryEvent).filter((event) => event.name);
  const journeys = new Map();
  for (const event of events) {
    if (!journeys.has(event.journeyId)) journeys.set(event.journeyId, []);
    journeys.get(event.journeyId).push(event);
  }
  for (const journey of journeys.values()) journey.sort((left, right) => left.sequence - right.sequence);

  const findings = [];
  for (const rule of rules) {
    const affected = [];
    let occurrenceCount = 0;
    for (const [journeyId, journey] of journeys) {
      if (rule.start && rule.missingAfter) {
        const startIndex = journey.findIndex((event) => event.name === rule.start);
        if (startIndex >= 0 && !journey.slice(startIndex + 1).some((event) => event.name === rule.missingAfter)) {
          affected.push(journeyId);
          occurrenceCount += 1;
        }
      } else if (rule.event) {
        const count = journey.filter((event) => event.name === rule.event && eventMatches(event, rule.where)).length;
        if (count >= Number(rule.minimumCount || 1)) {
          affected.push(journeyId);
          occurrenceCount += count;
        }
      }
    }
    if (affected.length) findings.push({
      id: rule.id,
      title: rule.title,
      severity: rule.severity,
      affectedJourneys: affected.length,
      occurrenceCount,
      score: (SEVERITY_WEIGHT[rule.severity] || 1) * affected.length + occurrenceCount,
    });
  }
  findings.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return { eventCount: events.length, journeyCount: journeys.size, findings, topPriority: findings[0] || null };
}

export function auditCopyFiles(files = [], copyContract = {}) {
  const excludes = copyContract.excludePatterns || [];
  const included = files.filter(({ path }) => !excludes.some((pattern) => path.includes(pattern)));
  const findings = [];
  for (const file of included) {
    for (const rule of copyContract.prohibited || []) {
      const escaped = rule.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = file.content.match(new RegExp(escaped, 'gi')) || [];
      if (matches.length) findings.push({ path: file.path, text: rule.text, count: matches.length, reason: rule.reason });
    }
  }
  return { status: findings.length ? 'fail' : 'pass', filesScanned: included.length, findings };
}

export function evaluateJourneyEvidence(report = {}, journeys = []) {
  const measured = new Map((report.journeys || []).map((journey) => [journey.id, journey]));
  const results = journeys.map((journey) => {
    const sample = measured.get(journey.id);
    if (!sample) return { id: journey.id, status: 'missing', failures: ['missing journey evidence'] };
    const comparisons = [
      ['actions', 'maxActions'],
      ['backtracks', 'maxBacktracks'],
      ['errors', 'maxErrors'],
      ['firstActionMs', 'maxFirstActionMs'],
      ['completionMs', 'maxCompletionMs'],
      ['recoveryMs', 'maxRecoveryMs'],
    ];
    const failures = [];
    for (const [metric, budget] of comparisons) {
      const value = finiteNumber(sample[metric]);
      if (value === null) failures.push(`missing metric ${metric}`);
      else if (value > Number(journey.budgets[budget])) failures.push(`${metric} ${sample[metric]} > ${journey.budgets[budget]}`);
    }
    for (const event of journey.requiredEvents || []) if (!(sample.events || []).includes(event)) failures.push(`missing event ${event}`);
    return { id: journey.id, status: failures.length ? 'fail' : 'pass', failures };
  });
  return { status: results.every((result) => result.status === 'pass') ? 'pass' : results.some((result) => result.status === 'fail') ? 'fail' : 'missing', results };
}

export function evaluateAutomatedEvidence(documents = {}, contract = {}, now = new Date()) {
  const cutoff = now.getTime() - Number(contract.maxAgeDays || 14) * DAY_MS;
  const results = (contract.suites || []).map((suite) => {
    const report = documents[suite.id];
    if (!report) return { id: suite.id, label: suite.label, status: 'missing', failures: ['missing evidence report'] };
    const failures = [];
    if (report.status !== 'pass') failures.push(`suite status is ${report.status || 'missing'}`);
    const generatedAt = Date.parse(report.generatedAt);
    if (!Number.isFinite(generatedAt)) failures.push('generatedAt is invalid');
    else if (generatedAt < cutoff) failures.push(`evidence is older than ${contract.maxAgeDays || 14} days`);
    for (const project of suite.requiredProjects || []) {
      if (!(report.projects || []).includes(project)) failures.push(`missing project ${project}`);
    }
    const stale = failures.some((failure) => failure.startsWith('evidence is older'));
    return { id: suite.id, label: suite.label, status: failures.length ? stale ? 'stale' : 'fail' : 'pass', generatedAt: report.generatedAt || null, projects: report.projects || [], failures };
  });
  const status = results.every((result) => result.status === 'pass')
    ? 'pass'
    : results.some((result) => result.status === 'fail')
      ? 'fail'
      : results.some((result) => result.status === 'stale')
        ? 'stale'
        : 'missing';
  return { status, results };
}
