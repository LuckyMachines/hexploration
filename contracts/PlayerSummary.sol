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

contract PlayerSummary is Utilities, GameWallets {
    // Public Player Summary Functions
    function getPlayerAddress(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    ) public view returns (address playerAddress) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        playerAddress = pr.playerAddress(gameID, playerID);
    }

    function getPlayerID(
        address gameBoardAddress,
        uint256 gameID
    ) public view returns (uint256 playerID) {
        playerID = getPlayerID(gameBoardAddress, gameID, tx.origin);
    }

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
        uint256 gameID
    ) public view returns (bool playerIsActive) {
        playerIsActive = isActive(gameBoardAddress, gameID, tx.origin);
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
        uint256 gameID
    ) public view returns (bool playerIsRegistered) {
        playerIsRegistered = isRegistered(gameBoardAddress, gameID, tx.origin);
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
    function activeAction(
        address gameBoardAddress,
        uint256 gameID
    ) public view returns (string memory action) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        uint256 playerID = PlayerRegistry(board.prAddress()).playerID(
            gameID,
            tx.origin
        );
        action = activeAction(gameBoardAddress, gameID, playerID);
    }

    function activeAction(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    ) public view returns (string memory action) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
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

    function activeInventory(
        address gameBoardAddress,
        uint256 gameID
    )
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
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        (
            artifact,
            status,
            relic,
            shield,
            campsite,
            leftHandItem,
            rightHandItem
        ) = activeInventory(
            gameBoardAddress,
            gameID,
            pr.playerID(gameID, tx.origin)
        );
    }

    function activeInventory(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    )
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

    function availableMovement(
        address gameBoardAddress,
        uint256 gameID
    ) public view returns (uint8 movement) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        movement = availableMovement(gameBoardAddress, gameID, playerID);
    }

    function availableMovement(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    ) public view returns (uint8 movement) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        HexplorationZone hexZone = HexplorationZone(board.hexZoneAddress());
        CharacterCard cc = CharacterCard(board.characterCard());
        movement = cc.movement(gameID, playerID);

        HexplorationZone.Tile currentTile = hexZone.tile(
            gameID,
            currentLocation(gameBoardAddress, gameID)
        );
        if (stringsMatch(currentPhase(gameBoardAddress, gameID), "Day")) {
            /*
            Daytime
            Plains: No change
            Jungle: -1 Speed
            Mountain: -1 Speed
            Desert: -2 Speed
            */
            if (currentTile == HexplorationZone.Tile.Jungle) {
                movement = movement > 0 ? movement - 1 : 0;
            } else if (currentTile == HexplorationZone.Tile.Mountain) {
                movement = movement > 0 ? movement - 1 : 0;
            } else if (currentTile == HexplorationZone.Tile.Desert) {
                movement = movement > 1 ? movement - 2 : 0;
            }
        } else {
            /*
            Night time
            Plains: -1 Speed
            Jungle: -2 Speed,
            Mountain: -2 Speed,
            Desert: -1 Speed
            */
            if (currentTile == HexplorationZone.Tile.Plains) {
                movement = movement > 0 ? movement - 1 : 0;
            } else if (currentTile == HexplorationZone.Tile.Jungle) {
                movement = movement > 1 ? movement - 2 : 0;
            } else if (currentTile == HexplorationZone.Tile.Mountain) {
                movement = movement > 1 ? movement - 2 : 0;
            } else if (currentTile == HexplorationZone.Tile.Desert) {
                movement = movement > 0 ? movement - 1 : 0;
            }
        }
    }

    function currentHandInventory(
        address gameBoardAddress,
        uint256 gameID
    )
        public
        view
        returns (string memory leftHandItem, string memory rightHandItem)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        (leftHandItem, rightHandItem) = currentHandInventory(
            gameBoardAddress,
            gameID,
            playerID
        );
    }

    function currentHandInventory(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    )
        public
        view
        returns (string memory leftHandItem, string memory rightHandItem)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
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

    function currentLocation(
        address gameBoardAddress,
        uint256 gameID
    ) public view returns (string memory location) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        location = currentLocation(gameBoardAddress, gameID, playerID);
    }

    function currentLocation(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    ) public view returns (string memory location) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        location = board.currentPlayZone(gameID, playerID);
    }

    function currentPlayerStats(
        address gameBoardAddress,
        uint256 gameID
    ) public view returns (uint8 movement, uint8 agility, uint8 dexterity) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        (movement, agility, dexterity) = currentPlayerStats(
            gameBoardAddress,
            gameID,
            playerID
        );
    }

    function currentPlayerStats(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    ) public view returns (uint8 movement, uint8 agility, uint8 dexterity) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        movement = cc.movement(gameID, playerID);
        agility = cc.agility(gameID, playerID);
        dexterity = cc.dexterity(gameID, playerID);
    }

    function inactiveInventory(
        address gameBoardAddress,
        uint256 gameID
    )
        public
        view
        returns (string[] memory itemTypes, uint256[] memory itemBalances)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        (itemTypes, itemBalances) = inactiveInventory(
            gameBoardAddress,
            gameID,
            playerID
        );
    }

    function inactiveInventory(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    )
        public
        view
        returns (string[] memory itemTypes, uint256[] memory itemBalances)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        TokenInventory ti = TokenInventory(board.tokenInventory());

        GameToken itemToken = ti.ITEM_TOKEN();
        itemTypes = itemToken.getTokenTypes();
        itemBalances = new uint256[](itemTypes.length);
        // Campsite, Artfacts, Relics, Shield should always be active...
        // Items set to always active may be inactive if player has multiples (1 already in active)
        string memory lhItem;
        string memory rhItem;
        (lhItem, rhItem) = currentHandInventory(gameBoardAddress, gameID);
        if (ti.holdsToken(playerID, TokenInventory.Token.Item, gameID)) {
            for (uint256 i = 0; i < itemTypes.length; i++) {
                string memory item = itemTypes[i];
                itemBalances[i] = (!stringsMatch(item, lhItem) &&
                    !stringsMatch(item, rhItem))
                    ? (itemToken.allTokenState(item) ==
                        GameToken.TokenState.Active &&
                        itemToken.balance(item, gameID, playerID) >= 1)
                        ? itemToken.balance(item, gameID, playerID) - 1
                        : itemToken.balance(item, gameID, playerID)
                    : 0;
            }
        }
    }

    function isAtCampsite(
        address gameBoardAddress,
        uint256 gameID
    ) public view returns (bool atCampsite) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        atCampsite = isAtCampsite(gameBoardAddress, gameID, playerID);
    }

    function isAtCampsite(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    ) public view returns (bool atCampsite) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        string memory currentZone = board.currentPlayZone(gameID, playerID);
        uint256 index = zoneIndex(gameBoardAddress, currentZone);
        atCampsite =
            TokenInventory(board.tokenInventory()).ITEM_TOKEN().zoneBalance(
                "Campsite",
                gameID,
                index
            ) >
            0;
    }

    function playerRecoveredArtifacts(
        address gameBoardAddress,
        uint256 gameID
    ) public view returns (string[] memory artifacts) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, tx.origin);
        artifacts = playerRecoveredArtifacts(
            gameBoardAddress,
            gameID,
            playerID
        );
    }

    function playerRecoveredArtifacts(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    ) public view returns (string[] memory artifacts) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        artifacts = board.getArtifactsRetrieved(gameID, playerID);
    }

    // Internal Stuff
    function currentPhase(
        address gameBoardAddress,
        uint256 gameID
    ) public view returns (string memory phase) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        TokenInventory tokens = TokenInventory(board.tokenInventory());

        uint256 dayBalance = tokens.DAY_NIGHT_TOKEN().balance(
            "Day",
            gameID,
            GAME_BOARD_WALLET_ID
        );
        phase = dayBalance > 0 ? "Day" : "Night";
    }

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

    function zoneIndex(
        address gameBoardAddress,
        string memory zoneAlias
    ) internal view returns (uint256 index) {
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
}
