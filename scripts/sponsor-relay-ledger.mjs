import { promises as fs } from 'node:fs';
import path from 'node:path';
import { RelayError, SPONSOR_RELAY_VERSION } from './sponsor-relay-core.mjs';

const initialState = () => ({
  version: SPONSOR_RELAY_VERSION,
  paused: false,
  pauseReason: null,
  updatedAt: new Date().toISOString(),
  days: {},
  hours: {},
  requests: {},
  transactions: {},
});

const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
const hourKey = (now) => new Date(now).toISOString().slice(0, 13);
const bigint = (value) => BigInt(value || 0);

export class SponsorBudgetLedger {
  constructor(file, limits, now = () => Date.now()) {
    this.file = file;
    this.limits = limits;
    this.now = now;
    this.state = initialState();
    this.queue = Promise.resolve();
  }

  async init() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (parsed.version !== SPONSOR_RELAY_VERSION) throw new Error('Unsupported sponsor relay state version');
      this.state = parsed;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.persist();
    }
    await this.mutate(() => this.prune());
    return this;
  }

  snapshot() { return structuredClone(this.state); }

  async mutate(task) {
    const operation = this.queue.then(async () => {
      const result = await task(this.state);
      this.state.updatedAt = new Date(this.now()).toISOString();
      await this.persist();
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async persist() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(this.state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(temp, this.file);
  }

  prune() {
    const now = this.now();
    const keepAfter = now - 7 * 24 * 60 * 60 * 1000;
    for (const [key, value] of Object.entries(this.state.requests)) {
      if (Date.parse(value.createdAt || 0) < keepAfter) delete this.state.requests[key];
    }
    for (const key of Object.keys(this.state.days)) if (Date.parse(`${key}T00:00:00Z`) < keepAfter) delete this.state.days[key];
    for (const key of Object.keys(this.state.hours)) if (Date.parse(`${key}:00:00Z`) < keepAfter) delete this.state.hours[key];
  }

  async setPaused(paused, reason = null) {
    return this.mutate(() => {
      this.state.paused = Boolean(paused);
      this.state.pauseReason = paused ? String(reason || 'Paused by operator').slice(0, 240) : null;
      return { paused: this.state.paused, reason: this.state.pauseReason };
    });
  }

  async reserve({ digest, player, signer, gas, costWei, actionCount = 1, participants = null }) {
    return this.mutate(() => {
      const existing = this.state.requests[digest];
      if (existing) return { duplicate: true, record: existing };
      if (this.state.paused) throw new RelayError(503, 'relay_paused', this.state.pauseReason || 'Sponsorship is paused');
      if (!Number.isSafeInteger(actionCount) || actionCount < 1 || actionCount > 8) throw new RelayError(400, 'invalid_batch', 'Sponsored action count must be between one and eight');
      const allocations = participants || [{ player, signer, actionCount }];
      if (!Array.isArray(allocations) || allocations.reduce((sum, item) => sum + Number(item.actionCount || 0), 0) !== actionCount) {
        throw new RelayError(400, 'invalid_batch', 'Sponsored participant allocations must match the action count');
      }
      if (gas > this.limits.maxGasPerAction * BigInt(actionCount)) throw new RelayError(422, 'gas_limit', 'This request exceeds its sponsored gas budget');
      if (costWei > this.limits.maxSponsoredCostWei * BigInt(actionCount)) throw new RelayError(422, 'cost_limit', 'This request exceeds its sponsorship value budget');

      const now = this.now();
      const day = dayKey(now);
      const hour = hourKey(now);
      const daily = this.state.days[day] ||= { actions: 0, gas: '0', costWei: '0', players: {} };
      const hourly = this.state.hours[hour] ||= { signers: {} };

      if (daily.actions + actionCount > this.limits.globalDailyActions) throw new RelayError(429, 'global_daily_limit', 'The daily sponsorship action budget is exhausted');
      if (bigint(daily.gas) + gas > this.limits.globalDailyGas) throw new RelayError(429, 'global_gas_limit', 'The daily sponsorship gas budget is exhausted');
      if (bigint(daily.costWei) + costWei > this.limits.globalDailyCostWei) throw new RelayError(429, 'global_cost_limit', 'The daily sponsorship value budget is exhausted');
      for (const allocation of allocations) {
        const playerDaily = daily.players[allocation.player] ||= { actions: 0, gas: '0', costWei: '0' };
        const signerHourly = hourly.signers[allocation.signer] ||= { actions: 0 };
        if (playerDaily.actions + allocation.actionCount > this.limits.perPlayerDailyActions) throw new RelayError(429, 'player_daily_limit', 'This player has reached the daily sponsored-action limit');
        if (signerHourly.actions + allocation.actionCount > this.limits.perSignerHourlyActions) throw new RelayError(429, 'signer_hourly_limit', 'This session key has reached its hourly sponsored-action limit');
      }

      daily.actions += actionCount;
      daily.gas = (bigint(daily.gas) + gas).toString();
      daily.costWei = (bigint(daily.costWei) + costWei).toString();
      let allocatedGas = 0n;
      let allocatedCost = 0n;
      const allocationRecords = [];
      allocations.forEach((allocation, index) => {
        const final = index === allocations.length - 1;
        const shareGas = final ? gas - allocatedGas : gas * BigInt(allocation.actionCount) / BigInt(actionCount);
        const shareCost = final ? costWei - allocatedCost : costWei * BigInt(allocation.actionCount) / BigInt(actionCount);
        allocatedGas += shareGas;
        allocatedCost += shareCost;
        const playerDaily = daily.players[allocation.player];
        const signerHourly = hourly.signers[allocation.signer];
        playerDaily.actions += allocation.actionCount;
        playerDaily.gas = (bigint(playerDaily.gas) + shareGas).toString();
        playerDaily.costWei = (bigint(playerDaily.costWei) + shareCost).toString();
        signerHourly.actions += allocation.actionCount;
        allocationRecords.push({
          player: allocation.player,
          signer: allocation.signer,
          actionCount: allocation.actionCount,
          reservedGas: shareGas.toString(),
          reservedCostWei: shareCost.toString(),
        });
      });
      const record = {
        digest,
        player,
        signer,
        status: 'reserved',
        estimatedGas: gas.toString(),
        reservedCostWei: costWei.toString(),
        actionCount,
        budgetDay: day,
        participants: allocationRecords,
        createdAt: new Date(now).toISOString(),
      };
      this.state.requests[digest] = record;
      return { duplicate: false, record };
    });
  }

  async markSubmitted(digest, hash) {
    return this.mutate(() => {
      const record = this.state.requests[digest];
      if (!record) throw new Error('Unknown sponsor request');
      Object.assign(record, { status: 'submitted', hash, submittedAt: new Date(this.now()).toISOString() });
      this.state.transactions[hash] = { digest, status: 'submitted', submittedAt: record.submittedAt };
      return record;
    });
  }

  async markFailed(digest, code) {
    return this.mutate(() => {
      const record = this.state.requests[digest];
      if (!record) return null;
      Object.assign(record, { status: 'failed', failureCode: code, failedAt: new Date(this.now()).toISOString() });
      return record;
    });
  }

  async markReceipt(hash, receipt) {
    return this.mutate(() => {
      const transaction = this.state.transactions[hash];
      if (!transaction) return null;
      Object.assign(transaction, {
        status: receipt.status === 'success' ? 'confirmed' : 'reverted',
        blockNumber: receipt.blockNumber?.toString?.(),
        gasUsed: receipt.gasUsed?.toString?.(),
        effectiveGasPrice: receipt.effectiveGasPrice?.toString?.(),
        confirmedAt: new Date(this.now()).toISOString(),
      });
      const request = this.state.requests[transaction.digest];
      if (request) {
        Object.assign(request, transaction);
        if (!request.budgetReconciledAt && receipt.gasUsed !== undefined && receipt.effectiveGasPrice !== undefined) {
          const actualGas = BigInt(receipt.gasUsed);
          const actualCost = actualGas * BigInt(receipt.effectiveGasPrice);
          const reservedGas = bigint(request.estimatedGas);
          const reservedCost = bigint(request.reservedCostWei);
          const daily = this.state.days[request.budgetDay];
          if (daily) {
            daily.gas = (bigint(daily.gas) - reservedGas + actualGas).toString();
            daily.costWei = (bigint(daily.costWei) - reservedCost + actualCost).toString();
            let assignedGas = 0n;
            let assignedCost = 0n;
            const participants = request.participants || [{ player: request.player, actionCount: request.actionCount || 1, reservedGas: request.estimatedGas, reservedCostWei: request.reservedCostWei }];
            participants.forEach((participant, index) => {
              const final = index === participants.length - 1;
              const gasShare = final ? actualGas - assignedGas : actualGas * BigInt(participant.actionCount) / BigInt(request.actionCount || 1);
              const costShare = final ? actualCost - assignedCost : actualCost * BigInt(participant.actionCount) / BigInt(request.actionCount || 1);
              assignedGas += gasShare;
              assignedCost += costShare;
              const playerDaily = daily.players[participant.player];
              if (playerDaily) {
                playerDaily.gas = (bigint(playerDaily.gas) - bigint(participant.reservedGas) + gasShare).toString();
                playerDaily.costWei = (bigint(playerDaily.costWei) - bigint(participant.reservedCostWei) + costShare).toString();
              }
            });
          }
          Object.assign(request, {
            actualCostWei: actualCost.toString(),
            budgetReconciledAt: new Date(this.now()).toISOString(),
          });
        }
      }
      return transaction;
    });
  }
}
