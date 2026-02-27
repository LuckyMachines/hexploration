// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

import "./HexplorationBoard.sol";
import "./HexplorationQueue.sol";
import "./RandomIndices.sol";

contract HexplorationDisputeResolver is RandomIndices {
    uint256 private constant CURRENT_PLAY_ZONE = 10000000000;

    function resolveCampSetupDisputes(
        uint256[] memory zoneTransfersTo,
        uint256[] memory zoneTransfersFrom,
        uint256[] memory zoneTransferQtys,
        string[] memory zoneTransferItemTypes,
        uint256 gameID,
        string[4] memory currentPlayZones,
        address gameBoardAddress,
        address queueAddress
    )
        external
        view
        returns (
            uint256[] memory nextZoneTransfersTo,
            uint256[] memory nextZoneTransfersFrom,
            uint256[] memory nextZoneTransferQtys
        )
    {
        uint256 randomness = _getDisputeRandomness(gameID, queueAddress);

        // campsite disputes hardcoded for max 2 disputes
        // with 4 players, no more than 2 disputes will ever occur (1-3 or 2-2 splits)
        string[2] memory campsiteSetupDisputes;
        uint256[2] memory campsiteSetups;
        for (uint256 i = 0; i < zoneTransfersTo.length; i++) {
            if (
                zoneTransfersTo[i] == CURRENT_PLAY_ZONE &&
                stringsMatch(zoneTransferItemTypes[i], "Campsite")
            ) {
                if (bytes(campsiteSetupDisputes[0]).length == 0) {
                    campsiteSetupDisputes[0] = HexplorationBoard(
                        gameBoardAddress
                    ).currentPlayZone(gameID, zoneTransfersFrom[i]);
                } else if (
                    bytes(campsiteSetupDisputes[1]).length == 0 &&
                    !stringsMatch(
                        currentPlayZones[zoneTransfersFrom[i] - 1],
                        campsiteSetupDisputes[0]
                    )
                ) {
                    campsiteSetupDisputes[1] = HexplorationBoard(
                        gameBoardAddress
                    ).currentPlayZone(gameID, zoneTransfersFrom[i]);
                }
                uint256 currentIndex = stringsMatch(
                    campsiteSetupDisputes[0],
                    currentPlayZones[zoneTransfersFrom[i] - 1]
                )
                    ? 0
                    : 1;
                campsiteSetups[currentIndex]++;
            }
        }

        uint256[][2] memory campsiteSetupPlayers;
        campsiteSetupPlayers[0] = new uint256[](campsiteSetups[0]);
        campsiteSetupPlayers[1] = new uint256[](campsiteSetups[1]);
        uint256[][2] memory campsiteSetupIndices;
        campsiteSetupIndices[0] = new uint256[](campsiteSetups[0]);
        campsiteSetupIndices[1] = new uint256[](campsiteSetups[1]);
        uint256[2] memory positions;

        if (campsiteSetups[0] > 1 || campsiteSetups[1] > 1) {
            for (uint256 i = 0; i < zoneTransfersTo.length; i++) {
                if (
                    zoneTransfersTo[i] == CURRENT_PLAY_ZONE &&
                    stringsMatch(zoneTransferItemTypes[i], "Campsite")
                ) {
                    uint256 currentIndex = stringsMatch(
                        campsiteSetupDisputes[0],
                        currentPlayZones[zoneTransfersFrom[i] - 1]
                    )
                        ? 0
                        : 1;
                    campsiteSetupPlayers[currentIndex][
                        positions[currentIndex]
                    ] = zoneTransfersFrom[i];
                    campsiteSetupIndices[currentIndex][
                        positions[currentIndex]
                    ] = i;
                    positions[currentIndex]++;
                }
            }

            uint256[2] memory campsiteSetupDisputeWinners;
            campsiteSetupDisputeWinners[0] = campsiteSetupPlayers[0].length > 0
                ? campsiteSetupPlayers[0][
                    randomness % campsiteSetupPlayers[0].length
                ]
                : 0;
            campsiteSetupDisputeWinners[1] = campsiteSetupPlayers[1].length > 0
                ? campsiteSetupPlayers[1][
                    randomness % campsiteSetupPlayers[1].length
                ]
                : 0;

            for (uint256 i = 0; i < campsiteSetupPlayers[0].length; i++) {
                if (
                    campsiteSetupPlayers[0][i] != campsiteSetupDisputeWinners[0]
                ) {
                    zoneTransfersTo[campsiteSetupIndices[0][i]] = 0;
                    zoneTransfersFrom[campsiteSetupIndices[0][i]] = 0;
                    zoneTransferQtys[campsiteSetupIndices[0][i]] = 0;
                }
            }
            for (uint256 i = 0; i < campsiteSetupPlayers[1].length; i++) {
                if (
                    campsiteSetupPlayers[1][i] != campsiteSetupDisputeWinners[1]
                ) {
                    zoneTransfersTo[campsiteSetupIndices[1][i]] = 0;
                    zoneTransfersFrom[campsiteSetupIndices[1][i]] = 0;
                    zoneTransferQtys[campsiteSetupIndices[1][i]] = 0;
                }
            }
        }

        return (zoneTransfersTo, zoneTransfersFrom, zoneTransferQtys);
    }

    function resolveCampBreakDownDisputes(
        uint256[] memory zoneTransfersTo,
        uint256[] memory zoneTransfersFrom,
        uint256[] memory zoneTransferQtys,
        string[] memory zoneTransferItemTypes,
        uint256 gameID,
        string[4] memory currentPlayZones,
        address gameBoardAddress,
        address queueAddress
    )
        external
        view
        returns (
            uint256[] memory nextZoneTransfersTo,
            uint256[] memory nextZoneTransfersFrom,
            uint256[] memory nextZoneTransferQtys
        )
    {
        uint256 randomness = _getDisputeRandomness(gameID, queueAddress);

        string[2] memory campsiteBreakDownDisputes;
        uint256[2] memory campsiteBreakDowns;
        for (uint256 i = 0; i < zoneTransfersFrom.length; i++) {
            if (
                zoneTransfersFrom[i] == CURRENT_PLAY_ZONE &&
                stringsMatch(zoneTransferItemTypes[i], "Campsite")
            ) {
                if (bytes(campsiteBreakDownDisputes[0]).length == 0) {
                    campsiteBreakDownDisputes[0] = HexplorationBoard(
                        gameBoardAddress
                    ).currentPlayZone(gameID, zoneTransfersTo[i]);
                } else if (
                    bytes(campsiteBreakDownDisputes[1]).length == 0 &&
                    !stringsMatch(
                        currentPlayZones[zoneTransfersTo[i] - 1],
                        campsiteBreakDownDisputes[0]
                    )
                ) {
                    campsiteBreakDownDisputes[1] = HexplorationBoard(
                        gameBoardAddress
                    ).currentPlayZone(gameID, zoneTransfersTo[i]);
                }
                uint256 currentIndex = stringsMatch(
                    campsiteBreakDownDisputes[0],
                    currentPlayZones[zoneTransfersTo[i] - 1]
                )
                    ? 0
                    : 1;
                campsiteBreakDowns[currentIndex]++;
            }
        }

        uint256[][2] memory campsiteBreakDownPlayers;
        campsiteBreakDownPlayers[0] = new uint256[](campsiteBreakDowns[0]);
        campsiteBreakDownPlayers[1] = new uint256[](campsiteBreakDowns[1]);
        uint256[][2] memory campsiteBreakDownIndices;
        campsiteBreakDownIndices[0] = new uint256[](campsiteBreakDowns[0]);
        campsiteBreakDownIndices[1] = new uint256[](campsiteBreakDowns[1]);
        uint256[2] memory positions;

        if (campsiteBreakDowns[0] > 1 || campsiteBreakDowns[1] > 1) {
            for (uint256 i = 0; i < zoneTransfersFrom.length; i++) {
                if (
                    zoneTransfersFrom[i] == CURRENT_PLAY_ZONE &&
                    stringsMatch(zoneTransferItemTypes[i], "Campsite")
                ) {
                    uint256 currentIndex = stringsMatch(
                        campsiteBreakDownDisputes[0],
                        currentPlayZones[zoneTransfersTo[i] - 1]
                    )
                        ? 0
                        : 1;
                    campsiteBreakDownPlayers[currentIndex][
                        positions[currentIndex]
                    ] = zoneTransfersTo[i];
                    campsiteBreakDownIndices[currentIndex][
                        positions[currentIndex]
                    ] = i;
                    positions[currentIndex]++;
                }
            }

            uint256[2] memory campsiteBreakDownDisputeWinners;
            campsiteBreakDownDisputeWinners[0] = campsiteBreakDownPlayers[0]
                .length > 0
                ? campsiteBreakDownPlayers[0][
                    randomness % campsiteBreakDownPlayers[0].length
                ]
                : 0;
            campsiteBreakDownDisputeWinners[1] = campsiteBreakDownPlayers[1]
                .length > 0
                ? campsiteBreakDownPlayers[1][
                    randomness % campsiteBreakDownPlayers[1].length
                ]
                : 0;

            for (uint256 i = 0; i < campsiteBreakDownPlayers[0].length; i++) {
                if (
                    campsiteBreakDownPlayers[0][i] !=
                    campsiteBreakDownDisputeWinners[0]
                ) {
                    zoneTransfersTo[campsiteBreakDownIndices[0][i]] = 0;
                    zoneTransfersFrom[campsiteBreakDownIndices[0][i]] = 0;
                    zoneTransferQtys[campsiteBreakDownIndices[0][i]] = 0;
                }
            }
            for (uint256 i = 0; i < campsiteBreakDownPlayers[1].length; i++) {
                if (
                    campsiteBreakDownPlayers[1][i] !=
                    campsiteBreakDownDisputeWinners[1]
                ) {
                    zoneTransfersTo[campsiteBreakDownIndices[1][i]] = 0;
                    zoneTransfersFrom[campsiteBreakDownIndices[1][i]] = 0;
                    zoneTransferQtys[campsiteBreakDownIndices[1][i]] = 0;
                }
            }
        }

        return (zoneTransfersTo, zoneTransfersFrom, zoneTransferQtys);
    }

    function resolveDigDisputes(
        uint256[] memory playerTransfersTo,
        uint256[] memory playerTransfersFrom,
        uint256[] memory playerTransferQtys,
        string[] memory playerTransferItemTypes,
        uint256 gameID,
        string[4] memory currentPlayZones,
        address gameBoardAddress,
        address queueAddress
    )
        external
        view
        returns (
            uint256[] memory nextPlayerTransfersTo,
            uint256[] memory nextPlayerTransfersFrom,
            uint256[] memory nextPlayerTransferQtys
        )
    {
        uint256 randomness = _getDisputeRandomness(gameID, queueAddress);

        string[2] memory digDisputes;
        uint256[2] memory digs;
        for (uint256 i = 0; i < playerTransfersTo.length; i++) {
            if (
                playerTransfersTo[i] != 0 &&
                itemIsArtifact(playerTransferItemTypes[i])
            ) {
                if (bytes(digDisputes[0]).length == 0) {
                    digDisputes[0] = HexplorationBoard(gameBoardAddress)
                        .currentPlayZone(gameID, playerTransfersTo[i]);
                } else if (
                    bytes(digDisputes[1]).length == 0 &&
                    !stringsMatch(
                        currentPlayZones[playerTransfersTo[i] - 1],
                        digDisputes[0]
                    )
                ) {
                    digDisputes[1] = HexplorationBoard(gameBoardAddress)
                        .currentPlayZone(gameID, playerTransfersTo[i]);
                }
                uint256 currentIndex = stringsMatch(
                    digDisputes[0],
                    currentPlayZones[playerTransfersTo[i] - 1]
                )
                    ? 0
                    : 1;
                digs[currentIndex]++;
            }
        }

        uint256[][2] memory digPlayers;
        digPlayers[0] = new uint256[](digs[0]);
        digPlayers[1] = new uint256[](digs[1]);
        uint256[][2] memory digIndices;
        digIndices[0] = new uint256[](digs[0]);
        digIndices[1] = new uint256[](digs[1]);
        uint256[2] memory positions;

        if (digs[0] > 1 || digs[1] > 1) {
            for (uint256 i = 0; i < playerTransfersTo.length; i++) {
                if (
                    playerTransfersTo[i] != 0 &&
                    itemIsArtifact(playerTransferItemTypes[i])
                ) {
                    uint256 currentIndex = stringsMatch(
                        digDisputes[0],
                        currentPlayZones[playerTransfersTo[i] - 1]
                    )
                        ? 0
                        : 1;
                    digPlayers[currentIndex][positions[currentIndex]] = playerTransfersTo[
                        i
                    ];
                    digIndices[currentIndex][positions[currentIndex]] = i;
                    positions[currentIndex]++;
                }
            }

            uint256[2] memory digDisputeWinners;
            digDisputeWinners[0] = digPlayers[0].length > 0
                ? digPlayers[0][randomness % digPlayers[0].length]
                : 0;
            digDisputeWinners[1] = digPlayers[1].length > 0
                ? digPlayers[1][randomness % digPlayers[1].length]
                : 0;

            for (uint256 i = 0; i < digPlayers[0].length; i++) {
                if (digPlayers[0][i] != digDisputeWinners[0]) {
                    playerTransfersTo[digIndices[0][i]] = 0;
                    playerTransfersFrom[digIndices[0][i]] = 0;
                    playerTransferQtys[digIndices[0][i]] = 0;
                }
            }
            for (uint256 i = 0; i < digPlayers[1].length; i++) {
                if (digPlayers[1][i] != digDisputeWinners[1]) {
                    playerTransfersTo[digIndices[1][i]] = 0;
                    playerTransfersFrom[digIndices[1][i]] = 0;
                    playerTransferQtys[digIndices[1][i]] = 0;
                }
            }
        }

        return (playerTransfersTo, playerTransfersFrom, playerTransferQtys);
    }

    function _getDisputeRandomness(
        uint256 gameID,
        address queueAddress
    ) internal view returns (uint256) {
        HexplorationQueue queue = HexplorationQueue(payable(queueAddress));
        uint256 currentQueueID = queue.queueID(gameID);
        return
            queue.isInTestMode()
                ? queue.randomness(currentQueueID, uint256(RandomIndex.TieDispute))
                : expandNumber(
                    queue.randomness(currentQueueID, 0),
                    RandomIndex.TieDispute
                );
    }

    function itemIsArtifact(
        string memory itemType
    ) internal pure returns (bool) {
        return (
            stringsMatch(itemType, "Engraved Tablet") ||
            stringsMatch(itemType, "Sigil Gem") ||
            stringsMatch(itemType, "Ancient Tome")
        );
    }

    function stringsMatch(
        string memory s1,
        string memory s2
    ) internal pure returns (bool) {
        return keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }
}
