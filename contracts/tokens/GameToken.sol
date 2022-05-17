// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";

// Allows a collection of tokens to be created within a token group or contract
// these tokens exclusively for in game use and by default only controllable by
// a game controller
contract GameToken is AccessControlEnumerable {
    event Transfer(
        uint256 indexed gameID,
        uint256 indexed fromID,
        uint256 indexed toID,
        address controller,
        string tokenType,
        uint256 value
    );

    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");
    // tokenType => game ID => id =>
    // (0 is bank, player ID or 1 is active wallet)
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
            string[] storage tTypes = tokenTypes;
            if (!tokenTypeSet[tokenType]) {
                tTypes.push(tokenType);
                tokenTypeSet[tokenType] = true;
            }
        }
    }

    function mint(
        string memory tokenType,
        uint256 gameID,
        uint256 quantity
    ) public onlyRole(CONTROLLER_ROLE) {
        require(tokenTypeSet[tokenType], "Token type not set");
        balance[tokenType][gameID][0] = quantity;
    }

    // from ID + to ID can be player IDs or any other ID used in game.
    function transfer(
        string memory tokenType,
        uint256 gameID,
        uint256 fromID,
        uint256 toID,
        uint256 quantity
    ) public onlyRole(CONTROLLER_ROLE) {
        require(
            balance[tokenType][gameID][fromID] >= quantity,
            "from balance too low"
        );
        balance[tokenType][gameID][toID] += quantity;
        balance[tokenType][gameID][fromID] -= quantity;
        emit Transfer(gameID, fromID, toID, _msgSender(), tokenType, quantity);
    }

    function getTokenTypes() public view returns (string[] memory) {
        return tokenTypes;
    }
}
