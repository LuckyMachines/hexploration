// add game controller as vc of gsu
// add queue as vc of gsu
// add game state as vc on game board

const GameStateUpdate = artifacts.require("HexplorationStateUpdate");
const Queue = artifacts.require("HexplorationQueue");
const GameBoard = artifacts.require("HexplorationBoard");
const GameController = artifacts.require("HexplorationController");
const Gameplay = artifacts.require("HexplorationGameplay");
const CharacterCard = artifacts.require("CharacterCard");
// Tokens
const Artifact = artifacts.require("Artifact");
const DayNight = artifacts.require("DayNight");
const Disaster = artifacts.require("Disaster");
const Enemy = artifacts.require("Enemy");
const Item = artifacts.require("Item");
const PlayerStatus = artifacts.require("PlayerStatus");
const Relic = artifacts.require("Relic");
const addresses = require("./addresses.js");

module.exports = async (deployer, network, [defaultAccount]) => {
  //TODO: set for all chains
  let BOARD_ADDRESS;
  let CONTROLLER_ADDRESS;

  if (network.startsWith("ganache")) {
    CONTROLLER_ADDRESS = addresses.GANACHE_HEXPLORATION_CONTROLLER;
    BOARD_ADDRESS = addresses.GANACHE_HEXPLORATION_BOARD;
  } else if (network.startsWith("binance_test")) {
    CONTROLLER_ADDRESS = addresses.BINANCE_TEST_HEXPLORATION_CONTROLLER;
    BOARD_ADDRESS = addresses.BINANCE_TEST_HEXPLORATION_BOARD;
  } else if (network.startsWith("mumbai")) {
    CONTROLLER_ADDRESS = addresses.MUMBAI_HEXPLORATION_CONTROLLER;
    BOARD_ADDRESS = addresses.MUMBAI_HEXPLORATION_BOARD;
  } else {
    BOARD_ADDRESS = "0x0000000000000000000000000000000000000000";
    CONTROLLER_ADDRESS = "0x0000000000000000000000000000000000000000";
  }
  //console.log("Board address:", BOARD_ADDRESS);
  try {
    await deployer.deploy(
      GameStateUpdate,
      BOARD_ADDRESS,
      CharacterCard.address
    );

    console.log(
      "Hexploration game state update deployed to:",
      GameStateUpdate.address
    );
  } catch (err) {
    console.error(err);
  }
};
