// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./GameToken.sol";

contract Disaster is GameToken {
    constructor(address controllerAddress) GameToken(controllerAddress) {
        string[] memory tokenTypes = new string[](2);
        tokenTypes[0] = "Earthquake";
        tokenTypes[1] = "Volcano";
        addTokenTypes(tokenTypes);
    }
}
