// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./GameToken.sol";

contract Item is GameToken {
    constructor(address controllerAddress) GameToken(controllerAddress) {
        string[] memory tokenTypes = new string[](7);
        tokenTypes[0] = "Small Ammo";
        tokenTypes[1] = "Large Ammo";
        tokenTypes[2] = "Batteries";
        tokenTypes[3] = "Shield";
        tokenTypes[4] = "Portal";
        tokenTypes[5] = "On";
        tokenTypes[6] = "Off";
        addTokenTypes(tokenTypes);
    }
}
