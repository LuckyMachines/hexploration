// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./GameToken.sol";

contract PlayerStatus is GameToken {
    constructor(address controllerAddress) GameToken(controllerAddress) {
        string[] memory tokenTypes = new string[](2);
        tokenTypes[0] = "Stunned";
        tokenTypes[1] = "Burned";
        addTokenTypes(tokenTypes);
    }
}
