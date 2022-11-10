// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

//TODO:
// setup timer keeper for when all players don't submit moves

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./HexplorationStateUpdate.sol";
import "./GameEvents.sol";

contract HexplorationQueue is AccessControlEnumerable, VRFConsumerBaseV2 {
    using Counters for Counters.Counter;
    Counters.Counter internal QUEUE_ID;
    CharacterCard internal CHARACTER_CARD;
    GameEvents internal GAME_EVENTS;

    // VRF
    VRFCoordinatorV2Interface COORDINATOR;
    uint64 s_subscriptionId;
    bytes32 s_keyHash;
    uint32 callbackGasLimit = 100000;
    uint16 requestConfirmations = 3;
    uint32 numWords = 1;

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

    //////////////////////////////////////////////
    // For testing only. Do not use in production
    bool _testMode;
    uint256[] _testRandomness;
    //////////////////////////////////////////////

    // Array of Queue IDs to be processed.
    uint256[] public processingQueue;

    // do we need these 2?
    mapping(uint256 => uint16) public currentQueuePosition; // ?? increases with each player in queue, then back to 0
    mapping(uint256 => uint16) public playThroughPosition; // ?? in case we need to batch this too... hopefully not.

    // mapping from game ID
    mapping(uint256 => uint256) public queueID; // mapping from game ID to it's queue, updates to 0 when finished

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
    mapping(uint256 => uint256[41]) public randomness; // randomness delivered here at start of each phase processing
    mapping(uint256 => bool[41]) public randomNeeds; // which slots requested randomness
    mapping(uint256 => uint256) public totalRandomWords; // how many random words to request from VRF
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

    // From request ID => queue ID
    mapping(uint256 => uint256) internal randomnessRequestQueueID; // ID set before randomness delivered

    constructor(
        address gameplayAddress,
        address characterCard,
        uint64 _vrfSubscriptionID,
        address _vrfCoordinator,
        bytes32 _keyHash
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(GAMEPLAY_ROLE, gameplayAddress);
        QUEUE_ID.increment(); // start at 1
        CHARACTER_CARD = CharacterCard(characterCard);
        s_subscriptionId = _vrfSubscriptionID;
        s_keyHash = _keyHash;
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
    }

    // Can set multiple VCs, one for manual pushing, one for keeper
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

    // Used to check if contract is in testing mode
    function getTestRandomness()
        public
        view
        returns (bool usingTestRandomness, uint256[] memory testRandomness)
    {
        usingTestRandomness = _testMode;
        testRandomness = _testRandomness;
    }

    function isInTestMode() public view returns (bool testMode) {
        testMode = _testMode;
    }

    function getRandomness(uint256 _queueID)
        public
        view
        returns (uint256[41] memory)
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

            // automatically add to queue if last player to submit move
            if (players[_queueID].length >= totalPlayers[_queueID]) {
                // set to opposite of current phase since this check will be done during next phase
                isDayPhase[_queueID] = !_isDayPhase;
                _processAllActions(_queueID);
            }

            GAME_EVENTS.emitActionSubmit(
                game[_queueID],
                playerID,
                uint256(action)
            );
        }
    }

    // Will get processed once keeper is available
    // and previous game queues have been processed
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

    function setRandomNumbers(
        uint256[41] memory randomNumbers,
        uint256 _queueID
    ) external onlyRole(GAMEPLAY_ROLE) {
        randomness[_queueID] = randomNumbers;
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

            // update idleness
            _updateIdleness(_queueID);

            // request random number for phase
            requestRandomWords(_queueID);
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

    function requestRandomWords(uint256 _queueID) internal {
        setRandomNeeds(_queueID);

        uint256 reqID = COORDINATOR.requestRandomWords(
            s_keyHash,
            s_subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            uint32(totalRandomWords[_queueID])
        );

        randomnessRequestQueueID[reqID] = _queueID;

        // testing below, uncomment VRF code above to enable chainlink vrf for production
        // & comment testing code out
        // uint256 reqID = _queueID;
        // randomnessRequestQueueID[reqID] = _queueID;
        // uint256 random = uint256(keccak256(abi.encode(block.timestamp, reqID)));
        // uint256[] memory randomWords = new uint256[](1);
        // randomWords[0] = random;
        // fulfillRandomWords(reqID, randomWords);
    }

    function fulfillRandomWords(uint256 requestID, uint256[] memory randomWords)
        internal
        override
    {
        uint256 qID = randomnessRequestQueueID[requestID];
        if (_testMode) {
            processRandomWords(qID, _testRandomness);
        } else {
            processRandomWords(qID, randomWords);
        }
    }

    function setRandomNeeds(uint256 _queueID) internal {
        // set bools in _randomNeeds for each test
        uint256[] memory _players = players[_queueID];
        bool[41] storage _randomNeeds = randomNeeds[_queueID];
        uint256 numbersNeeded = 1;
        for (uint256 i = 0; i < _players.length; i++) {
            uint256 playerID = _players[i];
            uint256 startingIndex;

            if (submissionAction[_queueID][playerID] == Action.Dig) {
                // is player digging?
                ////        1       2          3        4
                //// set [0,1,2], [3,4,5], [6,7,8], or [9,10,11]
                startingIndex = playerID == 1 ? 0 : playerID == 2
                    ? 3
                    : playerID == 3
                    ? 6
                    : 9;
                _randomNeeds[startingIndex] = true;
                _randomNeeds[startingIndex + 1] = true;
                _randomNeeds[startingIndex + 2] = true;
                numbersNeeded += 3;
            } else if (submissionAction[_queueID][playerID] == Action.Move) {
                // is player moving? // limited to 4 random values for movement (might need more)
                ////        1               2           3                   4
                //// set [25,26,27,28], [29,30,31,32], [33,34,35,36], or [37,38,39,40]
                startingIndex = playerID == 1 ? 25 : playerID == 2
                    ? 29
                    : playerID == 3
                    ? 33
                    : 37;
                _randomNeeds[startingIndex] = true;
                _randomNeeds[startingIndex + 1] = true;
                _randomNeeds[startingIndex + 2] = true;
                _randomNeeds[startingIndex + 3] = true;
                numbersNeeded += 4;
            }

            if (isDayPhase[_queueID]) {
                // is it day time?
                ////        1           2           3               4
                //// set [13,14,15], [16,17,18], [19,20,21], or [22,23,24]
                startingIndex = playerID == 1 ? 13 : playerID == 2
                    ? 16
                    : playerID == 3
                    ? 19
                    : 22;
                _randomNeeds[startingIndex] = true;
                _randomNeeds[startingIndex + 1] = true;
                _randomNeeds[startingIndex + 2] = true;
                numbersNeeded += 3;
            }
        }

        //// set 12 (dig dispute / flag that randomness was delivered)
        _randomNeeds[12] = true;
        totalRandomWords[_queueID] = numbersNeeded;
    }

    function processRandomWords(uint256 _queueID, uint256[] memory randomWords)
        internal
    {
        bool[41] memory _randomNeeds = randomNeeds[_queueID];
        uint256 position = 0;
        for (uint256 i = 0; i < _randomNeeds.length; i++) {
            if (_randomNeeds[i]) {
                randomness[_queueID][i] = randomWords[position];
                position++;
            }
        }
    }

    function _requestGameQueue(uint256 gameID, uint256 _totalPlayers)
        internal
        returns (uint256)
    {
        require(queueID[gameID] == 0, "queue already set");
        uint256 newQueueID = QUEUE_ID.current();
        game[newQueueID] = gameID;
        queueID[gameID] = newQueueID;
        totalPlayers[newQueueID] = _totalPlayers;
        QUEUE_ID.increment();
        return newQueueID;
    }

    // Admin functions
    function setTestRandomness(
        bool useTestRandomness,
        uint256[] memory testRandomness
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _testMode = useTestRandomness;
        _testRandomness = testRandomness;
    }
}
