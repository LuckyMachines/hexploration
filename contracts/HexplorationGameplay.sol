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

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
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

        if (phase == HexplorationQueue.ProcessingPhase.Processing) {
            (intValues, stringValues) = processPlayerActions(queueID);
        } else if (phase == HexplorationQueue.ProcessingPhase.PlayThrough) {
            (intValues, stringValues) = playThrough(queueID);
        } else {
            intValues = new uint256[](0);
            stringValues = new string[](0);
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
        // Initial thoughts...
        // figure out most expensive move and only do as many as can be safely completed
        // in one transaction
        // start at currentQueuePosition
        // after each move is processed currentQueuePosition++
        // on after final batch, switch day / night and
        // set QUEUE.setPhase(HexplorationQueue.ProcessingPhase.PlayThrough, queueID);

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
        intReturn[0] = 1;
        intReturn[1] = 2;
        intReturn[2] = 3;
        intReturn[3] = 4;

        // TODO: update to actual max value
        uint256 maxMovementPerPlayer = 7; // should be set to max movement + 1 (if 6 max set to 7)
        uint256 stringReturnLength = 1 +
            (totalPlayerPositionUpdates * maxMovementPerPlayer) +
            totalPlayerEquips +
            totalPlayerTfers +
            (totalZoneTfers * 2);

        string[] memory stringReturn = new string[](stringReturnLength);
        stringReturn[0] = "something";
        stringReturn[1] = "to";
        stringReturn[2] = "post";

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
}

// What is processing?
// take all moves from batch, verify are valid moves, and
// return list of final moves to process
// keeper will post list of final moves to contract,
//// *shouldn't be able to fail if it got this far
// moves that failed pre-check will be returned as another list that will get logged in an event
