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
        bytes32 _vrfKeyHash
    )
        RandomnessConsumer(
            _vrfSubscriptionID,
            _vrfCoordinator,
            _vrfKeyHash
        )
    {
        _setNumWords(2); // we need 2 numbers per request
    }

    function addVerifiedController(
        address vcAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    function setGameEvents(
        address gameEventsAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        GAME_EVENTS = GameEvents(gameEventsAddress);
    }

    function allPlayersRegistered(
        uint256 gameID,
        address boardAddress
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
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
        uint256[] memory _randomness
    ) internal override {
        super.fulfillRandomness(_requestId, _randomness);

        chooseLandingSite(_requestId);
        mintGameTokens(_requestId);
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

        string[] memory relics = ti.RELIC_TOKEN().getTokenTypes();
        ti.RELIC_TOKEN().mintAllTokens(gameID, 1);
        // mint remaining relic mystery tokens
        // need mystery relic for (relics.length - 1), already have 1

        if (relics.length > 2) {
            // 0 relic should be the mystery type relics[0]
            // could hardcode first argument to "Mystery"
            ti.RELIC_TOKEN().mint(relics[0], gameID, relics.length - 2);
        }

        // Items set to always active may be inactive if player has multiples (1 already in active)

        // Transfer day token to board
        ti.DAY_NIGHT_TOKEN().transfer(
            "Day",
            gameID,
            0,
            GAME_BOARD_WALLET_ID,
            1
        );

        // Transfer Relic tokens to playZones
        uint256 landingZoneIndex = zoneIndex(
            addresses[requestID],
            board.initialPlayZone(gameID)
        );
        uint256[] memory relicZoneIDs = new uint256[](relics.length - 1);
        for (uint256 i = 0; i < relicZoneIDs.length; i++) {
            relicZoneIDs[i] = 999999999;
        }

        for (uint256 i = 0; i < relicZoneIDs.length; i++) {
            // set this at random from available spaces
            // derive new random number for each relic
            uint256 r = uint256(
                keccak256(
                    abi.encode(randomnessRequests[requestID].randomWords[0], i)
                )
            );
            uint256 zoneIndexChoice = r % board.getZoneAliases().length;
            bool zoneSet = false;
            while (!zoneSet) {
                if (
                    zoneIndexChoice != landingZoneIndex &&
                    !_numberIsInSet(zoneIndexChoice, relicZoneIDs)
                ) {
                    relicZoneIDs[i] = zoneIndexChoice;
                    zoneSet = true;
                } else {
                    zoneIndexChoice = zoneIndexChoice <
                        board.getZoneAliases().length - 1
                        ? zoneIndexChoice + 1
                        : 0;
                }
            }

            // 0 relic should be the mystery type relics[0]
            // could hardcode first argument to "Mystery"
            ti.RELIC_TOKEN().transferToZone(
                relics[0],
                gameID,
                0,
                relicZoneIDs[i],
                1
            );

            board.enableZone(
                board.getZoneAliases()[relicZoneIDs[i]],
                HexplorationZone.Tile.RelicMystery,
                gameID
            );
        }

        for (uint256 i = 0; i < totalRegistrations; i++) {
            uint256 playerID = i + 1;
            // Transfer campsite tokens to players
            ti.ITEM_TOKEN().transfer("Campsite", gameID, 0, playerID, 1);
        }
    }

    function _numberIsInSet(
        uint256 number,
        uint256[] memory numberSet
    ) internal pure returns (bool inSet) {
        for (uint256 i = 0; i < numberSet.length; i++) {
            if (number == numberSet[i]) {
                inSet = true;
                break;
            }
        }
    }

    // TODO: move into game board
    function zoneIndex(
        address gameBoardAddress,
        string memory zoneAlias
    ) internal view returns (uint256 index) {
        index = 1111111111111;
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        string[] memory allZones = board.getZoneAliases();
        for (uint256 i = 0; i < allZones.length; i++) {
            if (
                keccak256(abi.encodePacked(zoneAlias)) ==
                keccak256(abi.encodePacked(allZones[i]))
            ) {
                index = i;
                break;
            }
        }
    }
}
