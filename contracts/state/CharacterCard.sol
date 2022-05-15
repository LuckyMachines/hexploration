// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract CharacterCard is AccessControlEnumerable {
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    address public itemToken;
    address public artifactToken;
    address public relicToken;
    // game id => player address
    mapping(uint256 => mapping(address => uint8)) public movement;
    mapping(uint256 => mapping(address => uint8)) public agility;
    mapping(uint256 => mapping(address => uint8)) public dexterity;
    //// the following assign a token type, player must still hold balance to use item
    mapping(uint256 => mapping(address => string)) public leftHandItem;
    mapping(uint256 => mapping(address => string)) public rightHandItem;
    mapping(uint256 => mapping(address => string)) public artifact;
    mapping(uint256 => mapping(address => string)) public status;
    mapping(uint256 => mapping(address => string)) public relic;

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

    function setStats(
        uint8[3] memory stats,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // set all stats at once [movement, agility, dexterity]
        movement[gameID][playerAddress] = stats[0];
        agility[gameID][playerAddress] = stats[1];
        dexterity[gameID][playerAddress] = stats[2];
    }

    function setMovement(
        uint8 movementValue,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        movement[gameID][playerAddress] = movementValue;
    }

    function setAgility(
        uint8 agilityValue,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        agility[gameID][playerAddress] = agilityValue;
    }

    function setDexterity(
        uint8 dexterityValue,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        dexterity[gameID][playerAddress] = dexterityValue;
    }

    function setLeftHandItem(
        string memory itemTokenType,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        leftHandItem[gameID][playerAddress] = itemTokenType;
    }

    function setRightHandItem(
        string memory itemTokenType,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        rightHandItem[gameID][playerAddress] = itemTokenType;
    }

    function setArtifact(
        string memory itemTokenType,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        rightHandItem[gameID][playerAddress] = itemTokenType;
    }

    function setStatus(
        string memory itemTokenType,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        rightHandItem[gameID][playerAddress] = itemTokenType;
    }

    function setRelic(
        string memory itemTokenType,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        rightHandItem[gameID][playerAddress] = itemTokenType;
    }
}
