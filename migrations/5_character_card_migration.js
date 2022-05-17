/// PASTE CONTROLLER AND GAME BOARD ADDRESSES HERE ///
const GAME_BOARD_ADDRESS = "0x103279f12c7c7CaeA3a5B8d940d3108A180f59c8";
const VERIFIED_CONTROLLER_ADDRESS =
  "0xB6243b8f5b39D34c627B2443E50eaE735ae4D59e";

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
