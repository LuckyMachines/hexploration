// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

// Allows a collection of tokens to be created within a token group or contract
// these tokens exclusively for in game use and by default only controllable by
// a game controller
contract GameToken is AccessControlEnumerable {
    event Transfer(
        uint256 indexed gameID,
        uint256 indexed fromPlayerID,
        uint256 indexed toPlayerID,
        address controller,
        string tokenType,
        uint256 value
    );

    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");
    // tokenType => game ID => playerID =>
    // (playerID can be 0 if not assigned to any player)
    mapping(string => mapping(uint256 => mapping(uint256 => uint256)))
        public balance;

    string[] public tokenTypes;

    constructor(string[] memory _tokenTypes, address controllerAddress) {
        tokenTypes = _tokenTypes;
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        // controller is only one who can send tokens around
        _setupRole(CONTROLLER_ROLE, controllerAddress);
    }

    function transfer(
        string memory tokenType,
        uint256 gameID,
        uint256 fromPlayerID,
        uint256 toPlayerID,
        uint256 quantity
    ) public onlyRole(CONTROLLER_ROLE) {
        require(
            balance[tokenType][gameID][fromPlayerID] >= quantity,
            "from balance too low"
        );
        balance[tokenType][gameID][toPlayerID] += quantity;
        balance[tokenType][gameID][fromPlayerID] -= quantity;
        emit Transfer(
            gameID,
            fromPlayerID,
            toPlayerID,
            _msgSender(),
            tokenType,
            quantity
        );
    }
}
