// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract GameEvents is AccessControlEnumerable {
    bytes32 public constant EVENT_SENDER_ROLE = keccak256("EVENT_SENDER_ROLE");

    event ActionSubmit(
        uint256 indexed gameID,
        uint256 playerID,
        uint256 actionID,
        uint256 timeStamp
    );
    event EndGameStarted(
        uint256 indexed gameID,
        uint256 timeStamp,
        string scenario
    );
    event GameOver(uint256 indexed gameID, uint256 timeStamp);
    event GamePhaseChange(
        uint256 indexed gameID,
        uint256 timeStamp,
        string newPhase
    );
    event GameRegistration(
        uint256 indexed gameID,
        address playerAddress,
        uint256 playerID
    );
    event GameStart(uint256 indexed gameID, uint256 timeStamp);
    event LandingSiteSet(uint256 indexed gameID, string landingSite);
    event PlayerIdleKick(
        uint256 indexed gameID,
        uint256 playerID,
        uint256 timeStamp
    );
    event ProcessingPhaseChange(
        uint256 indexed gameID,
        uint256 timeStamp,
        uint256 newPhase
    );
    event TurnProcessingFail(
        uint256 indexed gameID,
        uint256 queueID,
        uint256 timeStamp
    );
    event TurnProcessingStart(uint256 indexed gameID, uint256 timeStamp);

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    // Event emitters
    function emitActionSubmit(
        uint256 gameID,
        uint256 playerID,
        uint256 actionID
    ) external onlyRole(EVENT_SENDER_ROLE) {
        emit ActionSubmit(gameID, playerID, actionID, block.timestamp);
    }

    function emitEndGameStarted(uint256 gameID, string memory scenario)
        external
        onlyRole(EVENT_SENDER_ROLE)
    {
        emit EndGameStarted(gameID, block.timestamp, scenario);
    }

    function emitGameOver(uint256 gameID) external onlyRole(EVENT_SENDER_ROLE) {
        emit GameOver(gameID, block.timestamp);
    }

    function emitGamePhaseChange(uint256 gameID, string memory newPhase)
        external
        onlyRole(EVENT_SENDER_ROLE)
    {
        emit GamePhaseChange(gameID, block.timestamp, newPhase);
    }

    function emitGameRegistration(
        uint256 gameID,
        address playerAddress,
        uint256 playerID
    ) external onlyRole(EVENT_SENDER_ROLE) {
        emit GameRegistration(gameID, playerAddress, playerID);
    }

    function emitGameStart(uint256 gameID)
        external
        onlyRole(EVENT_SENDER_ROLE)
    {
        emit GameStart(gameID, block.timestamp);
    }

    function emitLandingSiteSet(uint256 gameID, string memory _landingSite)
        external
        onlyRole(EVENT_SENDER_ROLE)
    {
        emit LandingSiteSet(gameID, _landingSite);
    }

    function emitPlayerIdleKick(uint256 gameID, uint256 playerID)
        external
        onlyRole(EVENT_SENDER_ROLE)
    {
        emit PlayerIdleKick(gameID, playerID, block.timestamp);
    }

    function emitProcessingPhaseChange(uint256 gameID, uint256 newPhase)
        external
        onlyRole(EVENT_SENDER_ROLE)
    {
        emit ProcessingPhaseChange(gameID, block.timestamp, newPhase);
    }

    function emitTurnProcessingFail(uint256 gameID, uint256 queueID)
        external
        onlyRole(EVENT_SENDER_ROLE)
    {
        emit TurnProcessingFail(gameID, queueID, block.timestamp);
    }

    function emitTurnProcessingStart(uint256 gameID)
        external
        onlyRole(EVENT_SENDER_ROLE)
    {
        emit TurnProcessingStart(gameID, block.timestamp);
    }

    function addEventSender(address eventSenderAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(EVENT_SENDER_ROLE, eventSenderAddress);
    }
}
