const GameSummary = artifacts.require("GameSummary");

module.exports = async (deployer, network, [defaultAccount]) => {
  try {
    await deployer.deploy(GameSummary);
    console.log("Game summary deployed to:", GameSummary.address);
  } catch (err) {
    console.error(err);
  }
};
