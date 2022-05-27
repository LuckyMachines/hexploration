const EventDeck = artifacts.require("EventDeck");
const AmbushDeck = artifacts.require("AmbushDeck");
const LandDeck = artifacts.require("LandDeck");
const TreasureDeck = artifacts.require("TreasureDeck");

require("dotenv").config();

module.exports = async (deployer, network, [defaultAccount]) => {
  console.log("Deploying Treasure Deck");
  try {
    await deployer.deploy(TreasureDeck);
  } catch (err) {
    console.error(err);
  }

  if (network.startsWith("ganache"))
    console.log(`
  GANACHE_AMBUSH_DECK: "${AmbushDeck.address}",
  GANACHE_EVENT_DECK: "${EventDeck.address}",
  GANACHE_LAND_DECK: "${LandDeck.address}",
  GANACHE_TREASURE_DECK: "${TreasureDeck.address}"`);
};
