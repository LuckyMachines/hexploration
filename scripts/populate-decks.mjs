/**
 * Populate card deck data on deployed contracts using data pulled from the
 * existing Sepolia deployment (scripts/onchain-data.json).
 *
 * Usage:
 *   1. Deploy contracts: forge script script/DeployHexploration.s.sol --rpc-url sepolia --broadcast
 *   2. Update deployments.json with new addresses
 *   3. Run: node scripts/populate-decks.mjs
 *
 * Requires PRIVATE_KEY in .env (same key used for deployment).
 */
import "dotenv/config";
import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { foundry } from "viem/chains";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ── Config ──────────────────────────────────────────────────────────

const CHAIN_NAME = process.env.CHAIN || "sepolia";
const chain = CHAIN_NAME === "foundry" ? foundry : sepolia;
const RPC_URL = process.env.RPC_URL || process.env.SEPOLIA_RPC_URL || "https://1rpc.io/sepolia";
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY) {
  console.error("ERROR: PRIVATE_KEY not set in .env");
  process.exit(1);
}

const deployments = process.env.DEPLOYMENTS_JSON
  ? JSON.parse(process.env.DEPLOYMENTS_JSON)
  : JSON.parse(readFileSync(resolve(root, "deployments.json"), "utf8")).sepolia;

const onchainData = JSON.parse(
  readFileSync(resolve(root, "scripts", "onchain-data.json"), "utf8")
);

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
});

const walletClient = createWalletClient({
  account,
  chain,
  transport: http(RPC_URL),
});

// ── ABI ─────────────────────────────────────────────────────────────

const deckAbi = parseAbi([
  "function addCards(string[] titles, string[] descriptions, uint16[] quantities)",
  "function addCardsWithStatAdjustments(string[] titles, string[] descriptions, uint16[] quantities, uint256[3][] rollThresholdValues, string[3][] outcomeDescriptions, int8[3][] movementAdjustments, int8[3][] agilityAdjustments, int8[3][] dexterityAdjustments, uint256[] rollTypesRequired)",
  "function addCardsWithItemGains(string[] titles, string[] descriptions, uint16[] quantities, string[3][] itemGains, string[3][] itemLosses, string[3][] outcomeDescriptions)",
  "function addCardsWithStatBuffs(string[] titles, string[] descriptions, uint16[] quantities, int8[] movementBuffs, int8[] agilityBuffs, int8[] dexterityBuffs, int8[] digOddsBuffs, int8[] combatBuffs)",
  "function getDeck() view returns (string[])",
]);

// ── Helpers ─────────────────────────────────────────────────────────

function hasStatAdjustments(card) {
  return card.rollTypeRequired > 0 ||
    card.rollThresholds.some((v) => v > 0) ||
    card.movementAdjust.some((v) => v !== 0) ||
    card.agilityAdjust.some((v) => v !== 0) ||
    card.dexterityAdjust.some((v) => v !== 0);
}

function hasItemGains(card) {
  return card.itemGain.some((v) => v !== "") ||
    card.itemLoss.some((v) => v !== "") ||
    card.handLoss.some((v) => v !== "");
}

function hasBuffs(card) {
  const b = card.buffs;
  return b.movement !== 0 || b.agility !== 0 || b.dexterity !== 0 ||
    b.digOdds !== 0 || b.combat !== 0;
}

