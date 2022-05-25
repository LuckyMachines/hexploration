// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract CardDeck is AccessControlEnumerable {
    // This is an infinite deck, cards drawn are not removed from deck
    // We can set card "quantities" for desireable probability

    // controller role should be set to a controller contract
    // not used by default, provided if going to make custom deck with limited access
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    string[] _cards;

    // mappings from card name
    mapping(string => string) public description;
    mapping(string => uint16) public quantity;
    mapping(string => int8) public movementAdjust;
    mapping(string => int8) public agilityAdjust;
    mapping(string => int8) public dexterityAdjust;
    mapping(string => string) public itemGain;
    mapping(string => string) public itemLoss;
    mapping(string => string) public handLoss;
    mapping(string => int256) public movementX;
    mapping(string => int256) public movementY;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function addCards(
        string[] memory titles,
        string[] memory descriptions,
        uint16[] memory quantities
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            titles.length == descriptions.length &&
                titles.length == quantities.length,
            "array quantity mismatch"
        );
        for (uint256 i = 0; i < titles.length; i++) {
            // only add if not already added and set quantity is not 0
            string memory title = titles[i];
            if (quantity[title] == 0 && quantities[i] != 0) {
                _cards.push(title);
                description[title] = descriptions[i];
                quantity[title] = quantities[i];
            }
        }
    }

    // this function does not provide randomness,
    // passing the same random word will yield the same draw.
    // randomness should come from controller
    function drawCard(uint256 randomWord)
        public
        view
        virtual
        returns (
            string memory,
            int8,
            int8,
            int8,
            string memory,
            string memory,
            string memory,
            int256,
            int256
        )
    {
        uint256 cardIndex = randomWord % _cards.length;
        string memory card = _cards[cardIndex];
        return (
            card,
            movementAdjust[card],
            agilityAdjust[card],
            dexterityAdjust[card],
            itemLoss[card],
            itemGain[card],
            handLoss[card],
            movementX[card],
            movementY[card]
        );
    }

    function getDeck() public view returns (string[] memory) {
        return _cards;
    }
}
