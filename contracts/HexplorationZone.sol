// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/PlayZone.sol";

contract HexplorationZone is PlayZone {
    enum Tile {
        Default,
        Jungle,
        Plain,
        Desert,
        Mountain,
        Base
    }

    // Mappings from game ID => zone alias
    mapping(uint256 => mapping(string => Tile)) public tile;
    mapping(uint256 => mapping(string => bool)) public tileIsSet;

    constructor(
        address _rulesetAddress,
        address _gameRegistryAddress,
        address adminAddress,
        address factoryAddress
    )
        PlayZone(
            _rulesetAddress,
            _gameRegistryAddress,
            adminAddress,
            factoryAddress
        )
    {}

    function setTile(
        Tile _tile,
        uint256 gameID,
        string memory zoneAlias
    ) public onlyRole(GAME_BOARD_ROLE) {
        tile[gameID][zoneAlias] = _tile;
        tileIsSet[gameID][zoneAlias] = true;
    }
}
