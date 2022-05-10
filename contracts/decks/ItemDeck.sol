// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract ItemDeck is AccessControlEnumerable {
    // This is an infinite deck, cards drawn are not removed from deck
    // We can set card "quantities" for desireable probability

    // controller role should be set to a controller contract
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    constructor() {}

    function drawCard(uint256 randomSeed)
        public
        virtual
        onlyRole(CONTROLLER_ROLE)
    {}

    function getDeck() public view returns (string[] memory) {}
}
