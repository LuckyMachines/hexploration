// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./HexplorationQueue.sol";
import "./HexplorationStateUpdate.sol";
import "./state/GameSummary.sol";
import "./HexplorationBoard.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@chainlink/contracts/src/v0.8/KeeperCompatible.sol";
import "./decks/CardDeck.sol";

contract HexplorationGameplay is
    AccessControlEnumerable,
    KeeperCompatibleInterface
{
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    HexplorationQueue QUEUE;
    HexplorationStateUpdate GAME_STATE;
    HexplorationBoard GAME_BOARD;
    address gameSummaryAddress;
    CardDeck EVENT_DECK;
    CardDeck TREASURE_DECK;
    CardDeck AMBUSH_DECK;

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
        uint256[] playerEquipHands;
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
        string[] activeActionOptions;
        uint256[] activeActionResults; // 0 = None, 1 = Event, 2 = Ambush, 3 = Treasure
        string[2][] activeActionResultCard; // Card for Event / ambush / treasure , outcome e.g. ["Dance with locals", "You're amazing!"]
        string[3][] activeActionInventoryChange; // [item loss, item gain, hand loss]
        uint256 randomness;
    }

    constructor(
        address _gameSummaryAddress,
        address gameBoardAddress,
        address eventDeck,
        address treasureDeck,
        address ambushDeck
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        GAME_BOARD = HexplorationBoard(gameBoardAddress);
        gameSummaryAddress = _gameSummaryAddress;
        EVENT_DECK = CardDeck(eventDeck);
        TREASURE_DECK = CardDeck(treasureDeck);
        AMBUSH_DECK = CardDeck(ambushDeck);
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

    // Test keeper functions
    function needsUpkeep()
        public
        view
        returns (bool upkeepNeeded, bytes memory performData)
    {
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
        if (QUEUE.randomness(queueIDToUpdate) == 0) {
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

    function doUpkeep(bytes calldata performData)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
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
        if (processingPhase == 2) {
            processPlayerActions(queueID, summary);
        } else if (processingPhase == 3) {
            processPlayThrough(queueID, summary);
        }
    }

    // Keeper functions
    function performUpkeep(bytes calldata performData) external override {
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
        if (processingPhase == 2) {
            processPlayerActions(queueID, summary);
        } else if (processingPhase == 3) {
            processPlayThrough(queueID, summary);
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
            if (pq[i] != 0 && QUEUE.randomness(queueIDToUpdate) > 0) {
                queueIDToUpdate = pq[i];
                upkeepNeeded = true;
                break;
            }
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

            if (
                action == HexplorationQueue.Action.Dig ||
                action == HexplorationQueue.Action.Rest ||
                action == HexplorationQueue.Action.Help ||
                action == HexplorationQueue.Action.SetupCamp ||
                action == HexplorationQueue.Action.BreakDownCamp
            ) {
                data.activeActions += 1;
            }

            if (
                action == HexplorationQueue.Action.Dig ||
                action == HexplorationQueue.Action.Rest
            ) {
                data.playerStatUpdates += 1;
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

    // Called by keeper
    function processPlayerActions(uint256 queueID, DataSummary memory summary)
        internal
    {
        uint256 gameID = QUEUE.game(queueID);
        // TODO: save update struct with all the actions from queue (what was originally the ints array)
        PlayUpdates memory playUpdates = playUpdatesForPlayerActionPhase(
            queueID,
            summary
        );
        GAME_STATE.postUpdates(playUpdates, gameID);
        QUEUE.setPhase(HexplorationQueue.ProcessingPhase.PlayThrough, queueID);
    }

    function processPlayThrough(uint256 queueID, DataSummary memory summary)
        internal
    {
        HexplorationQueue.ProcessingPhase phase = QUEUE.currentPhase(queueID);

        if (QUEUE.randomness(queueID) != 0) {
            if (phase == HexplorationQueue.ProcessingPhase.PlayThrough) {
                uint256 gameID = QUEUE.game(queueID);
                PlayUpdates memory playUpdates = playUpdatesForPlayThroughPhase(
                    queueID,
                    summary
                );
                // TODO: set this to true when game is finished
                bool gameComplete = false;
                GAME_STATE.postUpdates(playUpdates, gameID);
                QUEUE.finishProcessing(queueID, gameComplete);
            }
        }
    }

    function playUpdatesForPlayerActionPhase(
        uint256 queueID,
        DataSummary memory summary
    ) internal view returns (PlayUpdates memory) {
        PlayUpdates memory playUpdates;

        uint256[] memory playersInQueue = QUEUE.getAllPlayers(queueID);
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
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Move
            ) {
                // return [player id, # spaces to move]

                playUpdates.playerPositionIDs[position] = playersInQueue[i];
                playUpdates.spacesToMove[position] = QUEUE
                    .getSubmissionOptions(queueID, playersInQueue[i])
                    .length;
                string[] memory options = QUEUE.getSubmissionOptions(
                    queueID,
                    playersInQueue[i]
                );
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
                bytes(QUEUE.submissionLeftHand(queueID, playersInQueue[i]))
                    .length > 0
            ) {
                // return [player id, r/l hand (0/1)]

                playUpdates.playerEquipIDs[position] = playersInQueue[i];
                playUpdates.playerEquipHands[position] = 0;
                playUpdates.playerEquips[position] = QUEUE.submissionLeftHand(
                    queueID,
                    playersInQueue[i]
                );
                position++;
            }
        }

        // RH equip
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                bytes(QUEUE.submissionRightHand(queueID, playersInQueue[i]))
                    .length > 0
            ) {
                // return [player id, r/l hand (0/1)]

                playUpdates.playerEquipIDs[position] = playersInQueue[i];
                playUpdates.playerEquipHands[position] = 1;
                playUpdates.playerEquips[position] = QUEUE.submissionRightHand(
                    queueID,
                    playersInQueue[i]
                );
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
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.SetupCamp
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
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.BreakDownCamp
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
        playUpdates.activeActionOptions = new string[](summary.activeActions);
        playUpdates.activeActionResults = new uint256[](summary.activeActions);
        playUpdates.activeActionResultCard = new string[2][](
            summary.activeActions
        );
        playUpdates.activeActionInventoryChange = new string[3][](
            summary.activeActions
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
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.SetupCamp
            ) {
                playUpdates.activeActions[position] = "Setup camp";
                playUpdates.activeActionOptions[position] = "";
                playUpdates.playerActiveActionIDs[position] = playersInQueue[i];
                position++;
            } else if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.BreakDownCamp
            ) {
                playUpdates.activeActions[position] = "Break down camp";
                playUpdates.activeActionOptions[position] = "";
                position++;
            } else if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Dig
            ) {
                playUpdates.activeActions[position] = "Dig";
                playUpdates.activeActionOptions[position] = "";
                playUpdates.activeActionResults[position] = dig(
                    queueID,
                    playersInQueue[i]
                );
                (
                    playUpdates.activeActionResultCard[position][0],
                    playUpdates.playerStatUpdates[playerStatPosition],
                    playUpdates.activeActionInventoryChange[position][0],
                    playUpdates.activeActionInventoryChange[position][1],
                    playUpdates.activeActionInventoryChange[position][2],
                    playUpdates.activeActionResultCard[position][1]
                ) = drawCard(
                    playUpdates.activeActionResults[position],
                    queueID,
                    playersInQueue[i]
                );

                playerStatPosition++;
                position++;
            } else if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Rest
            ) {
                playUpdates.activeActions[position] = "Rest";
                playUpdates.activeActionOptions[position] = QUEUE
                    .submissionOptions(queueID, playersInQueue[i], 0);

                playUpdates.playerStatUpdates[playerStatPosition] = rest(
                    queueID,
                    playersInQueue[i]
                );
                playerStatPosition++;
                position++;
            } else if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Help
            ) {
                // TODO: use this...
                playUpdates.activeActions[position] = "Help";
                playUpdates.activeActionOptions[position] = QUEUE
                    .submissionOptions(queueID, playersInQueue[i], 0);
                position++;
            }
        }
        playUpdates.randomness = QUEUE.randomness(queueID);

        // only need to store current action as digging, resting, and play out during play phase

        return playUpdates;
    }

    function playUpdatesForPlayThroughPhase(
        uint256 queueID,
        DataSummary memory summary
    ) internal view returns (PlayUpdates memory) {
        PlayUpdates memory playUpdates;
        /*
        // TODO: update to actual game phase at appropriate time...
        HexplorationQueue.ProcessingPhase phase = QUEUE.currentPhase(queueID);

        // TODO: set this to true when game is finished
        bool gameComplete = false;

        uint256 gameID = QUEUE.game(queueID);
        //uint256 gameID = QUEUE.game(queueID);
        // uint256 totalPlayers = PlayerRegistry(GAME_BOARD.prAddress())
        //     .totalRegistrations(QUEUE.game(queueID));
        CharacterCard cc = CharacterCard(GAME_BOARD.characterCard());

        // setup endgame

        //TODO:
        // check current phase (day / night)
        string memory currentPhase = "Day";
        bool isDay = stringsMatch(currentPhase, "Day");
        bool setupEndGame = false;
        for (
            uint256 i = 0;
            i <
            PlayerRegistry(GAME_BOARD.prAddress()).totalRegistrations(
                QUEUE.game(queueID)
            );
            i++
        ) {
            uint256 playerID = i + 1;
            uint256 activeAction = uint256(
                QUEUE.activeAction(queueID, playerID)
            );
            if (activeAction == 4) {
                // dig
                if (stringsMatch(dig(queueID, playerID), "Treasure")) {
                    // dug treasure! pick treasure card
                    // if final artifact is found, setupEndGame = true;
                } else {
                    // dug ambush...
                    // play out consequences
                }
            } else if (activeAction == 5) {
                // rest
                string memory restChoice = QUEUE.submissionOptions(
                    queueID,
                    playerID,
                    0
                );
                if (stringsMatch(restChoice, "Movement")) {
                    // add 1 to movement
                } else if (stringsMatch(restChoice, "Agility")) {
                    // add 1 to agility
                } else if (stringsMatch(restChoice, "Dexterity")) {
                    // add 1 to dexterity
                }
            } else if (activeAction == 6) {
                //help
                // set player ID to help (options) as string choice
            }

            // to get current player stats...
            // cc.movement(gameID, playerID) => returns uint8
            // cc.agility(gameID, playerID) => returns uint8
            // cc.dexterity(gameID, playerID) => returns uint8

            //to subtract from player stats...
            //subToZero(uint256(playerStat), reductionAmount);
            // can submit numbers higher than max here, but won't actually get set to those
            // will get set to max if max exceeded
        }

        if (setupEndGame) {
            // setup end game...
        }
        // update Phase (Day / Night);
        playUpdates.gamePhase = isDay ? "Night" : "Day";

        if (isDay) {
            for (
                uint256 i = 0;
                i <
                PlayerRegistry(GAME_BOARD.prAddress()).totalRegistrations(
                    QUEUE.game(queueID)
                );
                i++
            ) {
                uint256 playerID = i + 1;
                // if Day,
                // roll D6
                // if EVEN - Choose Event Card + calculate results + save to data
                // if ODD - Choose Ambush Card + calculate results + save to data
            }
        }
        */
        return playUpdates;
    }

    function dig(uint256 queueID, uint256 playerID)
        public
        view
        returns (uint256 resultType)
    {
        // if digging available... (should be pre-checked)
        // roll dice (d6) for each player on space not resting

        uint256 playersOnSpace = QUEUE
            .getSubmissionOptions(queueID, playerID)
            .length - 1;
        string memory phase = QUEUE.getSubmissionOptions(queueID, playerID)[0];
        uint256 rollOutcome = d6Roll(
            playersOnSpace,
            queueID,
            playerID * block.timestamp
        );
        uint256 rollRequired = stringsMatch(phase, "Day") ? 4 : 5;
        resultType = rollOutcome < rollRequired ? 2 : 3;

        // if sum of rolls is greater than 5 during night win treasure
        // if sum of rolls is greater than 4 during day win treasure
        // return "Treasure" or "Ambush"
        // Result types: 0 = None, 1 = Event, 2 = Ambush, 3 = Treasure
    }

    function playerRolls(uint256 queueID, uint256 playerID)
        internal
        view
        returns (uint256[3] memory rolls)
    {
        uint8[3] memory playerStats = QUEUE.getStatsAtSubmission(
            queueID,
            playerID
        );
        rolls[0] = attributeRoll(
            playerStats[0],
            queueID,
            playerID * block.timestamp
        );
        rolls[1] = attributeRoll(
            playerStats[1],
            queueID,
            playerID * block.timestamp
        );
        rolls[2] = attributeRoll(
            playerStats[2],
            queueID,
            playerID * block.timestamp
        );
    }

    function rest(uint256 queueID, uint256 playerID)
        internal
        view
        returns (int8[3] memory stats)
    {
        string memory statToRest = QUEUE.getSubmissionOptions(
            queueID,
            playerID
        )[0];
        if (stringsMatch(statToRest, "Movement")) {
            stats[0] = 1;
        } else if (stringsMatch(statToRest, "Agility")) {
            stats[1] = 1;
        } else if (stringsMatch(statToRest, "Dexterity")) {
            stats[2] = 1;
        }
    }

    function drawCard(
        uint256 cardType,
        uint256 queueID,
        uint256 playerID
    )
        internal
        view
        returns (
            string memory card,
            int8[3] memory stats,
            string memory itemTypeLoss,
            string memory itemTypeGain,
            string memory handLoss,
            string memory outcome
        )
    {
        // get randomness from queue  QUEUE.randomness(queueID)
        // outputs should match up with what's returned from deck draw

        if (cardType == 1) {
            // draw from event deck
            (
                card,
                stats[0],
                stats[1],
                stats[2],
                itemTypeLoss,
                itemTypeGain,
                handLoss,
                outcome
            ) = EVENT_DECK.drawCard(
                QUEUE.randomness(queueID),
                playerRolls(queueID, playerID)
            );
        } else if (cardType == 2) {
            // draw from ambush deck
            (
                card,
                stats[0],
                stats[1],
                stats[2],
                itemTypeLoss,
                itemTypeGain,
                handLoss,
                outcome
            ) = AMBUSH_DECK.drawCard(
                QUEUE.randomness(queueID),
                playerRolls(queueID, playerID)
            );
        } else {
            // draw from treasure deck
            (
                card,
                stats[0],
                stats[1],
                stats[2],
                itemTypeLoss,
                itemTypeGain,
                handLoss,
                outcome
            ) = TREASURE_DECK.drawCard(
                QUEUE.randomness(queueID),
                playerRolls(queueID, playerID)
            );
        }
    }

    function attributeRoll(
        uint256 numDice,
        uint256 queueID,
        uint256 rollSeed
    ) public view returns (uint256 rollTotal) {
        uint8[] memory die = new uint8[](3);
        die[0] = 0;
        die[1] = 1;
        die[2] = 2;
        rollTotal = rollDice(queueID, die, numDice, rollSeed);
    }

    function d6Roll(
        uint256 numDice,
        uint256 queueID,
        uint256 rollSeed
    ) public view returns (uint256 rollTotal) {
        uint8[] memory die = new uint8[](6);
        die[0] = 1;
        die[1] = 2;
        die[2] = 3;
        die[3] = 4;
        die[4] = 5;
        die[5] = 6;
        rollTotal = rollDice(queueID, die, numDice, rollSeed);
    }

    function rollDice(
        uint256 queueID,
        uint8[] memory diceValues,
        uint256 diceQty,
        uint256 rollSeed
    ) internal view returns (uint256 rollTotal) {
        rollTotal = 0;
        uint256 randomness = QUEUE.randomness(queueID);
        for (uint256 i = 0; i < diceQty; i++) {
            rollTotal += diceValues[
                uint256(
                    keccak256(abi.encode(randomness, i * rollTotal, rollSeed))
                ) % diceValues.length
            ];
        }
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

    // returns a - b or 0 if negative;
    function subToZero(uint256 a, uint256 b)
        internal
        pure
        returns (uint256 difference)
    {
        difference = a > b ? a - b : 0;
    }

    function absoluteValue(int256 x) internal pure returns (uint256 absX) {
        absX = x >= 0 ? uint256(x) : uint256(-x);
    }
}

