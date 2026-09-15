// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

interface IXenovoyaActionController {
    function registerForGameFor(address player, uint256 gameID, address boardAddress) external;

    function submitActionFor(
        address player,
        uint256 playerID,
        uint8 actionIndex,
        string[] memory options,
        string memory leftHand,
        string memory rightHand,
        uint256 gameID,
        address boardAddress
    ) external;
}

contract XenovoyaSessionForwarder is EIP712 {
    using ECDSA for bytes32;

    struct SessionAuthorization {
        uint64 expiresAt;
        uint32 remainingActions;
    }

    struct RelayedAction {
        address player;
        uint256 playerID;
        uint8 actionIndex;
        string[] options;
        string leftHand;
        string rightHand;
        uint256 gameID;
        address boardAddress;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    struct RelayedRegistration {
        address player;
        uint256 gameID;
        address boardAddress;
        uint256 nonce;
        uint256 deadline;
        bytes signature;
    }

    uint256 public constant MAX_SESSION_DURATION = 7 days;
    uint32 public constant MAX_SESSION_ACTIONS = 100;
    uint256 public constant MAX_RELAYED_ACTIONS = 8;
    bytes32 public constant ACTION_AUTHORIZATION_TYPEHASH = keccak256(
        "ActionAuthorization(address player,uint256 playerID,uint8 actionIndex,bytes32 optionsHash,bytes32 leftHandHash,bytes32 rightHandHash,uint256 gameID,address boardAddress,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant REGISTRATION_AUTHORIZATION_TYPEHASH = keccak256(
        "RegistrationAuthorization(address player,uint256 gameID,address boardAddress,uint256 nonce,uint256 deadline)"
    );

    IXenovoyaActionController public immutable CONTROLLER;
    mapping(address player => mapping(address sessionKey => mapping(address board => mapping(uint256 gameID => SessionAuthorization))))
        public sessionAuthorizations;
    mapping(address signer => uint256 nonce) public actionNonces;
    mapping(address player => uint256 nonce) public registrationNonces;

    event SessionKeyAuthorized(
        address indexed player,
        address indexed sessionKey,
        address indexed boardAddress,
        uint256 gameID,
        uint64 expiresAt,
        uint32 actionLimit
    );
    event SessionKeyRevoked(address indexed player, address indexed sessionKey, address indexed boardAddress, uint256 gameID);
    event SessionActionUsed(address indexed player, address indexed sessionKey, uint256 indexed gameID, uint32 remainingActions);
    event RelayedActionSubmitted(address indexed player, uint256 indexed gameID, uint256 nonce);
    event RelayedRegistrationSubmitted(address indexed player, uint256 indexed gameID, uint256 nonce);

    constructor(address controllerAddress) EIP712("Xenovoya", "1") {
        require(controllerAddress != address(0), "Invalid controller");
        CONTROLLER = IXenovoyaActionController(controllerAddress);
    }

    function authorizeSessionKey(
        address sessionKey,
        uint256 gameID,
        address boardAddress,
        uint64 expiresAt,
        uint32 actionLimit
    ) external {
        address player = msg.sender;
        require(sessionKey != address(0) && sessionKey != player, "Invalid session key");
        // Session expiry intentionally follows chain time.
        // forge-lint: disable-next-line(block-timestamp)
        require(expiresAt > block.timestamp && expiresAt <= block.timestamp + MAX_SESSION_DURATION, "Invalid session expiry");
        require(actionLimit > 0 && actionLimit <= MAX_SESSION_ACTIONS, "Invalid session action limit");
        sessionAuthorizations[player][sessionKey][boardAddress][gameID] = SessionAuthorization(expiresAt, actionLimit);
        emit SessionKeyAuthorized(player, sessionKey, boardAddress, gameID, expiresAt, actionLimit);
    }

    function revokeSessionKey(address sessionKey, uint256 gameID, address boardAddress) external {
        delete sessionAuthorizations[msg.sender][sessionKey][boardAddress][gameID];
        emit SessionKeyRevoked(msg.sender, sessionKey, boardAddress, gameID);
    }

    function isSessionKeyAuthorized(address player, address sessionKey, uint256 gameID, address boardAddress)
        public
        view
        returns (bool)
    {
        SessionAuthorization memory authorization = sessionAuthorizations[player][sessionKey][boardAddress][gameID];
        // forge-lint: disable-next-line(block-timestamp)
        return authorization.remainingActions > 0 && authorization.expiresAt >= block.timestamp;
    }

    function submitAction(
        address player,
        uint256 playerID,
        uint8 actionIndex,
        string[] calldata options,
        string calldata leftHand,
        string calldata rightHand,
        uint256 gameID,
        address boardAddress
    ) external {
        _consumeActionAuthorization(player, msg.sender, boardAddress, gameID);
        CONTROLLER.submitActionFor(player, playerID, actionIndex, options, leftHand, rightHand, gameID, boardAddress);
    }

    function actionAuthorizationDigest(
        address player,
        uint256 playerID,
        uint8 actionIndex,
        string[] calldata options,
        string calldata leftHand,
        string calldata rightHand,
        uint256 gameID,
        address boardAddress,
        uint256 nonce,
        uint256 deadline
    ) external view returns (bytes32) {
        return _actionAuthorizationDigest(
            player, playerID, actionIndex, options, leftHand, rightHand, gameID, boardAddress, nonce, deadline
        );
    }

    function submitActionWithSignature(RelayedAction calldata action) external {
        _submitSignedAction(action);
    }

    function registrationAuthorizationDigest(
        address player,
        uint256 gameID,
        address boardAddress,
        uint256 nonce,
        uint256 deadline
    ) external view returns (bytes32) {
        return _registrationAuthorizationDigest(player, gameID, boardAddress, nonce, deadline);
    }

    function registerForGameWithSignature(RelayedRegistration calldata registration) external {
        // Signature deadline intentionally follows chain time.
        // forge-lint: disable-next-line(block-timestamp)
        require(block.timestamp <= registration.deadline, "Registration authorization expired");
        address signer = _registrationAuthorizationDigest(
            registration.player,
            registration.gameID,
            registration.boardAddress,
            registration.nonce,
            registration.deadline
        ).recover(registration.signature);
        require(signer == registration.player && signer != address(0), "Invalid registration signer");
        require(registrationNonces[signer] == registration.nonce, "Invalid registration nonce");
        unchecked {
            registrationNonces[signer] = registration.nonce + 1;
        }
        CONTROLLER.registerForGameFor(signer, registration.gameID, registration.boardAddress);
        emit RelayedRegistrationSubmitted(signer, registration.gameID, registration.nonce);
    }

    function submitActionsWithSignatures(RelayedAction[] calldata actions) external {
        require(actions.length > 0 && actions.length <= MAX_RELAYED_ACTIONS, "Invalid relay batch");
        for (uint256 i = 0; i < actions.length;) {
            _submitSignedAction(actions[i]);
            unchecked {
                ++i;
            }
        }
    }

    function _submitSignedAction(RelayedAction calldata action) internal {
        // Signature deadline intentionally follows chain time.
        // forge-lint: disable-next-line(block-timestamp)
        require(block.timestamp <= action.deadline, "Action authorization expired");
        address signer = _actionAuthorizationDigest(
            action.player,
            action.playerID,
            action.actionIndex,
            action.options,
            action.leftHand,
            action.rightHand,
            action.gameID,
            action.boardAddress,
            action.nonce,
            action.deadline
        ).recover(action.signature);
        require(actionNonces[signer] == action.nonce, "Invalid action nonce");
        unchecked {
            actionNonces[signer] = action.nonce + 1;
        }
        _consumeActionAuthorization(action.player, signer, action.boardAddress, action.gameID);
        CONTROLLER.submitActionFor(
            action.player,
            action.playerID,
            action.actionIndex,
            action.options,
            action.leftHand,
            action.rightHand,
            action.gameID,
            action.boardAddress
        );
        emit RelayedActionSubmitted(action.player, action.gameID, action.nonce);
    }

    function _actionAuthorizationDigest(
        address player,
        uint256 playerID,
        uint8 actionIndex,
        string[] calldata options,
        string calldata leftHand,
        string calldata rightHand,
        uint256 gameID,
        address boardAddress,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            ACTION_AUTHORIZATION_TYPEHASH,
            player,
            playerID,
            actionIndex,
            keccak256(abi.encode(options)),
            keccak256(bytes(leftHand)),
            keccak256(bytes(rightHand)),
            gameID,
            boardAddress,
            nonce,
            deadline
        )));
    }

    function _registrationAuthorizationDigest(
        address player,
        uint256 gameID,
        address boardAddress,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            REGISTRATION_AUTHORIZATION_TYPEHASH,
            player,
            gameID,
            boardAddress,
            nonce,
            deadline
        )));
    }

    function _consumeActionAuthorization(address player, address signer, address boardAddress, uint256 gameID) internal {
        require(player != address(0), "Player is not registered");
        if (signer == player) return;
        SessionAuthorization storage authorization = sessionAuthorizations[player][signer][boardAddress][gameID];
        // forge-lint: disable-next-line(block-timestamp)
        require(authorization.expiresAt >= block.timestamp, "Session key expired");
        require(authorization.remainingActions > 0, "Session action limit reached");
        authorization.remainingActions -= 1;
        emit SessionActionUsed(player, signer, gameID, authorization.remainingActions);
    }
}
