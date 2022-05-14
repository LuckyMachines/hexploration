// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/custom_boards/HexGrid.sol";
import "./HexplorationZone.sol";

contract HexplorationBoard is HexGrid {
    // This role is a hybrid controller, assumes on chain verification of moves before submission

    uint256 private _randomness;

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

    function hexZoneAddress() public view returns (address) {
        return address(HEX_ZONE);
    }

    // VERIFIED CONTROLLER functions
    // We can assume these have been pre-verified

    function lockRegistration(uint256 gameID)
        public
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        PLAYER_REGISTRY.lockRegistration(gameID);
    }

    function enterPlayer(
        address playerAddress,
        uint256 gameID,
        string memory zone
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        HEX_ZONE.enterPlayer(playerAddress, gameID, zone);
    }

    function exitPlayer(
        address playerAddress,
        uint256 gameID,
        string memory zone
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        HEX_ZONE.exitPlayer(playerAddress, gameID, zone);
    }

    function requestNewGame(address gameRegistryAddress)
        external
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        GameRegistry(gameRegistryAddress).registerGame();
    }

    function setGameState(uint256 gs, uint256 gameID)
        external
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        // 0 start
        // 1 inititalizing
        // 2 initialized
        gameState[gameID] = gs;
    }

    function setRandomness(uint256 randomness)
        external
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        _randomness = randomness;
    }

    function start(uint256 gameID) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        _gamesNeedUpdates.push(gameID);
    }

    function enableZone(
        string memory zoneAlias,
        HexplorationZone.Tile tile,
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        if (!zoneEnabled[gameID][zoneAlias]) {
            HEX_ZONE.setTile(tile, gameID, zoneAlias);
            zoneEnabled[gameID][zoneAlias] = true;
        }
    }

    // pass path and what tiles should be
    function moveThroughPath(
        string[] memory zonePath,
        address playerAddress,
        uint256 gameID,
        HexplorationZone.Tile[] memory tiles
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        HEX_ZONE.exitPlayer(playerAddress, gameID, zonePath[0]);
        HEX_ZONE.enterPlayer(
            playerAddress,
            gameID,
            zonePath[zonePath.length - 1]
        );
        for (uint256 i = 0; i < zonePath.length; i++) {
            enableZone(zonePath[i], tiles[i], gameID);
        }
    }
}
