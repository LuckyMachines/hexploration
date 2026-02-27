// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

import "./HexplorationBoard.sol";
import "./HexplorationZone.sol";
import "@luckymachines/game-core/contracts/src/v0.0/PlayerRegistry.sol";
import "./CharacterCard.sol";
import "./TokenInventory.sol";
import "./HexplorationQueue.sol";
import "./GameWallets.sol";
import "./Utilities.sol";

contract PlayZoneSummary is GameWallets, Utilities, AccessControlEnumerable {
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

    struct InventoryItem {
        string item;
        uint256 quantity;
    }

    struct ZoneInventory {
        string zoneAlias;
        InventoryItem[] inventory;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    // Public Play Zone Summary Functions
    function allPlayZoneInventories(
        address gameBoardAddress,
        uint256 gameID
    ) public view returns (ZoneInventory[] memory allInventory) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        string[] memory zoneAliases = board.getZoneAliases();
        allInventory = new ZoneInventory[](zoneAliases.length);
        for (uint256 i = 0; i < zoneAliases.length; i++) {
            allInventory[i] = ZoneInventory({
                zoneAlias: zoneAliases[i],
                inventory: playZoneInventory(
                    gameBoardAddress,
                    gameID,
                    zoneAliases[i]
                )
            });
        }
    }

    function playZoneInventory(
        address gameBoardAddress,
        uint256 gameID,
        string memory zoneAlias
    ) public view returns (InventoryItem[] memory inventory) {
        uint256 zi = zoneIndex(gameBoardAddress, zoneAlias);
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        TokenInventory tokens = TokenInventory(board.tokenInventory());

        uint256 totalTypes = tokens.zoneHoldsToken(
            zi,
            TokenInventory.Token.DayNight,
            gameID
        ) +
            tokens.zoneHoldsToken(zi, TokenInventory.Token.Disaster, gameID) +
            tokens.zoneHoldsToken(zi, TokenInventory.Token.Enemy, gameID) +
            tokens.zoneHoldsToken(zi, TokenInventory.Token.Item, gameID) +
            tokens.zoneHoldsToken(zi, TokenInventory.Token.Artifact, gameID) +
            tokens.zoneHoldsToken(zi, TokenInventory.Token.Relic, gameID);

        inventory = new InventoryItem[](totalTypes);
        uint256 inventoryPosition = 0;

        if (
            tokens.zoneHoldsToken(zi, TokenInventory.Token.DayNight, gameID) > 0
        ) {
            string[] memory dayNightTokenTypes = tokens
                .DAY_NIGHT_TOKEN()
                .getTokenTypes();
            for (uint256 i = 0; i < dayNightTokenTypes.length; i++) {
                if (
                    tokens.DAY_NIGHT_TOKEN().zoneBalance(
                        dayNightTokenTypes[i],
                        gameID,
                        zi
                    ) > 0
                ) {
                    inventory[inventoryPosition] = InventoryItem({
                        item: dayNightTokenTypes[i],
                        quantity: tokens.DAY_NIGHT_TOKEN().zoneBalance(
                            dayNightTokenTypes[i],
                            gameID,
                            zi
                        )
                    });
                    ++inventoryPosition;
                }
            }
        }

        if (
            tokens.zoneHoldsToken(zi, TokenInventory.Token.Disaster, gameID) > 0
        ) {
            string[] memory disasterTokenTypes = tokens
                .DISASTER_TOKEN()
                .getTokenTypes();
            for (uint256 i = 0; i < disasterTokenTypes.length; i++) {
                if (
                    tokens.DISASTER_TOKEN().zoneBalance(
                        disasterTokenTypes[i],
                        gameID,
                        zi
                    ) > 0
                ) {
                    inventory[inventoryPosition] = InventoryItem({
                        item: disasterTokenTypes[i],
                        quantity: tokens.DISASTER_TOKEN().zoneBalance(
                            disasterTokenTypes[i],
                            gameID,
                            zi
                        )
                    });
                    ++inventoryPosition;
                }
            }
        }

        if (tokens.zoneHoldsToken(zi, TokenInventory.Token.Enemy, gameID) > 0) {
            string[] memory enemyTokenTypes = tokens
                .ENEMY_TOKEN()
                .getTokenTypes();
            for (uint256 i = 0; i < enemyTokenTypes.length; i++) {
                if (
                    tokens.ENEMY_TOKEN().zoneBalance(
                        enemyTokenTypes[i],
                        gameID,
                        zi
                    ) > 0
                ) {
                    inventory[inventoryPosition] = InventoryItem({
                        item: enemyTokenTypes[i],
                        quantity: tokens.ENEMY_TOKEN().zoneBalance(
                            enemyTokenTypes[i],
                            gameID,
                            zi
                        )
                    });
                    ++inventoryPosition;
                }
            }
        }

        if (tokens.zoneHoldsToken(zi, TokenInventory.Token.Item, gameID) > 0) {
            string[] memory itemTokenTypes = tokens
                .ITEM_TOKEN()
                .getTokenTypes();
            for (uint256 i = 0; i < itemTokenTypes.length; i++) {
                if (
                    tokens.ITEM_TOKEN().zoneBalance(
                        itemTokenTypes[i],
                        gameID,
                        zi
                    ) > 0
                ) {
                    inventory[inventoryPosition] = InventoryItem({
                        item: itemTokenTypes[i],
                        quantity: tokens.ITEM_TOKEN().zoneBalance(
                            itemTokenTypes[i],
                            gameID,
                            zi
                        )
                    });
                    ++inventoryPosition;
                }
            }
        }

        if (
            tokens.zoneHoldsToken(zi, TokenInventory.Token.Artifact, gameID) > 0
        ) {
            string[] memory artifactTokenTypes = tokens
                .ARTIFACT_TOKEN()
                .getTokenTypes();
            for (uint256 i = 0; i < artifactTokenTypes.length; i++) {
                if (
                    tokens.ARTIFACT_TOKEN().zoneBalance(
                        artifactTokenTypes[i],
                        gameID,
                        zi
                    ) > 0
                ) {
                    inventory[inventoryPosition] = InventoryItem({
                        item: artifactTokenTypes[i],
                        quantity: tokens.ARTIFACT_TOKEN().zoneBalance(
                            artifactTokenTypes[i],
                            gameID,
                            zi
                        )
                    });
                    ++inventoryPosition;
                }
            }
        }

        if (tokens.zoneHoldsToken(zi, TokenInventory.Token.Relic, gameID) > 0) {
            string[] memory relicTokenTypes = tokens
                .RELIC_TOKEN()
                .getTokenTypes();
            for (uint256 i = 0; i < relicTokenTypes.length; i++) {
                if (
                    tokens.RELIC_TOKEN().zoneBalance(
                        relicTokenTypes[i],
                        gameID,
                        zi
                    ) > 0
                ) {
                    inventory[inventoryPosition] = InventoryItem({
                        item: relicTokenTypes[i],
                        quantity: tokens.RELIC_TOKEN().zoneBalance(
                            relicTokenTypes[i],
                            gameID,
                            zi
                        )
                    });
                    ++inventoryPosition;
                }
            }
        }
    }

    // Internal Stuff
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
