// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.7;

import "@luckymachines/game-core/contracts/src/v0.0/GameController.sol";
import "./HexplorationBoard.sol";
import "./HexplorationZone.sol";
import "./HexplorationQueue.sol";
import "./HexplorationStateUpdate.sol";
import "./CharacterCard.sol";
import "./TokenInventory.sol";
import "./GameEvents.sol";
import "./GameSetup.sol";
import "./GameWallets.sol";
import "@chainlink/contracts/src/v0.8/AutomationCompatible.sol";
import "@luckymachines/autoloop/contracts/AutoLoopCompatible.sol";

contract HexplorationController is
    GameController,
    GameWallets,
    AutomationCompatibleInterface,
    AutoLoopCompatible
{
    // functions are meant to be called directly by players by default
    // we are adding the ability of a Controller Admin or Keeper to
    // execute the game aspects not directly controlled by players
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    HexplorationStateUpdate GAME_STATE;
    GameEvents GAME_EVENTS;
    GameSetup GAME_SETUP;

    uint256 public timeLimit = 10 * 60; // Defaults to 10 minutes (in seconds)

    // Mapping from board address => game ID => queue ID
    mapping(address => mapping(uint256 => mapping(uint256 => uint256)))
        public submissionTimeStart;
    mapping(address => mapping(uint256 => mapping(uint256 => bool))) readyForUpdate;

    address[] public activeGameAddresses;
    uint256[] public activeGames;

    modifier onlyAdminVC() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
                hasRole(VERIFIED_CONTROLLER_ROLE, _msgSender()),
            "Admin or Keeper role required"
        );
        _;
    }

    constructor(address adminAddress) GameController(adminAddress) {}

    // Admin Functions

    function setGameEvents(address gameEventsAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GAME_EVENTS = GameEvents(gameEventsAddress);
    }

    function setGameStateUpdate(address gsuAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GAME_STATE = HexplorationStateUpdate(gsuAddress);
    }

    function setGameSetup(address gameSetupAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        GAME_SETUP = GameSetup(payable(gameSetupAddress));
    }

    function addVerifiedController(address vcAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    function setTimeLimit(uint256 timeInSeconds)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        timeLimit = timeInSeconds;
    }

    function stopTimer(
        uint256 gameID,
        address boardAddress,
        uint256 queueID
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        delete submissionTimeStart[boardAddress][gameID][queueID];
        for (uint256 i = 0; i < activeGames.length; i++) {
            if (
                activeGames[i] == gameID &&
                activeGameAddresses[i] == boardAddress
            ) {
                delete activeGames[i];
                delete activeGameAddresses[i];
            }
        }
    }

    //Player Interactions
    function registerForGame(uint256 gameID, address boardAddress) public {
        HexplorationBoard board = HexplorationBoard(boardAddress);
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        board.registerPlayer(tx.origin, gameID);
        uint256 playerID = pr.playerID(gameID, tx.origin);
        // TODO: set to official values
        CharacterCard(board.characterCard()).setStats(
            [4, 4, 4],
            gameID,
            playerID
        );
        // emit player joined
        GAME_EVENTS.emitGameRegistration(gameID, tx.origin, playerID);

        // If registry is full we can kick off game start...
        if (pr.totalRegistrations(gameID) == pr.registrationLimit(gameID)) {
            GAME_SETUP.allPlayersRegistered(gameID, boardAddress);
        }
    }

    function submitAction(
        uint256 playerID,
        uint8 actionIndex,
        string[] memory options,
        string memory leftHand,
        string memory rightHand,
        uint256 gameID,
        address boardAddress
    ) public {
        _checkAction(
            actionIndex,
            options,
            leftHand,
            rightHand,
            gameID,
            boardAddress,
            playerID
        );
        HexplorationBoard board = HexplorationBoard(boardAddress);
        HexplorationQueue q = HexplorationQueue(payable(board.gameplayQueue()));
        PlayerRegistry pr = PlayerRegistry(board.prAddress());
        require(
            pr.playerAddress(gameID, playerID) == tx.origin,
            "PlayerID is not sender"
        );
        uint256 qID = q.queueID(gameID);
        if (qID == 0) {
            uint256 totalRegistrations = pr.totalRegistrations(gameID);
            qID = q.requestGameQueue(gameID, totalRegistrations);
        }
        require(qID != 0, "unable to set qID in controller");

        if (submissionTimeStart[boardAddress][gameID][qID] == 0) {
            submissionTimeStart[boardAddress][gameID][qID] = block.timestamp;
            activeGames.push(gameID);
            activeGameAddresses.push(boardAddress);
        }

        string memory cz = board.currentPlayZone(gameID, playerID);
        string[] memory newOptions;
        bool isDayPhase = TokenInventory(board.tokenInventory())
            .DAY_NIGHT_TOKEN()
            .balance("Day", gameID, GAME_BOARD_WALLET_ID) > 0
            ? true
            : false;
        if (actionIndex == 4) {
            // dig action, set options to # players on board
            // TODO: find way to secure this option (don't want players arbitrarily setting)
            uint256 activePlayersOnSpace = 0;
            for (uint256 i = 0; i < pr.totalRegistrations(gameID); i++) {
                if (
                    keccak256(
                        abi.encodePacked(board.currentPlayZone(gameID, i + 1))
                    ) == keccak256(abi.encodePacked(cz))
                ) {
                    activePlayersOnSpace++;
                }
                //currentPlayZone[gameID][playerID]
            }
            newOptions = new string[](activePlayersOnSpace + 1); // array length = players on space + 1
            newOptions[0] = isDayPhase ? "Day" : "Night";
        } else {
            newOptions = options;
        }

        q.submitActionForPlayer(
            playerID,
            actionIndex,
            newOptions,
            leftHand,
            rightHand,
            qID,
            isDayPhase
        );

        if (q.getAllPlayers(qID).length >= q.totalPlayers(qID)) {
            readyForUpdate[boardAddress][gameID][qID] = true;
        }
    }

    // TODO: limit this to authorized game starters
    function requestNewGame(address gameRegistryAddress, address boardAddress)
        public
    {
        requestNewGame(gameRegistryAddress, boardAddress, 4);
    }

    function requestNewGame(
        address gameRegistryAddress,
        address boardAddress,
        uint256 totalPlayers
    ) public {
        HexplorationBoard board = HexplorationBoard(boardAddress);
        board.requestNewGame(gameRegistryAddress, totalPlayers);
    }

    // TODO: move this into game summary
    function latestGame(address gameRegistryAddress, address boardAddress)
        public
        view
        returns (uint256)
    {
        return GameRegistry(gameRegistryAddress).latestGame(boardAddress);
    }

    // AutoLoop
    // forwarding keeper functions for compatibility
    function shouldProgressLoop()
        external
        view
        override
        returns (bool loopIsReady, bytes memory progressWithData)
    {
        (loopIsReady, progressWithData) = this.checkUpkeep(new bytes(0));
    }

    function progressLoop(bytes calldata progressWithData) external override {
        this.performUpkeep(progressWithData);
    }

    // Keeper Functions
    function checkUpkeep(
        bytes calldata /* checkData */
    )
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256 gameIndex;
        uint256 queueID;
        for (uint256 i = 0; i < activeGames.length; i++) {
            if (activeGames[i] > 0) {
                HexplorationBoard board = HexplorationBoard(
                    activeGameAddresses[i]
                );
                HexplorationQueue q = HexplorationQueue(
                    payable(board.gameplayQueue())
                );
                queueID = q.queueID(activeGames[i]);
                if (
                    readyForUpdate[activeGameAddresses[i]][activeGames[i]][
                        queueID
                    ] == true
                ) {
                    gameIndex = i;
                    upkeepNeeded = true;
                    break;
                }
                uint256 startTime = submissionTimeStart[activeGameAddresses[i]][
                    activeGames[i]
                ][queueID];
                if (startTime > 0 && block.timestamp - startTime >= timeLimit) {
                    gameIndex = i;
                    upkeepNeeded = true;
                    break;
                } else {
                    upkeepNeeded = false;
                }
            }
        }
        performData = abi.encode(gameIndex, queueID);
    }

    function performUpkeep(bytes calldata performData) external override {
        uint256 gameIndex;
        uint256 queueID;
        (gameIndex, queueID) = abi.decode(performData, (uint256, uint256));
        uint256 startTime = submissionTimeStart[activeGameAddresses[gameIndex]][
            activeGames[gameIndex]
        ][queueID];
        if (
            readyForUpdate[activeGameAddresses[gameIndex]][
                activeGames[gameIndex]
            ][queueID] ||
            (startTime > 0 &&
                activeGames.length > gameIndex &&
                activeGames[gameIndex] > 0 &&
                block.timestamp - startTime > timeLimit)
        ) {
            submissionTimeout(
                activeGames[gameIndex],
                activeGameAddresses[gameIndex]
            );
            // update
            delete activeGames[gameIndex];
            delete activeGameAddresses[gameIndex];
        }
    }

    function getActiveGames() public view returns (uint256[] memory games) {
        games = activeGames;
    }

    function getActiveGameAddresses()
        public
        view
        returns (address[] memory addresses)
    {
        addresses = activeGameAddresses;
    }

    function timeNow() public view returns (uint256) {
        return block.timestamp;
    }

    // internal

    // Starts processing turn after timeout
    function submissionTimeout(uint256 gameID, address boardAddress) internal {
        HexplorationBoard board = HexplorationBoard(boardAddress);
        HexplorationQueue q = HexplorationQueue(payable(board.gameplayQueue()));
        uint256 qID = q.queueID(gameID);
        bool isDayPhase = TokenInventory(board.tokenInventory())
            .DAY_NIGHT_TOKEN()
            .balance("Day", gameID, GAME_BOARD_WALLET_ID) > 0
            ? true
            : false;
        q.requestProcessActions(qID, isDayPhase);
    }

    // TODO: move these validation functions into rules

    function _checkAction(
        uint8 actionIndex,
        string[] memory options,
        string memory leftHand,
        string memory rightHand,
        uint256 gameID,
        address gameBoardAddress,
        uint256 playerID
    ) internal view {
        bool valid;
        string memory reason;
        (valid, reason) = actionIsValid(
            actionIndex,
            options,
            leftHand,
            rightHand,
            gameID,
            gameBoardAddress,
            playerID
        );
        require(valid, reason);
    }

    function actionIsValid(
        uint8 actionIndex,
        string[] memory options,
        string memory leftHand,
        string memory rightHand,
        uint256 gameID,
        address gameBoardAddress,
        uint256 playerID
    ) public view returns (bool isValid, string memory invalidError) {
        HexplorationBoard gameBoard = HexplorationBoard(gameBoardAddress);
        HexplorationQueue q = HexplorationQueue(
            payable(gameBoard.gameplayQueue())
        );
        uint256 qID = q.queueID(gameID);
        CharacterCard cc = CharacterCard(gameBoard.characterCard());
        if (readyForUpdate[gameBoardAddress][gameID][qID] == true) {
            isValid = false;
            invalidError = "Cannot submit move. Queue already processing.";
        } else if (
            gameBoard.gameOver(gameID) || cc.playerIsDead(gameID, playerID)
        ) {
            isValid = false;
            invalidError = "Invalid action submitted: Game over or player is dead";
        } else {
            isValid = true;
            invalidError = "";
            string memory currentSpace = gameBoard.currentPlayZone(
                gameID,
                playerID
            );
            if (actionIndex == 4) {
                // TODO:
                // dig action
                if (gameBoard.artifactFound(gameID, currentSpace)) {
                    // artifact already found at space, can't dig here
                    isValid = false;
                    invalidError = "Invalid action submitted: Artifact found on space, can't dig.";
                } else if (
                    bytes(
                        CharacterCard(gameBoard.characterCard()).artifact(
                            gameID,
                            playerID
                        )
                    ).length > 0
                ) {
                    // player already has artifact, can't dig
                    isValid = false;
                    invalidError = "Invalid action submitted: Player has artifact, can't dig.";
                }
            } else if (actionIndex == 1) {
                // moving
                // check options for valid movement
                // TODO: make sure # of spaces is within movement
                if (
                    CharacterCard(gameBoard.characterCard()).movement(
                        gameID,
                        playerID
                    ) < (options.length)
                ) {
                    isValid = false;
                    invalidError = "Invalid action submitted: player movement limit exceeded.";
                } else {
                    // TODO:
                    // ensure each movement zone has output to next movement zone
                    // for (uint256 i = 0; i < options.length; i++) {
                    //     if (
                    //         i == 0 && !gameBoard.hasOutput(currentSpace, options[0])
                    //     ) {
                    //         isValid = false;
                    //         break;
                    //         // check that movement from current zone to option[0] is valid
                    //     } else if (
                    //         !gameBoard.hasOutput(options[i - 1], options[i])
                    //     ) {
                    //         // check that movement from option[i - 1] to option[i] is valid
                    //         isValid = false;
                    //         break;
                    //     }
                    // }
                }
            } else if (actionIndex == 2) {
                // setup camp
                TokenInventory tokenInventory = TokenInventory(
                    gameBoard.tokenInventory()
                );
                if (
                    tokenInventory.ITEM_TOKEN().balance(
                        "Campsite",
                        gameID,
                        playerID
                    ) == 0
                ) {
                    // campsite is not in player inventory
                    isValid = false;
                    invalidError = "Invalid action submitted: Campsite not in inventory.";
                } else if (
                    tokenInventory.ITEM_TOKEN().zoneBalance(
                        "Campsite",
                        gameID,
                        zoneIndex(gameBoard.getZoneAliases(), currentSpace)
                    ) > 0
                ) {
                    // campsite is already on board space
                    isValid = false;
                    invalidError = "Invalid action submitted: Campsite already on space.";
                }
            } else if (actionIndex == 3) {
                // break down camp
                TokenInventory tokenInventory = TokenInventory(
                    gameBoard.tokenInventory()
                );
                if (
                    tokenInventory.ITEM_TOKEN().balance(
                        "Campsite",
                        gameID,
                        playerID
                    ) > 0
                ) {
                    // campsite is already in player inventory
                    isValid = false;
                    invalidError = "Invalid action submitted: Campsite already in inventory.";
                } else if (
                    tokenInventory.ITEM_TOKEN().zoneBalance(
                        "Campsite",
                        gameID,
                        zoneIndex(gameBoard.getZoneAliases(), currentSpace)
                    ) == 0
                ) {
                    // campsite is not on board space
                    isValid = false;
                    invalidError = "Invalid action submitted: Campsite is not on space.";
                }
            } else if (actionIndex == 5) {
                // rest
                if (
                    TokenInventory(gameBoard.tokenInventory())
                        .ITEM_TOKEN()
                        .zoneBalance(
                            "Campsite",
                            gameID,
                            zoneIndex(gameBoard.getZoneAliases(), currentSpace)
                        ) ==
                    0 ||
                    bytes(options[0]).length == 0
                ) {
                    // campsite is not on board space || options is not ""
                    isValid = false;
                    invalidError = "Invalid action submitted: Campsite not on space or options are empty.";
                }
            } else if (actionIndex == 6) {
                // help
                // check that player being helped is on the same space
                // options[0] = player to help ("1","2","3", or "4")
                // options[1] = attribute to help ("Movement", "Agility", or "Dexterity")
                uint256 playerIDToHelp = stringsMatch(options[0], "1")
                    ? 1
                    : stringsMatch(options[0], "2")
                    ? 2
                    : stringsMatch(options[0], "3")
                    ? 3
                    : stringsMatch(options[0], "4")
                    ? 4
                    : 0;
                if (
                    !stringsMatch(
                        currentSpace,
                        gameBoard.currentPlayZone(gameID, playerIDToHelp)
                    )
                ) {
                    // players are not on same space
                    isValid = false;
                    invalidError = "Invalid action submitted: players not on same space";
                } else {
                    // check that player can transfer attribute (> 1)
                    // check that receiving player can increase attribute (< MAX)
                    if (stringsMatch(options[1], "Movement")) {
                        if (
                            cc.movement(gameID, playerID) <= 1 ||
                            cc.movement(gameID, playerIDToHelp) ==
                            cc.MAX_MOVEMENT()
                        ) {
                            // player doesn't have movement attribute to transfer or
                            // recipient has full movement attribute
                            isValid = false;
                            invalidError = "Invalid action submitted: Movement attribute mismatch";
                        }
                    } else if (stringsMatch(options[1], "Agility")) {
                        if (
                            cc.agility(gameID, playerID) <= 1 ||
                            cc.agility(gameID, playerIDToHelp) ==
                            cc.MAX_AGILITY()
                        ) {
                            // player doesn't have agility attribute to transfer or
                            // recipient has full agility attribute
                            isValid = false;
                            invalidError = "Invalid action submitted: Agility attribute mismatch";
                        }
                    } else if (stringsMatch(options[1], "Dexterity")) {
                        if (
                            cc.dexterity(gameID, playerID) <= 1 ||
                            cc.dexterity(gameID, playerIDToHelp) ==
                            cc.MAX_DEXTERITY()
                        ) {
                            // player doesn't have dexterity attribute to transfer or
                            // recipient has full dexterity attribute
                            isValid = false;
                            invalidError = "Invalid action submitted: Dexterity attribute mismatch";
                        }
                    }
                }
            }
            if (bytes(leftHand).length > 0 && bytes(rightHand).length > 0) {
                // cannot equip both hands in one turn
                isValid = false;
                invalidError = "Invalid action submitted: Can't equip both hands in one turn.";
            } else if (
                bytes(leftHand).length > 0 && !stringsMatch(leftHand, "None")
            ) {
                if (
                    TokenInventory(gameBoard.tokenInventory())
                        .ITEM_TOKEN()
                        .balance(leftHand, gameID, playerID) == 0
                ) {
                    // item not in inventory
                    isValid = false;
                    invalidError = "Invalid action submitted: LH equip not in inventory.";
                }
            } else if (
                bytes(rightHand).length > 0 && !stringsMatch(rightHand, "None")
            ) {
                if (
                    TokenInventory(gameBoard.tokenInventory())
                        .ITEM_TOKEN()
                        .balance(rightHand, gameID, playerID) == 0
                ) {
                    // item not in inventory
                    isValid = false;
                    invalidError = "Invalid action submitted: RH equip not in inventory.";
                }
            }
        }
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(AccessControlEnumerable, AutoLoopCompatible)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function stringsMatch(string memory s1, string memory s2)
        internal
        pure
        returns (bool)
    {
        return
            keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }

    function zoneIndex(string[] memory allZones, string memory zoneAlias)
        internal
        pure
        returns (uint256 index)
    {
        index = 1111111111111;
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
