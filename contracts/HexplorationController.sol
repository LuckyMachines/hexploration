// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/GameController.sol";
import "./HexplorationBoard.sol";
import "./HexplorationZone.sol";
import "./state/CharacterCard.sol";
// Game Tokens
import "./tokens/DayNight.sol";
import "./tokens/Disaster.sol";
import "./tokens/Enemy.sol";
import "./tokens/Item.sol";
import "./tokens/PlayerStatus.sol";

contract HexplorationController is GameController {
    // functions are meant to be called directly by players by default
    // we are adding the ability of a Controller Admin or Keeper to
    // execute the game aspects not directly controlled by players
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    DayNight internal DAY_NIGHT_TOKEN;
    Disaster internal DISASTER_TOKEN;
    Enemy internal ENEMY_TOKEN;
    Item internal ITEM_TOKEN;
    PlayerStatus internal PLAYER_STATUS_TOKEN;

    // TODO:
    // Connect to Chainlink VRF for random seeds when needed
    // submit move + space choice
    // use / swap item

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
        uint256 fromPlayerID,
        uint256 toPlayerID,
        uint256 quantity
    )
*/
    modifier onlyAdminKeeper() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
                hasRole(KEEPER_ROLE, _msgSender()),
            "Admin or Keeper role required"
        );
        _;
    }

    constructor(address adminAddress) GameController(adminAddress) {}

    // Admin Functions
    function setTokenAddresses(
        address dayNightAddress,
        address disasterAddress,
        address enemyAddress,
        address itemAddress,
        address playerStatusAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        DAY_NIGHT_TOKEN = DayNight(dayNightAddress);
        DISASTER_TOKEN = Disaster(disasterAddress);
        ENEMY_TOKEN = Enemy(enemyAddress);
        ITEM_TOKEN = Item(itemAddress);
        PLAYER_STATUS_TOKEN = PlayerStatus(playerStatusAddress);
    }

    function addKeeper(address keeperAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(KEEPER_ROLE, keeperAddress);
    }

    // Admin or Keeper Interactions
    function runBoardUpdate(address boardAddress) public {
        HexplorationBoard(boardAddress).runUpdate();
    }

    function startGame(uint256 gameID, address boardAddress) public {
        HexplorationBoard board = HexplorationBoard(boardAddress);
        require(board.gameState(gameID) == 0, "game already started");

        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        board.lockRegistration(gameID);
        uint256 totalRegistrations = pr.totalRegistrations(gameID);
        string memory startZone = board.initialPlayZone(gameID);
        for (uint256 i = 0; i < totalRegistrations; i++) {
            address playerAddress = pr.playerAddress(gameID, i + 1);
            board.enterPlayer(playerAddress, gameID, startZone);
        }
        // set game to initialized
        board.setGameState(2, gameID);

        // mint game tokens (maybe mint on demand instead...)
        // minting full game set here
        DAY_NIGHT_TOKEN.mint("Day", gameID, 1);
        DAY_NIGHT_TOKEN.mint("Night", gameID, 1);
        DISASTER_TOKEN.mint("Earthquake", gameID, 1000);
        DISASTER_TOKEN.mint("Volcano", gameID, 1000);
        ENEMY_TOKEN.mint("Pirate", gameID, 1000);
        ENEMY_TOKEN.mint("Pirate Ship", gameID, 1000);
        ENEMY_TOKEN.mint("Deathbot", gameID, 1000);
        ENEMY_TOKEN.mint("Guardian", gameID, 1000);
        ENEMY_TOKEN.mint("Sandworm", gameID, 1000);
        ENEMY_TOKEN.mint("Dragon", gameID, 1000);
        ITEM_TOKEN.mint("Small Ammo", gameID, 1000);
        ITEM_TOKEN.mint("Large Ammo", gameID, 1000);
        ITEM_TOKEN.mint("Batteries", gameID, 1000);
        ITEM_TOKEN.mint("Shield", gameID, 1000);
        ITEM_TOKEN.mint("Portal", gameID, 1000);
        ITEM_TOKEN.mint("On", gameID, 1000);
        ITEM_TOKEN.mint("Off", gameID, 1000);
        PLAYER_STATUS_TOKEN.mint("Stunned", gameID, 1000);
        PLAYER_STATUS_TOKEN.mint("Burned", gameID, 1000);
        // Transfer day token to board
        DAY_NIGHT_TOKEN.transfer("Day", gameID, 0, 1, 1);
    }

    //Player Interactions
    function registerForGame(uint256 gameID, address boardAddress) public {
        HexplorationBoard board = HexplorationBoard(boardAddress);
        board.registerPlayer(msg.sender, gameID);
        CharacterCard(board.characterCardAddress()).setStats(
            [4, 4, 4],
            gameID,
            msg.sender
        );
    }

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
        // TODO: decide if this is done by a leader or automatically
        // game will begin and registration locked after this...
        HexplorationBoard board = HexplorationBoard(boardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        require(pr.isRegistered(gameID, msg.sender), "player not registered");

        board.enableZone(zoneChoice, HexplorationZone.Tile.LandingSite, gameID);
        // set landing site at space on board
        board.setInitialPlayZone(zoneChoice, gameID);
    }

    // TODO: limit this to authorized game starters
    function requestNewGame(address gameRegistryAddress, address boardAddress)
        public
    {
        HexplorationBoard board = HexplorationBoard(boardAddress);
        board.requestNewGame(gameRegistryAddress);
    }

    function latestGame(address gameRegistryAddress, address boardAddress)
        public
        view
        returns (uint256)
    {
        return GameRegistry(gameRegistryAddress).latestGame(boardAddress);
    }
}
