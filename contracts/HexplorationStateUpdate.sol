// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

// TODO: start using this for state updating outside of controller
// Controller should only be used by users / UI directly sending
// commands. This does things that can only imagine...

// This should be only associated with one board...

import "@luckymachines/game-core/contracts/src/v0.0/GameController.sol";
import "./HexplorationBoard.sol";

contract HexplorationStateUpdate is AccessControlEnumerable {
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");
    /*
    Controller can access all game tokens with the following methods:

    function mint(
        string memory tokenType,
        uint256 gameID,
        uint256 quantity
    )

    function transfer(
        string memory tokenType,
        uint256 gameID,
        uint256 fromID,
        uint256 toID,
        uint256 quantity
    )
*/
    HexplorationBoard internal GAME_BOARD;
    modifier onlyAdminVC() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
                hasRole(VERIFIED_CONTROLLER_ROLE, _msgSender()),
            "Admin or Keeper role required"
        );
        _;
    }

    constructor(address gameBoardAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        GAME_BOARD = HexplorationBoard(gameBoardAddress);
    }

    // Admin Functions

    function addVerifiedController(address vcAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    function postUpdates(
        uint256[] memory intUpdates,
        string[] memory stringUpdates,
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // go through values and post everything, transfer all the tokens, and pray
        // use gamestate update contract to post everything
        updatePlayerPositions(intUpdates, stringUpdates, gameID);
        updatePlayerStats(intUpdates, stringUpdates, gameID);
        updatePlayerHands(intUpdates, stringUpdates, gameID);
        transferPlayerItems(intUpdates, stringUpdates, gameID);
        transferZoneItems(intUpdates, stringUpdates, gameID);
    }

    function updatePlayerPositions(
        uint256[] memory intUpdates,
        string[] memory stringUpdates,
        uint256 gameID
    ) internal {
        // total positions = intUpdates[0]
        //test moving a player...
        // string[] memory movementPath = new string[](3);
        // movementPath[0] = "1,4";
        // movementPath[1] = "2,4";
        // movementPath[2] = "3,5";
        // moveThroughPath(movementPath, gameID, 1);
        for (uint256 i = 0; i < intUpdates[0]; i++) {
            uint256 spacesToMove = intUpdates[(i * 2) + 6];
            string[] memory path = new string[](spacesToMove);
            for (uint256 j = 0; j < spacesToMove; j++) {
                path[j] = stringUpdates[(i * 6) + 1 + j];
            }
            moveThroughPath(path, gameID, intUpdates[(i * 2) + 5]);
        }
    }

    function updatePlayerStats(
        uint256[] memory intUpdates,
        string[] memory stringUpdates,
        uint256 gameID
    ) internal {}

    function updatePlayerHands(
        uint256[] memory intUpdates,
        string[] memory stringUpdates,
        uint256 gameID
    ) internal {}

    function transferPlayerItems(
        uint256[] memory intUpdates,
        string[] memory stringUpdates,
        uint256 gameID
    ) internal {}

    function transferZoneItems(
        uint256[] memory intUpdates,
        string[] memory stringUpdates,
        uint256 gameID
    ) internal {}

    function moveThroughPath(
        string[] memory zonePath,
        uint256 gameID,
        uint256 playerID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        //TODO: pick tiles from deck

        HexplorationZone.Tile[] memory tiles = new HexplorationZone.Tile[](
            zonePath.length
        );
        for (uint256 i = 0; i < zonePath.length; i++) {
            tiles[i] = i == 0 ? HexplorationZone.Tile.Jungle : i == 1
                ? HexplorationZone.Tile.Plains
                : HexplorationZone.Tile.Mountain;
        }

        GAME_BOARD.moveThroughPath(zonePath, playerID, gameID, tiles);
    }
}
