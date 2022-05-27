// game queue + processing

const Queue = artifacts.require("HexplorationQueue");
const Gameplay = artifacts.require("HexplorationGameplay");
const GameBoard = artifacts.require("HexplorationBoard");
const GameController = artifacts.require("HexplorationController");
const CharacterCard = artifacts.require("CharacterCard");
const GameSummary = artifacts.require("GameSummary");
const EventDeck = artifacts.require("EventDeck");
const AmbushDeck = artifacts.require("AmbushDeck");
const TreasureDeck = artifacts.require("TreasureDeck");
const addresses = require("./addresses.js");

module.exports = async (deployer, network, [defaultAccount]) => {
  let BOARD_ADDRESS;
  let CONTROLLER_ADDRESS;
  let VRF_COORDINATOR_ADDRESS;
  let VRF_KEY_HASH;
  let VRF_SUBSCRIPTION_ID;

  if (network.startsWith("ganache")) {
    CONTROLLER_ADDRESS = addresses.GANACHE_HEXPLORATION_CONTROLLER;
    BOARD_ADDRESS = addresses.GANACHE_HEXPLORATION_BOARD;
    VRF_COORDINATOR_ADDRESS = addresses.GANACHE_VRF_COORDINATOR;
    VRF_KEY_HASH = addresses.GANACHE_VRF_KEY_HASH;
    VRF_SUBSCRIPTION_ID = addresses.GANACHE_VRF_SUBSCRIPTION_ID;
  } else if (network.startsWith("binance_test")) {
    CONTROLLER_ADDRESS = addresses.BINANCE_TEST_HEXPLORATION_CONTROLLER;
    BOARD_ADDRESS = addresses.BINANCE_TEST_HEXPLORATION_BOARD;
    VRF_COORDINATOR_ADDRESS = addresses.BINANCE_TEST_VRF_COORDINATOR;
    VRF_KEY_HASH = addresses.BINANCE_TEST_VRF_KEY_HASH;
    VRF_SUBSCRIPTION_ID = addresses.BINANCE_TEST_VRF_SUBSCRIPTION_ID;
  } else if (network.startsWith("mumbai")) {
    CONTROLLER_ADDRESS = addresses.MUMBAI_HEXPLORATION_CONTROLLER;
    BOARD_ADDRESS = addresses.MUMBAI_HEXPLORATION_BOARD;
    VRF_COORDINATOR_ADDRESS = addresses.MUMBAI_VRF_COORDINATOR;
    VRF_KEY_HASH = addresses.MUMBAI_VRF_KEY_HASH;
    VRF_SUBSCRIPTION_ID = addresses.MUMBAI_VRF_SUBSCRIPTION_ID;
  } else {
    BOARD_ADDRESS = "0x0000000000000000000000000000000000000000";
    CONTROLLER_ADDRESS = "0x0000000000000000000000000000000000000000";
    VRF_COORDINATOR_ADDRESS = addresses.GANACHE_VRF_COORDINATOR;
    VRF_KEY_HASH = addresses.GANACHE_VRF_KEY_HASH;
    VRF_SUBSCRIPTION_ID = addresses.GANACHE_VRF_SUBSCRIPTION_ID;
  }
  // TODO: Set from addresses

  console.log("Board address:");

  try {
    await deployer.deploy(
      Gameplay,
      GameSummary.address,
      BOARD_ADDRESS,
      EventDeck.address,
      TreasureDeck.address,
      AmbushDeck.address
    );
  } catch (err) {
    console.error(err);
  }
};
