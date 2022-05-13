// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/GameController.sol";
import "./HexplorationBoard.sol";
import "./HexplorationZone.sol";

contract HexplorationController is GameController {
    // functions are meant to be called directly by players by default
    // we are adding the ability of a Controller Admin or Keeper to
    // execute the game aspects not directly controlled by players
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    // TODO:
    // Connect to Chainlink VRF for random seeds when needed
    // submit move + space choice
    // use / swap item

    modifier onlyAdminKeeper() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
                hasRole(KEEPER_ROLE, _msgSender()),
            "Admin or Keeper role required"
        );
        _;
    }

    constructor(address adminAddress) GameController(adminAddress) {}

    function addKeeper(address keeperAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(KEEPER_ROLE, keeperAddress);
    }

    // Admin or Keeper Interactions
    function startGame(uint256 gameID, address boardAddress)
        public
        onlyAdminKeeper
    {
        HexplorationBoard board = HexplorationBoard(boardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());

        // start game init on game board, might not need to do this function...
        // move all registered players to site
    }

    //Player Interactions
    function moveThroughPath(
        string[] memory zonePath,
        uint256 gameID,
        address boardAddress
    ) public {
        // TODO:
        // verify move is valid
        // pick tiles from deck
        HexplorationBoard board = HexplorationBoard(boardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        require(pr.isRegistered(gameID, msg.sender), "player not registered");

        HexplorationZone.Tile[] memory tiles = new HexplorationZone.Tile[](
            zonePath.length
        );
        for (uint256 i = 0; i < zonePath.length; i++) {
            tiles[i] = i == 0 ? HexplorationZone.Tile.Jungle : i == 1
                ? HexplorationZone.Tile.Plains
                : HexplorationZone.Tile.Mountain;
        }

        HexplorationBoard(boardAddress).moveThroughPath(
            zonePath,
            msg.sender,
            gameID,
            tiles
        );
    }

    function chooseLandingSite(
        string memory zoneChoice,
        uint256 gameID,
        address boardAddress
    ) public {
        // TODO: ensure landing site has not been set
        // might make this automatic and not a player choice
        HexplorationBoard board = HexplorationBoard(boardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        require(pr.isRegistered(gameID, msg.sender), "player not registered");

        board.enableZone(zoneChoice, HexplorationZone.Tile.LandingSite, gameID);
        // set landing site at space on board
        board.setInitialPlayZone(zoneChoice, gameID);
        board.start();
        // run loop to continue startup process
    }
}
