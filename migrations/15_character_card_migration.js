const addresses = require("./addresses.js");

const CharacterCard = artifacts.require("CharacterCard");
const ItemToken = artifacts.require("Item");
const ArtifactToken = artifacts.require("Artifact");
const RelicToken = artifacts.require("Relic");
const GameBoard = artifacts.require("HexplorationBoard");

module.exports = async (deployer, network, [defaultAccount]) => {
  //TODO: Update for all networks
  let GAME_BOARD_ADDRESS;
  let VERIFIED_CONTROLLER_ADDRESS;
  if (network.startsWith("ganache")) {
    VERIFIED_CONTROLLER_ADDRESS = addresses.GANACHE_HEXPLORATION_CONTROLLER;
    GAME_BOARD_ADDRESS = addresses.GANACHE_HEXPLORATION_BOARD;
  } else if (network.startsWith("binance_test")) {
    VERIFIED_CONTROLLER_ADDRESS =
      addresses.BINANCE_TEST_HEXPLORATION_CONTROLLER;
    GAME_BOARD_ADDRESS = addresses.BINANCE_TEST_HEXPLORATION_BOARD;
  } else if (network.startsWith("mumbai")) {
    VERIFIED_CONTROLLER_ADDRESS = addresses.MUMBAI_HEXPLORATION_CONTROLLER;
    GAME_BOARD_ADDRESS = addresses.MUMBAI_HEXPLORATION_BOARD;
  } else {
    GAME_BOARD_ADDRESS = "0x0000000000000000000000000000000000000000";
    VERIFIED_CONTROLLER_ADDRESS = "0x0000000000000000000000000000000000000000";
  }
  try {
    await deployer.deploy(
      CharacterCard,
      ItemToken.address,
      ArtifactToken.address,
      RelicToken.address
    );
    // set verified controller...
    const cc = await CharacterCard.deployed();
    console.log("Character card deployed to:", CharacterCard.address);
    console.log("Adding verified controller:", VERIFIED_CONTROLLER_ADDRESS);
    await cc.addVerifiedController(VERIFIED_CONTROLLER_ADDRESS);
    console.log("Controller added");
    console.log("Adding card to game board...");
    let hexBoard = await GameBoard.at(GAME_BOARD_ADDRESS);
    await hexBoard.setCharacterCard(CharacterCard.address);
    console.log("Character card set.");
  } catch (err) {
    console.error(err);
  }
};
