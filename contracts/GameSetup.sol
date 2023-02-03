// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./HexplorationBoard.sol";
import "./HexplorationQueue.sol";
import "./CharacterCard.sol";
import "./TokenInventory.sol";
import "./GameEvents.sol";
import "./GameWallets.sol";
import "./RandomnessConsumer.sol";

contract GameSetup is RandomnessConsumer, GameWallets {
    GameEvents GAME_EVENTS;

    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    constructor(
        uint64 _vrfSubscriptionID,
        address _vrfCoordinator,
        bytes32 _vrfKeyHash,
        address _bandProvider,
        address _stringToUint
    )
        RandomnessConsumer(
            _vrfSubscriptionID,
            _vrfCoordinator,
            _vrfKeyHash,
            _bandProvider,
            _stringToUint
        )
    {
        _setNumWords(2); // we need 2 numbers per request
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
            requestRandomness(gameID, boardAddress);
        }
    }

    function fulfillRandomness(
        uint256 _requestId,
        uint256[] memory _randomness,
        string memory _seed,
        uint64 _time
    ) internal override {
        super.fulfillRandomness(_requestId, _randomness, _seed, _time);

        mintGameTokens(_requestId);
        chooseLandingSite(_requestId);
        startGame(_requestId);
    }

    function testFulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) public override onlyRole(DEFAULT_ADMIN_ROLE) {
        super.testFulfillRandomWords(_requestId, _randomWords);

        mintGameTokens(_requestId);
        chooseLandingSite(_requestId);
        startGame(_requestId);
    }

    function chooseLandingSite(uint256 requestID) internal {
        uint256 gameID = ids[requestID];
        address boardAddress = addresses[requestID];
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
        uint256 gameID = ids[requestID];
        address boardAddress = addresses[requestID];
        HexplorationBoard board = HexplorationBoard(boardAddress);
        require(board.gameState(gameID) == 0, "game already started");

        PlayerRegistry pr = PlayerRegistry(board.prAddress());

        // set game to initialized
        board.setGameState(2, gameID);

        HexplorationQueue q = HexplorationQueue(payable(board.gameplayQueue()));

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
        uint256 gameID = ids[requestID];
        HexplorationBoard board = HexplorationBoard(addresses[requestID]);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);

        TokenInventory ti = TokenInventory(board.tokenInventory());
        // mint game tokens (maybe mint on demand instead...)
        // minting full game set here
        ti.DAY_NIGHT_TOKEN().mintAllTokens(
            gameID,
            1,
            GameToken.TokenState.Setting1
        );
        ti.DISASTER_TOKEN().mintAllTokens(gameID, 1000);
        ti.ENEMY_TOKEN().mintAllTokens(gameID, 1000);
        ti.ITEM_TOKEN().mintAllTokens(gameID, 1000);
        ti.PLAYER_STATUS_TOKEN().mintAllTokens(gameID, 1000);
        ti.RELIC_TOKEN().mintAllTokens(gameID, 1000);

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
