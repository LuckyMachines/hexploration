// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "./HexplorationBoard.sol";
import "./HexplorationZone.sol";
import "@luckymachines/game-core/contracts/src/v0.0/PlayerRegistry.sol";
import "./CharacterCard.sol";
import "./TokenInventory.sol";
import "./HexplorationQueue.sol";
import "./GameWallets.sol";
import "./Utilities.sol";
import "./PlayerSummary.sol";

contract GameSummary is GameWallets, Utilities, AccessControlEnumerable {
    PlayerSummary PLAYER_SUMMARY;

    struct EventSummary {
        uint256 playerID;
        string cardType;
        string cardDrawn;
        uint8 currentAction;
        string cardResult;
        string[3] inventoryChanges;
        int8[3] statUpdates;
        string[] movementPath;
    }

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    // Public Game Summary Functions
    function activeZones(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (
            string[] memory zones,
            uint16[] memory tiles,
            bool[] memory campsites
        )
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        string[] memory allZones = board.getZoneAliases();

        uint16 activeZoneCount = 0;
        for (uint256 i = 0; i < allZones.length; i++) {
            if (board.zoneEnabled(gameID, allZones[i])) {
                activeZoneCount++;
            }
        }
        zones = new string[](activeZoneCount);
        tiles = new uint16[](activeZoneCount);
        campsites = new bool[](activeZoneCount);

        activeZoneCount = 0;
        for (uint256 i = 0; i < allZones.length; i++) {
            if (board.zoneEnabled(gameID, allZones[i])) {
                zones[activeZoneCount] = allZones[i];
                HexplorationZone hexZone = HexplorationZone(
                    board.hexZoneAddress()
                );
                tiles[activeZoneCount] = uint16(
                    hexZone.tile(gameID, allZones[i])
                );
                uint256 index = zoneIndex(gameBoardAddress, allZones[i]);

                campsites[activeZoneCount] =
                    TokenInventory(board.tokenInventory())
                        .ITEM_TOKEN()
                        .zoneBalance("Campsite", gameID, index) >
                    0;
                activeZoneCount++;
            }
        }
    }

    function allPlayerActiveInventories(
        address gameBoardAddress,
        uint256 gameID
    )
        public
        view
        returns (
            uint256[] memory playerIDs,
            string[] memory artifacts,
            string[] memory statuses,
            string[] memory relics,
            bool[] memory shields,
            bool[] memory campsites,
            string[] memory leftHandItems,
            string[] memory rightHandItems
        )
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        // uint256 totalRegistrations = pr.totalRegistrations(gameID);
        playerIDs = new uint256[](
            PlayerRegistry(board.prAddress()).totalRegistrations(gameID)
        );
        artifacts = new string[](
            PlayerRegistry(board.prAddress()).totalRegistrations(gameID)
        );
        statuses = new string[](
            PlayerRegistry(board.prAddress()).totalRegistrations(gameID)
        );
        relics = new string[](
            PlayerRegistry(board.prAddress()).totalRegistrations(gameID)
        );
        shields = new bool[](
            PlayerRegistry(board.prAddress()).totalRegistrations(gameID)
        );
        campsites = new bool[](
            PlayerRegistry(board.prAddress()).totalRegistrations(gameID)
        );
        leftHandItems = new string[](
            PlayerRegistry(board.prAddress()).totalRegistrations(gameID)
        );
        rightHandItems = new string[](
            PlayerRegistry(board.prAddress()).totalRegistrations(gameID)
        );

        for (
            uint256 i = 0;
            i < PlayerRegistry(board.prAddress()).totalRegistrations(gameID);
            i++
        ) {
            playerIDs[i] = i + 1;
            (
                artifacts[i],
                statuses[i],
                relics[i],
                shields[i],
                campsites[i],
                leftHandItems[i],
                rightHandItems[i]
            ) = PLAYER_SUMMARY.activeInventory(gameBoardAddress, gameID, i + 1);
        }
    }

    function allPlayerInactiveInventories(
        address gameBoardAddress,
        uint256 gameID
    )
        public
        view
        returns (
            uint256[] memory playerIDs,
            string[][] memory itemTypes,
            uint256[][] memory itemBalances
        )
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);
        playerIDs = new uint256[](totalRegistrations);
        for (uint256 i = 0; i < totalRegistrations; i++) {
            playerIDs[i] = i + 1;
            (itemTypes[i], itemBalances[i]) = PLAYER_SUMMARY.inactiveInventory(
                gameBoardAddress,
                gameID,
                i + 1
            );
        }
    }

    function allPlayerLocations(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (uint256[] memory playerIDs, string[] memory playerZones)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);
        playerIDs = new uint256[](totalRegistrations);
        playerZones = new string[](totalRegistrations);
        for (uint256 i = 0; i < totalRegistrations; i++) {
            playerIDs[i] = i + 1;
            playerZones[i] = board.currentPlayZone(gameID, i + 1);
        }
    }

    function boardSize(address gameBoardAddress)
        public
        view
        returns (uint256 rows, uint256 columns)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        rows = board.gridHeight();
        columns = board.gridWidth();
    }

    function canDigAtZone(
        address gameBoardAddress,
        uint256 gameID,
        string memory _zoneAlias
    ) public view returns (bool diggingAllowed) {
        uint256 index = zoneIndex(gameBoardAddress, _zoneAlias);
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        diggingAllowed =
            TokenInventory(board.tokenInventory()).ITEM_TOKEN().zoneBalance(
                "Campsite",
                gameID,
                index
            ) >
            0 &&
            !board.artifactFound(gameID, _zoneAlias);
    }

    function currentDay(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (uint256 day)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        HexplorationQueue q = HexplorationQueue(board.gameplayQueue());
        day = (q.getQueueIDs(gameID).length + 1) / 2;
    }

    function currentGameplayQueue(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (uint256 queueID)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        HexplorationQueue q = HexplorationQueue(board.gameplayQueue());
        queueID = q.queueID(gameID);
    }

    function currentPhase(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory phase)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        TokenInventory tokens = TokenInventory(board.tokenInventory());

        uint256 dayBalance = tokens.DAY_NIGHT_TOKEN().balance(
            "Day",
            gameID,
            GAME_BOARD_WALLET_ID
        );
        phase = dayBalance > 0 ? "Day" : "Night";
    }

    function gameStarted(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (bool gameHasStarted)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        gameHasStarted = board.gameState(gameID) > 0;
    }

    function getAvailableGames(
        address gameBoardAddress,
        address gameRegistryAddress
    )
        public
        view
        returns (
            uint256[] memory gameIDs,
            uint256[] memory maxPlayers,
            uint256[] memory currentRegistrations
        )
    {
        (gameIDs, maxPlayers, currentRegistrations) = HexplorationBoard(
            gameBoardAddress
        ).openGames(gameRegistryAddress);
    }

    function landingSite(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory zoneAlias)
    {
        zoneAlias = HexplorationBoard(gameBoardAddress).initialPlayZone(gameID);
    }

    function lastDayPhaseEvents(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (
            uint256[] memory playerIDs,
            string[] memory cardTypes,
            string[] memory cardsDrawn,
            string[] memory cardResults,
            string[3][] memory inventoryChanges,
            int8[3][] memory statUpdates
        )
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);
        playerIDs = new uint256[](totalRegistrations);
        cardTypes = new string[](totalRegistrations);
        cardsDrawn = new string[](totalRegistrations);
        cardResults = new string[](totalRegistrations);
        inventoryChanges = new string[3][](totalRegistrations);
        statUpdates = new int8[3][](totalRegistrations);

        // TODO: skip inactive players, will return 0 / default empty values
        for (uint256 i = 0; i < totalRegistrations; i++) {
            uint256 pID = i + 1;
            playerIDs[i] = pID;
            cardTypes[i] = cc.dayPhaseActionCardType(gameID, pID);
            cardsDrawn[i] = cc.dayPhaseActionCardDrawn(gameID, pID);
            cardResults[i] = cc.dayPhaseActionCardResult(gameID, pID);
            inventoryChanges[i] = cc.getDayPhaseInventoryChanges(gameID, pID);
            statUpdates[i] = cc.getDayPhaseStatUpdates(gameID, pID);
        }
    }

    // function lastPlayerActions(address gameBoardAddress, uint256 gameID)
    //     public
    //     view
    //     returns (
    //         uint256[] memory playerIDs,
    //         string[] memory activeActionCardTypes,
    //         string[] memory activeActionCardsDrawn,
    //         uint8[] memory currentActiveActions,
    //         string[] memory activeActionCardResults,
    //         string[3][] memory activeActionCardInventoryChanges,
    //         int8[3][] memory activeActionStatUpdates
    //     )
    // {
    //     HexplorationBoard board = HexplorationBoard(gameBoardAddress);
    //     CharacterCard cc = CharacterCard(board.characterCard());
    //     PlayerRegistry pr = PlayerRegistry(board.prAddress());
    //     uint256 totalRegistrations = pr.totalRegistrations(gameID);
    //     playerIDs = new uint256[](totalRegistrations);
    //     activeActionCardTypes = new string[](totalRegistrations);
    //     activeActionCardsDrawn = new string[](totalRegistrations);
    //     currentActiveActions = new uint8[](totalRegistrations);
    //     activeActionCardResults = new string[](totalRegistrations);
    //     activeActionCardInventoryChanges = new string[3][](totalRegistrations);
    //     activeActionStatUpdates = new int8[3][](totalRegistrations);

    //     // TODO: skip inactive players, will return 0 / default empty values
    //     for (uint256 i = 0; i < totalRegistrations; i++) {
    //         uint256 pID = i + 1;
    //         playerIDs[i] = pID;
    //         activeActionCardTypes[i] = cc.activeActionCardType(gameID, pID);
    //         activeActionCardsDrawn[i] = cc.activeActionCardDrawn(gameID, pID);
    //         currentActiveActions[i] = uint8(cc.action(gameID, pID));
    //         activeActionCardResults[i] = cc.activeActionCardResult(gameID, pID);
    //         activeActionCardInventoryChanges[i] = cc.getInventoryChanges(
    //             gameID,
    //             pID
    //         );
    //         activeActionStatUpdates[i] = cc.getStatUpdates(gameID, pID);
    //     }
    //     // returns
    //     // playerIDs
    //     // activeActionCardType - // "Event","Ambush","Treasure"
    //     // activationActionCardsDrawn = card title of card drawn
    //     // currentActveActions - action doing that led to card draw
    //     // activeActionCardResults - outcomes of cards
    //     // activeActionCardInventoryChangs - item loss, item gain, hand loss (left/right)
    //     // activeActionStatUpdates - [movement adjust, agility adjust, dexterity adjust] (will only effect up to max and down to 0)
    // }

    function lastPlayerActions(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (EventSummary[] memory playerActions)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);

        playerActions = new EventSummary[](totalRegistrations);

        // TODO: skip inactive players, will return 0 / default empty values
        for (uint256 i = 0; i < playerActions.length; i++) {
            uint256 pID = i + 1;
            playerActions[i].playerID = pID;
            playerActions[i].cardType = cc.activeActionCardType(gameID, pID);
            playerActions[i].cardDrawn = cc.activeActionCardDrawn(gameID, pID);
            playerActions[i].currentAction = uint8(cc.action(gameID, pID));
            playerActions[i].cardResult = cc.activeActionCardResult(
                gameID,
                pID
            );
            playerActions[i].inventoryChanges = cc.getInventoryChanges(
                gameID,
                pID
            );
            playerActions[i].statUpdates = cc.getStatUpdates(gameID, pID);
        }
    }

    // Returns artifacts recovered and stored on the ship
    function recoveredArtifacts(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string[] memory artifacts)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        TokenInventory tokens = TokenInventory(board.tokenInventory());
        uint256 totalArtifacts = 0;
        uint256 artifactBalance1 = tokens.ITEM_TOKEN().balance(
            "Engraved Tablet",
            gameID,
            SHIP_WALLET_ID
        );
        uint256 artifactBalance2 = tokens.ITEM_TOKEN().balance(
            "Sigil Gem",
            gameID,
            SHIP_WALLET_ID
        );
        uint256 artifactBalance3 = tokens.ITEM_TOKEN().balance(
            "Ancient Tome",
            gameID,
            SHIP_WALLET_ID
        );
        if (
            artifactBalance1 > 0 || artifactBalance2 > 0 || artifactBalance3 > 0
        ) {
            totalArtifacts =
                artifactBalance1 +
                artifactBalance2 +
                artifactBalance3;
        }

        // repeat for each artifact

        artifacts = new string[](totalArtifacts);
        uint256 position = 0;
        for (uint256 i = 0; i < artifactBalance1; i++) {
            // for each artifact, add to artifacts[i]
            artifacts[position] = "Engraved Tablet";
            position++;
        }
        for (uint256 i = 0; i < artifactBalance2; i++) {
            // for each artifact, add to artifacts[i]
            artifacts[position] = "Sigil Gem";
            position++;
        }
        for (uint256 i = 0; i < artifactBalance3; i++) {
            // for each artifact, add to artifacts[i]
            artifacts[position] = "Ancient Tome";
            position++;
        }
    }

    function totalPlayers(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (uint256 numPlayers)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        numPlayers = pr.totalRegistrations(gameID);
    }

    // Internal Stuff
    function zoneIndex(address gameBoardAddress, string memory zoneAlias)
        internal
        view
        returns (uint256 index)
    {
        index = 1111111111111;
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        string[] memory allZones = board.getZoneAliases();
        for (uint256 i = 0; i < allZones.length; i++) {
            if (
                keccak256(abi.encodePacked(zoneAlias)) ==
                keccak256(abi.encodePacked(allZones[i]))
            ) {
                index = i;
                break;
            }
        }
    }

    // Admin functions
    function setPlayerSummary(address playerSummaryAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        PLAYER_SUMMARY = PlayerSummary(playerSummaryAddress);
    }
}
