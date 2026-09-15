// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IXenovoyaActionController, XenovoyaSessionForwarder} from "../contracts/XenovoyaSessionForwarder.sol";

contract ActionControllerRecorder is IXenovoyaActionController {
    address public lastPlayer;
    uint256 public lastPlayerID;
    uint8 public lastActionIndex;
    uint256 public callCount;
    uint256 public registrationCount;

    function registerForGameFor(address player, uint256 playerGameID, address) external {
        lastPlayer = player;
        lastPlayerID = playerGameID;
        registrationCount += 1;
    }

    function submitActionFor(
        address player,
        uint256 playerID,
        uint8 actionIndex,
        string[] memory,
        string memory,
        string memory,
        uint256,
        address
    ) external {
        lastPlayer = player;
        lastPlayerID = playerID;
        lastActionIndex = actionIndex;
        callCount += 1;
    }
}

contract XenovoyaSessionForwarderHarness is XenovoyaSessionForwarder {
    constructor(address controllerAddress) XenovoyaSessionForwarder(controllerAddress) {}

    function consumeFor(address player, address boardAddress, uint256 gameID) external {
        _consumeActionAuthorization(player, msg.sender, boardAddress, gameID);
    }
}

contract XenovoyaSessionForwarderTest is Test {
    ActionControllerRecorder internal recorder;
    XenovoyaSessionForwarderHarness internal forwarder;
    address internal player = address(0xA11CE);
    address internal sessionKey = address(0xB0B);
    address internal board = address(0xB04D);

    function setUp() public {
        recorder = new ActionControllerRecorder();
        forwarder = new XenovoyaSessionForwarderHarness(address(recorder));
    }

    function testSessionAuthorizationIsScopedExpiringAndLimited() public {
        uint64 expiry = uint64(block.timestamp + 1 days);
        vm.prank(player);
        forwarder.authorizeSessionKey(sessionKey, 42, board, expiry, 2);

        assertTrue(forwarder.isSessionKeyAuthorized(player, sessionKey, 42, board));
        assertFalse(forwarder.isSessionKeyAuthorized(player, sessionKey, 43, board));

        vm.prank(sessionKey);
        forwarder.consumeFor(player, board, 42);
        (, uint32 remainingAfterFirst) = forwarder.sessionAuthorizations(player, sessionKey, board, 42);
        assertEq(remainingAfterFirst, 1);

        vm.prank(sessionKey);
        forwarder.consumeFor(player, board, 42);
        assertFalse(forwarder.isSessionKeyAuthorized(player, sessionKey, 42, board));

        vm.expectRevert("Session action limit reached");
        vm.prank(sessionKey);
        forwarder.consumeFor(player, board, 42);
    }

    function testPlayerCanRevokeSessionImmediately() public {
        vm.startPrank(player);
        forwarder.authorizeSessionKey(sessionKey, 42, board, uint64(block.timestamp + 1 days), 10);
        forwarder.revokeSessionKey(sessionKey, 42, board);
        vm.stopPrank();
        assertFalse(forwarder.isSessionKeyAuthorized(player, sessionKey, 42, board));
    }

    function testSessionLimitsAreBounded() public {
        vm.expectRevert("Invalid session action limit");
        vm.prank(player);
        forwarder.authorizeSessionKey(sessionKey, 42, board, uint64(block.timestamp + 1 days), 101);

        vm.expectRevert("Invalid session expiry");
        vm.prank(player);
        forwarder.authorizeSessionKey(sessionKey, 42, board, uint64(block.timestamp + 8 days), 10);
    }

    function testSessionKeyCanSubmitWithoutTheOwnerSigningAgain() public {
        vm.prank(player);
        forwarder.authorizeSessionKey(sessionKey, 42, board, uint64(block.timestamp + 1 days), 2);
        string[] memory route = new string[](1);
        route[0] = "2,3";

        vm.prank(sessionKey);
        forwarder.submitAction(player, 7, 1, route, "", "", 42, board);

        assertEq(recorder.lastPlayer(), player);
        assertEq(recorder.lastPlayerID(), 7);
        assertEq(recorder.lastActionIndex(), 1);
    }

    function testRelayerCanSponsorTypedSessionActionAndReplayFails() public {
        uint256 privateKey = 0xB0B;
        address signer = vm.addr(privateKey);
        vm.prank(player);
        forwarder.authorizeSessionKey(signer, 42, board, uint64(block.timestamp + 1 days), 2);

        string[] memory route = new string[](1);
        route[0] = "2,3";
        uint256 deadline = block.timestamp + 10 minutes;
        bytes32 digest = forwarder.actionAuthorizationDigest(player, 7, 1, route, "", "", 42, board, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        XenovoyaSessionForwarder.RelayedAction memory action = XenovoyaSessionForwarder.RelayedAction({
            player: player,
            playerID: 7,
            actionIndex: 1,
            options: route,
            leftHand: "",
            rightHand: "",
            gameID: 42,
            boardAddress: board,
            nonce: 0,
            deadline: deadline,
            signature: signature
        });

        vm.prank(address(0xCAFE));
        forwarder.submitActionWithSignature(action);
        assertEq(recorder.callCount(), 1);
        assertEq(forwarder.actionNonces(signer), 1);

        vm.expectRevert("Invalid action nonce");
        vm.prank(address(0xCAFE));
        forwarder.submitActionWithSignature(action);
    }

    function testRelayerCanBatchActionsFromDifferentCustodiedPlayers() public {
        uint256 firstKey = 0xA11CE;
        uint256 secondKey = 0xB0B;
        address firstPlayer = vm.addr(firstKey);
        address secondPlayer = vm.addr(secondKey);
        string[] memory route = new string[](1);
        route[0] = "2,3";
        uint256 deadline = block.timestamp + 10 minutes;

        XenovoyaSessionForwarder.RelayedAction[] memory actions = new XenovoyaSessionForwarder.RelayedAction[](2);
        uint256[2] memory keys = [firstKey, secondKey];
        address[2] memory players = [firstPlayer, secondPlayer];
        for (uint256 i = 0; i < 2; i++) {
            bytes32 digest = forwarder.actionAuthorizationDigest(players[i], i + 1, 1, route, "", "", 42, board, 0, deadline);
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(keys[i], digest);
            actions[i] = XenovoyaSessionForwarder.RelayedAction({
                player: players[i],
                playerID: i + 1,
                actionIndex: 1,
                options: route,
                leftHand: "",
                rightHand: "",
                gameID: 42,
                boardAddress: board,
                nonce: 0,
                deadline: deadline,
                signature: abi.encodePacked(r, s, v)
            });
        }

        forwarder.submitActionsWithSignatures(actions);
        assertEq(recorder.callCount(), 2);
        assertEq(forwarder.actionNonces(firstPlayer), 1);
        assertEq(forwarder.actionNonces(secondPlayer), 1);
    }

    function testActionAuthorizationUsesTypedDataAndRecoversSigner() public view {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        string[] memory route = new string[](2);
        route[0] = "2,3";
        route[1] = "3,3";
        bytes32 digest = forwarder.actionAuthorizationDigest(
            signer, 1, 1, route, "", "", 42, board, 0, block.timestamp + 10 minutes
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        assertEq(ECDSA.recover(digest, abi.encodePacked(r, s, v)), signer);
    }

    function testRelayerCanRegisterCustodiedPlayerAndReplayFails() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        uint256 deadline = block.timestamp + 10 minutes;
        bytes32 digest = forwarder.registrationAuthorizationDigest(signer, 42, board, 0, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        XenovoyaSessionForwarder.RelayedRegistration memory registration = XenovoyaSessionForwarder.RelayedRegistration({
            player: signer,
            gameID: 42,
            boardAddress: board,
            nonce: 0,
            deadline: deadline,
            signature: abi.encodePacked(r, s, v)
        });

        vm.prank(address(0xCAFE));
        forwarder.registerForGameWithSignature(registration);
        assertEq(recorder.lastPlayer(), signer);
        assertEq(recorder.registrationCount(), 1);
        assertEq(forwarder.registrationNonces(signer), 1);

        vm.expectRevert("Invalid registration nonce");
        forwarder.registerForGameWithSignature(registration);
    }
}
