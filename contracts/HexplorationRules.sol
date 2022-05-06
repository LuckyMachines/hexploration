// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/Ruleset.sol";

contract HexplorationZone is Ruleset {
    constructor(address adminAddress, address factoryAddress)
        Ruleset(adminAddress, factoryAddress)
    {
        // comes with default movement between connected zones
        //
        // Rules to add:
        // (will return if moves are possible, then can be written to state)
        //
        // - checks for moving through multiple zones in one transaction
        // - space by space changes if pass-through effects required
        // - all the inventory stuff
        // - submitting choices
        //
        // - can move
        // - override
    }
}
