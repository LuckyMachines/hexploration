// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./HexplorationBoard.sol";
import "./HexplorationQueue.sol";
import "./CharacterCard.sol";
import "./TokenInventory.sol";
import "./GameEvents.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./GameWallets.sol";

contract GameSetup is AccessControlEnumerable, VRFConsumerBaseV2, GameWallets {
    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);

    struct RequestStatus {
        bool fulfilled; // whether the request has been successfully fulfilled
        bool exists; // whether a requestId exists
        uint256[] randomWords;
    }
    // Mappings from request ID
    mapping(uint256 => RequestStatus) public randomnessRequests; /* requestId --> requestStatus */
    mapping(uint256 => uint256) public gameIDs;
    mapping(uint256 => address) public gameBoardAddresses;

    // Mappings from game ID
    mapping(uint256 => uint256) public requestIDs;

    GameEvents GAME_EVENTS;
    VRFCoordinatorV2Interface COORDINATOR;

    uint64 subscriptionId;

    // past requests Id.
    uint256[] public requestIDHistory;
    uint256 public lastRequestId;

    bytes32 keyHash;
    uint32 callbackGasLimit = 2500000;
    uint16 requestConfirmations = 3;
    uint32 numWords = 2;

    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    bool public testingEnabled;

    constructor(
        uint64 _vrfSubscriptionID,
        address _vrfCoordinator,
        bytes32 _vrfKeyHash
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        subscriptionId = _vrfSubscriptionID;
        keyHash = _vrfKeyHash;
    }

    function addVerifiedController(address vcAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    function setGameEvents(address gameEventsAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GAME_EVENTS = GameEvents(gameEventsAddress);
    }

    function setVRFSubscriptionID(uint64 _subscriptionID)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        subscriptionId = _subscriptionID;
    }

    function setTestingEnabled(bool enabled)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        testingEnabled = enabled;
    }

    function allPlayersRegistered(uint256 gameID, address boardAddress)
        public
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        // lock registration
        HexplorationBoard board = HexplorationBoard(boardAddress);
        require(board.gameState(gameID) == 0, "game already started");
        board.lockRegistration(gameID);
        if (testingEnabled) {
            testRequestRandomWords(gameID, boardAddress);
        } else {
            requestRandomWords(gameID, boardAddress);
        }
    }

    function requestRandomWords(uint256 gameID, address boardAddress)
        internal
        returns (uint256 requestId)
    {
        // Will revert if subscription is not set and funded.
        requestId = COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        randomnessRequests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false
        });
        gameIDs[requestId] = gameID;
        gameBoardAddresses[requestId] = boardAddress;
        requestIDs[gameID] = requestId;
        requestIDHistory.push(requestId);
        lastRequestId = requestId;
        emit RequestSent(requestId, numWords);
        return requestId;
    }

    // If testing is enabled, this will get called. It is on the tester to also call testFulfillRandomWords
    function testRequestRandomWords(uint256 gameID, address boardAddress)
        internal
        returns (uint256 requestId)
    {
        requestId = gameID;
        randomnessRequests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false
        });
        gameIDs[requestId] = gameID;
        gameBoardAddresses[requestId] = boardAddress;
        requestIDs[gameID] = requestId;
        requestIDHistory.push(requestId);
        lastRequestId = requestId;
        emit RequestSent(requestId, numWords);
        return requestId;
    }

    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal override {
        require(randomnessRequests[_requestId].exists, "request not found");
        randomnessRequests[_requestId].fulfilled = true;
        randomnessRequests[_requestId].randomWords = _randomWords;
        emit RequestFulfilled(_requestId, _randomWords);

        mintGameTokens(_requestId);
        chooseLandingSite(_requestId);
        startGame(_requestId);
    }

    function testFulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(randomnessRequests[_requestId].exists, "request not found");
        randomnessRequests[_requestId].fulfilled = true;
        randomnessRequests[_requestId].randomWords = _randomWords;
        emit RequestFulfilled(_requestId, _randomWords);

        mintGameTokens(_requestId);
        chooseLandingSite(_requestId);
        startGame(_requestId);
    }

    function getRequestStatus(uint256 _requestId)
        external
        view
        returns (bool fulfilled, uint256[] memory randomWords)
    {
        require(randomnessRequests[_requestId].exists, "request not found");
        RequestStatus memory request = randomnessRequests[_requestId];
        return (request.fulfilled, request.randomWords);
    }

    function chooseLandingSite(uint256 requestID) internal {
        uint256 gameID = gameIDs[requestID];
        address boardAddress = gameBoardAddresses[requestID];
        HexplorationBoard board = HexplorationBoard(boardAddress);

        string[] memory allZones = board.getZoneAliases();
        // should have 2 random values stored, using second value
        string memory zoneChoice = allZones[
            randomnessRequests[requestID].randomWords[1] % allZones.length
        ];

        // PlayerRegistry pr = PlayerRegistry(board.prAddress());

        board.enableZone(zoneChoice, HexplorationZone.Tile.LandingSite, gameID);
        // set landing site at space on board
        board.setInitialPlayZone(zoneChoice, gameID);

        GAME_EVENTS.emitLandingSiteSet(gameID, zoneChoice);
    }

    function startGame(uint256 requestID) internal {
        uint256 gameID = gameIDs[requestID];
        address boardAddress = gameBoardAddresses[requestID];
        HexplorationBoard board = HexplorationBoard(boardAddress);
        require(board.gameState(gameID) == 0, "game already started");

        PlayerRegistry pr = PlayerRegistry(board.prAddress());

        // set game to initialized
        board.setGameState(2, gameID);

        HexplorationQueue q = HexplorationQueue(board.gameplayQueue());

        uint256 qID = q.queueID(gameID);
        if (qID == 0) {
            qID = q.requestGameQueue(
                gameID,
                uint16(pr.totalRegistrations(gameID))
            );
        }

        string memory startZone = board.initialPlayZone(gameID);
        for (uint256 i = 0; i < pr.totalRegistrations(gameID); i++) {
            uint256 playerID = i + 1;
            address playerAddress = pr.playerAddress(gameID, playerID);
            board.enterPlayer(playerAddress, gameID, startZone);
        }

        q.startGame(qID);

        GAME_EVENTS.emitGameStart(gameID);
    }

    function mintGameTokens(uint256 requestID) internal {
        uint256 gameID = gameIDs[requestID];
        HexplorationBoard board = HexplorationBoard(
            gameBoardAddresses[requestID]
        );
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);

        TokenInventory ti = TokenInventory(board.tokenInventory());
        // mint game tokens (maybe mint on demand instead...)
        // minting full game set here
        ti.DAY_NIGHT_TOKEN().mint("Day", gameID, 1);
        ti.DAY_NIGHT_TOKEN().mint("Night", gameID, 1);
        ti.DISASTER_TOKEN().mint("Earthquake", gameID, 1000);
        ti.DISASTER_TOKEN().mint("Volcano", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Pirate", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Pirate Ship", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Deathbot", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Guardian", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Sandworm", gameID, 1000);
        ti.ENEMY_TOKEN().mint("Dragon", gameID, 1000);
        ti.ITEM_TOKEN().mint("Small Ammo", gameID, 1000);
        ti.ITEM_TOKEN().mint("Large Ammo", gameID, 1000);
        ti.ITEM_TOKEN().mint("Batteries", gameID, 1000);
        ti.ITEM_TOKEN().mint("Shield", gameID, 1000);
        ti.ITEM_TOKEN().mint("Portal", gameID, 1000);
        ti.ITEM_TOKEN().mint("On", gameID, 1000);
        ti.ITEM_TOKEN().mint("Off", gameID, 1000);
        ti.ITEM_TOKEN().mint("Rusty Dagger", gameID, 1000);
        ti.ITEM_TOKEN().mint("Rusty Pistol", gameID, 1000);
        ti.ITEM_TOKEN().mint("Shiny Dagger", gameID, 1000);
        ti.ITEM_TOKEN().mint("Shiny Pistol", gameID, 1000);
        ti.ITEM_TOKEN().mint("Laser Dagger", gameID, 1000);
        ti.ITEM_TOKEN().mint("Laser Pistol", gameID, 1000);
        ti.ITEM_TOKEN().mint("Power Glove", gameID, 1000);
        ti.ITEM_TOKEN().mint("Engraved Tablet", gameID, 1000);
        ti.ITEM_TOKEN().mint("Sigil Gem", gameID, 1000);
        ti.ITEM_TOKEN().mint("Ancient Tome", gameID, 1000);
        ti.ITEM_TOKEN().mint("Campsite", gameID, 1000);
        ti.PLAYER_STATUS_TOKEN().mint("Stunned", gameID, 1000);
        ti.PLAYER_STATUS_TOKEN().mint("Burned", gameID, 1000);

        // Duplicate tokens, deprecating these
        /*
        ti.ARTIFACT_TOKEN().mint("Engraved Tablet", gameID, 1000);
        ti.ARTIFACT_TOKEN().mint("Sigil Gem", gameID, 1000);
        ti.ARTIFACT_TOKEN().mint("Ancient Tome", gameID, 1000);
        */
        ti.RELIC_TOKEN().mint("Relic 1", gameID, 1000);
        ti.RELIC_TOKEN().mint("Relic 2", gameID, 1000);
        ti.RELIC_TOKEN().mint("Relic 3", gameID, 1000);
        ti.RELIC_TOKEN().mint("Relic 4", gameID, 1000);
        ti.RELIC_TOKEN().mint("Relic 5", gameID, 1000);

        // Transfer day token to board
        ti.DAY_NIGHT_TOKEN().transfer(
            "Day",
            gameID,
            0,
            GAME_BOARD_WALLET_ID,
            1
        );

        for (uint256 i = 0; i < totalRegistrations; i++) {
            uint256 playerID = i + 1;
            // Transfer campsite tokens to players
            ti.ITEM_TOKEN().transfer("Campsite", gameID, 0, playerID, 1);
        }
    }
}
