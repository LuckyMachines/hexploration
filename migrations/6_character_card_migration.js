/// PASTE CONTROLLER AND GAME BOARD ADDRESSES HERE ///
const GAME_BOARD_ADDRESS = "0xD050082b7c6f42e544f7a7e09ef867f4833dC356";
const VERIFIED_CONTROLLER_ADDRESS =
  "0xdA660c93e5A7c2702548be14Dc918685a1Eea337";

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
