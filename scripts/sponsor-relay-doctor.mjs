#!/usr/bin/env node
import 'dotenv/config';
import { SponsorBudgetLedger } from './sponsor-relay-ledger.mjs';
import { parseRelayConfig } from './sponsor-relay-core.mjs';
import { createRelayClients, SponsorRelayService } from './sponsor-relay-service.mjs';

try {
  const config = parseRelayConfig(process.env);
  const ledger = await new SponsorBudgetLedger(config.stateFile, config).init();
  const clients = createRelayClients(config);
  const service = new SponsorRelayService({ config, ledger, ...clients });
  const readiness = await service.checkReadiness({ force: true });
  process.stdout.write(`${JSON.stringify({ ...service.publicConfig(), readiness }, null, 2)}\n`);
  if (!readiness.ready) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Sponsor relay doctor failed: ${error.message}\n`);
  process.exitCode = 1;
}
