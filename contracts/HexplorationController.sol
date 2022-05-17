// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/GameController.sol";
import "./HexplorationBoard.sol";
import "./HexplorationZone.sol";
import "./HexplorationQueue.sol";
import "./state/CharacterCard.sol";
import "./tokens/TokenInventory.sol";

contract HexplorationController is GameController {
    // functions are meant to be called directly by players by default
    // we are adding the ability of a Controller Admin or Keeper to
    // execute the game aspects not directly controlled by players
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

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

        TokenInventory ti = TokenInventory(board.tokenInventory());
        // mint game tokens (maybe mint on demand instead...)
        // minting full game set here
        ti.DAY_NIGHT_TOKEN().mint("Day", gameID, 1);
        ti.DAY_NIGHT_TOKEN().mint("Night", gameID, 1);
        ti.DISASTER_TOKEN().mint("Earthquake", gameID, 1000);
        ti.DISASTER_TOKEN().mint("Volcano", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Pirate", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Pirate Ship", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Deathbot", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Guardian", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Sandworm", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Dragon", gameID, 1000);
        ti.ITEM_TOKEN().mint("Small Ammo", gameID, 1000);
        ti.ITEM_TOKEN().mint("Large Ammo", gameID, 1000);
        ti.ITEM_TOKEN().mint("Batteries", gameID, 1000);
        ti.ITEM_TOKEN().mint("Shield", gameID, 1000);
        ti.ITEM_TOKEN().mint("Portal", gameID, 1000);
        ti.ITEM_TOKEN().mint("On", gameID, 1000);
        ti.ITEM_TOKEN().mint("Off", gameID, 1000);
        ti.ITEM_TOKEN().mint("Rusty Dagger", gameID, 1000);
        ti.ITEM_TOKEN().mint("Rusty Sword", gameID, 1000);
        ti.ITEM_TOKEN().mint("Rusty Pistol", gameID, 1000);
        ti.ITEM_TOKEN().mint("Rusty Rifle", gameID, 1000);
        ti.ITEM_TOKEN().mint("Shiny Dagger", gameID, 1000);
        ti.ITEM_TOKEN().mint("Shiny Sword", gameID, 1000);
        ti.ITEM_TOKEN().mint("Shiny Rifle", gameID, 1000);
        ti.ITEM_TOKEN().mint("Laser Dagger", gameID, 1000);
        ti.ITEM_TOKEN().mint("Laser Sword", gameID, 1000);
        ti.ITEM_TOKEN().mint("Laser Pistol", gameID, 1000);
        ti.ITEM_TOKEN().mint("Laser Rifle", gameID, 1000);
        ti.ITEM_TOKEN().mint("Glow stick", gameID, 1000);
        ti.ITEM_TOKEN().mint("Flashlight", gameID, 1000);
        ti.ITEM_TOKEN().mint("Flood light", gameID, 1000);
        ti.ITEM_TOKEN().mint("Nightvision Goggles", gameID, 1000);
        ti.ITEM_TOKEN().mint("Personal Shield", gameID, 1000);
        ti.ITEM_TOKEN().mint("Bubble Shield", gameID, 1000);
        ti.ITEM_TOKEN().mint("Frag Grenade", gameID, 1000);
        ti.ITEM_TOKEN().mint("Fire Grenade", gameID, 1000);
        ti.ITEM_TOKEN().mint("Shock Grenade", gameID, 1000);
        ti.ITEM_TOKEN().mint("HE Mortar", gameID, 1000);
        ti.ITEM_TOKEN().mint("Incendiary Mortar", gameID, 1000);
        ti.ITEM_TOKEN().mint("EMP Mortar", gameID, 1000);
        ti.ITEM_TOKEN().mint("Power Glove", gameID, 1000);
        ti.ITEM_TOKEN().mint("Remote Launch and Guidance System", gameID, 1000);
        ti.ITEM_TOKEN().mint("Teleporter Pack", gameID, 1000);
        ti.ITEM_TOKEN().mint("Campsite", gameID, 1000);
        ti.PLAYER_STATUS_TOKEN().mint("Stunned", gameID, 1000);
        ti.PLAYER_STATUS_TOKEN().mint("Burned", gameID, 1000);
        ti.ARTIFACT_TOKEN().mint("Engraved Tablet", gameID, 1000);
        ti.ARTIFACT_TOKEN().mint("Sigil Gem", gameID, 1000);
        ti.ARTIFACT_TOKEN().mint("Ancient Tome", gameID, 1000);
        ti.RELIC_TOKEN().mint("Relic 1", gameID, 1000);
        ti.RELIC_TOKEN().mint("Relic 2", gameID, 1000);
        ti.RELIC_TOKEN().mint("Relic 3", gameID, 1000);
        ti.RELIC_TOKEN().mint("Relic 4", gameID, 1000);
        ti.RELIC_TOKEN().mint("Relic 5", gameID, 1000);
        // Transfer day token to board
        ti.DAY_NIGHT_TOKEN().transfer("Day", gameID, 0, 1, 1);

        for (uint256 i = 0; i < totalRegistrations; i++) {
            uint256 playerID = i + 1;
            address playerAddress = pr.playerAddress(gameID, playerID);
            board.enterPlayer(playerAddress, gameID, startZone);
            // Transfer campsite tokens to players
            ti.ITEM_TOKEN().transfer("Campsite", gameID, 0, playerID, 1);
        }
        // set game to initialized
        board.setGameState(2, gameID);
    }

    //Player Interactions
    function registerForGame(uint256 gameID, address boardAddress) public {
        HexplorationBoard board = HexplorationBoard(boardAddress);
        board.registerPlayer(msg.sender, gameID);
        CharacterCard(board.characterCard()).setStats(
            [4, 4, 4],
            gameID,
            msg.sender
        );
    }

    function submitAction(
        uint256 gameID,
        uint8 actionIndex,
        uint256 playerID,
        string[] memory options
    ) public {
        // TODO: sumbit to queue
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
        // TODO: must be player 2 or on single player, p1
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
