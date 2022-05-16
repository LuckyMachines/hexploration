/// PASTE CONTROLLER AND GAME BOARD ADDRESSES HERE ///
const GAME_BOARD_ADDRESS = "0x6a5E47E90D95627441756626eA71EaECCC997246";
const VERIFIED_CONTROLLER_ADDRESS =
  "0x2AB24bf9bC362b63dcc68530f38adB7786E1c139";

const CharacterCard = artifacts.require("CharacterCard");
const ItemToken = artifacts.require("Item");
const ArtifactToken = artifacts.require("Artifact");
const RelicToken = artifacts.require("Relic");
const GameBoard = artifacts.require("HexplorationBoard");

module.exports = async (deployer, network, [defaultAccount]) => {
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
