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
    uint8 constant MAX_MOVEMENT = 4;
    uint8 constant MAX_AGILITY = 4;
    uint8 constant MAX_DEXTERITY = 4;

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

    function getStats(uint256 gameID, uint256 playerID)
        public
        view
        returns (uint8[3] memory stats)
    {
        stats[0] = movement[gameID][playerID];
        stats[1] = agility[gameID][playerID];
        stats[2] = dexterity[gameID][playerID];
    }

    function setStats(
        uint8[3] memory stats,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // set all stats at once [movement, agility, dexterity]
        movement[gameID][playerID] = stats[0];
        agility[gameID][playerID] = stats[1];
        dexterity[gameID][playerID] = stats[2];
    }

    function setMovement(
        uint8 movementValue,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        movement[gameID][playerID] = movementValue;
    }

    function setAgility(
        uint8 agilityValue,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        agility[gameID][playerID] = agilityValue;
    }

    function setDexterity(
        uint8 dexterityValue,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        dexterity[gameID][playerID] = dexterityValue;
    }

    function setLeftHandItem(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        leftHandItem[gameID][playerID] = itemTokenType;
    }

    function setRightHandItem(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        rightHandItem[gameID][playerID] = itemTokenType;
    }

    function setArtifact(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        rightHandItem[gameID][playerID] = itemTokenType;
    }

    function setStatus(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        rightHandItem[gameID][playerID] = itemTokenType;
    }

    function setRelic(
        string memory itemTokenType,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        rightHandItem[gameID][playerID] = itemTokenType;
    }

    function setAction(
        Action _action,
        uint256 gameID,
        uint256 playerID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        action[gameID][playerID] = _action;
    }
}
