// SPDX-License-Identifier: GPL-3.0
/* Notes:
// add controller as verified controller, and add address of queue to board on deployment
// Closes during processing. No moves can be submitted until processing is complete.
// Store moves to be processed at end of phase
// Clears out at end of every phase, shouldn't be too backed up
// Moves cannot be submitted to queue between phases;
// keeper will store processed moves, empty queue, and set status if ready.

// How are moves stored?
// PlayerID, action choice (move, dig, rest, etc.), options[], equipLH, equipRH
// uint256 queueIndex = 0; // increase with each phase processed so we don't have to clean the queue
// if all players have submitted, let queue into next phase

// players can have 1 move stored at a time.
// once a move is submitted, that's it for that phase.

// Phase flow:
// start, submission, processing,      play through,     submission,      processing,        play through,    submission,      processing
// Land, first moves, play out moves,                   review outcomes   play out moves,
//                    Start next phase                  submit moves      Start next phase
//                                     If phase == day:                                      If phase == day:
//                                     Run Events etc                                        Run events etc
*/
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract HexplorationQueue is AccessControlEnumerable {
    using Counters for Counters.Counter;
    Counters.Counter internal _queueID;

    enum ProcessingPhase {
        Start,
        Submission,
        Processing,
        PlayThrough,
        Closed
    }
    enum Action {
        Idle,
        Move,
        SetupCamp,
        BreakDownCamp,
        Dig,
        Rest,
        Help
    }

    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");
    bytes32 public constant GAMEPLAY_ROLE = keccak256("GAMEPLAY_ROLE");

    // mappings from queue index
    mapping(uint256 => uint16) public currentQueuePosition; // increases with each player in queue, then back to 0
    mapping(uint256 => ProcessingPhase) public currentPhase; // processingPhase
    mapping(uint256 => uint16) public playThroughPosition; // in case we need to batch this too... hopefully not.
    mapping(uint256 => uint256) public queueID; // mapping from game ID to it's queue
    mapping(uint256 => uint256) public game; // mapping from queue ID to it's game ID
    mapping(uint256 => uint256[]) public players; // all players with moves to process

    // mappings from queue index => player id
    mapping(uint256 => mapping(uint256 => Action)) public submissionAction;
    mapping(uint256 => mapping(uint256 => string[])) public submissionOptions;
    mapping(uint256 => mapping(uint256 => string)) public submissionLeftHand;
    mapping(uint256 => mapping(uint256 => string)) public submissionRightHand;

    mapping(uint256 => uint256) randomness; // randomness delivered here at start of each phase processing

    ///////  VRF can kick off processing phase

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _queueID.increment(); // start at 1
    }

    // Can set multiple VCs, one for manual pushing, one for keeper
    function addVerifiedController(address controllerAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, controllerAddress);
    }

    function sumbitActionForPlayer(
        Action action,
        string[] memory options,
        uint256 playerID,
        uint256 gameID,
        string memory leftHand,
        string memory righHand
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // if (move[queueIndex][playerID] == 0){
        //    submit moves
    }

    // These functions only kick off processing, processing will happen in separate contract
    // This queue should be updateable by game processor

    function beginProcessing() public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // get queue ID
        // set processingPhase of queue to "processing"
    }

    function continueProcessing() public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // continueProcessing//
        // figure out most expensive move and only do as many as can be safely completed
        // in one transaction
        // start at currentQueuePosition
        // after each move is processed currentQueuePosition++
        // on after final batch, switch day / night and call playThrough()
    }
}
