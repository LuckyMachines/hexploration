// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./GameToken.sol";

contract Relic is GameToken {
    constructor(address controllerAddress) GameToken(controllerAddress) {
        string[] memory tokenTypes = new string[](6);
        tokenTypes[0] = "Relic 1";
        tokenTypes[1] = "Relic 2";
        tokenTypes[2] = "Relic 3";
        tokenTypes[3] = "Relic 4";
        tokenTypes[4] = "Relic 5";
        addTokenTypes(tokenTypes);
    }
}
