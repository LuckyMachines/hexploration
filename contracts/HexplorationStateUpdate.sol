// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

// TODO: start using this for state updating outside of controller
// Controller should only be used by users / UI directly sending
// commands. This does things that can only imagine...

// This should be only associated with one board...

import "./HexplorationController.sol";
import "./HexplorationBoard.sol";
import "./decks/CardDeck.sol";
import "./state/CharacterCard.sol";
import "./HexplorationGameplay.sol";

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
    CharacterCard internal CHARACTER_CARD;
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
    constructor(address gameBoardAddress, address characterCardAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        GAME_BOARD = HexplorationBoard(gameBoardAddress);
        CHARACTER_CARD = CharacterCard(characterCardAddress);
    }

    // Admin Functions

    function addVerifiedController(address vcAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    function postUpdates(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // go through values and post everything, transfer all the tokens, and pray
        // use gamestate update contract to post everything
        updatePlayerPositions(updates, gameID);
        updatePlayerStats(updates, gameID);
        updatePlayerHands(updates, gameID);
        transferPlayerItems(updates, gameID);
        transferZoneItems(updates, gameID);
        applyActivityEffects(updates, gameID);
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
        string[] activeActionOptions;
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
            moveThroughPath(
                path,
                gameID,
                updates.playerPositionIDs[i],
                updates.randomness
            );
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
            stats[0] = updates.playerStatUpdates[i][0] < 0
                ? subToZero(
                    currentStats[0],
                    absoluteValue(updates.playerStatUpdates[i][0])
                )
                : currentStats[0] + uint8(updates.playerStatUpdates[i][0]);
            stats[1] = updates.playerStatUpdates[i][1] < 0
                ? subToZero(
                    currentStats[1],
                    absoluteValue(updates.playerStatUpdates[i][1])
                )
                : currentStats[1] + uint8(updates.playerStatUpdates[i][1]);
            stats[2] = updates.playerStatUpdates[i][2] < 0
                ? subToZero(
                    currentStats[2],
                    absoluteValue(updates.playerStatUpdates[i][2])
                )
                : currentStats[2] + uint8(updates.playerStatUpdates[i][2]);
            CHARACTER_CARD.setStats(stats, gameID, playerID);
        }
    }

    function updatePlayerHands(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
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
                gameID,
                updates.playerActiveActionIDs[i]
            );
        }
    }

    function transferPlayerItems(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        TokenInventory ti = TokenInventory(GAME_BOARD.tokenInventory());
        for (uint256 i = 0; i < updates.playerTransfersTo.length; i++) {
            ti.ITEM_TOKEN().transfer(
                updates.playerTransferItemTypes[i],
                gameID,
                updates.playerTransfersFrom[i],
                updates.playerTransfersTo[i],
                updates.playerTransferQtys[i]
            );
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
                ? currentZoneIndex(gameID, updates.zoneTransfersFrom[i])
                : updates.zoneTransfersTo[i];
            uint256 fromID = updates.zoneTransfersFrom[i] == 10000000000
                ? currentZoneIndex(gameID, updates.zoneTransfersTo[i])
                : updates.zoneTransfersFrom[i];
            uint256 tferQty = updates.zoneTransferQtys[i];
            string memory tferItem = updates.zoneTransferItemTypes[i];
            if (updates.zoneTransfersTo[i] == 10000000000) {
                ti.ITEM_TOKEN().transferToZone(
                    tferItem,
                    gameID,
                    fromID,
                    toID,
                    tferQty
                );
            } else if (updates.zoneTransfersFrom[i] == 10000000000) {
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

    function currentZoneIndex(uint256 gameID, uint256 playerID)
        internal
        view
        returns (uint256 index)
    {
        string memory zoneAlias = GAME_BOARD.currentPlayZone(gameID, playerID);
        string[] memory allZones = GAME_BOARD.getZoneAliases();
        index = 1111111111111;
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

    function moveThroughPath(
        string[] memory zonePath,
        uint256 gameID,
        uint256 playerID,
        uint256 randomness
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        //TODO: pick tiles from deck

        HexplorationZone.Tile[] memory tiles = new HexplorationZone.Tile[](
            zonePath.length
        );
        uint256[] memory randomNumbers = new uint256[](zonePath.length);
        randomNumbers[0] = randomness;
        // TODO: expand to more random numbers for length of zone
        // use this when drawing from tile deck
        for (uint256 i = 0; i < zonePath.length; i++) {
            tiles[i] = i == 0 ? HexplorationZone.Tile.Jungle : i == 1
                ? HexplorationZone.Tile.Plains
                : HexplorationZone.Tile.Mountain;
        }

        GAME_BOARD.moveThroughPath(zonePath, playerID, gameID, tiles);
    }

    // Utility
    // returns a - b or 0 if negative;
    function subToZero(uint8 a, uint8 b)
        internal
        pure
        returns (uint8 difference)
    {
        difference = a > b ? a - b : 0;
    }

    function absoluteValue(int8 x) internal pure returns (uint8 absX) {
        absX = x >= 0 ? uint8(x) : uint8(-x);
    }
}
