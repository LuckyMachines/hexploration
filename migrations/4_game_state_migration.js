const BoardWallet = artifacts.require("BoardWallet");
const PlayerWallet = artifacts.require("PlayerWallet");
const ZoneWallet = artifacts.require("ZoneWallet");
const CharacterCard = artifacts.require("CharacterCard");
const DayNightTokens = artifacts.require("DayNight");
const DisasterTokens = artifacts.require("Disaster");
const EnemyTokens = artifacts.require("Enemy");
const ItemTokens = artifacts.require("Item");
const PlayerStatusTokens = artifacts.require("PlayerStatus");

require("dotenv").config();

module.exports = async (deployer, network, [defaultAccount]) => {
  console.log("Deploying Board Wallet");
  try {
    await deployer.deploy(BoardWallet);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Player Wallet");
  try {
    await deployer.deploy(PlayerWallet);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Zone Wallet");
  try {
    await deployer.deploy(ZoneWallet);
  } catch (err) {
    console.error(err);
  }

  console.log("Setting token types on wallets...\n");
  const boardWallet = await BoardWallet.deployed();
  const zoneWallet = await ZoneWallet.deployed();
  const playerWallet = await PlayerWallet.deployed();

  console.log("Board Wallet:");
  let boardTokenTypes = ["Day", "Night"];
  let boardTokenAddresses = [DayNightTokens.address, DayNightTokens.address];
  await boardWallet.addTokenTypes(boardTokenAddresses, boardTokenTypes);
  console.log("done\n");

  console.log("Zone Wallet:");
  boardTokenTypes = [
    "EarthQuake",
    "Volcano",
    "Pirate",
    "Pirate Ship",
    "Deathbot",
    "Guardian",
    "Sandworm",
    "Dragon"
  ];
  boardTokenAddresses = [
    DisasterTokens.address,
    DisasterTokens.address,
    EnemyTokens.address,
    EnemyTokens.address,
    EnemyTokens.address,
    EnemyTokens.address,
    EnemyTokens.address,
    EnemyTokens.address
  ];
  await zoneWallet.addTokenTypes(boardTokenAddresses, boardTokenTypes);
  console.log("done\n");

  console.log("Player Wallet:");
  boardTokenTypes = ["Stunned", "Burned"];
  boardTokenAddresses = [ItemTokens.address, ItemTokens.address];
  await zoneWallet.addTokenTypes(boardTokenAddresses, boardTokenTypes);
  console.log("done\n");

  if (network.startsWith("ganache")) {
    console.log(`
  GANACHE_BOARD_WALLET: "${BoardWallet.address}",
  GANACHE_PLAYER_WALLET: "${PlayerWallet.address}",
  GANACHE_ZONE_WALLET: "${ZoneWallet.address}"`);
  }
};
