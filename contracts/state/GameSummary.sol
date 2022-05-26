// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "../HexplorationBoard.sol";
import "../HexplorationZone.sol";
import "@luckymachines/game-core/contracts/src/v0.0/PlayerRegistry.sol";
import "./CharacterCard.sol";
import "../tokens/TokenInventory.sol";
import "../HexplorationQueue.sol";

library GameSummary {
    // enemies
    // tokens
    function boardSize(address gameBoardAddress)
        public
        view
        returns (uint256 rows, uint256 columns)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        rows = board.gridHeight();
        columns = board.gridWidth();
    }

    function isRegistered(
        address gameBoardAddress,
        uint256 gameID,
        address playerAddress
    ) public view returns (bool) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        return pr.isRegistered(gameID, playerAddress);
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

    function getAvailableGameIDs() public view returns (uint256[] memory) {
        // TODO: return available game IDs
    }

    function currentGameplayQueue(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (uint256)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        HexplorationQueue q = HexplorationQueue(board.gameplayQueue());
        return q.queueID(gameID);
    }

    function currentPhase(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory phase)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        TokenInventory tokens = TokenInventory(board.tokenInventory());

        uint256 dayBalance = tokens.DAY_NIGHT_TOKEN().balance("Day", gameID, 1);
        phase = dayBalance > 0 ? "Day" : "Night";
    }

    function activeZones(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string[] memory zones, uint16[] memory tiles)
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
                activeZoneCount++;
            }
        }
    }

    function landingSite(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory)
    {
        return HexplorationBoard(gameBoardAddress).initialPlayZone(gameID);
    }

    function currentLocation(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        return board.currentPlayZone(gameID, pr.playerID(gameID, msg.sender));
    }

    function allPlayerLocations(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (uint256[] memory, string[] memory)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);
        uint256[] memory playerIDs = new uint256[](totalRegistrations);
        string[] memory playerZones = new string[](totalRegistrations);
        for (uint256 i = 0; i < totalRegistrations; i++) {
            playerIDs[i] = i + 1;
            playerZones[i] = board.currentPlayZone(gameID, i + 1);
        }
        return (playerIDs, playerZones);
    }

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

    function inventoryArtifactExists(
        string memory tokenType,
        address inventoryAddress,
        uint256 gameID,
        uint256 holderID
    ) internal view returns (bool) {
        return
            TokenInventory(inventoryAddress).ARTIFACT_TOKEN().balance(
                tokenType,
                gameID,
                holderID
            ) > 0;
    }

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
        uint256 playerID = pr.playerID(gameID, msg.sender);
        movement = cc.movement(gameID, playerID);
        agility = cc.agility(gameID, playerID);
        dexterity = cc.dexterity(gameID, playerID);
    }

    function currentHandInventory(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory leftHandItem, string memory rightHandItem)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, msg.sender);
        leftHandItem = inventoryItemExists(
            cc.leftHandItem(gameID, playerID),
            board.tokenInventory(),
            gameID,
            PlayerRegistry(board.prAddress()).playerID(gameID, msg.sender)
        )
            ? cc.leftHandItem(gameID, playerID)
            : "";

        rightHandItem = inventoryItemExists(
            cc.rightHandItem(gameID, playerID),
            board.tokenInventory(),
            gameID,
            PlayerRegistry(board.prAddress()).playerID(gameID, msg.sender)
        )
            ? cc.rightHandItem(gameID, playerID)
            : "";
    }

    function activeInventory(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (
            string memory artifact,
            string memory status,
            string memory relic,
            bool shield,
            bool campsite
        )
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 playerID = pr.playerID(gameID, msg.sender);
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
    }

    function inactiveInventory(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string[] memory itemTypes, uint256[] memory itemBalances)
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        TokenInventory ti = TokenInventory(board.tokenInventory());
        itemBalances = new uint256[](35);
        itemTypes = new string[](35);
        itemTypes[0] = "Small Ammo";
        itemTypes[1] = "Large Ammo";
        itemTypes[2] = "Batteries";
        itemTypes[3] = "Shield";
        itemTypes[4] = "Portal";
        itemTypes[5] = "On";
        itemTypes[6] = "Off";
        itemTypes[7] = "Rusty Dagger";
        itemTypes[8] = "Rusty Sword";
        itemTypes[9] = "Rusty Pistol";
        itemTypes[10] = "Rusty Rifle";
        itemTypes[11] = "Shiny Dagger";
        itemTypes[12] = "Shiny Sword";
        itemTypes[13] = "Shiny Pistol";
        itemTypes[14] = "Shiny Rifle";
        itemTypes[15] = "Laser Dagger";
        itemTypes[16] = "Laser Sword";
        itemTypes[17] = "Laser Pistol";
        itemTypes[18] = "Laser Rifle";
        itemTypes[19] = "Glow stick";
        itemTypes[20] = "Flashlight";
        itemTypes[21] = "Flood light";
        itemTypes[22] = "Nightvision Goggles";
        itemTypes[23] = "Personal Shield";
        itemTypes[24] = "Bubble Shield";
        itemTypes[25] = "Frag Grenade";
        itemTypes[26] = "Fire Grenade";
        itemTypes[27] = "Shock Grenade";
        itemTypes[28] = "HE Mortar";
        itemTypes[29] = "Incendiary Mortar";
        itemTypes[30] = "EMP Mortar";
        itemTypes[31] = "Power Glove";
        itemTypes[32] = "Remote Launch and Guidance System";
        itemTypes[33] = "Teleporter Pack";
        itemTypes[34] = "Campsite";
        uint256 playerID = pr.playerID(gameID, msg.sender);
        if (ti.holdsToken(playerID, TokenInventory.Token.Item, gameID)) {
            Item itemToken = ti.ITEM_TOKEN();
            string[] memory types = itemToken.getTokenTypes();
            for (uint256 i = 0; i < itemBalances.length; i++) {
                itemTypes[i] = types[i];
                itemBalances[i] = itemToken.balance(types[i], gameID, playerID);
            }
        }
        // uint256 campsiteBalance = ti.ITEM_TOKEN().balance(
        //     "Campsite",
        //     gameID,
        //     playerID
        // );
        // itemBalances[34] = campsiteBalance;
    }

    // TODO:
    // Functions to complete
    function activeAction(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory action)
    {}

    function lastPlayerActions(address gameBoardAddress, uint256 gameID)
        public
        returns (
            uint256[] memory playerIDs,
            string[] memory dayTimeActionEffect,
            string[] memory activeActionEffect,
            string[] memory currentActiveAction
        )
    {
        // returns
        // playerIDs
        // dayTimeActionEffect
        // activeActionEffect
        // currentActiveAction
    }
}
