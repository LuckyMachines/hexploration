const GameSummary = artifacts.require("GameSummary");

module.exports = async (deployer, network, [defaultAccount]) => {
  try {
    await deployer.deploy(GameSummary);
  } catch (err) {
    console.error(err);
  }
};
