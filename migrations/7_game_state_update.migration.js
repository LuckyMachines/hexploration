// add game controller as vc of gsu
// add queue as vc of gsu
// add game state as vc on game board

const GameStateUpdate = artifacts.require("HexplorationStateUpdate");
const Queue = artifacts.require("HexplorationQueue");
const GameBoard = artifacts.require("HexplorationBoard");
const GameController = artifacts.require("HexplorationController");
const addresses = require("./addresses.js");

module.exports = async (deployer, network, [defaultAccount]) => {
  //console.log("Board address:", addresses.GANACHE_HEXPLORATION_BOARD);
  try {
    await deployer.deploy(GameStateUpdate);
    const hexBoard = await GameBoard.at(addresses.GANACHE_HEXPLORATION_BOARD);
    const hexStateUpdate = await GameStateUpdate.deployed();
    const hexQueue = await Queue.deployed();
    const hexController = await GameController.at(
      addresses.GANACHE_HEXPLORATION_CONTROLLER
    );
    console.log("Adding game controller as VC of game state update...");
    await hexStateUpdate.addVerifiedController(
      addresses.GANACHE_HEXPLORATION_CONTROLLER
    );

    console.log("Adding game queue as VC of game state update...");
    await hexStateUpdate.addVerifiedController(Queue.address);

    console.log("Adding game state update as VC of game board...");
    await hexBoard.addVerifiedController(GameStateUpdate.address);

    console.log("Adding game state update address to controller...");
    await hexController.setGameStateUpdate(GameStateUpdate.address);

    console.log("Adding game state update address to queue...");
    await hexQueue.setGameStateUpdate(GameStateUpdate.address);

    console.log(
      "Hexploration game state update deployed to:",
      GameStateUpdate.address
    );
  } catch (err) {
    console.error(err);
  }
};
