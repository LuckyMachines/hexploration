// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

// TODO: start using this for state updating outside of controller
// Controller should only be used by users / UI directly sending
// commands. This does things that can only imagine...

// This should be only associated with one board...

import "./HexplorationController.sol";
import "./HexplorationBoard.sol";
import "./CardDeck.sol";
import "./CharacterCard.sol";
import "./HexplorationGameplay.sol";
import "./GameEvents.sol";
import "./RandomIndices.sol";
import "./GameWallets.sol";
import "./StateUpdateHelpers.sol";
import "./RelicManagement.sol";

contract HexplorationStateUpdate is
    AccessControlEnumerable,
    RandomIndices,
    GameWallets
{
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
    CharacterCard internal CHARACTER_CARD;
    GameEvents internal GAME_EVENTS;
    RelicManagement internal RELIC_MANAGEMENT;

    modifier onlyAdminVC() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
                hasRole(VERIFIED_CONTROLLER_ROLE, _msgSender()),
            "Admin or Keeper role required"
        );
        _;
    }

    // set other addresses going to need here
    // decks, tokens?
    constructor(
        address gameBoardAddress,
        address characterCardAddress,
        address relicManagementAddress
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        GAME_BOARD = HexplorationBoard(gameBoardAddress);
        CHARACTER_CARD = CharacterCard(characterCardAddress);
        RELIC_MANAGEMENT = RelicManagement(relicManagementAddress);
    }

    // Admin Functions

    function addVerifiedController(
        address vcAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    function setGameEvents(
        address gameEventsAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        GAME_EVENTS = GameEvents(gameEventsAddress);
    }

    function postUpdates(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // go through values and post everything, transfer all the tokens, and pray
        // use gamestate update contract to post everything
        // CHARACTER_CARD.resetActiveActions(
        //     gameID,
        //     GAME_EVENTS.totalPlayers(address(GAME_BOARD), gameID)
        // );
        updatePlayerPositions(updates, gameID);
        updatePlayerStats(updates, gameID);
        updatePlayerHands(updates, gameID);
        transferPlayerItems(updates, gameID);
        transferZoneItems(updates, gameID);
        applyActivityEffects(updates, gameID);
        // switch between night / day
        updatePlayPhase(updates, gameID);

        if (StateUpdateHelpers.checkGameOver(address(CHARACTER_CARD), gameID)) {
            // set game over
            GAME_BOARD.setGameOver(gameID);
            // emit event
            GAME_EVENTS.emitGameOver(gameID);
        }
    }

    function postDayPhaseUpdates(
        HexplorationGameplay.PlayUpdates memory dayPhaseUpdates,
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        if (
            !StateUpdateHelpers.checkGameOver(address(CHARACTER_CARD), gameID)
        ) {
            applyDayPhaseEffects(dayPhaseUpdates, gameID);
            updatePlayerStats(dayPhaseUpdates, gameID);
            updatePlayerHands(dayPhaseUpdates, gameID);
            transferPlayerItems(dayPhaseUpdates, gameID);
            transferZoneItems(dayPhaseUpdates, gameID);
            if (
                StateUpdateHelpers.checkGameOver(
                    address(CHARACTER_CARD),
                    gameID
                )
            ) {
                // set game over
                GAME_BOARD.setGameOver(gameID);
                // emit event
                GAME_EVENTS.emitGameOver(gameID);
            }
        }
    }

    /*
    struct PlayUpdates {
        uint256[] playerPositionIDs;
        uint256[] spacesToMove;
        uint256[] playerEquipIDs;
        uint256[] playerEquipHands;
        uint256[] zoneTransfersTo;
        uint256[] zoneTransfersFrom;
        uint256[] zoneTransferQtys;
        uint256[] playerTransfersTo;
        uint256[] playerTransfersFrom;
        uint256[] playerTransferQtys;
        uint256[] playerStatUpdateIDs;
        int8[3][] playerStatUpdates; // amount to adjust, not final value
        uint256[] playerActiveActionIDs;
        string gamePhase;
        string[7][] playerMovementOptions; // TODO: set this to max # of spaces possible
        string[] playerEquips;
        string[] zoneTransferItemTypes;
        string[] playerTransferItemTypes;
        string[] activeActions;
        string[][] activeActionOptions;
        uint256[] activeActionResults; // 0 = None, 1 = Event, 2 = Ambush, 3 = Treasure
        string[2][] activeActionResultCard; // Card for Event / ambush / treasure , outcome e.g. ["Dance with locals", "You're amazing!"]
        string[3][] activeActionInventoryChange; // [item loss, item gain, hand loss]
        uint256 randomness;
    }
    */

    function updatePlayerPositions(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        for (uint256 i = 0; i < updates.playerPositionIDs.length; i++) {
            uint256 spacesToMove = updates.spacesToMove[i];
            string[] memory path = new string[](spacesToMove);
            for (uint256 j = 0; j < spacesToMove; j++) {
                path[j] = updates.playerMovementOptions[i][j];
            }
            uint256 playerID = updates.playerPositionIDs[i];
            uint256[] memory revealRandomness = new uint256[](4);
            bool inTestMode = updates.randomness.length > 1;
            if (playerID == 1) {
                revealRandomness[0] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P1TileReveal1)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P1TileReveal1
                    );
                revealRandomness[1] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P1TileReveal2)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P1TileReveal2
                    );
                revealRandomness[2] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P1TileReveal3)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P1TileReveal3
                    );
                revealRandomness[3] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P1TileReveal4)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P1TileReveal4
                    );
            } else if (playerID == 2) {
                revealRandomness[0] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P2TileReveal1)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P2TileReveal1
                    );
                revealRandomness[1] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P2TileReveal2)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P2TileReveal2
                    );
                revealRandomness[2] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P2TileReveal3)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P2TileReveal3
                    );
                revealRandomness[3] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P2TileReveal4)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P2TileReveal4
                    );
            } else if (playerID == 3) {
                revealRandomness[0] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P3TileReveal1)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P3TileReveal1
                    );
                revealRandomness[1] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P3TileReveal2)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P3TileReveal2
                    );
                revealRandomness[2] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P3TileReveal3)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P3TileReveal3
                    );
                revealRandomness[3] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P3TileReveal4)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P3TileReveal4
                    );
            } else if (playerID == 4) {
                revealRandomness[0] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P4TileReveal1)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P4TileReveal1
                    );
                revealRandomness[1] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P4TileReveal2)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P4TileReveal2
                    );
                revealRandomness[2] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P4TileReveal3)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P4TileReveal3
                    );
                revealRandomness[3] = inTestMode
                    ? updates.randomness[uint256(RandomIndex.P4TileReveal4)]
                    : expandNumber(
                        updates.randomness[0],
                        RandomIndex.P4TileReveal4
                    );
            }

            moveThroughPath(path, gameID, playerID, revealRandomness);
        }
    }

    function updatePlayerStats(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        for (uint256 i = 0; i < updates.playerStatUpdateIDs.length; i++) {
            uint256 playerID = updates.playerStatUpdateIDs[i];
            uint8[3] memory currentStats = CHARACTER_CARD.getStats(
                gameID,
                playerID
            );
            uint8[3] memory stats;
            // Subtracts from updates down to zero, may set higher than max, will get limited upon setting on CC
            stats[0] = updates.playerStatUpdates[i][0] < 0
                ? StateUpdateHelpers.subToZero(
                    currentStats[0],
                    StateUpdateHelpers.absoluteValue(
                        updates.playerStatUpdates[i][0]
                    )
                )
                : currentStats[0] + uint8(updates.playerStatUpdates[i][0]);
            stats[1] = updates.playerStatUpdates[i][1] < 0
                ? StateUpdateHelpers.subToZero(
                    currentStats[1],
                    StateUpdateHelpers.absoluteValue(
                        updates.playerStatUpdates[i][1]
                    )
                )
                : currentStats[1] + uint8(updates.playerStatUpdates[i][1]);
            stats[2] = updates.playerStatUpdates[i][2] < 0
                ? StateUpdateHelpers.subToZero(
                    currentStats[2],
                    StateUpdateHelpers.absoluteValue(
                        updates.playerStatUpdates[i][2]
                    )
                )
                : currentStats[2] + uint8(updates.playerStatUpdates[i][2]);
            CHARACTER_CARD.setStats(stats, gameID, playerID);
        }
    }

    function updatePlayerHands(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        // TODO: transfer item to bank if in inventory + removing from hand
        for (uint256 i = 0; i < updates.playerEquipIDs.length; i++) {
            bool leftHand = updates.playerEquipHands[i] == 0;
            if (leftHand) {
                CHARACTER_CARD.setLeftHandItem(
                    updates.playerEquips[i],
                    gameID,
                    updates.playerEquipIDs[i]
                );
            } else {
                CHARACTER_CARD.setRightHandItem(
                    updates.playerEquips[i],
                    gameID,
                    updates.playerEquipIDs[i]
                );
            }
        }
    }

    function applyActivityEffects(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        for (uint256 i = 0; i < updates.activeActions.length; i++) {
            CHARACTER_CARD.setAction(
                updates.activeActions[i],
                gameID,
                updates.playerActiveActionIDs[i]
            );
            uint256 cardTypeID = updates.activeActionResults[i];
            string memory cardType;
            if (cardTypeID == 1) {
                cardType = "Event";
            } else if (cardTypeID == 2) {
                cardType = "Ambush";
            } else if (cardTypeID == 3) {
                cardType = "Treasure";
            } else {
                cardType = "None";
            }
            CHARACTER_CARD.setActionResults(
                cardType,
                updates.activeActionResultCard[i][0],
                updates.activeActionResultCard[i][1],
                updates.activeActionInventoryChanges[i],
                updates.playerStatUpdates.length > i
                    ? updates.playerStatUpdates[i]
                    : [int8(0), int8(0), int8(0)],
                gameID,
                updates.playerActiveActionIDs[i]
            );
        }
    }

    function applyDayPhaseEffects(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        for (uint256 i = 0; i < updates.activeActions.length; i++) {
            uint256 cardTypeID = updates.activeActionResults[i];
            string memory cardType;
            if (cardTypeID == 1) {
                cardType = "Event";
            } else if (cardTypeID == 2) {
                cardType = "Ambush";
            } else if (cardTypeID == 3) {
                cardType = "Treasure";
            } else {
                cardType = "None";
            }
            CHARACTER_CARD.setDayPhaseResults(
                cardType,
                updates.activeActionResultCard[i][0],
                updates.activeActionResultCard[i][1],
                updates.activeActionInventoryChanges[i],
                updates.playerStatUpdates[i],
                gameID,
                updates.playerActiveActionIDs[i]
            );
        }
    }

    function transferPlayerItems(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        // Transfers to / from players (item gains / losses)
        TokenInventory ti = TokenInventory(GAME_BOARD.tokenInventory());
        for (uint256 i = 0; i < updates.playerTransfersTo.length; i++) {
            if (
                updates.playerTransfersFrom[i] != 0 ||
                updates.playerTransfersTo[i] != 0
            ) {
                if (
                    ti.ITEM_TOKEN().balance(
                        updates.playerTransferItemTypes[i],
                        gameID,
                        updates.playerTransfersFrom[i]
                    ) >= updates.playerTransferQtys[i]
                ) {
                    // transfer item to player or to bank
                    ti.ITEM_TOKEN().transfer(
                        updates.playerTransferItemTypes[i],
                        gameID,
                        updates.playerTransfersFrom[i],
                        updates.playerTransfersTo[i],
                        updates.playerTransferQtys[i]
                    );
                    // check if item is artifact
                    if (
                        StateUpdateHelpers.itemIsArtifact(
                            updates.playerTransferItemTypes[i]
                        )
                    ) {
                        // set artifact for player
                        CHARACTER_CARD.setArtifact(
                            updates.playerTransferItemTypes[i],
                            gameID,
                            updates.playerTransfersTo[i]
                        );
                        GAME_BOARD.setArtifactFound(
                            gameID,
                            GAME_BOARD.currentPlayZone(
                                gameID,
                                updates.playerTransfersTo[i]
                            )
                        );
                    }
                }
            }
        }
        // Hand losses
        for (uint256 i = 0; i < updates.playerHandLossIDs.length; i++) {
            uint256 playerID = updates.playerHandLossIDs[i];
            if (updates.playerHandLosses[i] == 1) {
                // Right hand loss
                string memory rightHandItem = CHARACTER_CARD.rightHandItem(
                    gameID,
                    playerID
                );
                if (
                    ti.ITEM_TOKEN().balance(rightHandItem, gameID, playerID) > 0
                ) {
                    // Transfer to bank
                    ti.ITEM_TOKEN().transfer(
                        rightHandItem,
                        gameID,
                        playerID,
                        0,
                        1
                    );
                }
                // set hand to empty
                CHARACTER_CARD.setRightHandItem(
                    "",
                    gameID,
                    updates.playerHandLossIDs[i]
                );
            } else {
                // Left hand loss
                string memory leftHandItem = CHARACTER_CARD.leftHandItem(
                    gameID,
                    playerID
                );
                if (
                    ti.ITEM_TOKEN().balance(leftHandItem, gameID, playerID) > 0
                ) {
                    // Transfer to bank
                    ti.ITEM_TOKEN().transfer(
                        leftHandItem,
                        gameID,
                        playerID,
                        0,
                        1
                    );
                }
                // set hand to empty
                CHARACTER_CARD.setLeftHandItem(
                    "",
                    gameID,
                    updates.playerHandLossIDs[i]
                );
            }
        }
    }

    function transferZoneItems(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        // these are all current zone to player or player to current zone
        // we don't cover the zone to zone or player to other zone transfer cases yet
        TokenInventory ti = TokenInventory(GAME_BOARD.tokenInventory());
        for (uint256 i = 0; i < updates.zoneTransfersTo.length; i++) {
            // If to == current zone, from = playerID
            // if from == current zone, to = playerID
            uint256 toID = updates.zoneTransfersTo[i] == 10000000000
                ? StateUpdateHelpers.currentZoneIndex(
                    address(GAME_BOARD),
                    gameID,
                    updates.zoneTransfersFrom[i]
                )
                : updates.zoneTransfersTo[i];
            uint256 fromID = updates.zoneTransfersFrom[i] == 10000000000
                ? StateUpdateHelpers.currentZoneIndex(
                    address(GAME_BOARD),
                    gameID,
                    updates.zoneTransfersTo[i]
                )
                : updates.zoneTransfersFrom[i];
            uint256 tferQty = updates.zoneTransferQtys[i];
            string memory tferItem = updates.zoneTransferItemTypes[i];
            if (updates.zoneTransfersTo[i] == 10000000000) {
                // Player transferring item to zone
                ti.ITEM_TOKEN().transferToZone(
                    tferItem,
                    gameID,
                    fromID,
                    toID,
                    tferQty
                );
            } else if (updates.zoneTransfersFrom[i] == 10000000000) {
                // Zone transferring item to player
                ti.ITEM_TOKEN().transferFromZone(
                    tferItem,
                    gameID,
                    fromID,
                    toID,
                    tferQty
                );
            }
        }
    }

    function moveThroughPath(
        string[] memory zonePath,
        uint256 gameID,
        uint256 playerID,
        uint256[] memory randomness
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // TODO: look into extending this beyond 4...
        HexplorationZone.Tile[] memory tiles = new HexplorationZone.Tile[](
            zonePath.length > 4 ? 4 : zonePath.length
        );
        HexplorationZone hexZone = HexplorationZone(
            GAME_BOARD.hexZoneAddress()
        );
        TokenInventory ti = TokenInventory(GAME_BOARD.tokenInventory());
        string memory currentZone;
        for (uint256 i = 0; i < tiles.length; i++) {
            currentZone = zonePath[i];
            if (
                hexZone.tile(gameID, currentZone) ==
                HexplorationZone.Tile.RelicMystery
            ) {
                tiles[i] = RELIC_MANAGEMENT.revealRelic(
                    address(GAME_BOARD),
                    gameID,
                    currentZone,
                    randomness[i]
                );
            } else {
                // Standard tile selection
                // TODO: set to 0 if already set.
                // Won't double set, but want to avoid unnecessary computation.

                // Need # 1 - 4 for tile selection
                tiles[i] = HexplorationZone.Tile(((randomness[i]) % 4) + 1);
            }
        }

        GAME_BOARD.moveThroughPath(zonePath, playerID, gameID, tiles);

        // Current zone is now set to the final space
        HexplorationZone.Tile zoneTile = hexZone.tile(gameID, currentZone);
        if (
            StateUpdateHelpers.stringsMatch(
                currentZone,
                GAME_BOARD.initialPlayZone(gameID)
            ) &&
            StateUpdateHelpers.playerHasArtifact(
                address(CHARACTER_CARD),
                gameID,
                playerID
            )
        ) {
            // last space is at ship and player holds artifact
            dropArtifactAtShip(gameID, playerID);
        } else if (uint256(zoneTile) > 6 && uint256(zoneTile) < 12) {
            // player is on relic space
            RELIC_MANAGEMENT.pickupRelic(
                address(GAME_BOARD),
                address(CHARACTER_CARD),
                gameID,
                playerID,
                currentZone,
                zoneTile
            );
        }
    }

    // function resetPlayerRelic(
    //     uint256 gameID,
    //     uint256 playerID,
    //     TokenInventory ti
    // ) internal {
    //     // TokenInventory ti = TokenInventory(GAME_BOARD.tokenInventory());
    //     string[] memory relicTypes = ti.RELIC_TOKEN().getTokenTypes();

    //     for (uint256 i = 1; i < relicTypes.length; i++) {
    //         // Start at 1 so we don't use mystery relic
    //         if (ti.RELIC_TOKEN().balance(relicTypes[i], gameID, playerID) > 0) {
    //             // find location of that relic on board
    //             // transfer back to zone from player
    //             ti.RELIC_TOKEN().transferToZone(
    //                 relicTypes[i],
    //                 gameID,
    //                 playerID,
    //                 StateUpdateHelpers.zoneIndex(
    //                     address(GAME_BOARD),
    //                     GAME_BOARD.relicLocation(gameID, relicTypes[i])
    //                 ),
    //                 1
    //             );
    //             break;
    //         }
    //     }
    // }

    function updatePlayPhase(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        // set to NEXT play phase
        if (bytes(updates.gamePhase).length > 0) {
            TokenInventory ti = TokenInventory(GAME_BOARD.tokenInventory());
            if (
                keccak256(abi.encodePacked(updates.gamePhase)) ==
                keccak256(abi.encodePacked("Night"))
            ) {
                // set to day
                ti.DAY_NIGHT_TOKEN().transfer(
                    "Day",
                    gameID,
                    0,
                    GAME_BOARD_WALLET_ID,
                    1
                );
                ti.DAY_NIGHT_TOKEN().transfer(
                    "Night",
                    gameID,
                    GAME_BOARD_WALLET_ID,
                    0,
                    1
                );
                GAME_EVENTS.emitGamePhaseChange(gameID, "Day");
            } else {
                // set to night
                ti.DAY_NIGHT_TOKEN().transfer(
                    "Day",
                    gameID,
                    GAME_BOARD_WALLET_ID,
                    0,
                    1
                );
                ti.DAY_NIGHT_TOKEN().transfer(
                    "Night",
                    gameID,
                    0,
                    GAME_BOARD_WALLET_ID,
                    1
                );
                GAME_EVENTS.emitGamePhaseChange(gameID, "Night");
            }
        }
    }

    function dropArtifactAtShip(uint256 gameID, uint256 playerID) internal {
        // Transfer artifact to ship wallet
        TokenInventory ti = TokenInventory(GAME_BOARD.tokenInventory());
        string memory artifact = CHARACTER_CARD.artifact(gameID, playerID);
        ti.ITEM_TOKEN().transfer(artifact, gameID, playerID, SHIP_WALLET_ID, 1);
        GAME_BOARD.setArtifactRetrieved(gameID, playerID, artifact);
        // remove artifact from character card
        CHARACTER_CARD.setArtifact("", gameID, playerID);
    }
}
