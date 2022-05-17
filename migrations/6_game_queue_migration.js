// game queue + processing

const Queue = artifacts.require("HexplorationQueue");
const Gameplay = artifacts.require("HexplorationGameplay");
const GameBoard = artifacts.require("HexplorationBoard");
const addresses = require("./addresses.js");

module.exports = async (deployer, network, [defaultAccount]) => {
  console.log("Board address:", addresses.GANACHE_HEXPLORATION_BOARD);
  try {
    await deployer.deploy(Queue);
    await deployer.deploy(Gameplay);
    // set verified controller...
    // const cc = await CharacterCard.deployed();
    // console.log("Character card deployed to:", CharacterCard.address);
    // console.log("Adding verified controller:", VERIFIED_CONTROLLER_ADDRESS);
    // await cc.addVerifiedController(VERIFIED_CONTROLLER_ADDRESS);
    // console.log("Controller added");
    // console.log("Adding card to game board...");
    // let hexBoard = await GameBoard.at(GAME_BOARD_ADDRESS);
    // await hexBoard.setCharacterCard(CharacterCard.address);
    // console.log("Character card set.");
  } catch (err) {
    console.error(err);
  }
};
