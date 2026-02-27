// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

import "./CharacterCard.sol";
import "./HexplorationBoard.sol";

library StateUpdateHelpers {
    function checkGameOver(
        address characterCardAddress,
        uint256 gameID
    ) internal view returns (bool) {
        CharacterCard cc = CharacterCard(characterCardAddress);
        // Game is over when all players are dead (any stat at 0)
        // Check players 1-4 (max players)
        bool allDead = true;
        for (uint256 i = 1; i <= 4; i++) {
            uint8[3] memory stats = cc.getStats(gameID, i);
            // Player slot is unused if all stats are 0 AND player was never initialized
            // A living player has all stats > 0
            if (stats[0] > 0 && stats[1] > 0 && stats[2] > 0) {
                allDead = false;
                break;
            }
        }
        return allDead;
    }

    function subToZero(
        uint8 current,
        uint8 amount
    ) internal pure returns (uint8) {
        return current >= amount ? current - amount : 0;
    }

    function absoluteValue(int8 value) internal pure returns (uint8) {
        return value < 0 ? uint8(-value) : uint8(value);
    }

    function itemIsArtifact(
        string memory itemType
    ) internal pure returns (bool) {
        return
            stringsMatch(itemType, "Engraved Tablet") ||
            stringsMatch(itemType, "Sigil Gem") ||
            stringsMatch(itemType, "Ancient Tome");
    }

    function currentZoneIndex(
        address gameBoardAddress,
        uint256 gameID,
        uint256 playerID
    ) internal view returns (uint256) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        string memory zone = board.currentPlayZone(gameID, playerID);
        return board.zoneIndex(zone);
    }

    function stringsMatch(
        string memory s1,
        string memory s2
    ) internal pure returns (bool) {
        return
            keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }

    function playerHasArtifact(
        address characterCardAddress,
        uint256 gameID,
        uint256 playerID
    ) internal view returns (bool) {
        CharacterCard cc = CharacterCard(characterCardAddress);
        string memory art = cc.artifact(gameID, playerID);
        return bytes(art).length > 0;
    }
}
