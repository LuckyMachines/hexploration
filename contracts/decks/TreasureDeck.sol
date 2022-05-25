// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./CardDeck.sol";

contract TreasureDeck is CardDeck {
    constructor() CardDeck() {
        string[] memory cards = new string[](10);
        string[] memory descriptions = new string[](10);
        uint16[] memory quantities = new uint16[](10);

        cards[0] = "Rusty Dagger";
        descriptions[0] = "A short, pitted, unassuming blade. ";
        quantities[0] = 1;
        itemGain[cards[0]][2] = cards[0];

        cards[1] = "Rusty Pistol";
        descriptions[1] = "Small caliber, rusted firearm.";
        quantities[1] = 1;
        itemGain[cards[1]][2] = cards[1];

        cards[2] = "Shiny Dagger";
        descriptions[2] = "A short blade in great condition.";
        quantities[2] = 1;
        itemGain[cards[2]][2] = cards[2];

        cards[3] = "Shiny Pistol";
        descriptions[3] = "Small caliber firearm in great condition.";
        quantities[3] = 1;
        itemGain[cards[3]][2] = cards[3];

        cards[4] = "Laser Dagger";
        descriptions[4] = "A small blade made of pure light.";
        quantities[4] = 1;
        itemGain[cards[4]][2] = cards[4];

        cards[5] = "Laser Pistol";
        descriptions[5] = "Small caliber firearm that shoot bolts of light.";
        quantities[5] = 1;
        itemGain[cards[5]][2] = cards[5];

        cards[6] = "Power Glove";
        descriptions[
            6
        ] = "Powerful gauntlet that gives you incredible strength at the cost of dexterity.";
        quantities[6] = 1;
        itemGain[cards[6]][2] = cards[6];

        cards[7] = "Engraved Tablet";
        descriptions[
            7
        ] = "Artifact - The engravings on this tablet seem to document the Great Misfortune. Who authored this tablet? Perhaps the Scientists will be able to figure it out.";
        quantities[7] = 1;
        itemGain[cards[7]][2] = cards[7];
        outcomeDescription[cards[7]][2] = "Artifact";

        cards[8] = "Sigil Gem";
        descriptions[
            8
        ] = "Artifact - This gem has markings that indicate it may have been used for some powerful ritual. The Scientists will need to study it and see what power lies within.";
        quantities[8] = 1;
        itemGain[cards[8]][2] = cards[8];
        outcomeDescription[cards[7]][2] = "Artifact";

        cards[9] = "Ancient Tome";
        descriptions[
            9
        ] = "Artifact - This book contains several incantations in a language you cannot understand. If the Scientists can decipher it we may yet learn it's purpose.";
        quantities[9] = 1;
        itemGain[cards[9]][2] = cards[9];
        outcomeDescription[cards[9]][2] = "Artifact";

        // cards[1] = "Rusty Sword";
        // descriptions[1] = "A long, pitted, battered blade.";
        // quantities[1] = 1;

        // cards[3] = "Rusty Rifle";
        // descriptions[3] = "Large caliber, rusted firearm.";
        // quantities[3] = 1;

        // cards[5] = "Shiny Sword";
        // descriptions[5] = "A long blade in great condition.";
        // quantities[5] = 1;

        // cards[7] = "Shiny Rifle";
        // descriptions[7] = "Large caliber firearm in great condition.";
        // quantities[7] = 1;

        // cards[9] = "Laser Sword";
        // descriptions[9] = "A long blade made of pure light.";
        // quantities[9] = 1;

        // cards[11] = "Laser Rifle";
        // descriptions[11] = "Large caliber firearm that shoot bolts of light.";
        // quantities[11] = 1;

        // cards[12] = "Glow stick";
        // descriptions[12] = "A small tube of florescent liquid.";
        // quantities[12] = 1;

        // cards[13] = "Flashlight";
        // descriptions[13] = "A small light source.";
        // quantities[13] = 1;

        // cards[14] = "Flood light";
        // descriptions[14] = "A large light source.";
        // quantities[14] = 1;

        // cards[15] = "Nightvision Goggles";
        // descriptions[15] = "The ability to see at night.";
        // quantities[15] = 1;

        // cards[16] = "Personal Shield";
        // descriptions[
        //     16
        // ] = "A small short range sheild that would only protect your body.";
        // quantities[16] = 1;

        // cards[17] = "Bubble Shield";
        // descriptions[17] = "A large force field that can protect a large area.";
        // quantities[17] = 1;

        // cards[18] = "Frag Grenade";
        // descriptions[18] = "Small explosive grenade.";
        // quantities[18] = 1;

        // cards[19] = "Fire Grenade";
        // descriptions[19] = "Small incendiary grenade.";
        // quantities[19] = 1;

        // cards[20] = "Shock Grenade";
        // descriptions[20] = "Small emp grenade.";
        // quantities[20] = 1;

        // cards[21] = "HE Mortar";
        // descriptions[21] = "Portable HE launcher.";
        // quantities[21] = 1;

        // cards[22] = "Incendiary Mortar";
        // descriptions[22] = "Portable Incendiary launcher.";
        // quantities[22] = 1;

        // cards[23] = "EMP Mortar";
        // descriptions[23] = "Portable EMP launcher.";
        // quantities[23] = 1;

        // cards[25] = "Remote Launch and Guidance System";
        // descriptions[
        //     25
        // ] = "Grants the ability to safely launch the Ship off world without any players onboard.";
        // quantities[25] = 1;

        // cards[26] = "Teleporter Pack";
        // descriptions[
        //     26
        // ] = "Grants the ability to teleport all players on a tile to any other tile.";
        // quantities[26] = 1;

        addCards(cards, descriptions, quantities);
    }
}
