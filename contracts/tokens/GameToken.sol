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
    // (playerID 0 is bank)
    mapping(string => mapping(uint256 => mapping(uint256 => uint256)))
        public balance;
    mapping(string => bool) internal tokenTypeSet;
    string[] public tokenTypes;

    constructor(address controllerAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        // controller is only one who can send tokens around
        _setupRole(CONTROLLER_ROLE, controllerAddress);
    }

    function addTokenTypes(string[] memory _tokenTypes)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        for (uint256 i = 0; i < _tokenTypes.length; i++) {
            string memory tokenType = _tokenTypes[i];
            if (!tokenTypeSet[tokenType]) {
                tokenTypes.push(tokenType);
                tokenTypeSet[tokenType] = true;
            }
        }
    }

    function mint(
        string memory tokenType,
        uint256 gameID,
        uint256 quantity
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(tokenTypeSet[tokenType], "Token type not set");
        balance[tokenType][gameID][0] = quantity;
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
