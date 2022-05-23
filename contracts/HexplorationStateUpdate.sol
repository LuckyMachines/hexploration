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

        //test moving a player...
        string[] memory movementPath = new string[](4);
        movementPath[0] = "0,0";
        movementPath[0] = "0,1";
        movementPath[0] = "0,2";
        movementPath[0] = "0,3";
        moveThroughPath(
            movementPath,
            gameID,
            0xeF0524118944F9F2f46f708e731F097d8eF0B329
        );
    }

    function moveThroughPath(
        string[] memory zonePath,
        uint256 gameID,
        address playerAddress
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

        GAME_BOARD.moveThroughPath(zonePath, playerAddress, gameID, tiles);
    }
}
