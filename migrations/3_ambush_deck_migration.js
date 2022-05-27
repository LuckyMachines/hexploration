const EventDeck = artifacts.require("EventDeck");
const AmbushDeck = artifacts.require("AmbushDeck");
const LandDeck = artifacts.require("LandDeck");
const TreasureDeck = artifacts.require("TreasureDeck");

require("dotenv").config();

module.exports = async (deployer, network, [defaultAccount]) => {
  console.log("Deploying Ambush Deck");
  try {
    await deployer.deploy(AmbushDeck);
  } catch (err) {
    console.error(err);
  }
};
