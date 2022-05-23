// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./HexplorationQueue.sol";
import "./HexplorationStateUpdate.sol";
import "./state/GameSummary.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract HexplorationGameplay is AccessControlEnumerable {
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    HexplorationQueue QUEUE;
    HexplorationStateUpdate GAME_STATE;
    address gameSummaryAddress;

    constructor(address _gameSummaryAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
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

        // maybe we don't call this, since it needs to update state...
        // update this when we pass the results from the shouldProcess
        //finishProcessing(queueID);

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
        // TODO: get real values
        uint256 totalPlayerPositionUpdates = 0;
        uint256 totalPlayerStatUpdates = 0;
        uint256 totalPlayerEquips = 0;
        uint256 totalPlayerTfers = 0;
        uint256 totalZoneTfers = 0;

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
                totalPlayerPositionUpdates++;
            }
            if (bytes(QUEUE.submissionLeftHand(queueID, playerID)).length > 0) {
                totalPlayerEquips++;
            }
            if (
                bytes(QUEUE.submissionRightHand(queueID, playerID)).length > 0
            ) {
                totalPlayerEquips++;
            }
            if (
                action == HexplorationQueue.Action.SetupCamp ||
                action == HexplorationQueue.Action.BreakDownCamp
            ) {
                // either will have tfer between player and board + zone and board
                totalPlayerTfers++;
                totalZoneTfers++;
            }
        }

        // Next:
        // If dig:
        // pull treasure card or ambush
        // receive inventory / artifact or go to battle
        // update totals after Dig, Rest, Help

        // TODO: get updated stats after movement

        uint256[] memory intReturn = processedIntArray(
            totalPlayerPositionUpdates,
            totalPlayerStatUpdates,
            totalPlayerEquips,
            totalPlayerTfers,
            totalZoneTfers,
            queueID
        );

        string[] memory stringReturn = processedStringArray(
            totalPlayerPositionUpdates,
            totalPlayerEquips,
            totalPlayerTfers,
            totalZoneTfers,
            queueID
        );

        return (intReturn, stringReturn);
    }

    function playThrough(uint256 queueID)
        internal
        view
        returns (uint256[] memory, string[] memory)
    {
        // TODO: get real values
        uint256 totalPlayerPositionUpdates = 1;
        uint256 totalPlayerStatUpdates = 1;
        uint256 totalPlayerEquips = 1;
        uint256 totalPlayerTfers = 1;
        uint256 totalZoneTfers = 1;

        uint256 intReturnLength = 5 +
            (totalPlayerPositionUpdates * 2) +
            (totalPlayerStatUpdates * 4) +
            totalPlayerEquips +
            (totalPlayerTfers * 3) +
            (totalZoneTfers * 3);

        uint256[] memory intReturn = new uint256[](intReturnLength);
        intReturn[0] = 5;
        intReturn[1] = 6;
        intReturn[2] = 7;
        intReturn[3] = 8;

        // TODO: update to actual max value
        uint256 maxMovementPerPlayer = 7; // should be set to max movement + 1 (if 6 max set to 7)
        uint256 stringReturnLength = 1 +
            (totalPlayerPositionUpdates * maxMovementPerPlayer) +
            totalPlayerEquips +
            totalPlayerTfers +
            (totalZoneTfers * 2);

        string[] memory stringReturn = new string[](stringReturnLength);
        stringReturn[0] = "playing";
        stringReturn[1] = "through";
        stringReturn[2] = "game";
        return (intReturn, stringReturn);
        // if day phase (){
        // Play through events
        // daily events
        //}
        // if (end game) {
        // play enemy stuff here
        //}
    }

    function processedIntArray(
        uint256 totalPlayerPositionUpdates,
        uint256 totalPlayerStatUpdates,
        uint256 totalPlayerEquips,
        uint256 totalPlayerTfers,
        uint256 totalZoneTfers,
        uint256 queueID
    ) internal view returns (uint256[] memory) {
        uint256 intReturnLength = 5 +
            (totalPlayerPositionUpdates * 2) +
            (totalPlayerStatUpdates * 4) +
            (totalPlayerEquips * 2) +
            (totalPlayerTfers * 3) +
            (totalZoneTfers * 3);

        uint256[] memory intReturn = new uint256[](intReturnLength);
        intReturn[0] = totalPlayerPositionUpdates;
        intReturn[1] = totalPlayerStatUpdates;
        intReturn[2] = totalPlayerEquips;
        intReturn[3] = totalPlayerTfers;
        intReturn[4] = totalZoneTfers;

        uint256[] memory playersInQueue = QUEUE.getAllPlayers(queueID);

        uint256 currentArrayPosition = 5;

        // Movement
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Move
            ) {
                // adding player id, # spaces to move
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
            ) {}
        }

        // RH equip
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                bytes(QUEUE.submissionRightHand(queueID, playersInQueue[i]))
                    .length > 0
            ) {}
        }

        // Camp actions
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.SetupCamp ||
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.BreakDownCamp
            ) {}
        }

        // Dig
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Dig
            ) {}
        }

        //Rest
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Rest
            ) {}
        }

        // Help
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            if (
                QUEUE.submissionAction(queueID, playersInQueue[i]) ==
                HexplorationQueue.Action.Help
            ) {}
        }

        return intReturn;
    }

    function processedStringArray(
        uint256 totalPlayerPositionUpdates,
        uint256 totalPlayerEquips,
        uint256 totalPlayerTfers,
        uint256 totalZoneTfers,
        uint256 queueID
    ) internal view returns (string[] memory) {
        // TODO: update to actual max value
        uint256 maxMovementPerPlayer = 7;
        uint256 stringReturnLength = 1 +
            (totalPlayerPositionUpdates * maxMovementPerPlayer) +
            totalPlayerEquips +
            totalPlayerTfers +
            (totalZoneTfers * 2);

        string[] memory stringReturn = new string[](stringReturnLength);
        // TODO: update to actual game phase...
        stringReturn[0] = "Day";

        // set movement zones
        return stringReturn;
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
