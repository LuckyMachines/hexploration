// game queue + processing

const Queue = artifacts.require("HexplorationQueue");
const Gameplay = artifacts.require("HexplorationGameplay");
const GameBoard = artifacts.require("HexplorationBoard");
const GameController = artifacts.require("HexplorationController");
const addresses = require("./addresses.js");

module.exports = async (deployer, network, [defaultAccount]) => {
  console.log("Board address:", addresses.GANACHE_HEXPLORATION_BOARD);
  try {
    await deployer.deploy(Gameplay);
    await deployer.deploy(Queue, Gameplay.address);

    console.log("Adding queue to gameplay...");
    const gp = await Gameplay.deployed();
    await gp.setQueue(Queue.address);
    console.log("queue added");

    // set verified controller...
    const queue = await Queue.deployed();
    console.log(
      "Adding controller to HexplorationQueue:",
      addresses.GANACHE_HEXPLORATION_CONTROLLER
    );
    await queue.addVerifiedController(
      addresses.GANACHE_HEXPLORATION_CONTROLLER
    );
    console.log("Controller added");

    console.log("Adding queue to game board...");
    let hexBoard = await GameBoard.at(addresses.GANACHE_HEXPLORATION_BOARD);
    await hexBoard.setGameplayQueue(Queue.address);
    console.log("Gameplay queue set.");

    // set the queue as the controller's controller
    console.log("Adding queue as verified controller of controller...");
    let hexController = await GameController.at(
      addresses.GANACHE_HEXPLORATION_CONTROLLER
    );
    await hexController.addVerifiedController(Queue.address);
    console.log("queue set as controller's controller.\r");
    console.log(
      `GANACHE_HEXPLORATION_QUEUE: "${Queue.address}",
GANACHE_HEXPLORATION_GAMEPLAY: "${Gameplay.address}"`
    );
  } catch (err) {
    console.error(err);
  }
};
