// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./GameToken.sol";

contract Artifact is GameToken {
    constructor(address controllerAddress) GameToken(controllerAddress) {
        string[] memory tokenTypes = new string[](6);
        tokenTypes[0] = "Engraved Tabled";
        tokenTypes[1] = "Sigil Gem";
        tokenTypes[2] = "Ancient Tome";
        addTokenTypes(tokenTypes);
    }
}
