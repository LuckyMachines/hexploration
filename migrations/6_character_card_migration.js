const CharacterCard = artifacts.require("CharacterCard");
const ItemToken = artifacts.require("Item");
const GameBoard = artifacts.require("HexplorationBoard");

module.exports = async (deployer, network, [defaultAccount]) => {
  const GAME_BOARD_ADDRESS = "";
  const VERIFIED_CONTROLLER_ADDRESS =
    "0x9a2cE5A8F4F85238CcE3D799a5aAE18A71915326";
  try {
    await deployer.deploy(CharacterCard, ItemToken.address);
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
