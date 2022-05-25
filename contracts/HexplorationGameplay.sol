// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./HexplorationQueue.sol";
import "./HexplorationStateUpdate.sol";
import "./state/GameSummary.sol";
import "./HexplorationBoard.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract HexplorationGameplay is AccessControlEnumerable {
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    HexplorationQueue QUEUE;
    HexplorationStateUpdate GAME_STATE;
    HexplorationBoard GAME_BOARD;
    address gameSummaryAddress;

    // Mapping from QueueID to updates needed to run
    mapping(uint256 => PlayUpdates) public updates;
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
        uint256[] playerEquipIDs;
        uint256[] playerEquipHands;
        uint256[] zoneTransfersTo;
        uint256[] zoneTransfersFrom;
        uint256[] zoneTransferQtys;
        uint256[] playerTransfersTo;
        uint256[] playerTransfersFrom;
        uint256[] playerTransferQtys;
        uint256[] playerStatUpdateIDs;
        uint256[3][] playerStatUpdates;
        uint256[] playerActiveActionIDs;
        string gamePhase;
        string[][] playerMovementOptions;
        string[] playerEquips;
        string[] zoneTransferItemTypes;
        string[] playerTransferItemTypes;
        string[] activeActions;
        string[] activeActionOptions;
    }

    constructor(address _gameSummaryAddress, address gameBoardAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        GAME_BOARD = HexplorationBoard(gameBoardAddress);
        gameSummaryAddress = _gameSummaryAddress;
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

    // Keeper functions...
    // returns if should be processing and processed moves to post if so
    // this will be run twice for each phase, once for player actions,
    // once for playing out world scenarios
    function shouldContinueProcessing(uint256 queueID)
        public
        view
        returns (
            bool,
            uint256[] memory,
            string[] memory
        )
    {
        bool shouldContinue = QUEUE.currentPhase(queueID) ==
            HexplorationQueue.ProcessingPhase.Processing ||
            QUEUE.currentPhase(queueID) ==
            HexplorationQueue.ProcessingPhase.PlayThrough;
        string[] memory stringsToPost;
        uint256[] memory valuesToPost;
        if (shouldContinue) {
            (valuesToPost, stringsToPost) = process(queueID);
        } else {
            valuesToPost = new uint256[](0);
            stringsToPost = new string[](0);
        }

        return (shouldContinue, valuesToPost, stringsToPost);
    }

    // posts data returned from shouldContinueProcessing()...
    function postProcessedGameState(
        uint256 queueID,
        uint256[] memory intUpdates,
        string[] memory stringUpdates
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        HexplorationQueue.ProcessingPhase phase = QUEUE.currentPhase(queueID);

        // TODO: set this to true when game is finished
        bool gameComplete = false;
        uint256 gameID = QUEUE.game(queueID);
        if (phase == HexplorationQueue.ProcessingPhase.Processing) {
            GAME_STATE.postUpdates(intUpdates, stringUpdates, gameID);
            QUEUE.setPhase(
                HexplorationQueue.ProcessingPhase.PlayThrough,
                queueID
            );
        } else if (phase == HexplorationQueue.ProcessingPhase.PlayThrough) {
            GAME_STATE.postUpdates(intUpdates, stringUpdates, gameID);
            QUEUE.finishProcessing(queueID, gameComplete);
        }
    }

    function process(uint256 queueID)
        internal
        view
        returns (uint256[] memory intValues, string[] memory stringValues)
    {
        HexplorationQueue.ProcessingPhase phase = QUEUE.currentPhase(queueID);
        if (QUEUE.randomness(queueID) != 0) {
            if (phase == HexplorationQueue.ProcessingPhase.Processing) {
                (intValues, stringValues) = processPlayerActions(queueID);
            } else if (phase == HexplorationQueue.ProcessingPhase.PlayThrough) {
                (intValues, stringValues) = playThrough(queueID);
            } else {
                intValues = new uint256[](0);
                stringValues = new string[](0);
            }
        } else {
            // randomness not set for queue yet
            intValues = new uint256[](0);
            stringValues = new string[](1);
            stringValues[0] = "awaiting randomness";
        }

        // Update TODO: expand for processing larger turns...
        // something like
        // if (currentPhase == HexplorationQueue.ProcessingPhase.Processing) {
        //     // processPlayerActions()
        // } else if (
        //     currentPhase == HexplorationQueue.ProcessingPhase.PlayThrough
        // ) {
        //     // playThrough()
        //     // finishProcessing()
        // }
    }

    function processPlayerActions(uint256 queueID)
        internal
        view
        returns (uint256[] memory, string[] memory)
    {
        DataSummary memory data = DataSummary(0, 0, 0, 0, 0, 0);
        uint256[] memory playersInQueue = QUEUE.getAllPlayers(queueID);
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            uint256 playerID = playersInQueue[i];
            HexplorationQueue.Action action = QUEUE.submissionAction(
                queueID,
                playerID
            );
            /*
            Idle,
            Move,
            SetupCamp,
            BreakDownCamp,
            Dig,
            Rest,
            Help
            */
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
        }

        // Next: ( do this in play through phase / post )
        // If dig:
        // pull treasure card or ambush

        // receive inventory / artifact or go to battle

        // update totals after Dig, Rest, Help

        uint256[] memory intReturn = processedIntArray(data, queueID);

        string[] memory stringReturn = processedStringArray(data, queueID);

        return (intReturn, stringReturn);
    }

    function playThrough(uint256 queueID)
        internal
        view
        returns (uint256[] memory, string[] memory)
    {
        DataSummary memory data = DataSummary(0, 0, 0, 0, 0, 0);
        PlayUpdates memory playUpdates;
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

        uint256[] memory intReturn = processedIntArrayFrom(data, playUpdates);
        string[] memory stringReturn = processedStringArrayFrom(
            data,
            playUpdates
        );

        return (intReturn, stringReturn);

        // if day phase (){
        // Play through events
        // daily events
        //}
        // if (end game) {
        // play enemy stuff here
        //}
    }

    function processedIntArrayFrom(
        DataSummary memory dataSummary,
        PlayUpdates memory playUpdates
    ) internal pure returns (uint256[] memory) {
        uint256 intReturnLength = 6 +
            (dataSummary.playerPositionUpdates * 2) +
            (dataSummary.playerStatUpdates * 4) +
            (dataSummary.playerEquips * 2) +
            (dataSummary.playerTransfers * 3) +
            (dataSummary.zoneTransfers * 3) +
            dataSummary.activeActions;
        uint256[] memory returnArray = new uint256[](intReturnLength);
        return returnArray;
    }

    // TODO:
    // Store PlayUpdates
    // when random number is fulfilled from VRF
    // Then get Int parsing data from bytes sent with keeper
    function processedStringArrayFrom(
        DataSummary memory dataSummary,
        PlayUpdates memory playUpdates
    ) internal pure returns (string[] memory) {
        // TODO: update to actual max value
        uint256 maxMovementPerPlayer = 7;
        uint256 stringReturnLength = 1 +
            (dataSummary.playerPositionUpdates * maxMovementPerPlayer) +
            dataSummary.playerEquips +
            dataSummary.playerTransfers +
            (dataSummary.zoneTransfers * 2) +
            (dataSummary.activeActions * 2);
        string[] memory returnArray = new string[](stringReturnLength);
        returnArray[0] = playUpdates.gamePhase;
        return returnArray;
    }

    function processedIntArray(DataSummary memory dataSummary, uint256 queueID)
        internal
        view
        returns (uint256[] memory)
    {
        uint256 intReturnLength = 6 +
            (dataSummary.playerPositionUpdates * 2) +
            (dataSummary.playerStatUpdates * 4) +
            (dataSummary.playerEquips * 2) +
            (dataSummary.playerTransfers * 3) +
            (dataSummary.zoneTransfers * 3) +
            dataSummary.activeActions;

        uint256[] memory intReturn = new uint256[](intReturnLength);
        intReturn[0] = dataSummary.playerPositionUpdates;
        intReturn[1] = dataSummary.playerStatUpdates;
        intReturn[2] = dataSummary.playerEquips;
        intReturn[3] = dataSummary.playerTransfers;
        intReturn[4] = dataSummary.zoneTransfers;
        intReturn[5] = dataSummary.activeActions;

        uint256[] memory playersInQueue = QUEUE.getAllPlayers(queueID);

        uint256 currentArrayPosition = 6;

        // Movement
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Move
            ) {
                // return [player id, # spaces to move]
                intReturn[currentArrayPosition] = playersInQueue[i];
                intReturn[currentArrayPosition + 1] = QUEUE
                    .getSubmissionOptions(queueID, playersInQueue[i])
                    .length;
                currentArrayPosition += 2;
            }
        }

        // LH equip
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                bytes(QUEUE.submissionLeftHand(queueID, playersInQueue[i]))
                    .length > 0
            ) {
                // return [player id, r/l hand (0/1)]
                intReturn[currentArrayPosition] = playersInQueue[i];
                intReturn[currentArrayPosition + 1] = 0;
                currentArrayPosition += 2;
            }
        }

        // RH equip
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                bytes(QUEUE.submissionRightHand(queueID, playersInQueue[i]))
                    .length > 0
            ) {
                // return [player id, r/l hand (0/1)]
                intReturn[currentArrayPosition] = playersInQueue[i];
                intReturn[currentArrayPosition + 1] = 1;
                currentArrayPosition += 2;
            }
        }

        // Camp actions
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.SetupCamp
            ) {
                // setup camp
                // transfer from player to zone
                // return [to ID, from ID, quantity]
                // Transfer 1 campsite from player to current zone

                intReturn[currentArrayPosition] = 10000000000; //10000000000 represents current play zone of player
                intReturn[currentArrayPosition + 1] = playersInQueue[i];
                intReturn[currentArrayPosition + 2] = 1;
                currentArrayPosition += 3;
            }
        }

        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.BreakDownCamp
            ) {
                // break down camp
                // transfer from zone to player
                intReturn[currentArrayPosition] = playersInQueue[i];
                intReturn[currentArrayPosition + 1] = 10000000000;
                intReturn[currentArrayPosition + 2] = 1;
                currentArrayPosition += 3;
            }
        }

        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Dig ||
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Rest ||
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Help
            ) {
                intReturn[currentArrayPosition] = playersInQueue[i];
                currentArrayPosition++;
            }
        }

        // following are updated on play through phase only
        // no inventory transfers or stat adjustments from player action phase

        // only need to store current action as digging, resting, and play out during play phase

        return intReturn;
    }

    function processedStringArray(
        DataSummary memory dataSummary,
        uint256 queueID
    ) internal view returns (string[] memory) {
        // TODO: update to actual max value
        uint256 maxMovementPerPlayer = 7;
        uint256 stringReturnLength = 1 +
            (dataSummary.playerPositionUpdates * maxMovementPerPlayer) +
            dataSummary.playerEquips +
            dataSummary.playerTransfers +
            (dataSummary.zoneTransfers * 2) +
            (dataSummary.activeActions * 2);

        string[] memory stringReturn = new string[](stringReturnLength);
        // TODO: update to actual game phase...
        stringReturn[0] = "Day";

        uint256[] memory playersInQueue = QUEUE.getAllPlayers(queueID);

        uint256 currentArrayPosition = 1;

        // Movement
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Move
            ) {
                string[] memory options = QUEUE.getSubmissionOptions(
                    queueID,
                    playersInQueue[i]
                );
                for (uint256 j = 0; j < maxMovementPerPlayer; j++) {
                    stringReturn[currentArrayPosition] = j < options.length
                        ? options[j]
                        : "";
                    currentArrayPosition++;
                }
            }
        }

        // LH equip
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                bytes(QUEUE.submissionLeftHand(queueID, playersInQueue[i]))
                    .length > 0
            ) {
                stringReturn[currentArrayPosition] = QUEUE.submissionLeftHand(
                    queueID,
                    playersInQueue[i]
                );
                currentArrayPosition++;
            }
        }

        // RH equip
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                bytes(QUEUE.submissionRightHand(queueID, playersInQueue[i]))
                    .length > 0
            ) {
                stringReturn[currentArrayPosition] = QUEUE.submissionRightHand(
                    queueID,
                    playersInQueue[i]
                );
                currentArrayPosition++;
            }
        }

        // Camp actions
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.SetupCamp ||
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.BreakDownCamp
            ) {
                stringReturn[currentArrayPosition] = "Campsite";
                currentArrayPosition++;
            }
        }

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
    }

    function dig(uint256 queueID, uint256 playerID)
        public
        view
        returns (string memory cardType)
    {
        // if digging available...
        // roll dice (d6) for each player on space not resting
        // if sum of rolls is greater than 5 during night win treasure
        // if sum of rolls is greater than 4 during day win treasure
        // return "Treasure" or "Ambush"
    }

    function drawCard(
        string memory cardType,
        uint256 queueID,
        uint256 playerID
    )
        internal
        view
        returns (
            string memory card,
            int8 movementAdjust,
            int8 agilityAdjust,
            int8 dexterityAdjust,
            string memory itemTypeLoss,
            string memory itemTypeGain,
            string memory handLoss,
            int256 movementX,
            int256 movementY
        )
    {
        // get randomness from queue  QUEUE.randomness(queueID)
        // outputs should match up with what's returned from deck draw
        if (stringsMatch(cardType, "Treasure")) {
            // draw from treasure deck
        } else if (stringsMatch(cardType, "Ambush")) {
            // draw from ambush deck
        } else if (stringsMatch(cardType, "Event")) {
            // draw from event deck
        }
    }

    function rollDice(
        uint256 queueID,
        uint256[] memory diceValues,
        uint256 diceQty
    ) internal view returns (uint256) {
        uint256 rollTotal = 0;
        // roll dice quantity amount of times
        // each roll, select a number between 0 - diceValues.length - 1
        // add up value at diceValues[rollResult]
        return rollTotal;
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
