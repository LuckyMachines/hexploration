// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./ItemDeck.sol";

contract LandDeck is ItemDeck {
    string public constant card0 = "Plains";
    string public constant card1 = "Jungle";
    string public constant card2 = "Mountain";
    string public constant card3 = "Desert";
    string public constant card4 = "Landing Site";

    constructor() ItemDeck() {
        string[] memory cards = new string[](5);
        string[] memory descriptions = new string[](5);
        uint16[] memory quantities = new uint16[](5);

        cards[0] = card0;
        descriptions[0] = "";
        quantities[0] = 1;

        cards[1] = card1;
        descriptions[1] = "";
        quantities[1] = 1;

        cards[2] = card2;
        descriptions[2] = "";
        quantities[2] = 1;

        cards[3] = card3;
        descriptions[3] = "";
        quantities[3] = 1;

        cards[4] = card4;
        descriptions[4] = "";
        quantities[4] = 1;

        addCards(cards, descriptions, quantities);
    }
}
