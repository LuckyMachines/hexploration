// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./HexplorationQueue.sol";
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
    function shouldUpdate() public view returns (bool) {
        //TODO: check if any processing queue has any active game queues
        return false;
    }

    function beginProcessing(uint256 queueID) internal {
        // get queue ID
        // set processingPhase of queue to "processing"
    }

    function continueProcessing() internal {
        // continueProcessing//
        // figure out most expensive move and only do as many as can be safely completed
        // in one transaction
        // start at currentQueuePosition
        // after each move is processed currentQueuePosition++
        // on after final batch, switch day / night and call playThrough()
    }

    function process(uint256 queueID) internal {
        // continueProcessing//
        // figure out most expensive move and only do as many as can be safely completed
        // in one transaction
        // start at currentQueuePosition
        // after each move is processed currentQueuePosition++
        // on after final batch, switch day / night and call playThrough()
    }

    function playThrough() internal {
        // if day phase (){
        // Play through events
        // daily events
        //}
        // if (end game) {
        // play enemy stuff here
        //}
    }

    function finishProcessing() internal {
        //  assign new queue index for next processing phase (based on current queue)
    }
}

// What is processing?
// take all moves from batch, verify are valid moves, and
// return list of final moves to process
// keeper will post list of final moves to contract,
// *shouldn't be able to fail if it got this far
// moves that failed pre-check will be returned as another list that will get logged in an event
