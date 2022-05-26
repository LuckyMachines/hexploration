// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

//TODO:
// setup timer keeper for when all players don't sumbit moves

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./HexplorationStateUpdate.sol";

contract HexplorationQueue is AccessControlEnumerable {
    using Counters for Counters.Counter;
    Counters.Counter internal QUEUE_ID;
    CharacterCard internal CHARACTER_CARD;

    enum ProcessingPhase {
        Start,
        Submission,
        Processing,
        PlayThrough,
        Processed,
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

    // Array of Queue IDs to be processed.
    uint256[] public processingQueue;

    // do we need these 2?
    mapping(uint256 => uint16) public currentQueuePosition; // ?? increases with each player in queue, then back to 0
    mapping(uint256 => uint16) public playThroughPosition; // ?? in case we need to batch this too... hopefully not.

    // mapping from game ID
    mapping(uint256 => uint256) public queueID; // mapping from game ID to it's queue, updates to 0 when finished

    // mappings from queue index
    mapping(uint256 => bool) public inProcessingQueue; // game queue is in processing queue
    mapping(uint256 => ProcessingPhase) public currentPhase; // processingPhase
    mapping(uint256 => uint256) public game; // mapping from queue ID to it's game ID
    mapping(uint256 => uint256[]) public players; // all players with moves to process
    mapping(uint256 => uint256) public totalPlayers; // total # of players who will be submitting
    mapping(uint256 => uint256) public randomness; // randomness delivered here at start of each phase processing

    // mappings from queue index => player id
    mapping(uint256 => mapping(uint256 => Action)) public submissionAction;
    mapping(uint256 => mapping(uint256 => string[])) public submissionOptions;
    mapping(uint256 => mapping(uint256 => string)) public submissionLeftHand;
    mapping(uint256 => mapping(uint256 => string)) public submissionRightHand;
    mapping(uint256 => mapping(uint256 => bool)) public playerSubmitted;
    mapping(uint256 => mapping(uint256 => uint8[3]))
        public playerStatsAtSubmission;

    // current action, so we know what to process during play through phase
    mapping(uint256 => mapping(uint256 => Action)) public activeAction; // defaults to idle

    // From request ID => queue ID
    mapping(uint256 => uint256) internal randomnessRequestQueueID; // ID set before randomness delivered

    ///////  VRF can kick off processing phase

    constructor(address gameplayAddress, address characterCard) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(GAMEPLAY_ROLE, gameplayAddress);
        QUEUE_ID.increment(); // start at 1
        CHARACTER_CARD = CharacterCard(characterCard);
    }

    // Can set multiple VCs, one for manual pushing, one for keeper
    function addVerifiedController(address controllerAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, controllerAddress);
    }

    // pass total # players making submissions
    // total can be less than actual totalPlayers in game
    function requestGameQueue(uint256 gameID, uint256 _totalPlayers)
        external
        onlyRole(VERIFIED_CONTROLLER_ROLE)
        returns (uint256)
    {
        return _requestGameQueue(gameID, _totalPlayers);
    }

    // Sent from controller

    function startGame(uint256 _queueID)
        public
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        currentPhase[_queueID] = ProcessingPhase.Submission;
    }

    function sumbitActionForPlayer(
        uint256 playerID,
        uint8 action,
        string[] memory options,
        string memory leftHand,
        string memory rightHand,
        uint256 _queueID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        require(
            currentPhase[_queueID] == ProcessingPhase.Submission,
            "Not submission phase"
        );
        if (!playerSubmitted[_queueID][playerID]) {
            submissionAction[_queueID][playerID] = Action(action);
            submissionOptions[_queueID][playerID] = options;
            submissionLeftHand[_queueID][playerID] = leftHand;
            submissionRightHand[_queueID][playerID] = rightHand;

            players[_queueID].push(playerID);
            playerSubmitted[_queueID][playerID] = true;
            // automatically add to queue if last player to submit move
            if (players[_queueID].length >= totalPlayers[_queueID]) {
                _processAllActions(_queueID);
            }
            playerStatsAtSubmission[_queueID][playerID] = CHARACTER_CARD
                .getStats(game[_queueID], playerID);
        }
    }

    // Will get processed once keeper is available
    // and previous game queues have been processed
    function requestProcessActions(uint256 _queueID)
        public
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        _processAllActions(_queueID);
    }

    function getAllPlayers(uint256 _queueID)
        public
        view
        returns (uint256[] memory)
    {
        return players[_queueID];
    }

    function getSubmissionOptions(uint256 _queueID, uint256 _playerID)
        public
        view
        returns (string[] memory)
    {
        return submissionOptions[_queueID][_playerID];
    }

    function getStatsAtSubmission(uint256 _queueID, uint256 _playerID)
        public
        view
        returns (uint8[3] memory)
    {
        return playerStatsAtSubmission[_queueID][_playerID];
    }

    function getProcessingQueue() public view returns (uint256[] memory) {
        return processingQueue;
    }

    // Gameplay interactions
    function setPhase(ProcessingPhase phase, uint256 _queueID)
        external
        onlyRole(GAMEPLAY_ROLE)
    {
        currentPhase[_queueID] = phase;
    }

    function setRandomNumber(uint256 randomNumber, uint256 _queueID)
        external
        onlyRole(GAMEPLAY_ROLE)
    {
        randomness[_queueID] = randomNumber;
    }

    function requestNewQueueID(uint256 _queueID)
        external
        onlyRole(GAMEPLAY_ROLE)
    {
        uint256 g = game[_queueID];
        uint256 tp = totalPlayers[_queueID];
        queueID[g] = _requestGameQueue(g, tp);
    }

    function finishProcessing(uint256 _queueID, bool gameComplete)
        public
        onlyRole(GAMEPLAY_ROLE)
    {
        _setProcessingComplete(_queueID, gameComplete);
    }

    function _setProcessingComplete(uint256 _queueID, bool gameComplete)
        internal
    {
        uint256 g = game[_queueID];
        currentPhase[_queueID] = ProcessingPhase.Processed;
        queueID[g] = 0;
        inProcessingQueue[_queueID] = false;
        for (uint256 i = 0; i < processingQueue.length; i++) {
            if (processingQueue[i] == _queueID) {
                processingQueue[i] = 0;
                break;
            }
        }
        if (!gameComplete) {
            // get new queue ID for next set of player actions
            uint256 tp = totalPlayers[_queueID];
            uint256 newQueueID = _requestGameQueue(g, tp);
            queueID[g] = newQueueID;
            currentPhase[newQueueID] = ProcessingPhase.Submission;
        }
    }

    // Internal
    function _processAllActions(uint256 _queueID) internal {
        // Can only add unique unprocessed game queues into processing queue
        if (
            !inProcessingQueue[_queueID] &&
            currentPhase[_queueID] == ProcessingPhase.Submission
        ) {
            processingQueue.push(_queueID);
            inProcessingQueue[_queueID] = true;
            currentPhase[_queueID] = ProcessingPhase.Processing;
            // request random number for phase
            requestRandomWords(_queueID);
        }
    }

    function requestRandomWords(uint256 _queueID) internal {
        // randomnessRequestID[_queueID] = COORDINATOR.requestRandomWords(
        //   keyHash,
        //   s_subscriptionId,
        //   requestConfirmations,
        //   callbackGasLimit,
        //   numWords
        // );

        //set faux id + randomness
        uint256 reqID = _queueID;
        randomnessRequestQueueID[reqID] = _queueID;
        uint256 random = uint256(keccak256(abi.encode(block.timestamp, reqID)));
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = random;
        fulfillRandomWords(reqID, randomWords);
    }

    function fulfillRandomWords(uint256 requestID, uint256[] memory randomWords)
        internal
    {
        uint256 qID = randomnessRequestQueueID[requestID];
        randomness[qID] = randomWords[0];
        // TODO:
        // Call gameplay.processPlayerActions(uint256 queueID)
    }

    function _requestGameQueue(uint256 gameID, uint256 _totalPlayers)
        internal
        returns (uint256)
    {
        /*
    mapping(uint256 => uint256) public queueID; // mapping from game ID to it's queue, updates to 0 when finished
    mapping(uint256 => uint256) public game; // mapping from queue ID to it's game ID
    mapping(uint256 => uint256[]) public players; // all players with moves to process
    mapping(uint256 => uint16) public totalPlayers;
        */
        require(queueID[gameID] == 0, "queue already set");
        uint256 newQueueID = QUEUE_ID.current();
        game[newQueueID] = gameID;
        queueID[gameID] = newQueueID;
        totalPlayers[newQueueID] = _totalPlayers;
        QUEUE_ID.increment();
        return newQueueID;
    }
}
