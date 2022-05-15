// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./GameToken.sol";

contract Item is GameToken {
    constructor(address controllerAddress) GameToken(controllerAddress) {
        string[] memory tokenTypes = new string[](34);
        tokenTypes[0] = "Small Ammo";
        tokenTypes[1] = "Large Ammo";
        tokenTypes[2] = "Batteries";
        tokenTypes[3] = "Shield";
        tokenTypes[4] = "Portal";
        tokenTypes[5] = "On";
        tokenTypes[6] = "Off";
        tokenTypes[7] = "Rusty Dagger";
        tokenTypes[8] = "Rusty Sword";
        tokenTypes[9] = "Rusty Pistol";
        tokenTypes[10] = "Rusty Rifle";
        tokenTypes[11] = "Shiny Dagger";
        tokenTypes[12] = "Shiny Sword";
        tokenTypes[13] = "Shiny Pistol";
        tokenTypes[14] = "Shiny Rifle";
        tokenTypes[15] = "Laser Dagger";
        tokenTypes[16] = "Laser Sword";
        tokenTypes[17] = "Laser Pistol";
        tokenTypes[18] = "Laser Rifle";
        tokenTypes[19] = "Glow stick";
        tokenTypes[20] = "Flashlight";
        tokenTypes[21] = "Flood light";
        tokenTypes[22] = "Nightvision Goggles";
        tokenTypes[23] = "Personal Shield";
        tokenTypes[24] = "Bubble Shield";
        tokenTypes[25] = "Frag Grenade";
        tokenTypes[26] = "Fire Grenade";
        tokenTypes[27] = "Shock Grenade";
        tokenTypes[28] = "HE Mortar";
        tokenTypes[29] = "Incendiary Mortar";
        tokenTypes[30] = "EMP Mortar";
        tokenTypes[31] = "Power Glove";
        tokenTypes[32] = "Remote Launch and Guidance System";
        tokenTypes[33] = "Teleporter Pack";
        addTokenTypes(tokenTypes);
    }
}
