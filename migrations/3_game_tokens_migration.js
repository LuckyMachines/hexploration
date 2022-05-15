const DayNightTokens = artifacts.require("DayNight");
const DisasterTokens = artifacts.require("Disaster");
const EnemyTokens = artifacts.require("Enemy");
const ItemTokens = artifacts.require("Item");
const PlayerStatusTokens = artifacts.require("PlayerStatus");
const Controller = artifacts.require("HexplorationController");

module.exports = async (deployer, network, [defaultAccount]) => {
  const HEXPLORATION_CONTROLLER_ADDRESS = network.startsWith("ganache")
    ? "0x9a2cE5A8F4F85238CcE3D799a5aAE18A71915326"
    : "0x0000000000000000000000000000000000000000";
  console.log("Controller address set to:", HEXPLORATION_CONTROLLER_ADDRESS);
  console.log("Deploying Day Night Tokens");
  try {
    await deployer.deploy(DayNightTokens, HEXPLORATION_CONTROLLER_ADDRESS);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Disaster Tokens");
  try {
    await deployer.deploy(DisasterTokens, HEXPLORATION_CONTROLLER_ADDRESS);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Enemy Tokens");
  try {
    await deployer.deploy(EnemyTokens, HEXPLORATION_CONTROLLER_ADDRESS);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Item Tokens");
  try {
    await deployer.deploy(ItemTokens, HEXPLORATION_CONTROLLER_ADDRESS);
  } catch (err) {
    console.error(err);
  }

  console.log("Deploying Player Status Tokens");
  try {
    await deployer.deploy(PlayerStatusTokens, HEXPLORATION_CONTROLLER_ADDRESS);
  } catch (err) {
    console.error(err);
  }

  console.log("Adding tokens to controller");
  try {
    let hexController = await Controller.at(HEXPLORATION_CONTROLLER_ADDRESS);
    await hexController.setTokenAddresses(
      DayNightTokens.address,
      DisasterTokens.address,
      EnemyTokens.address,
      ItemTokens.address,
      PlayerStatusTokens.address
    );
    console.log("tokens added to contoller:", HEXPLORATION_CONTROLLER_ADDRESS);
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
