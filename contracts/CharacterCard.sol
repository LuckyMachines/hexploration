// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract CharacterCard is AccessControlEnumerable {
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
    uint8 public constant MAX_MOVEMENT = 4;
    uint8 public constant MAX_AGILITY = 4;
    uint8 public constant MAX_DEXTERITY = 4;

    address public itemToken;
    address public artifactToken;
    address public relicToken;
    // game id => player ID
    mapping(uint256 => mapping(uint256 => uint8)) public movement;
    mapping(uint256 => mapping(uint256 => uint8)) public agility;
    mapping(uint256 => mapping(uint256 => uint8)) public dexterity;
    mapping(uint256 => mapping(uint256 => Action)) public action; // set to enumerated list
    //// the following assign a token type, player must still hold balance to use item
    mapping(uint256 => mapping(uint256 => string)) public leftHandItem;
    mapping(uint256 => mapping(uint256 => string)) public rightHandItem;
    mapping(uint256 => mapping(uint256 => string)) public artifact;
    mapping(uint256 => mapping(uint256 => string)) public status;
    mapping(uint256 => mapping(uint256 => string)) public relic;
    // results of current action
    mapping(uint256 => mapping(uint256 => string)) public activeActionCardType;
    mapping(uint256 => mapping(uint256 => string)) public activeActionCardDrawn;
    mapping(uint256 => mapping(uint256 => string))
        public activeActionCardResult;
    mapping(uint256 => mapping(uint256 => string[3]))
        public activeActionCardInventoryChanges;
    mapping(uint256 => mapping(uint256 => int8[3]))
        public activeActionStatUpdates;
    // results of latest day phase
    mapping(uint256 => mapping(uint256 => string))
        public dayPhaseActionCardType;
    mapping(uint256 => mapping(uint256 => string))
        public dayPhaseActionCardDrawn;
    mapping(uint256 => mapping(uint256 => string))
        public dayPhaseActionCardResult;
    mapping(uint256 => mapping(uint256 => string[3]))
        public dayPhaseActionCardInventoryChanges;
    mapping(uint256 => mapping(uint256 => int8[3]))
        public dayPhaseActionStatUpdates;

    constructor(
        address itemTokenAddress,
        address artifactTokenAddress,
        address relicTokenAddress
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        itemToken = itemTokenAddress;
        artifactToken = artifactTokenAddress;
        relicToken = relicTokenAddress;
    }

    function addVerifiedController(address controllerAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, controllerAddress);
    }

    function isVC(address testAddress) public view returns (bool) {
        return hasRole(VERIFIED_CONTROLLER_ROLE, testAddress);
    }

    function getStats(uint256 gameID, uint256 playerID)
        public
        view
        returns (uint8[3] memory stats)
    {
        stats[0] = movement[gameID][playerID];
        stats[1] = agility[gameID][playerID];
        stats[2] = dexterity[gameID][playerID];
    }

    function getInventoryChanges(uint256 gameID, uint256 playerID)
        public
        view
        returns (string[3] memory)
    {
        return activeActionCardInventoryChanges[gameID][playerID];
    }

    function getDayPhaseInventoryChanges(uint256 gameID, uint256 playerID)
        public
        view
        returns (string[3] memory)
    {
        return dayPhaseActionCardInventoryChanges[gameID][playerID];
    }

    function getStatUpdates(uint256 gameID, uint256 playerID)
        public
        view
        returns (int8[3] memory)
    {
        return activeActionStatUpdates[gameID][playerID];
    }

    function getDayPhaseStatUpdates(uint256 gameID, uint256 playerID)
        public
        view
        returns (int8[3] memory)
    {
        return dayPhaseActionStatUpdates[gameID][playerID];
    }

    function playerIsDead(uint256 gameID, uint256 playerID)
        public
        view
        returns (bool)
    {
        if (
            movement[gameID][playerID] == 0 ||
            agility[gameID][playerID] == 0 ||
            dexterity[gameID][playerID] == 0
        ) {
            return true;
        } else {
            return false;
        }
    }

    // Controller functions
    function resetActiveActions(uint256 gameID, uint256 totalPlayers)
        external
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        for (uint256 i = 1; i < totalPlayers + 1; i++) {
            // i = player ID
            activeActionCardType[gameID][i] = "";
            activeActionCardDrawn[gameID][i] = "";
            activeActionCardResult[gameID][i] = "";
            activeActionCardInventoryChanges[gameID][i] = ["", "", ""];
            activeActionStatUpdates[gameID][i] = [int8(0), int8(0), int8(0)];
        }
    }

    function resetDayPhaseActions(uint256 gameID, uint256 totalPlayers)
        external
        onlyRole(VERIFIED_CONTROLLER_ROLE)
    {
        for (uint256 i = 1; i < totalPlayers + 1; i++) {
            // i = player ID
            dayPhaseActionCardType[gameID][i] = "";
            dayPhaseActionCardDrawn[gameID][i] = "";
            dayPhaseActionCardResult[gameID][i] = "";
            dayPhaseActionCardInventoryChanges[gameID][i] = ["", "", ""];
            dayPhaseActionStatUpdates[gameID][i] = [int8(0), int8(0), int8(0)];
        }
    }

    function setStats(
        uint8[3] memory stats,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // set all stats at once [movement, agility, dexterity]
        movement[gameID][playerID] = stats[0] > MAX_MOVEMENT
            ? MAX_MOVEMENT
            : stats[0];
        agility[gameID][playerID] = stats[1] > MAX_AGILITY
            ? MAX_AGILITY
            : stats[1];
        dexterity[gameID][playerID] = stats[2] > MAX_DEXTERITY
            ? MAX_DEXTERITY
            : stats[2];
    }

    function setMovement(
        uint8 movementValue,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        movement[gameID][playerID] = movementValue > MAX_MOVEMENT
            ? MAX_MOVEMENT
            : movementValue;
    }

    function setAgility(
        uint8 agilityValue,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        agility[gameID][playerID] = agilityValue > MAX_AGILITY
            ? MAX_AGILITY
            : agilityValue;
    }

    function setDexterity(
        uint8 dexterityValue,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        dexterity[gameID][playerID] = dexterityValue > MAX_DEXTERITY
            ? MAX_DEXTERITY
            : dexterityValue;
    }

    function setLeftHandItem(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        if (
            keccak256(abi.encode(itemTokenType)) !=
            keccak256(abi.encode("None"))
        ) {
            leftHandItem[gameID][playerID] = itemTokenType;
        } else {
            // "None" was passed, which empties out hand
            leftHandItem[gameID][playerID] = "";
        }
    }

    function setRightHandItem(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        if (
            keccak256(abi.encode(itemTokenType)) !=
            keccak256(abi.encode("None"))
        ) {
            rightHandItem[gameID][playerID] = itemTokenType;
        } else {
            // "None" was passed, which empties out hand
            rightHandItem[gameID][playerID] = "";
        }
    }

    function setArtifact(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        artifact[gameID][playerID] = itemTokenType;
    }

    function setStatus(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        status[gameID][playerID] = itemTokenType;
    }

    function setRelic(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        relic[gameID][playerID] = itemTokenType;
    }

    function setAction(
        Action _action,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        action[gameID][playerID] = _action;
    }

    function setAction(
        string memory _action,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        Action a = Action.Idle;
        if (compare(_action, "Move")) {
            a = Action.Move;
        } else if (compare(_action, "Setup camp")) {
            a = Action.SetupCamp;
        } else if (compare(_action, "Break down camp")) {
            a = Action.BreakDownCamp;
        } else if (compare(_action, "Dig")) {
            a = Action.Dig;
        } else if (compare(_action, "Rest")) {
            a = Action.Rest;
        } else if (compare(_action, "Help")) {
            a = Action.Help;
        }
        action[gameID][playerID] = a;
    }

    // TODO: make sure everything calling these sends stat updates too
    function setActionResults(
        string memory actionCardType,
        string memory actionCardDrawn,
        string memory actionCardResult,
        string[3] memory actionCardInventoryChanges,
        int8[3] memory actionCardStatUpdates,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        activeActionCardType[gameID][playerID] = actionCardType;
        activeActionCardDrawn[gameID][playerID] = actionCardDrawn;
        activeActionCardResult[gameID][playerID] = actionCardResult;
        activeActionCardInventoryChanges[gameID][
            playerID
        ] = actionCardInventoryChanges;
        activeActionStatUpdates[gameID][playerID] = actionCardStatUpdates;
    }

    function setDayPhaseResults(
        string memory cardType,
        string memory cardDrawn,
        string memory cardResult,
        string[3] memory cardInventoryChanges,
        int8[3] memory cardStatUpdates,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        dayPhaseActionCardType[gameID][playerID] = cardType;
        dayPhaseActionCardDrawn[gameID][playerID] = cardDrawn;
        dayPhaseActionCardResult[gameID][playerID] = cardResult;
        dayPhaseActionCardInventoryChanges[gameID][
            playerID
        ] = cardInventoryChanges;
        dayPhaseActionStatUpdates[gameID][playerID] = cardStatUpdates;
    }

    function compare(string memory s1, string memory s2)
        public
        pure
        returns (bool isMatch)
    {
        isMatch =
            keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }
}
