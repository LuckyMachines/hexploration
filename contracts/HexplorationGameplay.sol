// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./HexplorationQueue.sol";
import "./HexplorationStateUpdate.sol";
// import "./state/GameSummary.sol";
import "./HexplorationBoard.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import "./RollDraw.sol";
import "./HexplorationGameplayUpdates.sol";
import "./GameWallets.sol";
import "./CharacterCard.sol";

contract HexplorationGameplay is
    AccessControlEnumerable,
    KeeperCompatibleInterface,
    GameWallets,
    RandomIndices
{
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    HexplorationQueue QUEUE;
    HexplorationStateUpdate GAME_STATE;
    HexplorationBoard GAME_BOARD;
    RollDraw ROLL_DRAW;
    uint256 constant LEFT_HAND = 0;
    uint256 constant RIGHT_HAND = 1;

    // Mapping from QueueID to updates needed to run
    //mapping(uint256 => bool) public readyForKeeper;
    mapping(uint256 => bool) public updatesComplete;

    struct DataSummary {
        uint256 playerPositionUpdates;
        uint256 playerEquips;
        uint256 zoneTransfers;
        uint256 activeActions;
        uint256 playerTransfers;
        uint256 playerStatUpdates;
    }

    struct PlayUpdates {
        uint256[] playerPositionIDs;
        uint256[] spacesToMove;
        uint256[] playerEquipIDs;
        uint256[] playerEquipHands; // 0:left, 1:right
        uint256[] playerHandLossIDs;
        uint256[] playerHandLosses; // 0:left, 1:right
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
        string[][] activeActionOptions;
        uint256[] activeActionResults; // 0 = None, 1 = Event, 2 = Ambush, 3 = Treasure
        string[2][] activeActionResultCard; // Card for Event / ambush / treasure , outcome e.g. ["Dance with locals", "You're amazing!"]
        string[3][] activeActionInventoryChanges; // [item loss, item gain, hand loss]
        uint256[] randomness;
        bool setupEndgame;
    }

    constructor(address gameBoardAddress, address _rollDrawAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        GAME_BOARD = HexplorationBoard(gameBoardAddress);
        ROLL_DRAW = RollDraw(_rollDrawAddress);
    }

    function addVerifiedController(address vcAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    function setQueue(address queueContract)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        QUEUE = HexplorationQueue(queueContract);
        _setupRole(VERIFIED_CONTROLLER_ROLE, queueContract);
    }

    function setGameStateUpdate(address gsuAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GAME_STATE = HexplorationStateUpdate(gsuAddress);
    }

    // Keeper functions
    function getSummaryForUpkeep(bytes calldata performData)
        external
        pure
        returns (
            DataSummary memory summary,
            uint256 queueID,
            uint256 processingPhase
        )
    {
        (
            queueID,
            processingPhase,
            summary.playerPositionUpdates,
            summary.playerStatUpdates,
            summary.playerEquips,
            summary.zoneTransfers,
            summary.playerTransfers,
            summary.activeActions
        ) = abi.decode(
            performData,
            (
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256
            )
        );
    }

    function performUpkeep(bytes calldata performData) external override {
        // TODO: restrict to registry or admin
        DataSummary memory summary;
        uint256 queueID;
        uint256 processingPhase;
        (
            queueID,
            processingPhase,
            summary.playerPositionUpdates,
            summary.playerStatUpdates,
            summary.playerEquips,
            summary.zoneTransfers,
            summary.playerTransfers,
            summary.activeActions
        ) = abi.decode(
            performData,
            (
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256
            )
        );
        require(
            QUEUE.getRandomness(queueID).length > 0,
            "Randomness not delivered"
        );
        for (uint256 i = 0; i < QUEUE.getAllPlayers(queueID).length; i++) {
            uint256 playerID = i + 1;
            ROLL_DRAW.setRandomnessForPlayer(
                playerID,
                queueID,
                QUEUE.isDayPhase(queueID)
            );
        }
        if (processingPhase == 2) {
            (bool success, ) = address(this).call(
                abi.encodeWithSignature(
                    "processPlayerActions(uint256,(uint256,uint256,uint256,uint256,uint256,uint256))",
                    queueID,
                    summary
                )
            );
            if (!success) {
                // Can reset queue since nothing has been processed this turn
                QUEUE.failProcessing(queueID, activePlayers(queueID), true);
            }
        } else if (processingPhase == 3) {
            (bool success, ) = address(this).call(
                abi.encodeWithSignature(
                    "processPlayThrough(uint256,(uint256,uint256,uint256,uint256,uint256,uint256))",
                    queueID,
                    summary
                )
            );
            if (!success) {
                // Cannot reset queue since player actions already processed
                QUEUE.failProcessing(queueID, activePlayers(queueID), false);
            }
        }
    }

    function checkUpkeep(
        bytes calldata /* checkData */
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        // check for list of queues that need updates...
        upkeepNeeded = false;
        uint256 queueIDToUpdate = 0;
        uint256[] memory pq = QUEUE.getProcessingQueue();
        for (uint256 i = 0; i < pq.length; i++) {
            if (pq[i] != 0) {
                queueIDToUpdate = pq[i];
                upkeepNeeded = true;
                break;
            }
        }
        // Checks for randomness returned.
        if (QUEUE.getRandomness(queueIDToUpdate).length == 0) {
            upkeepNeeded = false;
        }

        HexplorationQueue.ProcessingPhase phase = QUEUE.currentPhase(
            queueIDToUpdate
        );
        // 2 = processing, 3 = play through, 4 = processed
        if (phase == HexplorationQueue.ProcessingPhase.Processing) {
            performData = getUpdateInfo(queueIDToUpdate, 2);
        } else if (phase == HexplorationQueue.ProcessingPhase.PlayThrough) {
            performData = getUpdateInfo(queueIDToUpdate, 3);
        } else {
            performData = getUpdateInfo(queueIDToUpdate, 4);
        }
    }

    function getUpdateInfo(uint256 queueID, uint256 processingPhase)
        internal
        view
        returns (bytes memory)
    {
        DataSummary memory data = DataSummary(0, 0, 0, 0, 0, 0);
        uint256[] memory playersInQueue = QUEUE.getAllPlayers(queueID);
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            uint256 playerID = playersInQueue[i];
            HexplorationQueue.Action action = QUEUE.submissionAction(
                queueID,
                playerID
            );
            if (action == HexplorationQueue.Action.Move) {
                data.playerPositionUpdates += 1;
            }
            if (bytes(QUEUE.submissionLeftHand(queueID, playerID)).length > 0) {
                data.playerEquips += 1;
            }
            if (
                bytes(QUEUE.submissionRightHand(queueID, playerID)).length > 0
            ) {
                data.playerEquips += 1;
            }
            if (
                action == HexplorationQueue.Action.SetupCamp ||
                action == HexplorationQueue.Action.BreakDownCamp
            ) {
                data.zoneTransfers += 1;
            }

            if (action == HexplorationQueue.Action.Dig) {
                data.playerTransfers += 1;
            }

            if (
                action == HexplorationQueue.Action.Dig ||
                action == HexplorationQueue.Action.Rest ||
                action == HexplorationQueue.Action.Help ||
                action == HexplorationQueue.Action.SetupCamp ||
                action == HexplorationQueue.Action.BreakDownCamp ||
                action == HexplorationQueue.Action.Move
            ) {
                data.activeActions += 1;
            }

            if (
                action == HexplorationQueue.Action.Dig ||
                action == HexplorationQueue.Action.Rest
            ) {
                data.playerStatUpdates += 1;
            }

            if (action == HexplorationQueue.Action.Help) {
                data.playerStatUpdates += 2;
            }
        }
        return (
            abi.encode(
                queueID,
                processingPhase,
                data.playerPositionUpdates,
                data.playerStatUpdates,
                data.playerEquips,
                data.zoneTransfers,
                data.playerTransfers,
                data.activeActions
            )
        );
    }

    function processPlayerActions(uint256 queueID, DataSummary memory summary)
        public
    {
        require(_msgSender() == address(this), "internal function");
        uint256 gameID = QUEUE.game(queueID);
        // TODO: save update struct with all the actions from queue (what was originally the ints array)
        PlayUpdates memory playUpdates = HexplorationGameplayUpdates
            .playUpdatesForPlayerActionPhase(
                address(QUEUE),
                queueID,
                address(ROLL_DRAW),
                summary
            );
        string[4] memory playerZones = [
            GAME_BOARD.currentPlayZone(gameID, 1),
            GAME_BOARD.currentPlayZone(gameID, 2),
            GAME_BOARD.currentPlayZone(gameID, 3),
            GAME_BOARD.currentPlayZone(gameID, 4)
        ];

        playUpdates = resolveCampSetupDisputes(
            playUpdates,
            gameID,
            playerZones
        );
        playUpdates = resolveCampBreakDownDisputes(
            playUpdates,
            gameID,
            playerZones
        );
        playUpdates = resolveDigDisputes(playUpdates, gameID, playerZones);
        GAME_STATE.postUpdates(playUpdates, gameID);
        QUEUE.setPhase(HexplorationQueue.ProcessingPhase.PlayThrough, queueID);
    }

    function processPlayThrough(uint256 queueID, DataSummary memory summary)
        public
    {
        require(_msgSender() == address(this), "internal function");
        HexplorationQueue.ProcessingPhase phase = QUEUE.currentPhase(queueID);

        if (QUEUE.getRandomness(queueID).length > 0) {
            if (phase == HexplorationQueue.ProcessingPhase.PlayThrough) {
                uint256 gameID = QUEUE.game(queueID);
                PlayUpdates memory playUpdates = HexplorationGameplayUpdates
                    .playUpdatesForPlayThroughPhase(
                        address(QUEUE),
                        queueID,
                        address(GAME_BOARD),
                        address(ROLL_DRAW)
                    );
                if (stringsMatch(playUpdates.gamePhase, "Day")) {
                    PlayUpdates
                        memory dayPhaseUpdates = HexplorationGameplayUpdates
                            .dayPhaseUpdatesForPlayThroughPhase(
                                address(QUEUE),
                                queueID,
                                gameID,
                                address(GAME_BOARD),
                                address(ROLL_DRAW)
                            );
                    GAME_STATE.postUpdates(
                        playUpdates,
                        dayPhaseUpdates,
                        gameID
                    );
                } else {
                    GAME_STATE.postUpdates(playUpdates, gameID);
                }

                // PlayUpdates
                //     memory dayPhaseUpdates = dayPhaseUpdatesForPlayThroughPhase(
                //         queueID,
                //         summary
                //     );
                // TODO: set this to true when game is finished
                bool gameComplete = false;

                QUEUE.finishProcessing(
                    queueID,
                    gameComplete,
                    activePlayers(queueID)
                );
            }
        }
    }

    // Internal
    function activePlayers(uint256 queueID) internal view returns (uint256) {
        uint256 gameID = QUEUE.game(queueID);
        PlayerRegistry pr = PlayerRegistry(GAME_BOARD.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);
        uint256 inactivePlayers = 0;
        CharacterCard cc = CharacterCard(GAME_BOARD.characterCard());
        for (uint256 i = 0; i < totalRegistrations; i++) {
            if (!pr.isActive(gameID, i + 1) || cc.playerIsDead(gameID, i + 1)) {
                inactivePlayers++;
            }
        }
        return (totalRegistrations - inactivePlayers);
    }

    // Pass play zones in order P1, P2, P3, P4
    function resolveCampSetupDisputes(
        PlayUpdates memory playUpdates,
        uint256 gameID,
        string[4] memory currentPlayZones
    ) internal view returns (PlayUpdates memory) {
        uint256 randomness = QUEUE.isInTestMode()
            ? QUEUE.randomness(
                QUEUE.queueID(gameID),
                uint256(RandomIndex.TieDispute)
            )
            : expandNumber(
                QUEUE.randomness(QUEUE.queueID(gameID), 0),
                RandomIndex.TieDispute
            );

        // campsite disputes hardcoded for max 2 disputes
        // with 4 players, no more than 2 disputes will ever occur (1-3 or 2-2 splits)
        string[2] memory campsiteSetupDisputes; //[map space, map space]
        uint256[2] memory campsiteSetups; // number of setups at each of the dispute zones
        for (uint256 i = 0; i < playUpdates.zoneTransfersTo.length; i++) {
            // If to == current zone, from = playerID
            // if from == current zone, to = playerID
            if (
                playUpdates.zoneTransfersTo[i] == 10000000000 &&
                stringsMatch(playUpdates.zoneTransferItemTypes[i], "Campsite")
            ) {
                // Sets up to 2 zones for potential disputes
                if (bytes(campsiteSetupDisputes[0]).length == 0) {
                    campsiteSetupDisputes[0] = GAME_BOARD.currentPlayZone(
                        gameID,
                        playUpdates.zoneTransfersFrom[i]
                    );
                } else if (
                    bytes(campsiteSetupDisputes[1]).length == 0 &&
                    !stringsMatch(
                        currentPlayZones[playUpdates.zoneTransfersFrom[i] - 1],
                        campsiteSetupDisputes[0]
                    )
                ) {
                    campsiteSetupDisputes[1] = GAME_BOARD.currentPlayZone(
                        gameID,
                        playUpdates.zoneTransfersFrom[i]
                    );
                }
                uint256 currentIndex = stringsMatch(
                    campsiteSetupDisputes[0],
                    currentPlayZones[playUpdates.zoneTransfersFrom[i] - 1]
                )
                    ? 0
                    : 1;
                campsiteSetups[currentIndex]++;
                //campsiteSetupPlayers[i] = playUpdates.zoneTransfersFrom[i];
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
            for (uint256 i = 0; i < playUpdates.zoneTransfersTo.length; i++) {
                if (
                    playUpdates.zoneTransfersTo[i] == 10000000000 &&
                    stringsMatch(
                        playUpdates.zoneTransferItemTypes[i],
                        "Campsite"
                    )
                ) {
                    // Player transferring campsite to zone (setting up camp)
                    uint256 currentIndex = stringsMatch(
                        campsiteSetupDisputes[0],
                        currentPlayZones[playUpdates.zoneTransfersFrom[i] - 1]
                    )
                        ? 0
                        : 1;
                    campsiteSetupPlayers[currentIndex][
                        positions[currentIndex]
                    ] = playUpdates.zoneTransfersFrom[i];
                    campsiteSetupIndices[currentIndex][
                        positions[currentIndex]
                    ] = i;
                    positions[currentIndex]++;
                }
            }

            // pick winner
            uint256[2] memory campsiteSetupDisputeWinners;
            campsiteSetupDisputeWinners[0] = campsiteSetupPlayers[0].length > 0
                ? campsiteSetupPlayers[0][
                    randomness % campsiteSetupPlayers[0].length
                ]
                : 0;
            // campsiteSetupDisputeWinners[0] = campsiteSetupPlayers[0][0]; // p1
            // campsiteSetupDisputeWinners[0] = campsiteSetupPlayers[0][1]; // p3
            // campsiteSetupDisputeWinners[0] = campsiteSetupPlayers[0][2]; // p4
            campsiteSetupDisputeWinners[1] = campsiteSetupPlayers[1].length > 0
                ? campsiteSetupPlayers[1][
                    randomness % campsiteSetupPlayers[1].length
                ]
                : 0;
            for (uint256 i = 0; i < campsiteSetupPlayers[0].length; i++) {
                if (
                    campsiteSetupPlayers[0][i] != campsiteSetupDisputeWinners[0]
                ) {
                    // disable transfer for non-winner
                    playUpdates.zoneTransfersTo[campsiteSetupIndices[0][i]] = 0;
                    playUpdates.zoneTransfersFrom[
                        campsiteSetupIndices[0][i]
                    ] = 0;
                    playUpdates.zoneTransferQtys[
                        campsiteSetupIndices[0][i]
                    ] = 0;
                }
            }
            for (uint256 i = 0; i < campsiteSetupPlayers[1].length; i++) {
                if (
                    campsiteSetupPlayers[1][i] != campsiteSetupDisputeWinners[1]
                ) {
                    // disable transfer for non-winner
                    playUpdates.zoneTransfersTo[campsiteSetupIndices[1][i]] = 0;
                    playUpdates.zoneTransfersFrom[
                        campsiteSetupIndices[1][i]
                    ] = 0;
                    playUpdates.zoneTransferQtys[
                        campsiteSetupIndices[1][i]
                    ] = 0;
                }
            }
        }

        return playUpdates;
    }

    function resolveCampBreakDownDisputes(
        PlayUpdates memory playUpdates,
        uint256 gameID,
        string[4] memory currentPlayZones
    ) internal view returns (PlayUpdates memory) {
        uint256 randomness = QUEUE.isInTestMode()
            ? QUEUE.randomness(
                QUEUE.queueID(gameID),
                uint256(RandomIndex.TieDispute)
            )
            : expandNumber(
                QUEUE.randomness(QUEUE.queueID(gameID), 0),
                RandomIndex.TieDispute
            );
        // campsite disputes hardcoded for max 2 disputes
        // with 4 players, no more than 2 disputes will ever occur (1-3 or 2-2 splits)
        string[2] memory campsiteBreakDownDisputes; //[zone, zone]
        uint256[2] memory campsiteBreakDowns;
        for (uint256 i = 0; i < playUpdates.zoneTransfersFrom.length; i++) {
            // If to == current zone, from = playerID
            // if from == current zone, to = playerID
            if (
                playUpdates.zoneTransfersFrom[i] == 10000000000 &&
                stringsMatch(playUpdates.zoneTransferItemTypes[i], "Campsite")
            ) {
                // Sets up to 2 zones for potential disputes
                if (bytes(campsiteBreakDownDisputes[0]).length == 0) {
                    campsiteBreakDownDisputes[0] = GAME_BOARD.currentPlayZone(
                        gameID,
                        playUpdates.zoneTransfersTo[i]
                    );
                } else if (
                    bytes(campsiteBreakDownDisputes[1]).length == 0 &&
                    !stringsMatch(
                        currentPlayZones[playUpdates.zoneTransfersTo[i] - 1],
                        campsiteBreakDownDisputes[0]
                    )
                ) {
                    campsiteBreakDownDisputes[1] = GAME_BOARD.currentPlayZone(
                        gameID,
                        playUpdates.zoneTransfersTo[i]
                    );
                }
                uint256 currentIndex = stringsMatch(
                    campsiteBreakDownDisputes[0],
                    currentPlayZones[playUpdates.zoneTransfersTo[i] - 1]
                )
                    ? 0
                    : 1;
                campsiteBreakDowns[currentIndex]++;
                //campsiteSetupPlayers[i] = playUpdates.zoneTransfersTo[i];
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
            for (uint256 i = 0; i < playUpdates.zoneTransfersFrom.length; i++) {
                if (
                    playUpdates.zoneTransfersFrom[i] == 10000000000 &&
                    stringsMatch(
                        playUpdates.zoneTransferItemTypes[i],
                        "Campsite"
                    )
                ) {
                    // Player transferring campsite to zone (setting up camp)
                    uint256 currentIndex = stringsMatch(
                        campsiteBreakDownDisputes[0],
                        currentPlayZones[playUpdates.zoneTransfersTo[i] - 1]
                    )
                        ? 0
                        : 1;
                    campsiteBreakDownPlayers[currentIndex][
                        positions[currentIndex]
                    ] = playUpdates.zoneTransfersTo[i];
                    campsiteBreakDownIndices[currentIndex][
                        positions[currentIndex]
                    ] = i;
                    positions[currentIndex]++;
                }
            }

            // pick winner
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
                    // disable transfer for non-winner
                    playUpdates.zoneTransfersTo[
                        campsiteBreakDownIndices[0][i]
                    ] = 0;
                    playUpdates.zoneTransfersFrom[
                        campsiteBreakDownIndices[0][i]
                    ] = 0;
                    playUpdates.zoneTransferQtys[
                        campsiteBreakDownIndices[0][i]
                    ] = 0;
                }
            }
            for (uint256 i = 0; i < campsiteBreakDownPlayers[1].length; i++) {
                if (
                    campsiteBreakDownPlayers[1][i] !=
                    campsiteBreakDownDisputeWinners[1]
                ) {
                    // disable transfer for non-winner
                    playUpdates.zoneTransfersTo[
                        campsiteBreakDownIndices[1][i]
                    ] = 0;
                    playUpdates.zoneTransfersFrom[
                        campsiteBreakDownIndices[1][i]
                    ] = 0;
                    playUpdates.zoneTransferQtys[
                        campsiteBreakDownIndices[1][i]
                    ] = 0;
                }
            }
        }

        return playUpdates;
    }

    function resolveDigDisputes(
        PlayUpdates memory playUpdates,
        uint256 gameID,
        string[4] memory currentPlayZones
    ) internal view returns (PlayUpdates memory) {
        uint256 randomness = QUEUE.isInTestMode()
            ? QUEUE.randomness(
                QUEUE.queueID(gameID),
                uint256(RandomIndex.TieDispute)
            )
            : expandNumber(
                QUEUE.randomness(QUEUE.queueID(gameID), 0),
                RandomIndex.TieDispute
            );
        // campsite disputes hardcoded for max 2 disputes
        // with 4 players, no more than 2 disputes will ever occur (1-3 or 2-2 splits)
        string[2] memory digDisputes; //[map space, map space]
        uint256[2] memory digs; // number of digs at each of the dispute zones

        //        playUpdates.playerTransfersTo[position] = playersInQueue[i];
        //        playUpdates.playerTransfersFrom[position] = 0;
        for (uint256 i = 0; i < playUpdates.playerTransfersTo.length; i++) {
            if (
                playUpdates.playerTransfersTo[i] != 0 &&
                itemIsArtifact(playUpdates.playerTransferItemTypes[i])
            ) {
                // player has dug an artifact
                // Sets up to 2 zones for potential disputes
                if (bytes(digDisputes[0]).length == 0) {
                    digDisputes[0] = GAME_BOARD.currentPlayZone(
                        gameID,
                        playUpdates.playerTransfersTo[i]
                    );
                } else if (
                    bytes(digDisputes[1]).length == 0 &&
                    !stringsMatch(
                        currentPlayZones[playUpdates.playerTransfersTo[i] - 1],
                        digDisputes[0]
                    )
                ) {
                    digDisputes[1] = GAME_BOARD.currentPlayZone(
                        gameID,
                        playUpdates.playerTransfersTo[i]
                    );
                }
                uint256 currentIndex = stringsMatch(
                    digDisputes[0],
                    currentPlayZones[playUpdates.playerTransfersTo[i] - 1]
                )
                    ? 0
                    : 1;
                digs[currentIndex]++;
                //campsiteSetupPlayers[i] = playUpdates.zoneTransfersFrom[i];
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
            for (uint256 i = 0; i < playUpdates.playerTransfersTo.length; i++) {
                if (
                    playUpdates.playerTransfersTo[i] != 0 &&
                    itemIsArtifact(playUpdates.playerTransferItemTypes[i])
                ) {
                    // Player receiving artifact from dig
                    uint256 currentIndex = stringsMatch(
                        digDisputes[0],
                        currentPlayZones[playUpdates.playerTransfersTo[i] - 1]
                    )
                        ? 0
                        : 1;
                    digPlayers[currentIndex][
                        positions[currentIndex]
                    ] = playUpdates.playerTransfersTo[i];
                    digIndices[currentIndex][positions[currentIndex]] = i;
                    positions[currentIndex]++;
                }
            }

            // pick winner
            uint256[2] memory digDisputeWinners;
            digDisputeWinners[0] = digPlayers[0].length > 0
                ? digPlayers[0][randomness % digPlayers[0].length]
                : 0;
            digDisputeWinners[1] = digPlayers[1].length > 0
                ? digPlayers[1][randomness % digPlayers[1].length]
                : 0;
            for (uint256 i = 0; i < digPlayers[0].length; i++) {
                if (digPlayers[0][i] != digDisputeWinners[0]) {
                    // disable transfer for non-winner
                    playUpdates.playerTransfersTo[digIndices[0][i]] = 0;
                    playUpdates.playerTransfersFrom[digIndices[0][i]] = 0;
                    playUpdates.playerTransferQtys[digIndices[0][i]] = 0;
                }
            }
            for (uint256 i = 0; i < digPlayers[1].length; i++) {
                if (digPlayers[1][i] != digDisputeWinners[1]) {
                    // disable transfer for non-winner
                    playUpdates.playerTransfersTo[digIndices[1][i]] = 0;
                    playUpdates.playerTransfersFrom[digIndices[1][i]] = 0;
                    playUpdates.playerTransferQtys[digIndices[1][i]] = 0;
                }
            }
        }

        return playUpdates;
    }

    function _setupEndGame(uint256 gameID) internal {
        // TODO:
        // setup end game...
    }

    // Utilities
    function stringsMatch(string memory s1, string memory s2)
        internal
        pure
        returns (bool)
    {
        return
            keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }

    function itemIsArtifact(string memory itemType)
        internal
        pure
        returns (bool)
    {
        return (stringsMatch(itemType, "Engraved Tablet") ||
            stringsMatch(itemType, "Sigil Gem") ||
            stringsMatch(itemType, "Ancient Tome"));
    }
}
