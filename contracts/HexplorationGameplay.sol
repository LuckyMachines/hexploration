// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

import "./HexplorationQueue.sol";
import "./HexplorationStateUpdate.sol";
import "./HexplorationBoard.sol";
import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";
import "./RollDraw.sol";
import "./HexplorationGameplayUpdates.sol";
import "./HexplorationDisputeResolver.sol";
import "./GameWallets.sol";
import "./CharacterCard.sol";
import "@luckymachines/autoloop/src/AutoLoopCompatible.sol";
import "@luckymachines/autoloop/src/AutoLoopVRFCompatible.sol";
import "./TokenInventory.sol";

contract HexplorationGameplay is
    AccessControlEnumerable,
    AutomationCompatibleInterface,
    GameWallets,
    RandomIndices,
    AutoLoopVRFCompatible
{
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    HexplorationQueue QUEUE;
    HexplorationStateUpdate GAME_STATE;
    HexplorationBoard GAME_BOARD;
    RollDraw ROLL_DRAW;
    HexplorationDisputeResolver DISPUTE_RESOLVER;
    uint256 constant LEFT_HAND = 0;
    uint256 constant RIGHT_HAND = 1;

    // AutoLoop VRF mode: when true, VRF proof is verified in progressLoop
    // and randomness is written to Queue in the same transaction
    bool public useAutoLoopVRF;

    // Mapping from QueueID to updates needed to run
    //mapping(uint256 => bool) public readyForKeeper;
    mapping(uint256 => bool) public updatesComplete;

    struct DataSummary {
        uint256 playerPositionUpdates;
        uint256 playerEquips;
        uint256 zoneTransfers;
        uint256 activeActions;
        uint256 playerTransfers;
        uint256 playerStatUpdates;
    }

    struct PlayUpdates {
        uint256[] playerPositionIDs;
        uint256[] spacesToMove;
        uint256[] playerEquipIDs;
        uint256[] playerEquipHands; // 0:left, 1:right
        uint256[] playerHandLossIDs;
        uint256[] playerHandLosses; // 0:left, 1:right
        uint256[] zoneTransfersTo;
        uint256[] zoneTransfersFrom;
        uint256[] zoneTransferQtys;
        uint256[] playerTransfersTo;
        uint256[] playerTransfersFrom;
        uint256[] playerTransferQtys;
        uint256[] playerStatUpdateIDs;
        int8[3][] playerStatUpdates; // amount to adjust, not final value
        uint256[] playerActiveActionIDs;
        string gamePhase;
        string[7][] playerMovementOptions; // TODO: set this to max # of spaces possible
        string[] playerEquips;
        string[] zoneTransferItemTypes;
        string[] playerTransferItemTypes;
        string[] activeActions;
        string[][] activeActionOptions;
        uint256[] activeActionResults; // 0 = None, 1 = Event, 2 = Ambush, 3 = Treasure
        string[2][] activeActionResultCard; // Card for Event / ambush / treasure , outcome e.g. ["Dance with locals", "You're amazing!"]
        string[3][] activeActionInventoryChanges; // [item loss, item gain, hand loss]
        uint256[] randomness;
        bool setupEndgame;
    }

    constructor(
        address gameBoardAddress,
        address _rollDrawAddress,
        address disputeResolverAddress
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        GAME_BOARD = HexplorationBoard(gameBoardAddress);
        ROLL_DRAW = RollDraw(_rollDrawAddress);
        DISPUTE_RESOLVER = HexplorationDisputeResolver(disputeResolverAddress);
    }

    function addVerifiedController(
        address vcAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    function setQueue(
        address queueContract
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        QUEUE = HexplorationQueue(payable(queueContract));
        _grantRole(VERIFIED_CONTROLLER_ROLE, queueContract);
    }

    function setGameStateUpdate(
        address gsuAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        GAME_STATE = HexplorationStateUpdate(gsuAddress);
    }

    function setUseAutoLoopVRF(
        bool enabled
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        useAutoLoopVRF = enabled;
    }

    // AutoLoop
    // forwarding keeper functions for compatibility
    function shouldProgressLoop()
        external
        view
        override
        returns (bool loopIsReady, bytes memory progressWithData)
    {
        if (useAutoLoopVRF) {
            // In VRF mode, don't wait for randomness — it comes with the VRF proof
            (loopIsReady, progressWithData) = _checkUpkeepVRF();
        } else {
            (loopIsReady, progressWithData) = this.checkUpkeep(new bytes(0));
        }
    }

    function progressLoop(bytes calldata progressWithData) external override {
        if (useAutoLoopVRF) {
            // Verify VRF proof, extract randomness, write to Queue
            (bytes32 vrfRandomness, bytes memory innerPerformData) =
                _verifyAndExtractRandomness(progressWithData, tx.origin);

            // Expand bytes32 randomness into uint256[] for Queue
            uint256[] memory randomWords = new uint256[](1);
            randomWords[0] = uint256(vrfRandomness);

            // Decode queueID from innerPerformData to write randomness
            (uint256 queueID, , , , , , , ) = abi.decode(
                innerPerformData,
                (uint256, uint256, uint256, uint256, uint256, uint256, uint256, uint256)
            );
            QUEUE.setRandomnessFromGameplay(queueID, randomWords);

            // External call to self converts bytes memory → calldata
            // solhint-disable-next-line avoid-low-level-calls
            (bool success, ) = address(this).call(
                abi.encodeWithSignature("performUpkeep(bytes)", innerPerformData)
            );
            require(success, "performUpkeep failed after VRF");
        } else {
            performUpkeep(progressWithData);
        }
    }

    // Keeper functions
    function getSummaryForUpkeep(
        bytes calldata performData
    )
        external
        pure
        returns (
            DataSummary memory summary,
            uint256 queueID,
            uint256 processingPhase
        )
    {
        (
            queueID,
            processingPhase,
            summary.playerPositionUpdates,
            summary.playerStatUpdates,
            summary.playerEquips,
            summary.zoneTransfers,
            summary.playerTransfers,
            summary.activeActions
        ) = abi.decode(
            performData,
            (
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256
            )
        );
    }

    function performUpkeep(bytes calldata performData) public override {
        // TODO: restrict to registry or admin
        DataSummary memory summary;
        uint256 queueID;
        uint256 processingPhase;
        (
            queueID,
            processingPhase,
            summary.playerPositionUpdates,
            summary.playerStatUpdates,
            summary.playerEquips,
            summary.zoneTransfers,
            summary.playerTransfers,
            summary.activeActions
        ) = abi.decode(
            performData,
            (
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256,
                uint256
            )
        );
        require(
            QUEUE.getRandomness(queueID).length > 0,
            "Randomness not delivered"
        );

        uint256[] memory players = QUEUE.getAllPlayers(queueID);
        for (uint256 i = 0; i < players.length; i++) {
            uint256 playerID = players[i];
            // ISSUE: isDayPhase is not yet set on queue... not set until next processing phase
            // SOLUTION: check something else to see if day phase here
            /*
            HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        TokenInventory tokens = TokenInventory(board.tokenInventory());

        uint256 dayBalance = tokens.DAY_NIGHT_TOKEN().balance(
            "Day",
            gameID,
            GAME_BOARD_WALLET_ID
        );
        phase = dayBalance > 0 ? "Day" : "Night";
            */
            bool isDay = TokenInventory(GAME_BOARD.tokenInventory())
                .DAY_NIGHT_TOKEN()
                .balance("Day", QUEUE.game(queueID), GAME_BOARD_WALLET_ID) > 0;
            ROLL_DRAW.setRandomnessForPlayer(playerID, queueID, isDay);
        }

        if (processingPhase == 2) {
            (bool success, ) = address(this).call(
                abi.encodeWithSignature(
                    "processPlayerActions(uint256,(uint256,uint256,uint256,uint256,uint256,uint256))",
                    queueID,
                    summary
                )
            );
            if (!success) {
                // Can reset queue since nothing has been processed this turn
                QUEUE.failProcessing(queueID, activePlayers(queueID), true);
            }
        } else if (processingPhase == 3) {
            (bool success, ) = address(this).call(
                abi.encodeWithSignature("processPlayThrough(uint256)", queueID)
            );
            if (!success) {
                // TODO: don't fail yet, save to allow re-try
                // Cannot reset queue since player actions already processed
                QUEUE.failProcessing(queueID, activePlayers(queueID), false);
            }
        }
    }

    /**
     * @dev VRF-mode check: same as checkUpkeep but skips the randomness-delivered check
     *      since randomness will come with the VRF proof in progressLoop.
     */
    function _checkUpkeepVRF()
        internal
        view
        returns (bool upkeepNeeded, bytes memory performData)
    {
        upkeepNeeded = false;
        uint256 queueIDToUpdate = 0;
        uint256[] memory pq = QUEUE.getProcessingQueue();
        for (uint256 i = 0; i < pq.length; i++) {
            if (pq[i] != 0) {
                queueIDToUpdate = pq[i];
                upkeepNeeded = true;
                break;
            }
        }

        // Skip randomness check — VRF proof will provide it

        HexplorationQueue.ProcessingPhase phase = QUEUE.currentPhase(
            queueIDToUpdate
        );
        if (phase == HexplorationQueue.ProcessingPhase.Processing) {
            performData = getUpdateInfo(queueIDToUpdate, 2);
        } else if (phase == HexplorationQueue.ProcessingPhase.PlayThrough) {
            performData = getUpdateInfo(queueIDToUpdate, 3);
        } else {
            performData = getUpdateInfo(queueIDToUpdate, 4);
        }
    }

    function checkUpkeep(
        bytes calldata /*checkData*/
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        // check for list of queues that need updates...
        upkeepNeeded = false;
        uint256 queueIDToUpdate = 0;
        uint256[] memory pq = QUEUE.getProcessingQueue();
        for (uint256 i = 0; i < pq.length; i++) {
            if (pq[i] != 0) {
                queueIDToUpdate = pq[i];
                upkeepNeeded = true;
                break;
            }
        }
        // Checks for randomness returned.
        if (QUEUE.getRandomness(queueIDToUpdate).length == 0) {
            upkeepNeeded = false;
        }

        HexplorationQueue.ProcessingPhase phase = QUEUE.currentPhase(
            queueIDToUpdate
        );
        // 2 = processing, 3 = play through, 4 = processed
        if (phase == HexplorationQueue.ProcessingPhase.Processing) {
            performData = getUpdateInfo(queueIDToUpdate, 2);
        } else if (phase == HexplorationQueue.ProcessingPhase.PlayThrough) {
            performData = getUpdateInfo(queueIDToUpdate, 3);
        } else {
            performData = getUpdateInfo(queueIDToUpdate, 4);
        }
    }

    function getUpdateInfo(
        uint256 queueID,
        uint256 processingPhase
    ) public view returns (bytes memory) {
        DataSummary memory data = DataSummary(0, 0, 0, 0, 0, 0);
        uint256[] memory playersInQueue = QUEUE.getAllPlayers(queueID);
        for (uint256 i = 0; i < playersInQueue.length; i++) {
            uint256 playerID = playersInQueue[i];
            HexplorationQueue.Action action = QUEUE.submissionAction(
                queueID,
                playerID
            );
            if (action == HexplorationQueue.Action.Move) {
                data.playerPositionUpdates += 1;
            }
            if (bytes(QUEUE.submissionLeftHand(queueID, playerID)).length > 0) {
                data.playerEquips += 1;
            }
            if (
                bytes(QUEUE.submissionRightHand(queueID, playerID)).length > 0
            ) {
                data.playerEquips += 1;
            }
            if (
                action == HexplorationQueue.Action.SetupCamp ||
                action == HexplorationQueue.Action.BreakDownCamp
            ) {
                data.zoneTransfers += 1;
            }

            if (action == HexplorationQueue.Action.Dig) {
                data.playerTransfers += 1;
            }

            if (
                action == HexplorationQueue.Action.Dig ||
                action == HexplorationQueue.Action.Rest ||
                action == HexplorationQueue.Action.Help ||
                action == HexplorationQueue.Action.SetupCamp ||
                action == HexplorationQueue.Action.BreakDownCamp ||
                action == HexplorationQueue.Action.Move
            ) {
                data.activeActions += 1;
            }

            if (
                action == HexplorationQueue.Action.Dig ||
                action == HexplorationQueue.Action.Rest
            ) {
                data.playerStatUpdates += 1;
            }

            if (action == HexplorationQueue.Action.Help) {
                data.playerStatUpdates += 2;
            }
        }
        return (
            abi.encode(
                queueID,
                processingPhase,
                data.playerPositionUpdates,
                data.playerStatUpdates,
                data.playerEquips,
                data.zoneTransfers,
                data.playerTransfers,
                data.activeActions
            )
        );
    }

    function processPlayerActions(
        uint256 queueID,
        DataSummary memory summary
    ) public {
        require(_msgSender() == address(this), "internal function");
        processPlayerActionsUnsafe(queueID, summary);
    }

    function processPlayThrough(uint256 queueID) public {
        // TODO: rename this. It's currently only used for processing day phase events.
        require(_msgSender() == address(this), "internal function");
        processPlayThroughUnsafe(queueID);
    }

    function processFailedPlayThroughQueue(uint256 queueID) public {
        // retry processing failed queue, set game queue new and continue play
        // reset queue phase to play through then
        QUEUE.setPhase(HexplorationQueue.ProcessingPhase.PlayThrough, queueID);
        processPlayThroughUnsafe(queueID);
    }

    // functions to simulate upkeep
    function processPlayerActionsUnsafe(
        uint256 queueID,
        DataSummary memory summary
    ) public {
        uint256 gameID = QUEUE.game(queueID);
        // TODO: save update struct with all the actions from queue (what was originally the ints array)
        PlayUpdates memory playUpdates = HexplorationGameplayUpdates
            .playUpdatesForPlayerActionPhase(
                address(QUEUE),
                queueID,
                address(ROLL_DRAW),
                summary
            );
        string[4] memory playerZones = [
            GAME_BOARD.currentPlayZone(gameID, 1),
            GAME_BOARD.currentPlayZone(gameID, 2),
            GAME_BOARD.currentPlayZone(gameID, 3),
            GAME_BOARD.currentPlayZone(gameID, 4)
        ];

        (
            playUpdates.zoneTransfersTo,
            playUpdates.zoneTransfersFrom,
            playUpdates.zoneTransferQtys
        ) = DISPUTE_RESOLVER.resolveCampSetupDisputes(
            playUpdates.zoneTransfersTo,
            playUpdates.zoneTransfersFrom,
            playUpdates.zoneTransferQtys,
            playUpdates.zoneTransferItemTypes,
            gameID,
            playerZones,
            address(GAME_BOARD),
            address(QUEUE)
        );
        (
            playUpdates.zoneTransfersTo,
            playUpdates.zoneTransfersFrom,
            playUpdates.zoneTransferQtys
        ) = DISPUTE_RESOLVER.resolveCampBreakDownDisputes(
            playUpdates.zoneTransfersTo,
            playUpdates.zoneTransfersFrom,
            playUpdates.zoneTransferQtys,
            playUpdates.zoneTransferItemTypes,
            gameID,
            playerZones,
            address(GAME_BOARD),
            address(QUEUE)
        );
        (
            playUpdates.playerTransfersTo,
            playUpdates.playerTransfersFrom,
            playUpdates.playerTransferQtys
        ) = DISPUTE_RESOLVER.resolveDigDisputes(
            playUpdates.playerTransfersTo,
            playUpdates.playerTransfersFrom,
            playUpdates.playerTransferQtys,
            playUpdates.playerTransferItemTypes,
            gameID,
            playerZones,
            address(GAME_BOARD),
            address(QUEUE)
        );
        GAME_STATE.postUpdates(playUpdates, gameID);
        // player actions
        // sets phase (token balance) to playUpdates.gamePhase
        QUEUE.setPhase(HexplorationQueue.ProcessingPhase.PlayThrough, queueID);
    }

    function processPlayThroughUnsafe(uint256 queueID) public {
        HexplorationQueue.ProcessingPhase phase = QUEUE.currentPhase(queueID);
        if (QUEUE.getRandomness(queueID).length > 0) {
            if (phase == HexplorationQueue.ProcessingPhase.PlayThrough) {
                uint256 gameID = QUEUE.game(queueID);

                if (!QUEUE.isDayPhase(queueID)) {
                    // current live phase is opposite of what queue is set to
                    // (we process day phase events with previous night's turn queue)
                    PlayUpdates
                        memory dayPhaseUpdates = HexplorationGameplayUpdates
                            .dayPhaseUpdatesForPlayThroughPhase(
                                address(QUEUE),
                                queueID,
                                gameID,
                                address(GAME_BOARD),
                                address(ROLL_DRAW)
                            );
                    GAME_STATE.postDayPhaseUpdates(dayPhaseUpdates, gameID);
                }
            }
            // TODO: set this to true when game is finished
            bool gameComplete = false;
            QUEUE.finishProcessing(
                queueID,
                gameComplete,
                activePlayers(queueID)
            );
        }
    }

    // Internal
    function activePlayers(uint256 queueID) internal view returns (uint256) {
        uint256 gameID = QUEUE.game(queueID);
        PlayerRegistry pr = PlayerRegistry(GAME_BOARD.prAddress());
        uint256 totalRegistrations = pr.totalRegistrations(gameID);
        uint256 inactivePlayers = 0;
        CharacterCard cc = CharacterCard(GAME_BOARD.characterCard());
        for (uint256 i = 0; i < totalRegistrations; i++) {
            if (!pr.isActive(gameID, i + 1) || cc.playerIsDead(gameID, i + 1)) {
                inactivePlayers++;
            }
        }
        return (totalRegistrations - inactivePlayers);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(AccessControlEnumerable, AutoLoopVRFCompatible)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
