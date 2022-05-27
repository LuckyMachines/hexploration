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

  console.log("Deploying Disaster Tokens");
  try {
    await deployer.deploy(DisasterTokens, HEXPLORATION_CONTROLLER_ADDRESS);
  } catch (err) {
    console.error(err);
  }
};
