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

    function playerCanEnter(
        address playerAddress,
        uint256 gameID,
        string memory zoneAlias
    ) public view override returns (bool canEnter) {
        super.playerCanExit(playerAddress, gameID, zoneAlias);
    }

    function playerCanExit(
        address playerAddress,
        uint256 gameID,
        string memory zoneAlias
    ) public view override returns (bool canExit) {
        super.playerCanExit(playerAddress, gameID, zoneAlias);
    }

    // Override for custom game
    // function _playerWillEnter(
    //     address playerAddress,
    //     uint256 gameID,
    //     string memory zoneAlias
    // ) internal virtual {}

    // function _playerDidEnter(
    //     address playerAddress,
    //     uint256 gameID,
    //     string memory zoneAlias
    // ) internal virtual {}

    // function _playerWillExit(
    //     address playerAddress,
    //     uint256 gameID,
    //     string memory zoneAlias
    // ) internal virtual {}

    // function _playerDidExit(
    //     address playerAddress,
    //     uint256 gameID,
    //     string memory zoneAlias
    // ) internal virtual {}

    // function _playersWillEnter(
    //     uint256 gameID,
    //     uint256 groupID,
    //     string memory zoneAlias
    // ) internal virtual {
    //     // called when batch of players are being entered from lobby or previous zone
    //     // individual player entries are called from _playerDidEnter
    // }

    // function _allPlayersEntered(
    //     uint256 gameID,
    //     uint256 groupID,
    //     string memory zoneAlias
    // ) internal virtual {
    //     // called after player group has all been entered
    // }

    // function _playerWillBeRemoved(
    //     address playerAddress,
    //     uint256 gameID,
    //     string memory zoneAlias
    // ) internal virtual {}

    // function _playerWasRemoved(
    //     address playerAddress,
    //     uint256 gameID,
    //     string memory zoneAlias
    // ) internal virtual {}

    // function _customAction(
    //     string[] memory stringParams,
    //     address[] memory addressParams,
    //     uint256[] memory uintParams
    // ) internal virtual {
    //     // should definitiely do some checks when implementing this function
    //     // make sure the sender is correct and nothing malicious is going on
    // }
}
