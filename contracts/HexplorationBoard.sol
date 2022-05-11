// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/custom_boards/HexGrid.sol";
import "./HexplorationZone.sol";

contract HexplorationBoard is HexGrid {
    // This role is a hybrid controller, assumes on chain verification of moves before submission

    HexplorationZone internal HEX_ZONE;
    // game ID => zone alias returns bool
    mapping(uint256 => mapping(string => bool)) public zoneEnabled;

    constructor(
        address adminAddress,
        uint256 gridWidth,
        uint256 gridHeight,
        address zoneAddress
    ) HexGrid(adminAddress, gridWidth, gridHeight, zoneAddress) {
        HEX_ZONE = HexplorationZone(zoneAddress);
    }

    // TODO: figure out who should call this, might be VRF function...
    function enableZone(
        string memory zoneAlias,
        HexplorationZone.Tile tile,
        uint256 gameID
    ) public {
        HEX_ZONE.setTile(tile, gameID, zoneAlias);
        zoneEnabled[gameID][zoneAlias] = true;
    }

    // VERIFIED CONTROLLER functions
    // We can assume these have been pre-verified
    function moveThroughPath(string[] memory zonePath, uint256 gameID)
        external
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {}
}
