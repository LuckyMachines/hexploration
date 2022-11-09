// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/PlayZone.sol";

contract HexplorationZone is PlayZone {
    enum Tile {
        Default,
        Jungle,
        Plains,
        Desert,
        Mountain,
        LandingSite,
        RelicMystery,
        Relic1,
        Relic2,
        Relic3,
        Relic4,
        Relic5
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

    function playerCanEnter(
        address playerAddress,
        uint256 gameID,
        string memory zoneAlias
    ) public view override returns (bool canEnter) {
        canEnter = super.playerCanEnter(playerAddress, gameID, zoneAlias);
    }

    function playerCanExit(
        address playerAddress,
        uint256 gameID,
        string memory zoneAlias
    ) public view override returns (bool canExit) {
        canExit = super.playerCanExit(playerAddress, gameID, zoneAlias);
    }

    /*
    function _playerDidExit(
        address playerAddress,
        uint256 gameID,
        string memory zoneAlias
    ) internal override {
        // TODO:
        // update player registry with game info so player isn't registered for game anymore
        // this can be called if player credits run out
    }
*/
}
