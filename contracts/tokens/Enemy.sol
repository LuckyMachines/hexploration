// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./GameToken.sol";

contract Enemy is GameToken {
    constructor(address controllerAddress) GameToken(controllerAddress) {
        string[] memory tokenTypes = new string[](6);
        tokenTypes[0] = "Pirate";
        tokenTypes[1] = "Pirate Ship";
        tokenTypes[2] = "Deathbot";
        tokenTypes[3] = "Guardian";
        tokenTypes[4] = "Sandworm";
        tokenTypes[5] = "Dragon";
        addTokenTypes(tokenTypes);
    }
}