async function sendTx(address, functionName, args) {
  const hash = await walletClient.writeContract({
    address,
    abi: deckAbi,
    functionName,
    args,
  });
  console.log(`    tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new Error(`Transaction reverted: ${hash}`);
  }
  return receipt;
}

// ── Main ────────────────────────────────────────────────────────────

const BATCH_SIZE = 5; // cards per transaction to avoid RPC size limits

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function populateDeck(name, address, cards) {
  console.log(`\n=== ${name} Deck (${address}) — ${cards.length} cards ===`);

  // Check if deck already has cards
  try {
    const existing = await publicClient.readContract({
      address,
      abi: deckAbi,
      functionName: "getDeck",
    });
    if (existing.length > 0) {
      console.log(`  Already populated with ${existing.length} cards — skipping`);
      return;
    }
  } catch {}

  // Group cards by type
  const statCards = cards.filter((c) => hasStatAdjustments(c) && !hasItemGains(c) && !hasBuffs(c));
  const itemCards = cards.filter((c) => hasItemGains(c) && !hasBuffs(c));
  const buffCards = cards.filter((c) => hasBuffs(c));
  const simpleCards = cards.filter(
    (c) => !hasStatAdjustments(c) && !hasItemGains(c) && !hasBuffs(c)
  );
  const comboCards = cards.filter((c) => hasStatAdjustments(c) && hasItemGains(c));

  // Process simple cards in batches
  for (const batch of chunk(simpleCards, BATCH_SIZE)) {
    console.log(`  Adding ${batch.length} simple cards...`);
    await sendTx(address, "addCards", [
      batch.map((c) => c.title),
      batch.map((c) => c.description),
      batch.map((c) => c.quantity),
    ]);
  }

  // Process stat adjustment cards in batches
  for (const batch of chunk(statCards, BATCH_SIZE)) {
    console.log(`  Adding ${batch.length} stat-adjustment cards...`);
    await sendTx(address, "addCardsWithStatAdjustments", [
      batch.map((c) => c.title),
      batch.map((c) => c.description),
      batch.map((c) => c.quantity),
      batch.map((c) => c.rollThresholds),
      batch.map((c) => c.outcomeDescription),
      batch.map((c) => c.movementAdjust),
      batch.map((c) => c.agilityAdjust),
      batch.map((c) => c.dexterityAdjust),
      batch.map((c) => c.rollTypeRequired),
    ]);
  }

  // Process item gain cards in batches
  for (const batch of chunk(itemCards, BATCH_SIZE)) {
    console.log(`  Adding ${batch.length} item-gain cards...`);
    await sendTx(address, "addCardsWithItemGains", [
      batch.map((c) => c.title),
      batch.map((c) => c.description),
      batch.map((c) => c.quantity),
      batch.map((c) => c.itemGain),
      batch.map((c) => c.itemLoss),
      batch.map((c) => c.outcomeDescription),
    ]);
  }

  // Process buff cards in batches
  for (const batch of chunk(buffCards, BATCH_SIZE)) {
    console.log(`  Adding ${batch.length} buff cards...`);
    await sendTx(address, "addCardsWithStatBuffs", [
      batch.map((c) => c.title),
      batch.map((c) => c.description),
      batch.map((c) => c.quantity),
      batch.map((c) => c.buffs.movement),
      batch.map((c) => c.buffs.agility),
      batch.map((c) => c.buffs.dexterity),
      batch.map((c) => c.buffs.digOdds),
      batch.map((c) => c.buffs.combat),
    ]);
  }

  // Combo cards (stat + item): add as stat cards
  for (const batch of chunk(comboCards, BATCH_SIZE)) {
    console.log(`  Adding ${batch.length} combo (stat+item) cards...`);
    await sendTx(address, "addCardsWithStatAdjustments", [
      batch.map((c) => c.title),
      batch.map((c) => c.description),
      batch.map((c) => c.quantity),
      batch.map((c) => c.rollThresholds),
      batch.map((c) => c.outcomeDescription),
      batch.map((c) => c.movementAdjust),
      batch.map((c) => c.agilityAdjust),
      batch.map((c) => c.dexterityAdjust),
      batch.map((c) => c.rollTypeRequired),
    ]);
  }

  console.log(`  Done.`);
}

async function main() {
  console.log("=== Populating Card Decks ===");
  console.log(`Account: ${account.address}`);
  console.log(`RPC: ${RPC_URL}`);

  const deckFilter = process.env.DECK_FILTER; // optional: populate only one deck (e.g. "EVENT")

  const deckMap = {
    EVENT: deployments.EVENT_DECK,
    AMBUSH: deployments.AMBUSH_DECK,
    TREASURE: deployments.TREASURE_DECK,
    LAND: deployments.LAND_DECK,
    RELIC: deployments.RELIC_DECK,
  };

  const filteredEntries = deckFilter
    ? Object.entries(deckMap).filter(([name]) => name === deckFilter)
    : Object.entries(deckMap);

  for (const [name, address] of filteredEntries) {
    const cards = onchainData.decks[name];
    if (!cards || cards.length === 0) {
      console.log(`\n${name}: No card data — skipping`);
      continue;
    }
    await populateDeck(name, address, cards);
  }

  console.log("\n=== All decks populated! ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
