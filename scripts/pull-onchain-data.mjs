/**
 * Pull all token type names and card deck data from the existing Sepolia deployment.
 * Outputs a JSON file that the deploy script can reference.
 *
 * Usage: node scripts/pull-onchain-data.mjs
 */
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const deployments = JSON.parse(
  readFileSync(resolve(root, "deployments.json"), "utf8")
).sepolia;

// Try multiple RPCs - publicnode rate-limits aggressively
const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
console.log(`Using RPC: ${RPC_URL}\n`);

const client = createPublicClient({
  chain: sepolia,
  transport: http(RPC_URL),
});

// ── Minimal ABIs ─────────────────────────────────────────────────────

const gameTokenAbi = [
  {
    inputs: [],
    name: "getTokenTypes",
    outputs: [{ type: "string[]" }],
    stateMutability: "view",
    type: "function",
  },
];

const cardDeckAbi = [
  {
    inputs: [],
    name: "getDeck",
    outputs: [{ type: "string[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getDescription",
    outputs: [{ type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getQuantity",
    outputs: [{ type: "uint16" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getRollThresholds",
    outputs: [{ type: "uint256[3]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getRollTypeRequired",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getMovementAdjust",
    outputs: [{ type: "int8[3]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getAgilityAdjust",
    outputs: [{ type: "int8[3]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getDexterityAdjust",
    outputs: [{ type: "int8[3]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getItemGain",
    outputs: [{ type: "string[3]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getItemLoss",
    outputs: [{ type: "string[3]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getHandLoss",
    outputs: [{ type: "string[3]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "cardTitle", type: "string" }],
    name: "getOutcomeDescription",
    outputs: [{ type: "string[3]" }],
    stateMutability: "view",
    type: "function",
  },
  // Buff functions
  {
    inputs: [{ name: "", type: "string" }],
    name: "movementBuff",
    outputs: [{ type: "int8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "string" }],
    name: "agilityBuff",
    outputs: [{ type: "int8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "string" }],
    name: "dexterityBuff",
    outputs: [{ type: "int8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "string" }],
    name: "digOddsBuff",
    outputs: [{ type: "int8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "", type: "string" }],
    name: "combatBuff",
    outputs: [{ type: "int8" }],
    stateMutability: "view",
    type: "function",
  },
];

// Also read grid dimensions from the board
const boardAbi = [
  {
    inputs: [],
    name: "gridWidth",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "gridHeight",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Load partial results if they exist (resume after rate-limit)
let existing = { tokens: {}, decks: {}, board: {} };
try {
  existing = JSON.parse(
    readFileSync(resolve(root, "scripts", "onchain-data.json"), "utf8")
  );
  console.log("(Loaded existing partial results for resume)\n");
} catch {}

async function retry(fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i < retries - 1) {
        console.log(` (retry ${i + 1}/${retries} after ${delay}ms...)`);
        await sleep(delay);
        delay *= 2; // exponential backoff
      } else {
        throw e;
      }
    }
  }
}

async function readTokenTypes(name, address) {
  // Skip if already have data
  if (existing.tokens[name]?.length > 0) {
    console.log(`  ${name}: cached (${existing.tokens[name].length} types)`);
    return existing.tokens[name];
  }
  console.log(`  Reading ${name} at ${address}...`);
  try {
    const types = await retry(() =>
      client.readContract({ address, abi: gameTokenAbi, functionName: "getTokenTypes" })
    );
    console.log(`    → ${types.length} types: ${types.join(", ")}`);
    return types;
  } catch (e) {
    console.log(`    → ERROR: ${e.shortMessage || e.message}`);
    return [];
  }
}

// Known deck sizes from first run (getDeck returned these many unique titles)
const EXPECTED_DECK_SIZES = { EVENT: 25, AMBUSH: 25 };

async function readDeckCards(name, address) {
  const expected = EXPECTED_DECK_SIZES[name];
  const cached = existing.decks[name];
  // Only skip if we have ALL cards (or no expectation but have some data from a complete read)
  if (cached?.length > 0 && (!expected || cached.length >= expected)) {
    console.log(`  ${name}: cached (${cached.length} cards — complete)`);
    return cached;
  }
  if (cached?.length > 0) {
    console.log(`  ${name}: partial cache (${cached.length}/${expected || "?"} cards — re-reading)`);
  }

  console.log(`  Reading ${name} deck at ${address}...`);
  try {
    await sleep(1500); // rate limit protection
    const titles = await retry(() =>
      client.readContract({ address, abi: cardDeckAbi, functionName: "getDeck" })
    );
    console.log(`    → ${titles.length} card titles in deck`);

    const uniqueTitles = [...new Set(titles)];
    console.log(`    → ${uniqueTitles.length} unique cards after dedup`);

    const cards = [];
    for (const title of uniqueTitles) {
      if (!title || title === "") continue;

      process.stdout.write(`    Reading card "${title}"...`);
      await sleep(800); // throttle between cards

      try {
        // Read fields sequentially in small batches to avoid rate limits
        const [description, quantity, rollThresholds, rollTypeRequired] =
          await retry(() =>
            Promise.all([
              client.readContract({ address, abi: cardDeckAbi, functionName: "getDescription", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "getQuantity", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "getRollThresholds", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "getRollTypeRequired", args: [title] }),
            ])
          );

        await sleep(500);

        const [movementAdjust, agilityAdjust, dexterityAdjust] =
          await retry(() =>
            Promise.all([
              client.readContract({ address, abi: cardDeckAbi, functionName: "getMovementAdjust", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "getAgilityAdjust", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "getDexterityAdjust", args: [title] }),
            ])
          );

        await sleep(500);

        const [itemGain, itemLoss, handLoss, outcomeDescription] =
          await retry(() =>
            Promise.all([
              client.readContract({ address, abi: cardDeckAbi, functionName: "getItemGain", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "getItemLoss", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "getHandLoss", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "getOutcomeDescription", args: [title] }),
            ])
          );

        await sleep(500);

        const [movBuff, agiBuff, dexBuff, digBuff, comBuff] =
          await retry(() =>
            Promise.all([
              client.readContract({ address, abi: cardDeckAbi, functionName: "movementBuff", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "agilityBuff", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "dexterityBuff", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "digOddsBuff", args: [title] }),
              client.readContract({ address, abi: cardDeckAbi, functionName: "combatBuff", args: [title] }),
            ])
          );

        cards.push({
          title,
          description,
          quantity: Number(quantity),
          rollThresholds: rollThresholds.map(Number),
          rollTypeRequired: Number(rollTypeRequired),
          movementAdjust: movementAdjust.map(Number),
          agilityAdjust: agilityAdjust.map(Number),
          dexterityAdjust: dexterityAdjust.map(Number),
          itemGain: [...itemGain],
          itemLoss: [...itemLoss],
          handLoss: [...handLoss],
          outcomeDescription: [...outcomeDescription],
          buffs: {
            movement: Number(movBuff),
            agility: Number(agiBuff),
            dexterity: Number(dexBuff),
            digOdds: Number(digBuff),
            combat: Number(comBuff),
          },
        });
        console.log(" OK");
      } catch (e) {
        console.log(` ERROR: ${e.shortMessage || e.message}`);
      }
    }

    return cards;
  } catch (e) {
    console.log(`    → ERROR reading deck: ${e.shortMessage || e.message}`);
    return [];
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Pulling on-chain data from Sepolia ===\n");

  const result = { tokens: {}, decks: {}, board: {} };

  // 1. Token types
  console.log("--- Token Types ---");
  const tokenContracts = {
    DAY_NIGHT: deployments.DAY_NIGHT_TOKEN,
    DISASTER: deployments.DISASTER_TOKEN,
    ENEMY: deployments.ENEMY_TOKEN,
    ITEM: deployments.ITEM_TOKEN,
    PLAYER_STATUS: deployments.PLAYER_STATUS_TOKEN,
    RELIC: deployments.RELIC_TOKEN,
  };

  for (const [name, addr] of Object.entries(tokenContracts)) {
    result.tokens[name] = await readTokenTypes(name, addr);
  }

  // Save tokens immediately
  const outPath = resolve(root, "scripts", "onchain-data.json");
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log("  (saved token data)");

  // 2. Card decks
  console.log("\n--- Card Decks ---");
  const deckContracts = {
    EVENT: deployments.EVENT_DECK,
    AMBUSH: deployments.AMBUSH_DECK,
    TREASURE: deployments.TREASURE_DECK,
    LAND: deployments.LAND_DECK,
    RELIC: deployments.RELIC_DECK,
  };

  for (const [name, addr] of Object.entries(deckContracts)) {
    result.decks[name] = await readDeckCards(name, addr);
    // Save after each deck
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`  (saved ${name} deck)`);
  }

  // 3. Board dimensions
  console.log("\n--- Board Dimensions ---");
  try {
    const [width, height] = await Promise.all([
      client.readContract({
        address: deployments.HEXPLORATION_BOARD,
        abi: boardAbi,
        functionName: "gridWidth",
      }),
      client.readContract({
        address: deployments.HEXPLORATION_BOARD,
        abi: boardAbi,
        functionName: "gridHeight",
      }),
    ]);
    result.board.gridWidth = Number(width);
    result.board.gridHeight = Number(height);
    console.log(`  Grid: ${result.board.gridWidth} x ${result.board.gridHeight}`);
  } catch (e) {
    console.log(`  ERROR reading board: ${e.shortMessage || e.message}`);
  }

  // 4. Final write
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\n=== Done! Written to ${outPath} ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
