// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

// Game Tokens
import "./GameToken.sol";

contract TokenInventory is AccessControlEnumerable {
    enum Token {
        DayNight,
        Disaster,
        Enemy,
        Item,
        PlayerStatus,
        Artifact,
        Relic
    }

    GameToken public DAY_NIGHT_TOKEN;
    GameToken public DISASTER_TOKEN;
    GameToken public ENEMY_TOKEN;
    GameToken public ITEM_TOKEN;
    GameToken public PLAYER_STATUS_TOKEN;
    GameToken public ARTIFACT_TOKEN;
    GameToken public RELIC_TOKEN;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function setTokenAddresses(
        address dayNightAddress,
        address disasterAddress,
        address enemyAddress,
        address itemAddress,
        address playerStatusAddress,
        address relicAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        DAY_NIGHT_TOKEN = GameToken(dayNightAddress);
        DISASTER_TOKEN = GameToken(disasterAddress);
        ENEMY_TOKEN = GameToken(enemyAddress);
        ITEM_TOKEN = GameToken(itemAddress);
        PLAYER_STATUS_TOKEN = GameToken(playerStatusAddress);
        RELIC_TOKEN = GameToken(relicAddress);
    }

    function holdsToken(
        uint256 holderID,
        Token token,
        uint256 gameID
    ) public view returns (bool hasBalance) {
        hasBalance = false;
        string[] memory allTypes;
        if (token == Token.DayNight) {
            allTypes = DAY_NIGHT_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (
                    DAY_NIGHT_TOKEN.balance(allTypes[i], gameID, holderID) > 0
                ) {
                    hasBalance = true;
                    break;
                }
            }
        } else if (token == Token.Disaster) {
            allTypes = DISASTER_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (DISASTER_TOKEN.balance(allTypes[i], gameID, holderID) > 0) {
                    hasBalance = true;
                    break;
                }
            }
        } else if (token == Token.Enemy) {
            allTypes = ENEMY_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (ENEMY_TOKEN.balance(allTypes[i], gameID, holderID) > 0) {
                    hasBalance = true;
                    break;
                }
            }
        } else if (token == Token.Item) {
            allTypes = ITEM_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (ITEM_TOKEN.balance(allTypes[i], gameID, holderID) > 0) {
                    hasBalance = true;
                    break;
                }
            }
        } else if (token == Token.PlayerStatus) {
            allTypes = PLAYER_STATUS_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (
                    PLAYER_STATUS_TOKEN.balance(allTypes[i], gameID, holderID) >
                    0
                ) {
                    hasBalance = true;
                    break;
                }
            }
        } else if (token == Token.Relic) {
            allTypes = RELIC_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (RELIC_TOKEN.balance(allTypes[i], gameID, holderID) > 0) {
                    hasBalance = true;
                    break;
                }
            }
        }
    }

    function heldTokens(
        uint256 holderID,
        Token token,
        uint256 gameID
    ) public view returns (string[] memory tokensHeld) {
        uint256 totalTokensHeld = 0;
        GameToken selectedToken;
        if (token == Token.DayNight) {
            selectedToken = DAY_NIGHT_TOKEN;
        } else if (token == Token.Disaster) {
            selectedToken = DISASTER_TOKEN;
        } else if (token == Token.Enemy) {
            selectedToken = ENEMY_TOKEN;
        } else if (token == Token.Item) {
            selectedToken = ITEM_TOKEN;
        } else if (token == Token.PlayerStatus) {
            selectedToken = PLAYER_STATUS_TOKEN;
        } else if (token == Token.Artifact) {
            selectedToken = ARTIFACT_TOKEN;
        } else if (token == Token.Relic) {
            selectedToken = RELIC_TOKEN;
        }

        string[] memory types = selectedToken.getTokenTypes();
        for (uint256 i = 0; i < types.length; i++) {
            uint256 balance = selectedToken.balance(types[i], gameID, holderID);
            if (balance > 0) {
                ++totalTokensHeld;
            }
        }
        tokensHeld = new string[](totalTokensHeld);
        uint256 outputIndex = 0;
        for (uint256 i = 0; i < types.length; i++) {
            uint256 balance = selectedToken.balance(types[i], gameID, holderID);
            if (balance > 0) {
                tokensHeld[outputIndex] = types[i];
                ++outputIndex;
            }
        }
    }

    function zoneHoldsToken(
        uint256 zoneIndex,
        Token token,
        uint256 gameID
    ) public view returns (uint256 totalTokenTypes) {
        totalTokenTypes = 0;
        string[] memory allTypes;
        if (token == Token.DayNight) {
            allTypes = DAY_NIGHT_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (
                    DAY_NIGHT_TOKEN.zoneBalance(
                        allTypes[i],
                        gameID,
                        zoneIndex
                    ) > 0
                ) {
                    ++totalTokenTypes;
                }
            }
        } else if (token == Token.Disaster) {
            allTypes = DISASTER_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (
                    DISASTER_TOKEN.zoneBalance(allTypes[i], gameID, zoneIndex) >
                    0
                ) {
                    ++totalTokenTypes;
                }
            }
        } else if (token == Token.Enemy) {
            allTypes = ENEMY_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (
                    ENEMY_TOKEN.zoneBalance(allTypes[i], gameID, zoneIndex) > 0
                ) {
                    ++totalTokenTypes;
                }
            }
        } else if (token == Token.Item) {
            allTypes = ITEM_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (
                    ITEM_TOKEN.zoneBalance(allTypes[i], gameID, zoneIndex) > 0
                ) {
                    ++totalTokenTypes;
                }
            }
        } else if (token == Token.PlayerStatus) {
            allTypes = PLAYER_STATUS_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (
                    PLAYER_STATUS_TOKEN.zoneBalance(
                        allTypes[i],
                        gameID,
                        zoneIndex
                    ) > 0
                ) {
                    ++totalTokenTypes;
                }
            }
        } else if (token == Token.Relic) {
            allTypes = RELIC_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (
                    RELIC_TOKEN.zoneBalance(allTypes[i], gameID, zoneIndex) > 0
                ) {
                    ++totalTokenTypes;
                }
            }
        }
    }

    function zoneHeldTokens(
        uint256 zoneIndex,
        Token token,
        uint256 gameID
    ) public view returns (string[] memory tokensHeld) {
        uint256 totalTokensHeld = 0;
        GameToken selectedToken;
        if (token == Token.DayNight) {
            selectedToken = DAY_NIGHT_TOKEN;
        } else if (token == Token.Disaster) {
            selectedToken = DISASTER_TOKEN;
        } else if (token == Token.Enemy) {
            selectedToken = ENEMY_TOKEN;
        } else if (token == Token.Item) {
            selectedToken = ITEM_TOKEN;
        } else if (token == Token.PlayerStatus) {
            selectedToken = PLAYER_STATUS_TOKEN;
        } else if (token == Token.Artifact) {
            selectedToken = ARTIFACT_TOKEN;
        } else if (token == Token.Relic) {
            selectedToken = RELIC_TOKEN;
        }

        string[] memory types = selectedToken.getTokenTypes();
        for (uint256 i = 0; i < types.length; i++) {
            uint256 balance = selectedToken.zoneBalance(
                types[i],
                gameID,
                zoneIndex
            );
            if (balance > 0) {
                ++totalTokensHeld;
            }
        }
        tokensHeld = new string[](totalTokensHeld);
        uint256 outputIndex = 0;
        for (uint256 i = 0; i < types.length; i++) {
            uint256 balance = selectedToken.zoneBalance(
                types[i],
                gameID,
                zoneIndex
            );
            if (balance > 0) {
                tokensHeld[outputIndex] = types[i];
                ++outputIndex;
            }
        }
    }
}
