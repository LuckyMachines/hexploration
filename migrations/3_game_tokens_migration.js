const DayNightTokens = artifacts.require("DayNight");
const DisasterTokens = artifacts.require("Disaster");
const EnemyTokens = artifacts.require("Enemy");
const ItemTokens = artifacts.require("Item");
const PlayerStatusTokens = artifacts.require("PlayerStatus");

module.exports = async (deployer, network, [defaultAccount]) => {
  const HexplorationControllerAddress = network.startsWith("ganache")
    ? "0x8137A825fC2e6Dd9E09e900698f866c185Be988A"
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

  if (network.startsWith("ganache")) {
    console.log(`
  GANACHE_DAY_NIGHT_TOKEN: "${DayNightTokens.address}",
  GANACHE_DISASTER_TOKEN: "${DisasterTokens.address}",
  GANACHE_ENEMY_TOKEN: "${EnemyTokens.address}",
  GANACHE_ITEM_TOKEN: "${ItemTokens.address}",
  GANACHE_PLAYER_STATUS_TOKEN: "${PlayerStatusTokens.address}"`);
  }
};
