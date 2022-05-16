// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

// Game Tokens
import "./DayNight.sol";
import "./Disaster.sol";
import "./Enemy.sol";
import "./Item.sol";
import "./PlayerStatus.sol";
import "./Artifact.sol";
import "./Relic.sol";

contract TokenInventory is AccessControlEnumerable {
    DayNight public DAY_NIGHT_TOKEN;
    Disaster public DISASTER_TOKEN;
    Enemy public ENEMY_TOKEN;
    Item public ITEM_TOKEN;
    PlayerStatus public PLAYER_STATUS_TOKEN;
    Artifact public ARTIFACT_TOKEN;
    Relic public RELIC_TOKEN;

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
        DAY_NIGHT_TOKEN = DayNight(dayNightAddress);
        DISASTER_TOKEN = Disaster(disasterAddress);
        ENEMY_TOKEN = Enemy(enemyAddress);
        ITEM_TOKEN = Item(itemAddress);
        PLAYER_STATUS_TOKEN = PlayerStatus(playerStatusAddress);
        ARTIFACT_TOKEN = Artifact(artifactAddress);
        RELIC_TOKEN = Relic(relicAddress);
    }
}
