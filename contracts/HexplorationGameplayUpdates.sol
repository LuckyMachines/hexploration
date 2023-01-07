// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./HexplorationQueue.sol";
import "./HexplorationGameplay.sol";
import "./HexplorationBoard.sol";
import "./RollDraw.sol";
import "./TokenInventory.sol";
import "./CharacterCard.sol";
import "./RandomIndices.sol";

library HexplorationGameplayUpdates {
    uint256 public constant GAME_BOARD_WALLET_ID = 1000000;
    uint256 public constant LEFT_HAND = 0;
    uint256 public constant RIGHT_HAND = 1;

    function playUpdatesForPlayerActionPhase(
        address queueAddress,
        uint256 queueID,
        address rollDrawAddress,
        bytes memory summaryData
    ) public view returns (HexplorationGameplay.PlayUpdates memory) {
        HexplorationGameplay.DataSummary memory summary = abi.decode(
            summaryData,
            (HexplorationGameplay.DataSummary)
        );
        return
            playUpdatesForPlayerActionPhase(
                queueAddress,
                queueID,
                rollDrawAddress,
                summary
            );
    }

    function playUpdatesForPlayerActionPhase(
        address queueAddress,
        uint256 queueID,
        address rollDrawAddress,
        HexplorationGameplay.DataSummary memory summary
    ) public view returns (HexplorationGameplay.PlayUpdates memory) {
        HexplorationGameplay.PlayUpdates memory playUpdates;
        uint256[] memory playersInQueue = HexplorationQueue(queueAddress)
            .getAllPlayers(queueID);
        uint256 position;
        // uint256 maxMovementPerPlayer = 7;
        // Movement
        playUpdates.playerPositionIDs = new uint256[](
            summary.playerPositionUpdates
        );
        playUpdates.spacesToMove = new uint256[](summary.playerPositionUpdates);
        playUpdates.playerMovementOptions = new string[7][](
            summary.playerPositionUpdates
        );
        position = 0;
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                HexplorationQueue(queueAddress).submissionAction(
                    queueID,
                    playersInQueue[i]
                ) == HexplorationQueue.Action.Move
            ) {
                // return [player id, # spaces to move]

                playUpdates.playerPositionIDs[position] = playersInQueue[i];
                playUpdates.spacesToMove[position] = HexplorationQueue(
                    queueAddress
                ).getSubmissionOptions(queueID, playersInQueue[i]).length;
                string[] memory options = HexplorationQueue(queueAddress)
                    .getSubmissionOptions(queueID, playersInQueue[i]);
                for (uint256 j = 0; j < 7; j++) {
                    playUpdates.playerMovementOptions[position][j] = j <
                        options.length
                        ? options[j]
                        : "";
                }
                position++;
            }
        }

        // LH equip
        playUpdates.playerEquipIDs = new uint256[](summary.playerEquips);
        playUpdates.playerEquipHands = new uint256[](summary.playerEquips);
        playUpdates.playerEquips = new string[](summary.playerEquips);
        position = 0;
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                bytes(
                    HexplorationQueue(queueAddress).submissionLeftHand(
                        queueID,
                        playersInQueue[i]
                    )
                ).length > 0
            ) {
                // return [player id, r/l hand (0/1)]

                playUpdates.playerEquipIDs[position] = playersInQueue[i];
                playUpdates.playerEquipHands[position] = 0;
                playUpdates.playerEquips[position] = HexplorationQueue(
                    queueAddress
                ).submissionLeftHand(queueID, playersInQueue[i]);
                position++;
            }
        }

        // RH equip
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                bytes(
                    HexplorationQueue(queueAddress).submissionRightHand(
                        queueID,
                        playersInQueue[i]
                    )
                ).length > 0
            ) {
                // return [player id, r/l hand (0/1)]

                playUpdates.playerEquipIDs[position] = playersInQueue[i];
                playUpdates.playerEquipHands[position] = 1;
                playUpdates.playerEquips[position] = HexplorationQueue(
                    queueAddress
                ).submissionRightHand(queueID, playersInQueue[i]);
                position++;
            }
        }

        // Camp actions
        playUpdates.zoneTransfersTo = new uint256[](summary.zoneTransfers);
        playUpdates.zoneTransfersFrom = new uint256[](summary.zoneTransfers);
        playUpdates.zoneTransferQtys = new uint256[](summary.zoneTransfers);
        playUpdates.zoneTransferItemTypes = new string[](summary.zoneTransfers);
        position = 0;
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                HexplorationQueue(queueAddress).submissionAction(
                    queueID,
                    playersInQueue[i]
                ) == HexplorationQueue.Action.SetupCamp
            ) {
                // setup camp
                // transfer from player to zone
                // return [to ID, from ID, quantity]
                // Transfer 1 campsite from player to current zone

                playUpdates.zoneTransfersTo[position] = 10000000000; //10000000000 represents current play zone of player
                playUpdates.zoneTransfersFrom[position] = playersInQueue[i];
                playUpdates.zoneTransferQtys[position] = 1;
                playUpdates.zoneTransferItemTypes[position] = "Campsite";
                position++;
            }
        }

        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                HexplorationQueue(queueAddress).submissionAction(
                    queueID,
                    playersInQueue[i]
                ) == HexplorationQueue.Action.BreakDownCamp
            ) {
                // break down camp
                // transfer from zone to player
                playUpdates.zoneTransfersTo[position] = playersInQueue[i];
                playUpdates.zoneTransfersFrom[position] = 10000000000;
                playUpdates.zoneTransferQtys[position] = 1;
                playUpdates.zoneTransferItemTypes[position] = "Campsite";
                position++;
            }
        }

        playUpdates.playerActiveActionIDs = new uint256[](
            summary.activeActions
        );
        playUpdates.activeActions = new string[](summary.activeActions);
        playUpdates.activeActionOptions = new string[][](summary.activeActions);
        playUpdates.activeActionResults = new uint256[](summary.activeActions);
        playUpdates.activeActionResultCard = new string[2][](
            summary.activeActions
        );
        playUpdates.activeActionInventoryChanges = new string[3][](
            summary.activeActions
        );
        playUpdates.playerHandLossIDs = new uint256[](summary.playerTransfers);
        playUpdates.playerHandLosses = new uint256[](summary.playerTransfers);

        playUpdates.playerStatUpdateIDs = new uint256[](
            summary.playerStatUpdates
        );
        playUpdates.playerStatUpdates = new int8[3][](
            summary.playerStatUpdates
        );
        playUpdates.playerTransfersTo = new uint256[](summary.playerTransfers);
        playUpdates.playerTransfersFrom = new uint256[](
            summary.playerTransfers
        );
        playUpdates.playerTransferQtys = new uint256[](summary.playerTransfers);
        playUpdates.playerTransferItemTypes = new string[](
            summary.playerTransfers
        );

        position = 0;
        // increase with each one added...
        uint256 playerStatPosition = 0;
        // Draw cards for dig this phase
        /*
         else if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Move
            ) {
                // TODO: use this...
                playUpdates.activeActions[position] = "Move";
                playUpdates.activeActionOptions[position] = QUEUE
                    .getSubmissionOptions(queueID, playersInQueue[i]);
                position++;
            }
        */
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                HexplorationQueue(queueAddress).submissionAction(
                    queueID,
                    playersInQueue[i]
                ) == HexplorationQueue.Action.SetupCamp
            ) {
                playUpdates.activeActions[position] = "Setup camp";
                playUpdates.activeActionOptions[position] = new string[](0);
                playUpdates.playerActiveActionIDs[position] = playersInQueue[i];
                position++;
            } else if (
                HexplorationQueue(queueAddress).submissionAction(
                    queueID,
                    playersInQueue[i]
                ) == HexplorationQueue.Action.BreakDownCamp
            ) {
                playUpdates.activeActions[position] = "Break down camp";
                playUpdates.activeActionOptions[position] = new string[](0);
                playUpdates.playerActiveActionIDs[position] = playersInQueue[i];
                position++;
            } else if (
                HexplorationQueue(queueAddress).submissionAction(
                    queueID,
                    playersInQueue[i]
                ) == HexplorationQueue.Action.Dig
            ) {
                playUpdates.activeActions[position] = "Dig";
                playUpdates.playerActiveActionIDs[position] = playersInQueue[i];
                playUpdates.activeActionOptions[position] = new string[](0);
                playUpdates.activeActionResults[position] = uint256(
                    dig(
                        queueAddress,
                        queueID,
                        rollDrawAddress,
                        playersInQueue[i]
                    )
                );
                (
                    playUpdates.activeActionResultCard[position][0],
                    playUpdates.playerStatUpdates[position],
                    playUpdates.activeActionInventoryChanges[position][0],
                    playUpdates.activeActionInventoryChanges[position][1],
                    playUpdates.activeActionInventoryChanges[position][2],
                    playUpdates.activeActionResultCard[position][1]
                ) = RollDraw(rollDrawAddress).drawCard(
                    RollDraw.CardType(
                        playUpdates.activeActionResults[position]
                    ),
                    queueID,
                    playersInQueue[i],
                    false,
                    true
                );

                if (
                    bytes(playUpdates.activeActionInventoryChanges[position][0])
                        .length > 0
                ) {
                    // item loss
                    playUpdates.playerTransferItemTypes[position] = playUpdates
                        .activeActionInventoryChanges[position][0];
                    playUpdates.playerTransfersTo[position] = 0;
                    playUpdates.playerTransfersFrom[position] = playersInQueue[
                        i
                    ];
                    playUpdates.playerTransferQtys[position] = 1;
                    // TODO: check if we need this...
                    playUpdates.playerStatUpdateIDs[position] = playersInQueue[
                        i
                    ];
                } else if (
                    bytes(playUpdates.activeActionInventoryChanges[position][1])
                        .length > 0
                ) {
                    // item gain
                    playUpdates.playerTransferItemTypes[position] = playUpdates
                        .activeActionInventoryChanges[position][1];
                    playUpdates.playerTransfersTo[position] = playersInQueue[i];
                    playUpdates.playerTransfersFrom[position] = 0;
                    playUpdates.playerTransferQtys[position] = 1;
                    // TODO: check if we need this...
                    playUpdates.playerStatUpdateIDs[position] = playersInQueue[
                        i
                    ];
                } else if (
                    bytes(playUpdates.activeActionInventoryChanges[position][2])
                        .length > 0
                ) {
                    // hand loss

                    playUpdates.playerHandLossIDs[position] = playersInQueue[i];
                    playUpdates.playerHandLosses[position] = stringsMatch(
                        playUpdates.activeActionInventoryChanges[position][2],
                        "Right"
                    )
                        ? 1
                        : 0;
                }

                playerStatPosition++;
                position++;
            } else if (
                HexplorationQueue(queueAddress).submissionAction(
                    queueID,
                    playersInQueue[i]
                ) == HexplorationQueue.Action.Rest
            ) {
                playUpdates.activeActions[position] = "Rest";
                playUpdates.activeActionOptions[position] = HexplorationQueue(
                    queueAddress
                ).getSubmissionOptions(queueID, playersInQueue[i]);
                playUpdates.playerActiveActionIDs[position] = playersInQueue[i];
                playUpdates.playerStatUpdates[playerStatPosition] = rest(
                    queueAddress,
                    queueID,
                    playersInQueue[i]
                );
                playUpdates.playerStatUpdateIDs[
                    playerStatPosition
                ] = playersInQueue[i];
                playerStatPosition++;
                position++;
            } else if (
                HexplorationQueue(queueAddress).submissionAction(
                    queueID,
                    playersInQueue[i]
                ) == HexplorationQueue.Action.Help
            ) {
                playUpdates.activeActions[position] = "Help";
                playUpdates.activeActionOptions[position] = HexplorationQueue(
                    queueAddress
                ).getSubmissionOptions(queueID, playersInQueue[i]);
                playUpdates.playerActiveActionIDs[position] = playersInQueue[i];

                // Update stats from help
                // Player giving help
                (
                    playUpdates.playerStatUpdates[playerStatPosition],
                    playUpdates.playerStatUpdates[playerStatPosition + 1]
                ) = help(queueAddress, queueID, playersInQueue[i]);

                playUpdates.playerStatUpdateIDs[
                    playerStatPosition
                ] = playersInQueue[i];
                playUpdates.playerStatUpdateIDs[
                    playerStatPosition + 1
                ] = playerIDFromString(
                    playUpdates.activeActionOptions[position][0]
                );
                playerStatPosition += 2;

                position++;
            } else if (
                HexplorationQueue(queueAddress).submissionAction(
                    queueID,
                    playersInQueue[i]
                ) == HexplorationQueue.Action.Move
            ) {
                playUpdates.activeActions[position] = "Move";
                playUpdates.activeActionOptions[position] = HexplorationQueue(
                    queueAddress
                ).getSubmissionOptions(queueID, playersInQueue[i]);
                playUpdates.playerActiveActionIDs[position] = playersInQueue[i];
                position++;
            }
        }
        playUpdates.randomness = HexplorationQueue(queueAddress).getRandomness(
            queueID
        );

        return playUpdates;
    }

    function playUpdatesForPlayThroughPhase(
        address queueAddress,
        uint256 queueID,
        address gameBoardAddress,
        address rollDrawAddress
    ) public view returns (HexplorationGameplay.PlayUpdates memory) {
        HexplorationGameplay.PlayUpdates memory playUpdates;

        // uint256[] memory playersInQueue = QUEUE.getAllPlayers(queueID);
        // uint256 position;

        uint256 gameID = HexplorationQueue(queueAddress).game(queueID);
        uint256 totalPlayers = PlayerRegistry(
            HexplorationBoard(gameBoardAddress).prAddress()
        ).totalRegistrations(gameID);

        playUpdates.gamePhase = TokenInventory(
            HexplorationBoard(gameBoardAddress).tokenInventory()
        ).DAY_NIGHT_TOKEN().balance("Day", gameID, GAME_BOARD_WALLET_ID) > 0
            ? "Night"
            : "Day";

        // uint256 totalPlayers = PlayerRegistry(GAME_BOARD.prAddress())
        //     .totalRegistrations(gameID);

        for (uint256 i = 0; i < totalPlayers; i++) {
            uint256 playerID = i + 1;
            // These are already processed... Don't need to reprocess.
            // HexplorationQueue.Action activeAction = HexplorationQueue(
            //     queueAddress
            // ).activeAction(queueID, playerID);
            /*
            if (activeAction == HexplorationQueue.Action.Dig) {
                // dig
                if (
                    dig(queueAddress, queueID, rollDrawAddress, playerID) ==
                    RollDraw.CardType.Treasure
                ) {
                    // TODO:
                    // dug treasure!
                    // pick treasure card
                    // if final artifact is found, playUpdates.setupEndgame = true;
                } else {
                    // TODO:
                    // dug ambush...
                    // play out consequences
                }
            } else if (activeAction == HexplorationQueue.Action.Rest) {
                // rest
                string memory restChoice = HexplorationQueue(queueAddress)
                    .submissionOptions(queueID, playerID, 0);
                if (stringsMatch(restChoice, "Movement")) {
                    // TODO:
                    // add 1 to movement
                } else if (stringsMatch(restChoice, "Agility")) {
                    // TODO:
                    // add 1 to agility
                } else if (stringsMatch(restChoice, "Dexterity")) {
                    // TODO:
                    // add 1 to dexterity
                }
            } else if (activeAction == HexplorationQueue.Action.Help) {
                // help
                // TODO:
                // set player ID to help (options) as string choice
            }
            */

            // to get current player stats...
            //CharacterCard cc = CharacterCard(GAME_BOARD.characterCard());
            // cc.movement(gameID, playerID) => returns uint8
            // cc.agility(gameID, playerID) => returns uint8
            // cc.dexterity(gameID, playerID) => returns uint8

            //to subtract from player stats...
            //subToZero(uint256(playerStat), reductionAmount);
            // can submit numbers higher than max here, but won't actually get set to those
            // will get set to max if max exceeded
        }

        // Day phase events, processed before players can submit choices

        // return (playUpdates, dayPhaseUpdates);
        return playUpdates;
    }

    function dayPhaseUpdatesForPlayThroughPhase(
        address queueAddress,
        uint256 queueID,
        uint256 gameID,
        address gameBoardAddress,
        address rollDrawAddress
    ) public view returns (HexplorationGameplay.PlayUpdates memory) {
        HexplorationGameplay.PlayUpdates memory dayPhaseUpdates;
        uint256 totalPlayers = PlayerRegistry(
            HexplorationBoard(gameBoardAddress).prAddress()
        ).totalRegistrations(gameID);
        // if (
        //     TokenInventory(HexplorationBoard(gameBoardAddress).tokenInventory())
        //         .DAY_NIGHT_TOKEN()
        //         .balance("Day", gameID, GAME_BOARD_WALLET_ID) > 0
        // ) {
        //updates.activeActions
        //updates.playerActiveActionIDs
        dayPhaseUpdates.randomness = HexplorationQueue(queueAddress)
            .getRandomness(queueID);
        dayPhaseUpdates.activeActions = new string[](totalPlayers);
        dayPhaseUpdates.playerActiveActionIDs = new uint256[](totalPlayers);
        for (uint256 i = 0; i < totalPlayers; i++) {
            // every player will have some update for this
            dayPhaseUpdates.playerActiveActionIDs[i] = i + 1;
        }
        dayPhaseUpdates.activeActionResults = new uint256[](totalPlayers);
        dayPhaseUpdates.activeActionResultCard = new string[2][](totalPlayers);
        dayPhaseUpdates.playerStatUpdateIDs = new uint256[](totalPlayers);
        dayPhaseUpdates.playerStatUpdates = new int8[3][](totalPlayers);
        dayPhaseUpdates.activeActionInventoryChanges = new string[3][](
            totalPlayers
        );
        dayPhaseUpdates.playerTransferItemTypes = new string[](totalPlayers);
        dayPhaseUpdates.playerTransfersFrom = new uint256[](totalPlayers);
        dayPhaseUpdates.playerTransfersTo = new uint256[](totalPlayers);
        dayPhaseUpdates.playerTransferQtys = new uint256[](totalPlayers);
        dayPhaseUpdates.playerEquipIDs = new uint256[](totalPlayers);
        dayPhaseUpdates.playerEquipHands = new uint256[](totalPlayers);
        dayPhaseUpdates.playerEquips = new string[](totalPlayers);

        for (uint256 i = 0; i < totalPlayers; i++) {
            uint256 playerID = i + 1;
            if (
                !CharacterCard(
                    HexplorationBoard(gameBoardAddress).characterCard()
                ).playerIsDead(gameID, playerID)
            ) {
                RandomIndices.RandomIndex randomIndex = playerID == 1
                    ? RandomIndices.RandomIndex.P1DayEventType
                    : playerID == 2
                    ? RandomIndices.RandomIndex.P2DayEventType
                    : playerID == 3
                    ? RandomIndices.RandomIndex.P3DayEventType
                    : RandomIndices.RandomIndex.P4DayEventType;
                // roll D6
                if (
                    ((
                        RollDraw(rollDrawAddress).d6Roll(
                            1,
                            queueID,
                            uint256(randomIndex)
                        )
                    ) % 2) == 0
                ) {
                    // even roll
                    // draw event card
                    int8[3] memory stats;
                    // TODO:
                    // set player randomness by here (not in this view function)
                    (
                        dayPhaseUpdates.activeActionResultCard[i][0],
                        stats,
                        dayPhaseUpdates.activeActionInventoryChanges[i][0],
                        dayPhaseUpdates.activeActionInventoryChanges[i][1],
                        dayPhaseUpdates.activeActionInventoryChanges[i][2],
                        dayPhaseUpdates.activeActionResultCard[i][1]
                    ) = RollDraw(rollDrawAddress).drawCard(
                        RollDraw.CardType.Event,
                        queueID,
                        playerID,
                        true,
                        true
                    );
                    dayPhaseUpdates.playerStatUpdates[i] = stats;
                    dayPhaseUpdates.activeActionResults[i] = 1;
                    dayPhaseUpdates.playerStatUpdateIDs[i] = playerID;
                } else {
                    // odd roll
                    // draw ambush card
                    // TODO:
                    // set player randomness by here (not in this view function)
                    int8[3] memory stats;
                    (
                        dayPhaseUpdates.activeActionResultCard[i][0],
                        stats,
                        dayPhaseUpdates.activeActionInventoryChanges[i][0],
                        dayPhaseUpdates.activeActionInventoryChanges[i][1],
                        dayPhaseUpdates.activeActionInventoryChanges[i][2],
                        dayPhaseUpdates.activeActionResultCard[i][1]
                    ) = RollDraw(rollDrawAddress).drawCard(
                        RollDraw.CardType.Ambush,
                        queueID,
                        playerID,
                        true,
                        true
                    );
                    dayPhaseUpdates.playerStatUpdates[i] = stats;
                    dayPhaseUpdates.activeActionResults[i] = 2;
                    dayPhaseUpdates.playerStatUpdateIDs[i] = playerID;
                }

                // string memory loseItemInventory = dayPhaseUpdates
                //     .activeActionInventoryChanges[i][0];
                // string memory handLossInventory = dayPhaseUpdates
                //     .activeActionInventoryChanges[i][2];

                if (
                    !stringsMatch(
                        dayPhaseUpdates.activeActionInventoryChanges[i][0],
                        ""
                    )
                ) {
                    // set item loss

                    // dayPhaseUpdates.playerActiveActionIDs[i] = playerID;
                    dayPhaseUpdates.playerTransferItemTypes[i] = dayPhaseUpdates
                        .activeActionInventoryChanges[i][0];
                    dayPhaseUpdates.playerTransfersTo[i] = 0;
                    dayPhaseUpdates.playerTransfersFrom[i] = playerID;
                    dayPhaseUpdates.playerTransferQtys[i] = 1;
                }

                if (
                    !stringsMatch(
                        dayPhaseUpdates.activeActionInventoryChanges[i][1],
                        ""
                    )
                ) {
                    // Set item gain
                    // dayPhaseUpdates.playerActiveActionIDs[i] = playerID;
                    dayPhaseUpdates.playerTransferItemTypes[i] = dayPhaseUpdates
                        .activeActionInventoryChanges[i][1];
                    dayPhaseUpdates.playerTransfersFrom[i] = 0;
                    dayPhaseUpdates.playerTransfersTo[i] = playerID;
                    dayPhaseUpdates.playerTransferQtys[i] = 1;
                }

                if (
                    !stringsMatch(
                        dayPhaseUpdates.activeActionInventoryChanges[i][2],
                        ""
                    )
                ) {
                    // set hand loss if item is in hand
                    string memory handItem = itemInHand(
                        dayPhaseUpdates.activeActionInventoryChanges[i][2],
                        playerID,
                        gameID,
                        gameBoardAddress
                    );
                    if (
                        !stringsMatch(handItem, "") &&
                        TokenInventory(
                            HexplorationBoard(gameBoardAddress).tokenInventory()
                        ).ITEM_TOKEN().balance(handItem, gameID, playerID) >
                        0
                    ) {
                        // dayPhaseUpdates.playerActiveActionIDs[i] = playerID;
                        dayPhaseUpdates.playerTransferItemTypes[i] = handItem;
                        dayPhaseUpdates.playerTransfersTo[i] = 0;
                        dayPhaseUpdates.playerTransfersFrom[i] = playerID;
                        dayPhaseUpdates.playerTransferQtys[i] = 1;
                        dayPhaseUpdates.playerEquipIDs[i] = playerID;
                        dayPhaseUpdates.playerEquipHands[i] = stringsMatch(
                            dayPhaseUpdates.activeActionInventoryChanges[i][2],
                            "Left"
                        )
                            ? LEFT_HAND
                            : RIGHT_HAND;
                        // no need to set playerEquips, this is already set to empty string, which will remove from hand
                    }
                }
            }
        }
        return dayPhaseUpdates;
    }

    function itemInHand(
        string memory whichHand,
        uint256 playerID,
        uint256 gameID,
        address gameBoardAddress
    ) public view returns (string memory item) {
        item = "";
        if (stringsMatch(whichHand, "Left")) {
            item = CharacterCard(
                HexplorationBoard(gameBoardAddress).characterCard()
            ).leftHandItem(gameID, playerID);
        } else if (stringsMatch(whichHand, "Right")) {
            item = CharacterCard(
                HexplorationBoard(gameBoardAddress).characterCard()
            ).rightHandItem(gameID, playerID);
        }
    }

    function dig(
        address queueAddress,
        uint256 queueID,
        address rollDrawAddress,
        uint256 playerID
    ) internal view returns (RollDraw.CardType resultType) {
        // if digging available... (should be pre-checked)
        // TODO:
        // roll dice (d6) for each player on space not resting

        uint256 playersOnSpace = HexplorationQueue(queueAddress)
            .getSubmissionOptions(queueID, playerID)
            .length - 1;
        string memory phase = HexplorationQueue(queueAddress)
            .getSubmissionOptions(queueID, playerID)[0];
        RandomIndices.RandomIndex randomIndex = playerID == 1
            ? RandomIndices.RandomIndex.P1DigPassFail
            : playerID == 2
            ? RandomIndices.RandomIndex.P2DigPassFail
            : playerID == 3
            ? RandomIndices.RandomIndex.P3DigPassFail
            : RandomIndices.RandomIndex.P4DigPassFail;
        uint256 rollOutcome = RollDraw(rollDrawAddress).d6Roll(
            playersOnSpace,
            queueID,
            uint256(randomIndex)
        );
        uint256 rollRequired = stringsMatch(phase, "Day") ? 4 : 5;
        resultType = rollOutcome < rollRequired
            ? RollDraw.CardType.Ambush
            : RollDraw.CardType.Treasure;

        // if sum of rolls is greater than 5 during night win treasure
        // if sum of rolls is greater than 4 during day win treasure
        // return "Treasure" or "Ambush"
        // Result types: 0 = None, 1 = Event, 2 = Ambush, 3 = Treasure
    }

    function help(
        address queueAddress,
        uint256 queueID,
        uint256 playerID
    )
        internal
        view
        returns (
            int8[3] memory playerStatAdjustment,
            int8[3] memory recipientStatAdjustment
        )
    {
        // returns [playerStat adjustments, recipientAdjustments]
        string[] memory helpOptions = HexplorationQueue(queueAddress)
            .getSubmissionOptions(queueID, playerID);
        if (stringsMatch(helpOptions[1], "Movement")) {
            playerStatAdjustment[0] = -1;
            recipientStatAdjustment[0] = 1;
        } else if (stringsMatch(helpOptions[1], "Agility")) {
            playerStatAdjustment[1] = -1;
            recipientStatAdjustment[1] = 1;
        } else if (stringsMatch(helpOptions[1], "Dexterity")) {
            playerStatAdjustment[2] = -1;
            recipientStatAdjustment[2] = 1;
        }
    }

    function rest(
        address queueAddress,
        uint256 queueID,
        uint256 playerID
    ) internal view returns (int8[3] memory stats) {
        string memory statToRest = HexplorationQueue(queueAddress)
            .getSubmissionOptions(queueID, playerID)[0];
        if (stringsMatch(statToRest, "Movement")) {
            stats[0] = 1;
        } else if (stringsMatch(statToRest, "Agility")) {
            stats[1] = 1;
        } else if (stringsMatch(statToRest, "Dexterity")) {
            stats[2] = 1;
        }
    }

    function stringsMatch(string memory s1, string memory s2)
        internal
        pure
        returns (bool)
    {
        return
            keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }

    function playerIDFromString(string memory playerID)
        internal
        pure
        returns (uint256)
    {
        if (stringsMatch(playerID, "1")) {
            return 1;
        } else if (stringsMatch(playerID, "2")) {
            return 2;
        } else if (stringsMatch(playerID, "3")) {
            return 3;
        } else if (stringsMatch(playerID, "4")) {
            return 4;
        } else {
            return 0;
        }
    }
}
