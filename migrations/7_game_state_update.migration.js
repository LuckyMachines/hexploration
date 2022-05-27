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
    const hexBoard = await GameBoard.at(BOARD_ADDRESS);
    const hexStateUpdate = await GameStateUpdate.deployed();
    //const hexQueue = await Queue.deployed();
    const hexGameplay = await Gameplay.deployed();
    const hexController = await GameController.at(CONTROLLER_ADDRESS);
    const cc = await CharacterCard.deployed();
    console.log("Adding game controller as VC of game state update...");
    await hexStateUpdate.addVerifiedController(CONTROLLER_ADDRESS);

    console.log("Adding gameplay as VC of game state update...");
    await hexStateUpdate.addVerifiedController(Gameplay.address);

    console.log("Adding game state update as VC of game board...");
    await hexBoard.addVerifiedController(GameStateUpdate.address);

    console.log("Adding game state update as VC of character card...");
    await cc.addVerifiedController(GameStateUpdate.address);

    console.log("Adding game state update address to controller...");
    await hexController.setGameStateUpdate(GameStateUpdate.address);

    console.log("Adding game state update address to gameplay...");
    await hexGameplay.setGameStateUpdate(GameStateUpdate.address);

    console.log("Setting gsu as controller for all tokens...");
    const artifactTokens = await Artifact.deployed();
    await artifactTokens.addController(GameStateUpdate.address);
    const dayNightTokens = await DayNight.deployed();
    await dayNightTokens.addController(GameStateUpdate.address);
    const disasterTokens = await Disaster.deployed();
    await disasterTokens.addController(GameStateUpdate.address);
    const enemyTokens = await Enemy.deployed();
    await enemyTokens.addController(GameStateUpdate.address);
    const itemTokens = await Item.deployed();
    await itemTokens.addController(GameStateUpdate.address);
    const playerStatusTokens = await PlayerStatus.deployed();
    await playerStatusTokens.addController(GameStateUpdate.address);
    const relicTokens = await Relic.deployed();
    await relicTokens.addController(GameStateUpdate.address);

    console.log(
      "Hexploration game state update deployed to:",
      GameStateUpdate.address
    );
  } catch (err) {
    console.error(err);
  }
};
