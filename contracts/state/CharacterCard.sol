// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

contract CharacterCard is AccessControlEnumerable {
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    address public itemToken;
    // game id => player address
    mapping(uint256 => mapping(address => uint16)) movement;
    mapping(uint256 => mapping(address => uint16)) agility;
    mapping(uint256 => mapping(address => uint16)) dexterity;
    //// the following assign a token type, player must still hold balance to use item
    mapping(uint256 => mapping(address => string)) leftHandItem;
    mapping(uint256 => mapping(address => string)) rightHandItem;

    constructor(address itemTokenAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        itemToken = itemTokenAddress;
        // TODO: set default stats here
    }

    function addVerifiedController(address controllerAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, controllerAddress);
    }

    function setStats(
        uint16[] memory stats,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // set all stats at once [movement, agility, dexterity]
        movement[gameID][playerAddress] = stats[0];
        agility[gameID][playerAddress] = stats[1];
        dexterity[gameID][playerAddress] = stats[2];
    }

    function setMovement(
        uint16 movementValue,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        movement[gameID][playerAddress] = movementValue;
    }

    function setAgility(
        uint16 agilityValue,
        uint256 gameID,
        address playerAddress
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        agility[gameID][playerAddress] = agilityValue;
    }

    function setDexterity(
        uint16 dexterityValue,
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
}
