// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "forge-std/Script.sol";

// --- game-core ---
import "@luckymachines/game-core/contracts/src/v0.0/GameRegistry.sol";
import "@luckymachines/game-core/contracts/src/v0.0/PlayerRegistry.sol";

// --- hexploration ---
import "../contracts/StringToUint.sol";
import "../contracts/GameToken.sol";
import "../contracts/CardDeck.sol";
import "../contracts/TokenInventory.sol";
import "../contracts/HexplorationRules.sol";
import "../contracts/HexplorationZone.sol";
import "../contracts/HexplorationBoard.sol";
import "../contracts/CharacterCard.sol";
import "../contracts/RollDraw.sol";
import "../contracts/RelicManagement.sol";
import "../contracts/GameEvents.sol";
import "../contracts/GameSetup.sol";
import "../contracts/HexplorationGameplay.sol";
import "../contracts/HexplorationStateUpdate.sol";
import "../contracts/HexplorationQueue.sol";
import "../contracts/HexplorationController.sol";
import "../contracts/GameSummary.sol";
import "../contracts/PlayerSummary.sol";
import "../contracts/PlayZoneSummary.sol";

contract DeployHexploration is Script {
    uint256 constant GRID_WIDTH = 10;
    uint256 constant GRID_HEIGHT = 10;

    // Store all deployed addresses in storage to avoid stack-too-deep
    address public deployer;
    address public s_gameRegistry;
    address public s_stringToUint;
    address public s_dayNight;
    address public s_disaster;
    address public s_enemy;
    address public s_item;
    address public s_playerStatus;
    address public s_relic;
    address public s_tokenInventory;
    address public s_eventDeck;
    address public s_ambushDeck;
    address public s_treasureDeck;
    address public s_landDeck;
    address public s_relicDeck;
    address public s_gameEvents;
    address public s_gameSummary;
    address public s_playZoneSummary;
    address public s_relicManagement;
    address public s_rules;
    address public s_zone;
    address public s_rollDraw;
    address public s_characterCard;
    address public s_board;
    address public s_playerRegistry;
    address public s_stateUpdate;
    address public s_gameplay;
    address payable public s_gameSetup;
    address public s_controller;
    address payable public s_queue;
    address public s_playerSummary;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);

        console.log("=== Hexploration Deployment ===");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        _deployPhase1();
        _deployPhase2();
        _deployPhase3();
        _deployPhase4();
        _deployPhase5();
        _wire();
        _registerTokenTypes();
        HexplorationBoard(s_board).createGrid();

        vm.stopBroadcast();

        _logAddresses();
    }

    // ── Phase 1: Independent contracts ──────────────────────────────

    function _deployPhase1() internal {
        s_gameRegistry = address(new GameRegistry(deployer));
        s_stringToUint = address(new StringToUint());

        s_dayNight = address(new GameToken());
        s_disaster = address(new GameToken());
        s_enemy = address(new GameToken());
        s_item = address(new GameToken());
        s_playerStatus = address(new GameToken());
        s_relic = address(new GameToken());

        s_tokenInventory = address(new TokenInventory());

        s_eventDeck = address(new CardDeck());
        s_ambushDeck = address(new CardDeck());
        s_treasureDeck = address(new CardDeck());
        s_landDeck = address(new CardDeck());
        s_relicDeck = address(new CardDeck());

        s_gameEvents = address(new GameEvents());
        s_gameSummary = address(new GameSummary());
        s_playZoneSummary = address(new PlayZoneSummary());
        s_relicManagement = address(new RelicManagement());
    }

    // ── Phase 2: Single-dependency contracts ────────────────────────

    function _deployPhase2() internal {
        s_rules = address(new HexplorationRules(deployer, deployer));
        s_zone = address(new HexplorationZone(s_rules, s_gameRegistry, deployer, deployer));
        s_rollDraw = address(new RollDraw(s_eventDeck, s_treasureDeck, s_ambushDeck));
        s_characterCard = address(new CharacterCard(s_item, s_relic));
    }

    // ── Phase 3: Board + PlayerRegistry ─────────────────────────────

    function _deployPhase3() internal {
        s_board = address(new HexplorationBoard(deployer, GRID_WIDTH, GRID_HEIGHT, s_zone));
        s_playerRegistry = address(new PlayerRegistry(s_board, deployer));
    }

    // ── Phase 4: Board-dependent contracts ──────────────────────────

    function _deployPhase4() internal {
        s_stateUpdate = address(new HexplorationStateUpdate(s_board, s_characterCard, s_relicManagement));
        s_gameplay = address(new HexplorationGameplay(s_board, s_rollDraw));

        // Mock VRF: subscriptionId=0, keyHash=0 → useMockVRF=true
        s_gameSetup = payable(address(new GameSetup(0, deployer, bytes32(0))));
        s_controller = address(new HexplorationController(deployer));
    }

    // ── Phase 5: Queue (depends on gameplay) ────────────────────────

    function _deployPhase5() internal {
        s_queue = payable(address(new HexplorationQueue(
            s_gameplay, s_characterCard, 0, deployer, bytes32(0)
        )));
        s_playerSummary = address(new PlayerSummary());
    }

    // ── Wiring ──────────────────────────────────────────────────────

    function _wire() internal {
        _wireBoard();
        _wireTokens();
        _wireGameLogic();
        _wireEvents();
        _wireSummary();
    }

    function _wireBoard() internal {
        GameRegistry(s_gameRegistry).addGameBoard(s_board);

        HexplorationBoard board = HexplorationBoard(s_board);
        board.addVerifiedController(s_controller);
        board.addVerifiedController(s_gameplay);
        board.addVerifiedController(s_stateUpdate);
        board.addVerifiedController(s_gameSetup);
        board.addFactory(deployer);
        board.setCharacterCard(s_characterCard);
        board.setTokenInventory(s_tokenInventory);
        board.setGameplayQueue(s_queue);
        board.setPlayerRegistry(s_playerRegistry);

        HexplorationZone(s_zone).addGameBoard(s_board);
    }

    function _wireTokens() internal {
        TokenInventory(s_tokenInventory).setTokenAddresses(
            s_dayNight, s_disaster, s_enemy, s_item, s_playerStatus, s_relic
        );

        GameToken(s_dayNight).addController(s_tokenInventory);
        GameToken(s_disaster).addController(s_tokenInventory);
        GameToken(s_enemy).addController(s_tokenInventory);
        GameToken(s_item).addController(s_tokenInventory);
        GameToken(s_playerStatus).addController(s_tokenInventory);
        GameToken(s_relic).addController(s_tokenInventory);
    }

    function _wireGameLogic() internal {
        // Controller
        HexplorationController(s_controller).setGameEvents(s_gameEvents);
        HexplorationController(s_controller).setGameStateUpdate(s_stateUpdate);
        HexplorationController(s_controller).setGameSetup(s_gameSetup);
        HexplorationController(s_controller).addVerifiedController(deployer);

        // Queue
        HexplorationQueue(s_queue).addVerifiedController(s_controller);
        HexplorationQueue(s_queue).setGameEvents(s_gameEvents);

        // Gameplay
        HexplorationGameplay(s_gameplay).addVerifiedController(s_controller);
        HexplorationGameplay(s_gameplay).setQueue(s_queue);
        HexplorationGameplay(s_gameplay).setGameStateUpdate(s_stateUpdate);

        // StateUpdate
        HexplorationStateUpdate(s_stateUpdate).addVerifiedController(s_gameplay);
        HexplorationStateUpdate(s_stateUpdate).setGameEvents(s_gameEvents);

        // GameSetup
        GameSetup(s_gameSetup).addVerifiedController(s_controller);
        GameSetup(s_gameSetup).setGameEvents(s_gameEvents);

        // RollDraw
        RollDraw(s_rollDraw).setQueue(s_queue);

        // RelicManagement
        RelicManagement(s_relicManagement).addVerifiedController(s_stateUpdate);

        // CharacterCard
        CharacterCard(s_characterCard).addVerifiedController(s_gameplay);
        CharacterCard(s_characterCard).addVerifiedController(s_stateUpdate);
        CharacterCard(s_characterCard).addVerifiedController(s_gameSetup);
    }

    function _wireEvents() internal {
        GameEvents ge = GameEvents(s_gameEvents);
        ge.addEventSender(s_controller);
        ge.addEventSender(s_queue);
        ge.addEventSender(s_stateUpdate);
        ge.addEventSender(s_gameSetup);
        ge.addEventSender(s_gameplay);
    }

    function _wireSummary() internal {
        GameSummary(s_gameSummary).setPlayerSummary(s_playerSummary);
        GameSummary(s_gameSummary).setPlayZoneSummary(s_playZoneSummary);
    }

    // ── Token Type Registration ─────────────────────────────────────

    function _registerTokenTypes() internal {
        _registerDayNight();
        _registerDisaster();
        _registerEnemy();
        _registerItemBatch1();
        _registerItemBatch2();
        _registerPlayerStatus();
        _registerRelic();
    }

    function _registerDayNight() internal {
        string[] memory t = new string[](2);
        t[0] = "Day";
        t[1] = "Night";
        GameToken.TokenState[] memory s = new GameToken.TokenState[](2);
        s[0] = GameToken.TokenState.Setting1;
        s[1] = GameToken.TokenState.Setting1;
        GameToken(s_dayNight).addTokenTypesWithState(t, s);
    }

    function _registerDisaster() internal {
        string[] memory t = new string[](2);
        t[0] = "Earthquake";
        t[1] = "Volcano";
        GameToken(s_disaster).addTokenTypes(t);
    }

    function _registerEnemy() internal {
        string[] memory t = new string[](6);
        t[0] = "Pirate";
        t[1] = "Pirate Ship";
        t[2] = "Deathbot";
        t[3] = "Guardian";
        t[4] = "Sandworm";
        t[5] = "Dragon";
        GameToken(s_enemy).addTokenTypes(t);
    }

    function _registerItemBatch1() internal {
        string[] memory t = new string[](22);
        t[0] = "Engraved Tablet";
        t[1] = "Sigil Gem";
        t[2] = "Ancient Tome";
        t[3] = "Electron Stabilizer";
        t[4] = "Gravity Shifter";
        t[5] = "Supersonic Absorber";
        t[6] = "Holo Module";
        t[7] = "Resonance Amplifier";
        t[8] = "Subsonic Projector";
        t[9] = "Plasma Loader";
        t[10] = "Fusion Torch";
        t[11] = "Phase Welder";
        t[12] = "Nano Driver";
        t[13] = "Neutron Disruptor";
        t[14] = "Particle Generator";
        t[15] = "Electron Injector";
        t[16] = "Compact Scanner";
        t[17] = "Gryroscopic Drill";
        t[18] = "Ion Generator";
        t[19] = "Particle Hammer";
        t[20] = "Warp Amplifier";
        t[21] = "Phase Scanner";
        GameToken(s_item).addTokenTypes(t);
    }

    function _registerItemBatch2() internal {
        string[] memory t = new string[](22);
        t[0] = "Resonance Torch";
        t[1] = "Nano Manipulator";
        t[2] = "Supersonic Shifter";
        t[3] = "Neutron Loader";
        t[4] = "Tachyon Welder";
        t[5] = "Electron Blaster";
        t[6] = "Tachyon Driver";
        t[7] = "Particle Compactor";
        t[8] = "Plasma Hammer";
        t[9] = "Porta Drill";
        t[10] = "Fusion Loader";
        t[11] = "Temporal Shifter";
        t[12] = "Tachyon Cutter";
        t[13] = "Nano Scrubber";
        t[14] = "Resonance Generator";
        t[15] = "Chem Absorber";
        t[16] = "Mini Module";
        t[17] = "Magnetic Projector";
        t[18] = "Mega Controller";
        t[19] = "Ion Manipulator";
        t[20] = "Campsite";
        t[21] = "Shield";
        GameToken(s_item).addTokenTypes(t);
    }

    function _registerPlayerStatus() internal {
        string[] memory t = new string[](2);
        t[0] = "Stunned";
        t[1] = "Burned";
        GameToken(s_playerStatus).addTokenTypes(t);
    }

    function _registerRelic() internal {
        string[] memory t = new string[](6);
        t[0] = "Mystery";
        t[1] = "Relic 1";
        t[2] = "Relic 2";
        t[3] = "Relic 3";
        t[4] = "Relic 4";
        t[5] = "Relic 5";
        GameToken(s_relic).addTokenTypes(t);
    }

    // ── Output ──────────────────────────────────────────────────────

    function _logAddresses() internal view {
        console.log("");
        console.log("=== Deployed Addresses ===");
        console.log("GAME_REGISTRY:           ", s_gameRegistry);
        console.log("STRING_TO_UINT:          ", s_stringToUint);
        console.log("HEXPLORATION_BOARD:      ", s_board);
        console.log("HEXPLORATION_CONTROLLER: ", s_controller);
        console.log("GAME_RULES:              ", s_rules);
        console.log("PLAY_ZONE:               ", s_zone);
        console.log("PLAYER_REGISTRY:         ", s_playerRegistry);
        console.log("EVENT_DECK:              ", s_eventDeck);
        console.log("AMBUSH_DECK:             ", s_ambushDeck);
        console.log("TREASURE_DECK:           ", s_treasureDeck);
        console.log("LAND_DECK:               ", s_landDeck);
        console.log("RELIC_DECK:              ", s_relicDeck);
        console.log("DAY_NIGHT_TOKEN:         ", s_dayNight);
        console.log("DISASTER_TOKEN:          ", s_disaster);
        console.log("ENEMY_TOKEN:             ", s_enemy);
        console.log("ITEM_TOKEN:              ", s_item);
        console.log("PLAYER_STATUS_TOKEN:     ", s_playerStatus);
        console.log("RELIC_TOKEN:             ", s_relic);
        console.log("TOKEN_INVENTORY:         ", s_tokenInventory);
        console.log("CHARACTER_CARD:          ", s_characterCard);
        console.log("GAMEPLAY:                ", s_gameplay);
        console.log("ROLL_DRAW:               ", s_rollDraw);
        console.log("GAME_QUEUE:              ", s_queue);
        console.log("GAME_STATE_UPDATE:       ", s_stateUpdate);
        console.log("GAME_EVENTS:             ", s_gameEvents);
        console.log("GAME_SETUP:              ", s_gameSetup);
        console.log("GAME_SUMMARY:            ", s_gameSummary);
        console.log("PLAYER_SUMMARY:          ", s_playerSummary);
        console.log("PLAY_ZONE_SUMMARY:       ", s_playZoneSummary);
        console.log("RELIC_MANAGEMENT:        ", s_relicManagement);
        console.log("");
        console.log("Next: node scripts/populate-decks.mjs");
    }
}
