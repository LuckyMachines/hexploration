// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./CardDeck.sol";

contract EventDeck is CardDeck {
    constructor() CardDeck() {
        string[] memory cards = new string[](4);
        string[] memory descriptions = new string[](4);
        uint16[] memory quantities = new uint16[](4);

        /*
    mapping(string => int8) public movementAdjust;
    mapping(string => int8) public agilityAdjust;
    mapping(string => int8) public dexterityAdjust;
    mapping(string => string) public itemGain;
    mapping(string => string) public itemLoss;
    mapping(string => string) public handLoss;
    mapping(string => int256) public movementX;
    mapping(string => int256) public movementY;
        */

        cards[0] = "Dance Off With Locals";
        descriptions[
            0
        ] = "You discover a friendly group of locals. They challenge you to a dance off.";
        quantities[0] = 1;
        rollTypeRequired[cards[0]] = 1;
        rollThresholds[cards[0]] = [0, 3, 6];
        outcomeDescription[cards[0]] = [
            "You are not impressive",
            "Nice moves!",
            "You're amazing!"
        ];
        agilityAdjust[cards[0]][2] = 1;

        cards[1] = "Local Map Makers";
        descriptions[
            1
        ] = "A friendly group of locals gives you a map of the area.";
        quantities[1] = 1;
        // set description as last element since we loop in reverse
        outcomeDescription[cards[1]][2] = "Reveal tile";

        cards[2] = "Local Martial Contest";
        descriptions[2] = "A friendly local warrior challenges you to spar.";
        quantities[2] = 1;
        rollTypeRequired[cards[2]] = 2;
        rollThresholds[cards[2]] = [0, 3, 5];
        outcomeDescription[cards[2]] = [
            "The warrior beats you easily",
            "A fair test of combat",
            "You defeat the warrior easily"
        ];
        dexterityAdjust[cards[2]][0] = -1;
        dexterityAdjust[cards[2]][2] = 1;

        cards[3] = "Downed Freighter";
        descriptions[
            3
        ] = "You discover a downed freighter and search for supplies.";
        quantities[3] = 1;
        rollTypeRequired[cards[3]] = 2;
        rollThresholds[cards[3]] = [0, 0, 3];
        outcomeDescription[cards[3]][2] = "You find some medical supplies";
        movementAdjust[cards[3]][2] = 1;
        // cards[4] = "Downed Scout Ship";
        // descriptions[
        //     4
        // ] = "You find a crashed scout ship and search the flight logs for map information.";
        // quantities[4] = 1;

        // cards[5] = "Downed Assault Ship";
        // descriptions[
        //     5
        // ] = "Smoke rises from a crashed assault ship. You search the ship and find training modules.";
        // quantities[5] = 1;

        // cards[6] = "Divine Vision";
        // descriptions[
        //     6
        // ] = "You fall to your knees and a vision rushes through your mind. You are soaring above the landscape.";
        // quantities[6] = 1;

        // cards[7] = "Juicy Berries";
        // descriptions[7] = "You stumble across a berry patch.";
        // quantities[7] = 1;

        // cards[8] = "Abandoned Mining Camp";
        // descriptions[
        //     8
        // ] = "You discover an abandoned mining camp and decide to look around to see what you can find.";
        // quantities[8] = 1;

        // cards[9] = "Training Module: Speed";
        // descriptions[9] = "You find a data disk containing training modules.";
        // quantities[9] = 1;

        // cards[10] = "Training Module: Acceleration";
        // descriptions[10] = "You find a data disk containing training modules.";
        // quantities[10] = 1;

        // cards[11] = "Training Module: Handling";
        // descriptions[11] = "You find a data disk containing training modules.";
        // quantities[11] = 1;

        // cards[12] = "Friendly Village";
        // descriptions[
        //     12
        // ] = "You hear the laughter of children playing. As you crest a small hill you find a villiage. The villagers welcome you and offer their tribal medicine.";
        // quantities[12] = 1;

        // cards[13] = "Ancient Quarry";
        // descriptions[
        //     13
        // ] = "Ancient equipment scatters a ravine. Inside you find some supplies.";
        // quantities[13] = 1;

        // cards[14] = "Ancient Watchtower";
        // descriptions[
        //     14
        // ] = "A spire stretches toward the sky. You climb it and can see for miles.";
        // quantities[14] = 1;

        // cards[15] = "Ancient Fortress";
        // descriptions[
        //     15
        // ] = "The remains of a battered stronghold could still be used as a defensive position.";
        // quantities[15] = 1;

        // cards[16] = "Weapons Cache";
        // descriptions[
        //     16
        // ] = "You discover an armored bunker, and attempt to get inside.";
        // quantities[16] = 1;

        // cards[17] = "Mutagens";
        // descriptions[17] = "You find a handful of small glowing syringes.";
        // quantities[17] = 1;

        // cards[18] = "Hot Springs";
        // descriptions[
        //     18
        // ] = "Steam rises from a hidden grotto. The hot springs are calming and healing.";
        // quantities[18] = 1;

        // cards[19] = "Desert Gateway";
        // descriptions[
        //     19
        // ] = "A strange portal opens. You can see the desert on the other side.";
        // quantities[19] = 1;

        // cards[20] = "Jungle Gateway";
        // descriptions[
        //     20
        // ] = "A strange portal opens. You can see the jungle on the other side.";
        // quantities[20] = 1;

        // cards[21] = "Mountain Gateway";
        // descriptions[
        //     21
        // ] = "A strange portal opens. You can see the mountains on the other side.";
        // quantities[21] = 1;

        // cards[22] = "Plains Gateway";
        // descriptions[
        //     22
        // ] = "A strange portal opens. You can see the plains on the other side.";
        // quantities[22] = 1;

        // cards[23] = "Supply Cache";
        // descriptions[23] = "You found some crates full of supplies.";
        // quantities[23] = 1;

        addCards(cards, descriptions, quantities);
    }
}
