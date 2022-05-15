const CharacterCard = artifacts.require("CharacterCard");
const ItemToken = artifacts.require("Item");

module.exports = async (deployer, network, [defaultAccount]) => {
  const VERIFIED_CONTROLLER_ADDRESS = "";
  try {
    await deployer.deploy(CharacterCard, ItemToken.address);
    // set verified controller...
    const cc = await CharacterCard.deployed();
    console.log("Character card deployed to:", CharacterCard.address);
    console.log("Adding verified controller:", VERIFIED_CONTROLLER_ADDRESS);
    await cc.addVerifiedController(VERIFIED_CONTROLLER_ADDRESS);
    console.log("Controller added");
  } catch (err) {
    console.error(err);
  }
};
