// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "./HexplorationBoard.sol";
import "./HexplorationZone.sol";
import "@luckymachines/game-core/contracts/src/v0.0/PlayerRegistry.sol";
import "./CharacterCard.sol";
import "./TokenInventory.sol";
import "./HexplorationQueue.sol";
import "./GameWallets.sol";

contract GameSummary is GameWallets {
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

    function lastPlayerActions(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (
            uint256[] memory playerIDs,
            string[] memory activeActionCardTypes,
            string[] memory activeActionCardsDrawn,
            uint8[] memory currentActiveActions,
            string[] memory activeActionCardResults,
            string[3][] memory activeActionCardInventoryChanges,
            int8[3][] memory activeActionStatUpdates
        )
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);
        playerIDs = new uint256[](totalRegistrations);
        activeActionCardTypes = new string[](totalRegistrations);
        activeActionCardsDrawn = new string[](totalRegistrations);
        currentActiveActions = new uint8[](totalRegistrations);
        activeActionCardResults = new string[](totalRegistrations);
        activeActionCardInventoryChanges = new string[3][](totalRegistrations);
        activeActionStatUpdates = new int8[3][](totalRegistrations);

        // TODO: skip inactive players, will return 0 / default empty values
        for (uint256 i = 0; i < totalRegistrations; i++) {
            uint256 pID = i + 1;
            playerIDs[i] = pID;
            activeActionCardTypes[i] = cc.activeActionCardType(gameID, pID);
            activeActionCardsDrawn[i] = cc.activeActionCardDrawn(gameID, pID);
            currentActiveActions[i] = uint8(cc.action(gameID, pID));
            activeActionCardResults[i] = cc.activeActionCardResult(gameID, pID);
            activeActionCardInventoryChanges[i] = cc.getInventoryChanges(
                gameID,
                pID
            );
            activeActionStatUpdates[i] = cc.getStatUpdates(gameID, pID);
        }
        // returns
        // playerIDs
        // activeActionCardType - // "Event","Ambush","Treasure"
        // activationActionCardsDrawn = card title of card drawn
        // currentActveActions - action doing that led to card draw
        // activeActionCardResults - outcomes of cards
        // activeActionCardInventoryChangs - item loss, item gain, hand loss (left/right)
        // activeActionStatUpdates - [movement adjust, agility adjust, dexterity adjust] (will only effect up to max and down to 0)
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

    // Public Player Summary Functions
    function getPlayerID(
        address gameBoardAddress,
        uint256 gameID,
        address playerAddress
    ) public view returns (uint256 playerID) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        playerID = pr.playerID(gameID, playerAddress);
    }

    function isActive(
        address gameBoardAddress,
        uint256 gameID,
        address playerAddress
    ) public view returns (bool playerIsActive) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, playerAddress);
        playerIsActive = pr.isActive(gameID, playerID);
    }

    function isActive(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    ) public view returns (bool playerIsActive) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        playerIsActive = pr.isActive(gameID, playerID);
    }

    function isRegistered(
        address gameBoardAddress,
        uint256 gameID,
        address playerAddress
    ) public view returns (bool playerIsRegistered) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        playerIsRegistered = pr.isRegistered(gameID, playerAddress);
    }

    // See if player is active in current game. Players will remain registered even when inactive.

    // Player Summary Functions called directly by players
    function activeAction(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory action)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        uint256 playerID = PlayerRegistry(board.prAddress()).playerID(
            gameID,
            tx.origin
        );
        CharacterCard.Action a = cc.action(gameID, playerID);

        action = "Idle";
        if (a == CharacterCard.Action.Move) {
            action = "Move";
        } else if (a == CharacterCard.Action.SetupCamp) {
            action = "Setup camp";
        } else if (a == CharacterCard.Action.BreakDownCamp) {
            action = "Break down camp";
        } else if (a == CharacterCard.Action.Dig) {
            action = "Dig";
        } else if (a == CharacterCard.Action.Rest) {
            action = "Rest";
        } else if (a == CharacterCard.Action.Help) {
            action = "Help";
        }
    }

    function activeInventory(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (
            string memory artifact,
            string memory status,
            string memory relic,
            bool shield,
            bool campsite,
            string memory leftHandItem,
            string memory rightHandItem
        )
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        artifact = inventoryArtifactExists(
            cc.artifact(gameID, playerID),
            board.tokenInventory(),
            gameID,
            playerID
        )
            ? cc.artifact(gameID, playerID)
            : "";

        status = inventoryStatusExists(
            cc.status(gameID, playerID),
            board.tokenInventory(),
            gameID,
            playerID
        )
            ? cc.status(gameID, playerID)
            : "";

        relic = inventoryItemExists(
            cc.relic(gameID, playerID),
            board.tokenInventory(),
            gameID,
            playerID
        )
            ? cc.relic(gameID, playerID)
            : "";

        shield = inventoryItemExists(
            "Shield",
            board.tokenInventory(),
            gameID,
            playerID
        )
            ? true
            : false;

        campsite = inventoryItemExists(
            "Campsite",
            board.tokenInventory(),
            gameID,
            playerID
        )
            ? true
            : false;

        (leftHandItem, rightHandItem) = currentHandInventory(
            gameBoardAddress,
            gameID
        );
    }

    // function availableMovement(address gameBoardAddress, uint256 gameID)
    //     public
    //     view
    //     returns (uint8 movement)
    // {
    //     HexplorationBoard board = HexplorationBoard(gameBoardAddress);
    //     HexplorationZone hexZone = HexplorationZone(board.hexZoneAddress());
    //     CharacterCard cc = CharacterCard(board.characterCard());
    //     PlayerRegistry pr = PlayerRegistry(board.prAddress());
    //     uint256 playerID = pr.playerID(gameID, tx.origin);
    //     movement = cc.movement(gameID, playerID);

    //     HexplorationZone.Tile currentTile = hexZone.tile(
    //         gameID,
    //         currentLocation(gameBoardAddress, gameID)
    //     );
    //     if (stringsMatch(currentPhase(gameBoardAddress, gameID), "Day")) {
    //         /*
    //         Daytime
    //         Plains: No change
    //         Jungle: -1 Speed
    //         Mountain: -1 Speed
    //         Desert: -2 Speed
    //         */
    //         if (currentTile == HexplorationZone.Tile.Jungle) {
    //             movement = movement > 0 ? movement - 1 : 0;
    //         } else if (currentTile == HexplorationZone.Tile.Mountain) {
    //             movement = movement > 0 ? movement - 1 : 0;
    //         } else if (currentTile == HexplorationZone.Tile.Desert) {
    //             movement = movement > 1 ? movement - 2 : 0;
    //         }
    //     } else {
    //         /*
    //         Night time
    //         Plains: -1 Speed
    //         Jungle: -2 Speed,
    //         Mountain: -2 Speed,
    //         Desert: -1 Speed
    //         */
    //         if (currentTile == HexplorationZone.Tile.Plains) {
    //             movement = movement > 0 ? movement - 1 : 0;
    //         } else if (currentTile == HexplorationZone.Tile.Jungle) {
    //             movement = movement > 1 ? movement - 2 : 0;
    //         } else if (currentTile == HexplorationZone.Tile.Mountain) {
    //             movement = movement > 1 ? movement - 2 : 0;
    //         } else if (currentTile == HexplorationZone.Tile.Desert) {
    //             movement = movement > 0 ? movement - 1 : 0;
    //         }
    //     }
    // }

    function currentHandInventory(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory leftHandItem, string memory rightHandItem)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        leftHandItem = inventoryItemExists(
            cc.leftHandItem(gameID, playerID),
            board.tokenInventory(),
            gameID,
            PlayerRegistry(board.prAddress()).playerID(gameID, tx.origin)
        )
            ? cc.leftHandItem(gameID, playerID)
            : "";

        rightHandItem = inventoryItemExists(
            cc.rightHandItem(gameID, playerID),
            board.tokenInventory(),
            gameID,
            PlayerRegistry(board.prAddress()).playerID(gameID, tx.origin)
        )
            ? cc.rightHandItem(gameID, playerID)
            : "";
    }

    function currentLocation(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory location)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        location = board.currentPlayZone(
            gameID,
            pr.playerID(gameID, tx.origin)
        );
    }

    function currentPlayerStats(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (
            uint8 movement,
            uint8 agility,
            uint8 dexterity
        )
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        movement = cc.movement(gameID, playerID);
        agility = cc.agility(gameID, playerID);
        dexterity = cc.dexterity(gameID, playerID);
    }

    function inactiveInventory(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string[] memory itemTypes, uint256[] memory itemBalances)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        TokenInventory ti = TokenInventory(board.tokenInventory());
        itemBalances = new uint256[](15);
        itemTypes = new string[](15);
        // Campsite, Artfacts, Relics, Shield never inactive.
        // 1 shield should always be active...
        itemTypes[0] = "Small Ammo";
        itemTypes[1] = "Large Ammo";
        itemTypes[2] = "Batteries";
        itemTypes[3] = "Portal";
        itemTypes[4] = "On";
        itemTypes[5] = "Off";
        itemTypes[6] = "Rusty Dagger";
        itemTypes[7] = "Rusty Pistol";
        itemTypes[8] = "Shiny Dagger";
        itemTypes[9] = "Shiny Pistol";
        itemTypes[10] = "Shiny Rifle";
        itemTypes[11] = "Laser Dagger";
        itemTypes[12] = "Laser Sword";
        itemTypes[13] = "Laser Pistol";
        itemTypes[14] = "Power Glove";
        uint256 playerID = pr.playerID(gameID, tx.origin);
        string memory lhItem;
        string memory rhItem;
        (lhItem, rhItem) = currentHandInventory(gameBoardAddress, gameID);
        if (ti.holdsToken(playerID, TokenInventory.Token.Item, gameID)) {
            GameToken itemToken = ti.ITEM_TOKEN();
            //string[] memory types = itemToken.getTokenTypes();
            for (uint256 i = 0; i < itemBalances.length; i++) {
                //itemTypes[i] = types[i];
                // TODO: don't include if matches LH, RH
                string memory item = itemTypes[i];
                itemBalances[i] = (!stringsMatch(item, lhItem) &&
                    !stringsMatch(item, rhItem))
                    ? (stringsMatch(item, "Shield") &&
                        itemToken.balance(item, gameID, playerID) > 1)
                        ? itemToken.balance(item, gameID, playerID) - 1
                        : itemToken.balance(item, gameID, playerID)
                    : 0;
            }
        }
    }

    function isAtCampsite(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (bool atCampsite)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        string memory currentZone = board.currentPlayZone(
            gameID,
            pr.playerID(gameID, tx.origin)
        );
        uint256 index = zoneIndex(gameBoardAddress, currentZone);
        // zone balance...
        //mapping(string => mapping(uint256 => mapping(uint256 => uint256)))

        atCampsite =
            TokenInventory(board.tokenInventory()).ITEM_TOKEN().zoneBalance(
                "Campsite",
                gameID,
                index
            ) >
            0;
    }

    /*
    function playerRecoveredArtifacts(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string[] memory artifacts)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        artifacts = board.getArtifactsRetrieved(
            gameID,
            pr.playerID(gameID, tx.origin)
        );
    }
*/
    // Internal Stuff
    // Item exists in player inventory
    function inventoryItemExists(
        string memory tokenType,
        address inventoryAddress,
        uint256 gameID,
        uint256 holderID
    ) internal view returns (bool) {
        return
            TokenInventory(inventoryAddress).ITEM_TOKEN().balance(
                tokenType,
                gameID,
                holderID
            ) > 0;
    }

    // Artifact exists in player inventory
    function inventoryArtifactExists(
        string memory tokenType,
        address inventoryAddress,
        uint256 gameID,
        uint256 holderID
    ) internal view returns (bool) {
        return
            TokenInventory(inventoryAddress).ITEM_TOKEN().balance(
                tokenType,
                gameID,
                holderID
            ) > 0;
    }

    // Status token exists in player inventory
    function inventoryStatusExists(
        string memory tokenType,
        address inventoryAddress,
        uint256 gameID,
        uint256 holderID
    ) internal view returns (bool) {
        return
            TokenInventory(inventoryAddress).PLAYER_STATUS_TOKEN().balance(
                tokenType,
                gameID,
                holderID
            ) > 0;
    }

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

    function stringsMatch(string memory s1, string memory s2)
        internal
        pure
        returns (bool)
    {
        return
            keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }
}
