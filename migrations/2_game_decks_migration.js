// Game Decks
const EventDeck = artifacts.require("EventDeck");

require("dotenv").config();

module.exports = async (deployer, network, [defaultAccount]) => {
  console.log("Deploying Event Deck");
  try {
    await deployer.deploy(EventDeck);
  } catch (err) {
    console.error(err);
  }
};
