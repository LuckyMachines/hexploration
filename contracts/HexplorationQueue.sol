// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

//TODO:
// setup timer keeper for when all players don't submit moves

// import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
// import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
// import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./RandomnessConsumer.sol";
import "./HexplorationStateUpdate.sol";
import "./GameEvents.sol";

contract HexplorationQueue is RandomnessConsumer {
    using Counters for Counters.Counter;
    Counters.Counter internal QUEUE_ID;
    CharacterCard internal CHARACTER_CARD;
    GameEvents internal GAME_EVENTS;

    // VRF
    // VRFCoordinatorV2Interface COORDINATOR;
    // uint64 s_subscriptionId;
    // bytes32 s_keyHash;
    // uint32 callbackGasLimit = 2500000;
    // uint16 requestConfirmations = 3;

    enum ProcessingPhase {
        Start,
        Submission,
        Processing,
        PlayThrough,
        Processed,
        Closed,
        Failed
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

    // Array of Queue IDs unable to be processed with upkeep
    uint256[] public failedQueue;

    // do we need these 2?
    mapping(uint256 => uint16) public currentQueuePosition; // ?? increases with each player in queue, then back to 0
    mapping(uint256 => uint16) public playThroughPosition; // ?? in case we need to batch this too... hopefully not.

    // mapping from game ID
    mapping(uint256 => uint256) public queueID; // mapping from game ID to it's queue, updates to 0 when finished
    mapping(uint256 => uint256[]) public queueIDs; // all queue IDs for a game

    // Idle player tracking
    // mapping from gameID => playerID
    mapping(uint256 => mapping(uint256 => uint256)) public idleTurns;
    // increase by one every time turn processed
    // reset each player with something in queue to 0

    // mappings from queue index
    mapping(uint256 => bool) public inProcessingQueue; // game queue is in processing queue
    mapping(uint256 => ProcessingPhase) public currentPhase; // processingPhase
    mapping(uint256 => uint256) public game; // mapping from queue ID to its game ID
    mapping(uint256 => uint256[]) public players; // all players with moves to process
    mapping(uint256 => uint256) public totalPlayers; // total # of players who will be submitting
    mapping(uint256 => uint256[]) public randomness; // randomness delivered here at start of each phase processing
    // (deprecated) mapping(uint256 => bool[41]) public randomNeeds; // which slots requested randomness
    // (deprecated) mapping(uint256 => uint256) public totalRandomWords; // how many random words to request from VRF
    mapping(uint256 => bool) public isDayPhase; // if queue is running during day phase
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

    constructor(
        address gameplayAddress,
        address characterCard,
        uint64 _vrfSubscriptionID,
        address _vrfCoordinator,
        bytes32 _vrfKeyHash
    ) RandomnessConsumer(_vrfSubscriptionID, _vrfCoordinator, _vrfKeyHash) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(GAMEPLAY_ROLE, gameplayAddress);
        QUEUE_ID.increment(); // start at 1
        CHARACTER_CARD = CharacterCard(characterCard);
        // s_subscriptionId = _vrfSubscriptionID;
        // s_keyHash = _vrfKeyHash;
        // COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
    }

    function addVerifiedController(address controllerAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, controllerAddress);
    }

    function setGameEvents(address gameEventsAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GAME_EVENTS = GameEvents(gameEventsAddress);
    }

    function cleanQueue() public {
        // TODO: remove 0s from processing queue
    }

    function isInTestMode() public view returns (bool testMode) {
        testMode = testingEnabled;
    }

    function getQueueIDs(uint256 gameID)
        public
        view
        returns (uint256[] memory)
    {
        return queueIDs[gameID];
    }

    function getRandomness(uint256 _queueID)
        public
        view
        returns (uint256[] memory)
    {
        return randomness[_queueID];
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

    function submitActionForPlayer(
        uint256 playerID,
        uint8 action,
        string[] memory options,
        string memory leftHand,
        string memory rightHand,
        uint256 _queueID,
        bool _isDayPhase
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

            playerStatsAtSubmission[_queueID][playerID] = CHARACTER_CARD
                .getStats(game[_queueID], playerID);

            GAME_EVENTS.emitActionSubmit(
                game[_queueID],
                playerID,
                uint256(action)
            );
        }
    }

    // Adds queue to queue, ready for keeper to update on next pass
    function requestProcessActions(uint256 _queueID, bool _isDayPhase)
        public
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        isDayPhase[_queueID] = !_isDayPhase;
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

    function getFailedQueue() public view returns (uint256[] memory) {
        return failedQueue;
    }

    // Gameplay interactions
    function setPhase(ProcessingPhase phase, uint256 _queueID)
        external
        onlyRole(GAMEPLAY_ROLE)
    {
        currentPhase[_queueID] = phase;
        GAME_EVENTS.emitProcessingPhaseChange(game[_queueID], uint256(phase));
        if (phase == ProcessingPhase.Processing) {
            GAME_EVENTS.emitTurnProcessingStart(game[_queueID]);
        }
    }

    function requestNewQueueID(uint256 _queueID)
        external
        onlyRole(GAMEPLAY_ROLE)
    {
        uint256 g = game[_queueID];
        uint256 tp = totalPlayers[_queueID];
        queueID[g] = _requestGameQueue(g, tp);
    }

    function failProcessing(
        uint256 _queueID,
        uint256 _totalPlayers,
        bool _reset
    ) public onlyRole(GAMEPLAY_ROLE) {
        _setProcessingFailed(_queueID, _totalPlayers, _reset);
    }

    function finishProcessing(
        uint256 _queueID,
        bool gameComplete,
        uint256 _totalPlayers
    ) public onlyRole(GAMEPLAY_ROLE) {
        _setProcessingComplete(_queueID, gameComplete, _totalPlayers);
    }

    function _setProcessingComplete(
        uint256 _queueID,
        bool gameComplete,
        uint256 _totalPlayers
    ) internal {
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
            // TODO: set total players to actual value here...
            uint256 newQueueID = _requestGameQueue(g, _totalPlayers);
            queueID[g] = newQueueID;
            currentPhase[newQueueID] = ProcessingPhase.Submission;
        }
    }

    function _setProcessingFailed(
        uint256 _queueID,
        uint256 _totalPlayers,
        bool _reset
    ) internal {
        uint256 g = game[_queueID];
        currentPhase[_queueID] = ProcessingPhase.Failed;
        queueID[g] = 0;
        inProcessingQueue[_queueID] = false;
        for (uint256 i = 0; i < processingQueue.length; i++) {
            if (processingQueue[i] == _queueID) {
                processingQueue[i] = 0;
                break;
            }
        }
        // TODO: how to get new queue ID to allow game to continue playing (rolled back to previous state if already processed player actions)?
        if (_reset) {
            uint256 newQueueID = _requestGameQueue(g, _totalPlayers);
            queueID[g] = newQueueID;
            currentPhase[newQueueID] = ProcessingPhase.Submission;
        }
    }

    // Internal
    function _processAllActions(uint256 _queueID) internal {
        // Can only add unique unprocessed game queues into processing queue

        // If we want to require everything...
        // require(
        //     !inProcessingQueue[_queueID],
        //     "Game already in processing queue"
        // );
        // require(
        //     currentPhase[_queueID] == ProcessingPhase.Submission,
        //     "Game not in submission phase, cannot move to processing phase"
        // );

        if (
            !inProcessingQueue[_queueID] &&
            currentPhase[_queueID] == ProcessingPhase.Submission
        ) {
            processingQueue.push(_queueID);
            inProcessingQueue[_queueID] = true;
            currentPhase[_queueID] = ProcessingPhase.Processing;

            // update idleness
            _updateIdleness(_queueID);

            // request random number for phase
            if (testingEnabled) {
                testRequestRandomWords(_queueID, address(this));
            } else {
                requestRandomWords(_queueID, address(this));
            }
        }
    }

    function _updateIdleness(uint256 _queueID) internal {
        uint256 gameID = game[_queueID];
        for (uint256 i = 1; i < 5; i++) {
            if (playerSubmitted[_queueID][i]) {
                idleTurns[gameID][i] = 0;
            } else {
                idleTurns[gameID][i] += 1;
            }
        }
    }

    function fulfillRandomWords(
        uint256 _requestID,
        uint256[] memory _randomWords
    ) internal override {
        super.fulfillRandomWords(_requestID, _randomWords);
        _setRandomness(_requestID);
    }

    function testFulfillRandomWords(
        uint256 _requestID,
        uint256[] memory _randomWords
    ) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        super.testFulfillRandomWords(_requestID, _randomWords);
        _setRandomness(_requestID);
    }

    function _setRandomness(uint256 requestID) internal {
        uint256 qID = ids[requestID];
        randomness[qID] = randomnessRequests[requestID].randomWords;
    }

    function _requestGameQueue(uint256 gameID, uint256 _totalPlayers)
        internal
        returns (uint256)
    {
        require(queueID[gameID] == 0, "queue already set");
        uint256 newQueueID = QUEUE_ID.current();
        game[newQueueID] = gameID;
        queueID[gameID] = newQueueID;
        queueIDs[gameID].push(newQueueID);
        totalPlayers[newQueueID] = _totalPlayers;
        QUEUE_ID.increment();
        return newQueueID;
    }
}
