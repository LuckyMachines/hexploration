const addresses = require("./addresses.js");

const DayNightTokens = artifacts.require("DayNight");
const DisasterTokens = artifacts.require("Disaster");
const EnemyTokens = artifacts.require("Enemy");
const ItemTokens = artifacts.require("Item");
const PlayerStatusTokens = artifacts.require("PlayerStatus");
const ArtifactTokens = artifacts.require("Artifact");
const RelicTokens = artifacts.require("Relic");
const TokenInventory = artifacts.require("TokenInventory");
const GameBoard = artifacts.require("HexplorationBoard");
const Controller = artifacts.require("HexplorationController");

module.exports = async (deployer, network, [defaultAccount]) => {
  //TODO: update for all chains
  let HEXPLORATION_CONTROLLER_ADDRESS;
  let HEXPLORATION_BOARD_ADDRESS;
  if (network.startsWith("ganache")) {
    HEXPLORATION_CONTROLLER_ADDRESS = addresses.GANACHE_HEXPLORATION_CONTROLLER;
    HEXPLORATION_BOARD_ADDRESS = addresses.GANACHE_HEXPLORATION_BOARD;
  } else if (network.startsWith("binance_test")) {
    HEXPLORATION_CONTROLLER_ADDRESS =
      addresses.BINANCE_TEST_HEXPLORATION_CONTROLLER;
    HEXPLORATION_BOARD_ADDRESS = addresses.BINANCE_TEST_HEXPLORATION_BOARD;
  } else if (network.startsWith("mumbai")) {
    HEXPLORATION_CONTROLLER_ADDRESS = addresses.MUMBAI_HEXPLORATION_CONTROLLER;
    HEXPLORATION_BOARD_ADDRESS = addresses.MUMBAI_HEXPLORATION_BOARD;
  } else {
    HEXPLORATION_BOARD_ADDRESS = "0x0000000000000000000000000000000000000000";
    HEXPLORATION_CONTROLLER_ADDRESS =
      "0x0000000000000000000000000000000000000000";
  }

  console.log("Deploying Token Inventory");
  try {
    await deployer.deploy(TokenInventory);
  } catch (err) {
    console.error(err);
  }

  console.log("Adding tokens to token inventory");

  try {
    const ti = await TokenInventory.deployed();
    await ti.setTokenAddresses(
      DayNightTokens.address,
      DisasterTokens.address,
      EnemyTokens.address,
      ItemTokens.address,
      PlayerStatusTokens.address,
      ArtifactTokens.address,
      RelicTokens.address
    );
    console.log("tokens added to contoller:", HEXPLORATION_CONTROLLER_ADDRESS);

    console.log("Adding token inventory to board");
    let hexBoard = await GameBoard.at(HEXPLORATION_BOARD_ADDRESS);
    await hexBoard.setTokenInventory(TokenInventory.address);
    console.log("done");
  } catch (err) {
    console.log(err.message);
  }

  if (network.startsWith("ganache")) {
    console.log(`
  GANACHE_DAY_NIGHT_TOKEN: "${DayNightTokens.address}",
  GANACHE_DISASTER_TOKEN: "${DisasterTokens.address}",
  GANACHE_ENEMY_TOKEN: "${EnemyTokens.address}",
  GANACHE_ITEM_TOKEN: "${ItemTokens.address}",
  GANACHE_PLAYER_STATUS_TOKEN: "${PlayerStatusTokens.address}",
  GANACHE_ARTIFACT_TOKEN: "${ArtifactTokens.address}"`);
  }
};