/*

        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.SetupCamp
            ) {
                stringReturn[currentArrayPosition] = "Setup camp";
                stringReturn[currentArrayPosition + 1] = "";
                currentArrayPosition += 2;
            } else if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.BreakDownCamp
            ) {
                stringReturn[currentArrayPosition] = "Break down camp";
                stringReturn[currentArrayPosition + 1] = "";
                currentArrayPosition += 2;
            } else if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Dig
            ) {
                stringReturn[currentArrayPosition] = "Dig";
                stringReturn[currentArrayPosition + 1] = "";
                currentArrayPosition += 2;
            } else if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Rest
            ) {
                stringReturn[currentArrayPosition] = "Rest";
                stringReturn[currentArrayPosition + 1] = QUEUE
                    .submissionOptions(queueID, playersInQueue[i], 0);
                currentArrayPosition += 2;
            } else if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Help
            ) {
                stringReturn[currentArrayPosition] = "Help";
                stringReturn[currentArrayPosition + 1] = QUEUE
                    .submissionOptions(queueID, playersInQueue[i], 0);
                currentArrayPosition += 2;
            }
        }

        // Dig
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Dig
            ) {
                stringReturn[currentArrayPosition] = "Dig";
                stringReturn[currentArrayPosition + 1] = "";
                currentArrayPosition += 2;
            }
        }

        //Rest
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Rest
            ) {
                stringReturn[currentArrayPosition] = "Rest";
                stringReturn[currentArrayPosition + 1] = QUEUE
                    .submissionOptions(queueID, playersInQueue[i], 0);
                currentArrayPosition += 2;
            }
        }

        // Help
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Help
            ) {
                stringReturn[currentArrayPosition] = "Help";
                stringReturn[currentArrayPosition + 1] = QUEUE
                    .submissionOptions(queueID, playersInQueue[i], 0);
                currentArrayPosition += 2;
            }
        }
        // set movement zones
        return stringReturn;
*/

// What is processing?
// take all moves from batch, verify are valid moves, and
// return list of final moves to process
// keeper will post list of final moves to contract,
//// *shouldn't be able to fail if it got this far
// moves that failed pre-check will be returned as another list that will get logged in an event

// Initial thoughts for scaling...
// figure out most expensive move and only do as many as can be safely completed
// in one transaction
// start at currentQueuePosition
// after each move is processed currentQueuePosition++
// on after final batch, switch day / night and
// set QUEUE.setPhase(HexplorationQueue.ProcessingPhase.PlayThrough, queueID);
