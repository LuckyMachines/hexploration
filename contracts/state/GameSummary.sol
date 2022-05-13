// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "../HexplorationBoard.sol";
import "../HexplorationZone.sol";

library GameSummary {
    // enemies
    // tokens
    function activeZones(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string[] memory zones, HexplorationZone.Tile[] memory tiles)
    {}

    function landingSite(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory)
    {}

    function currentLocation(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (string memory)
    {}

    function allPlayerLocations(address gameBoardAddress, uint256 gameID)
        public
        view
        returns (uint256[] memory, string[] memory)
    {
        // returns [player IDs], [zones]
    }
}
