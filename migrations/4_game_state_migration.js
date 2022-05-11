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

  console.log("Deploying Character Card");
  try {
    await deployer.deploy(CharacterCard);
  } catch (err) {
    console.error(err);
  }

  console.log("Setting token types on wallets...\n");
  const boardWallet = await BoardWallet.deployed();
  const playerWallet = await PlayerWallet.deployed();
  const zoneWallet = await ZoneWallet.deployed();

  console.log("Board Wallet:");
  const boardTokenTypes = ["Day", "Night"];
  const boardTokenAddresses = [DayNightTokens.address, DayNightTokens.address];
  await boardWallet.addTokenTypes(boardTokenAddresses, boardTokenTypes);

  console.log("Zone Wallet:");
  // disaster
  // enemy

  console.log("Player Wallet:");
  // item
  // player status
};
