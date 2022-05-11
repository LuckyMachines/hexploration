// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./CardDeck.sol";

contract AmbushDeck is CardDeck {
    constructor() CardDeck() {
        string[] memory cards = new string[](24);
        string[] memory descriptions = new string[](24);
        uint16[] memory quantities = new uint16[](24);

        cards[0] = "";
        descriptions[0] = "";
        quantities[0] = 1;

        cards[1] = "";
        descriptions[1] = "";
        quantities[1] = 1;

        cards[2] = "";
        descriptions[2] = "";
        quantities[2] = 1;

        cards[3] = "";
        descriptions[3] = "";
        quantities[3] = 1;

        cards[4] = "";
        descriptions[4] = "";
        quantities[4] = 1;

        cards[5] = "";
        descriptions[5] = "";
        quantities[5] = 1;

        cards[6] = "";
        descriptions[6] = "";
        quantities[6] = 1;

        cards[7] = "";
        descriptions[7] = "";
        quantities[7] = 1;

        cards[8] = "";
        descriptions[8] = "";
        quantities[8] = 1;

        cards[9] = "";
        descriptions[9] = "";
        quantities[9] = 1;

        cards[10] = "";
        descriptions[10] = "";
        quantities[10] = 1;

        cards[11] = "";
        descriptions[11] = "";
        quantities[11] = 1;

        cards[12] = "";
        descriptions[12] = "";
        quantities[12] = 1;

        cards[13] = "";
        descriptions[13] = "";
        quantities[13] = 1;

        cards[14] = "";
        descriptions[14] = "";
        quantities[14] = 1;

        cards[15] = "";
        descriptions[15] = "";
        quantities[15] = 1;

        cards[16] = "";
        descriptions[16] = "";
        quantities[16] = 1;

        cards[17] = "";
        descriptions[17] = "";
        quantities[17] = 1;

        cards[18] = "";
        descriptions[18] = "";
        quantities[18] = 1;

        cards[19] = "";
        descriptions[19] = "";
        quantities[19] = 1;

        cards[20] = "";
        descriptions[20] = "";
        quantities[20] = 1;

        cards[21] = "";
        descriptions[21] = "";
        quantities[21] = 1;

        cards[22] = "";
        descriptions[22] = "";
        quantities[22] = 1;

        cards[23] = "";
        descriptions[23] = "";
        quantities[23] = 1;

        addCards(cards, descriptions, quantities);
    }
}
