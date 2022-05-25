// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./CardDeck.sol";

contract AmbushDeck is CardDeck {
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

        // TODO:
        // set movement x + movement y for "escape" outcomes
        cards[0] = "Angry Locals";
        descriptions[
            0
        ] = "While exploring you scare away a herd of beasts. The hunters that have been tracking them for days is not happy about this. They attack you.";
        quantities[0] = 1;
        rollThresholds[cards[0]] = [0, 3, 5];
        outcomeDescription[cards[0]] = ["Defeated", "Escape", "Victory"];
        movementAdjust[cards[0]][0] = -1;
        agilityAdjust[cards[0]][0] = -2;

        cards[1] = "Shrieking Beasts";
        descriptions[
            1
        ] = "With a chorus of piercing shrieks, beasts decend upon you. They attack you.";
        quantities[1] = 1;
        rollThresholds[cards[1]] = [0, 3, 5];
        outcomeDescription[cards[1]] = ["Defeated", "Escape", "Victory"];
        dexterityAdjust[cards[1]][0] = -2;
        agilityAdjust[cards[1]][0] = -1;

        cards[2] = "Winged Beasts";
        descriptions[
            2
        ] = "Flying creatures soar above you. They dive out of the sky and attack you.";
        quantities[2] = 1;
        rollThresholds[cards[2]] = [0, 4, 6];
        outcomeDescription[cards[2]] = ["Defeated", "Escape", "Victory"];
        dexterityAdjust[cards[2]][0] = -2;
        movementAdjust[cards[2]][0] = -1;

        cards[3] = "Shadow Creatures";
        descriptions[
            3
        ] = "Shadows move and materialize. This combat is treated as if it is night. If it is already night, increase night penalty by 1.";
        quantities[3] = 1;
        rollThresholds[cards[3]] = [0, 3, 5];
        outcomeDescription[cards[1]] = ["Defeated", "Escape", "Victory"];
        movementAdjust[cards[1]][0] = -3;

        // cards[4] = "Ancient Guardian";
        // descriptions[
        //     4
        // ] = "An ancient guardian awakens and attacks you. You cannot escape.";
        // quantities[4] = 1;

        // cards[5] = "Deathbot Activated";
        // descriptions[
        //     5
        // ] = "The whirring of machinery. Death to organics. A deathbot attacks you.";
        // quantities[5] = 1;

        // cards[6] = "Clumsy Misstep";
        // descriptions[6] = "You lose your footing and drop an item. ";
        // quantities[6] = 1;

        // cards[7] = "Marooned Pirate";
        // descriptions[
        //     7
        // ] = "You trip over what you thought was a dead body. Rather it is a Marauder comfortably sleeping off some space rum. He is not happy about that and attacks you.";
        // quantities[7] = 1;

        // cards[8] = "Flesh Eating Insects";
        // descriptions[8] = "Ouch! You start to feel stings all over your body.";
        // quantities[8] = 1;

        // cards[9] = "Ghastly Apparition";
        // descriptions[
        //     9
        // ] = "A terrifying feeling chills your bones. You don't take the time to find out what it is.";
        // quantities[9] = 1;

        // cards[10] = "Pit of Spikes";
        // descriptions[
        //     10
        // ] = "Before you realize the ground is not solid, you fall into what appears to be an animal trap.";
        // quantities[10] = 1;

        // cards[11] = "Bubbling Ooze";
        // descriptions[11] = "The ground is sticky, you are unable to move.";
        // quantities[11] = 1;

        // cards[12] = "Rock Slide";
        // descriptions[12] = "You hear a rumble, a boulder tumbles toward you.";
        // quantities[12] = 1;

        // cards[13] = "Dark Clouds";
        // descriptions[13] = "The sun is blotted from the sky.";
        // quantities[13] = 1;

        // cards[14] = "Madness";
        // descriptions[
        //     14
        // ] = "You hear voices in your head beckoning you to follow them.";
        // quantities[14] = 1;

        // cards[15] = "Fear";
        // descriptions[15] = "You are suddenly struck with inexplicable terror.";
        // quantities[15] = 1;

        // cards[16] = "Meteorite Strike";
        // descriptions[
        //     16
        // ] = "A streak of fire smashes into the ground at your feet.";
        // quantities[16] = 1;

        // cards[17] = "Cryo Mine";
        // descriptions[
        //     17
        // ] = "As you take a step you hear a click and a beep. Before you can react you hear an explosion.";
        // quantities[17] = 1;

        // cards[18] = "Creeping Vines";
        // descriptions[
        //     18
        // ] = "The vegetation around you seems to come alive. It grasps you tightly.";
        // quantities[18] = 1;

        // cards[19] = "Evil Wizard";
        // descriptions[
        //     19
        // ] = "A flash and a puff of smoke reveals a cackling mage. He casts a fireball at you before disappearing again.";
        // quantities[19] = 1;

        // cards[20] = "Stone Golem";
        // descriptions[
        //     20
        // ] = "A monster made of stone rises from the ground and attacks you.";
        // quantities[20] = 1;

        // cards[21] = "Iron Golem";
        // descriptions[
        //     21
        // ] = "A monster made of iron rises from the ground and attacks you.";
        // quantities[21] = 1;

        // cards[22] = "Tungsten Golem";
        // descriptions[
        //     22
        // ] = "A monster made of tungsten rises from the ground and attacks you.";
        // quantities[22] = 1;

        // cards[23] = "Plasma Golem";
        // descriptions[
        //     23
        // ] = "A monter made of plasma rises from the ground and attacks you.";
        // quantities[23] = 1;

        addCards(cards, descriptions, quantities);
    }
}
