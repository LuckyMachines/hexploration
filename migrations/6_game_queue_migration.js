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
  const BOARD_ADDRESS = addresses.GANACHE_HEXPLORATION_BOARD;
  const CONTROLLER_ADDRESS = addresses.GANACHE_HEXPLORATION_CONTROLLER;
  // TODO: Set from addresses
  const VRF_COORDINATOR_ADDRESS = addresses.GANACHE_VRF_COORDINATOR;
  const VRF_KEY_HASH = addresses.GANACHE_VRF_KEY_HASH;
  const VRF_SUBSCRIPTION_ID = addresses.GANACHE_VRF_SUBSCRIPTION_ID;

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

    await deployer.deploy(
      Queue,
      Gameplay.address,
      CharacterCard.address,
      VRF_COORDINATOR_ADDRESS,
      VRF_SUBSCRIPTION_ID,
      VRF_KEY_HASH
    );

    console.log("Adding queue to gameplay...");
    const gp = await Gameplay.deployed();
    await gp.setQueue(Queue.address);
    console.log("queue added");

    // set verified controller...
    const queue = await Queue.deployed();
    console.log("Adding controller to HexplorationQueue:", CONTROLLER_ADDRESS);
    await queue.addVerifiedController(CONTROLLER_ADDRESS);
    console.log("Controller added");

    console.log("Adding queue to game board...");
    let hexBoard = await GameBoard.at(BOARD_ADDRESS);
    await hexBoard.setGameplayQueue(Queue.address);
    console.log("Gameplay queue set.");

    // set the queue as the controller's controller
    console.log("Adding queue as verified controller of controller...");
    let hexController = await GameController.at(CONTROLLER_ADDRESS);
    await hexController.addVerifiedController(Queue.address);
    console.log("queue set as controller's controller.\r");
    console.log(
      `_HEXPLORATION_QUEUE: "${Queue.address}",
_HEXPLORATION_GAMEPLAY: "${Gameplay.address}"`
    );
  } catch (err) {
    console.error(err);
  }
};
