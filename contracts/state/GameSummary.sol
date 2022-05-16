// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "../HexplorationBoard.sol";
import "../HexplorationZone.sol";
import "@luckymachines/game-core/contracts/src/v0.0/PlayerRegistry.sol";
import "./CharacterCard.sol";
// Game Tokens
import "../tokens/GameToken.sol";

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

    function currentPhase(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory phase)
    {
        // get balance of day token
        // we have to pull the token address from somewhere
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

    function currentPlayerStats(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (
            uint8 movement,
            uint8 agility,
            uint8 dexterity,
            string memory leftHandItem,
            string memory rightHandItem,
            string memory artifact,
            string memory status,
            string memory relic,
            bool shield,
            bool campsite
        )
    {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(board.characterCard());
        movement = cc.movement(gameID, msg.sender);
        agility = cc.agility(gameID, msg.sender);
        dexterity = cc.dexterity(gameID, msg.sender);
        leftHandItem = cc.leftHandItem(gameID, msg.sender);
        rightHandItem = cc.rightHandItem(gameID, msg.sender);
        artifact = "";
        status = "";
        relic = "";
        shield = false;
        campsite = false;
    }
}
