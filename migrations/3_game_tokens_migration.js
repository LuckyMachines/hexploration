const DayNightTokens = artifacts.require("DayNight");
const DisasterTokens = artifacts.require("Disaster");
const EnemyTokens = artifacts.require("Enemy");
const ItemTokens = artifacts.require("Item");
const PlayerStatusTokens = artifacts.require("PlayerStatus");

module.exports = async (deployer, network, [defaultAccount]) => {
  const HexplorationControllerAddress = network.startsWith("ganache")
    ? "0xbF542fa921003cE0085cB27E55188e5DF67Aa7Eb"
    : "0x0000000000000000000000000000000000000000";
  console.log("Controller address set to:", HexplorationControllerAddress);
  console.log("Deploying Day Night Tokens");
  try {
    await deployer.deploy(DayNightTokens, HexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Disaster Tokens");
  try {
    await deployer.deploy(DisasterTokens, HexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Enemy Tokens");
  try {
    await deployer.deploy(EnemyTokens, HexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Item Tokens");
  try {
    await deployer.deploy(ItemTokens, HexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Player Status Tokens");
  try {
    await deployer.deploy(PlayerStatusTokens, HexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }
};
