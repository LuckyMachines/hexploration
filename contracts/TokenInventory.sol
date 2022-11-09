// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

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
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function setTokenAddresses(
        address dayNightAddress,
        address disasterAddress,
        address enemyAddress,
        address itemAddress,
        address playerStatusAddress,
        address artifactAddress,
        address relicAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        DAY_NIGHT_TOKEN = GameToken(dayNightAddress);
        DISASTER_TOKEN = GameToken(disasterAddress);
        ENEMY_TOKEN = GameToken(enemyAddress);
        ITEM_TOKEN = GameToken(itemAddress);
        PLAYER_STATUS_TOKEN = GameToken(playerStatusAddress);
        ARTIFACT_TOKEN = GameToken(artifactAddress);
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
        } else if (token == Token.Artifact) {
            allTypes = ARTIFACT_TOKEN.getTokenTypes();
            for (uint256 i = 0; i < allTypes.length; i++) {
                if (ARTIFACT_TOKEN.balance(allTypes[i], gameID, holderID) > 0) {
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
}
