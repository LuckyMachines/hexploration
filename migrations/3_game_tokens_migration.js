const DayNightTokens = artifacts.require("DayNight");
const DisasterTokens = artifacts.require("Disaster");
const EnemyTokens = artifacts.require("Enemy");
const ItemTokens = artifacts.require("Item");
const PlayerStatusTokens = artifacts.require("PlayerStatus");
const Controller = artifacts.require("HexplorationController");

module.exports = async (deployer, network, [defaultAccount]) => {
  const hexplorationControllerAddress = network.startsWith("ganache")
    ? "0x80a9F7Dc8D7b31FeC08e8ED328AD63d6b48a2606"
    : "0x0000000000000000000000000000000000000000";
  console.log("Controller address set to:", hexplorationControllerAddress);
  console.log("Deploying Day Night Tokens");
  try {
    await deployer.deploy(DayNightTokens, hexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Disaster Tokens");
  try {
    await deployer.deploy(DisasterTokens, hexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Enemy Tokens");
  try {
    await deployer.deploy(EnemyTokens, hexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Item Tokens");
  try {
    await deployer.deploy(ItemTokens, hexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Player Status Tokens");
  try {
    await deployer.deploy(PlayerStatusTokens, hexplorationControllerAddress);
  } catch (err) {
    console.error(err);
  }

  console.log("Adding tokens to controller");
  try {
    let hexController = await Controller.at(hexplorationControllerAddress);
    await hexController.setTokenAddresses(
      DayNightTokens.address,
      DisasterTokens.address,
      EnemyTokens.address,
      ItemTokens.address,
      PlayerStatusTokens.address
    );
    console.log("tokens added to contoller:", hexplorationControllerAddress);
  } catch (err) {
    console.log(err.message);
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
