// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./HexplorationQueue.sol";
import "./state/GameSummary.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract HexplorationGameplay is AccessControlEnumerable {
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    HexplorationQueue QUEUE;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function setQueue(address queueContract)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        QUEUE = HexplorationQueue(queueContract);
        _setupRole(VERIFIED_CONTROLLER_ROLE, queueContract);
    }

    // Keeper functions...
    // returns if should be processing and processed moves to post if so
    function shouldContinueProcessing(uint256 queueID)
        public
        view
        returns (
            bool,
            uint256[] memory,
            string[] memory
        )
    {
        // since we are returning all moves in one tranasaction, we should always be
        // starting at this phase. Once larger moves are implemented, processing OR
        // play through phase will be ok
        bool shouldContinue = QUEUE.currentPhase(queueID) ==
            HexplorationQueue.ProcessingPhase.Processing;
        string[] memory movesToPost;
        uint256[] memory valuesToPost;
        if (shouldContinue) {
            (valuesToPost, movesToPost) = process(queueID);
        } else {
            valuesToPost = new uint256[](0);
            movesToPost = new string[](0);
        }

        return (shouldContinue, valuesToPost, movesToPost);
    }

    // posts data returned from shouldContinueProcessing()...
    function postProcessedGameState(
        uint256 queueID,
        uint256[] memory intUpdates,
        string[] memory stringUpdates
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        QUEUE.finishProcessing(queueID, intUpdates, stringUpdates);
    }

    function process(uint256 queueID)
        internal
        view
        returns (uint256[] memory, string[] memory)
    {
        processPlayerActions(queueID);
        playThrough(queueID);

        uint256[] memory sampleIntReturn = new uint256[](4);
        sampleIntReturn[0] = 1;
        sampleIntReturn[1] = 2;
        sampleIntReturn[2] = 3;
        sampleIntReturn[3] = 4;

        string[] memory sampleStringReturn = new string[](3);
        sampleStringReturn[0] = "something";
        sampleStringReturn[1] = "to";
        sampleStringReturn[2] = "post";
        return (sampleIntReturn, sampleStringReturn);

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

    function processPlayerActions(uint256 queueID) internal view {
        // figure out most expensive move and only do as many as can be safely completed
        // in one transaction
        // start at currentQueuePosition
        // after each move is processed currentQueuePosition++
        // on after final batch, switch day / night and
        // set QUEUE.setPhase(HexplorationQueue.ProcessingPhase.PlayThrough, queueID);
    }

    function playThrough(uint256 queueID) internal view {
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
