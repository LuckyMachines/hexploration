const CharacterCard = artifacts.require("CharacterCard");
const ItemToken = artifacts.require("Item");
const ArtifactToken = artifacts.require("Artifact");
const RelicToken = artifacts.require("Relic");
const GameBoard = artifacts.require("HexplorationBoard");

module.exports = async (deployer, network, [defaultAccount]) => {
  const GAME_BOARD_ADDRESS = "0x45c287260071E9DC2FC5cFbE90596706dCfFdaeD";
  const VERIFIED_CONTROLLER_ADDRESS =
    "0xaA600a99724a219738D94e97E28B5790926f7677";
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
