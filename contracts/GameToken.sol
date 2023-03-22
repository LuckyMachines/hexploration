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

    event TransferToZone(
        uint256 indexed gameID,
        uint256 indexed fromID,
        uint256 indexed toZoneIndex,
        address controller,
        string tokenType,
        uint256 value
    );

    event TransferFromZone(
        uint256 indexed gameID,
        uint256 indexed fromZoneIndex,
        uint256 indexed toID,
        address controller,
        string tokenType,
        uint256 value
    );

    event TransferZoneToZone(
        uint256 indexed gameID,
        uint256 indexed fromZoneIndex,
        uint256 indexed toZoneIndex,
        address controller,
        string tokenType,
        uint256 value
    );

    enum TokenState {
        Default,
        Active,
        Setting1,
        Setting2,
        Setting3,
        Setting4
    }

    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");
    // Mapping from tokenType => game ID => id
    // (0 is bank, player ID or 1000000 is active wallet)
    mapping(string => mapping(uint256 => mapping(uint256 => uint256)))
        public balance;
    // balance of a zone with all zones index of ID on game baord
    mapping(string => mapping(uint256 => mapping(uint256 => uint256)))
        public zoneBalance;

    mapping(string => mapping(uint256 => mapping(uint256 => TokenState)))
        public tokenState; // individual token state, overrides allTokenState if not Default
    // Mapping from tokenType
    mapping(string => bool) internal tokenTypeSet;
    mapping(string => TokenState) public allTokenState; // default token state

    string[] public tokenTypes;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function addController(
        address controllerAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(CONTROLLER_ROLE, controllerAddress);
    }

    function addTokenTypes(
        string[] memory _tokenTypes
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        for (uint256 i = 0; i < _tokenTypes.length; i++) {
            string memory tokenType = _tokenTypes[i];
            string[] storage tTypes = tokenTypes;
            if (!tokenTypeSet[tokenType]) {
                tTypes.push(tokenType);
                tokenTypeSet[tokenType] = true;
            }
        }
    }

    function addTokenTypesWithState(
        string[] memory _tokenTypes,
        TokenState[] memory tokenStates
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            _tokenTypes.length == tokenStates.length,
            "array length mismatch"
        );
        for (uint256 i = 0; i < _tokenTypes.length; i++) {
            string memory tokenType = _tokenTypes[i];
            string[] storage tTypes = tokenTypes;
            if (!tokenTypeSet[tokenType]) {
                tTypes.push(tokenType);
                tokenTypeSet[tokenType] = true;
                allTokenState[tokenType] = tokenStates[i];
            }
        }
    }

    function mintAllTokens(
        uint256 gameID,
        uint256 quantity
    ) public onlyRole(CONTROLLER_ROLE) {
        for (uint256 i = 0; i < tokenTypes.length; i++) {
            balance[tokenTypes[i]][gameID][0] += quantity;
        }
    }

    function mintAllTokens(
        uint256 gameID,
        uint256 quantity,
        TokenState withState
    ) public onlyRole(CONTROLLER_ROLE) {
        for (uint256 i = 0; i < tokenTypes.length; i++) {
            balance[tokenTypes[i]][gameID][0] += quantity;
            _setAllTokenState(tokenTypes[i], withState);
        }
    }

    function mint(
        string memory tokenType,
        uint256 gameID,
        uint256 quantity
    ) public onlyRole(CONTROLLER_ROLE) {
        require(tokenTypeSet[tokenType], "Token type not set");
        balance[tokenType][gameID][0] += quantity;
    }

    function mintTo(
        uint256 recipient,
        string memory tokenType,
        uint256 gameID,
        uint256 quantity
    ) public onlyRole(CONTROLLER_ROLE) {
        require(tokenTypeSet[tokenType], "Token type not set");
        balance[tokenType][gameID][recipient] += quantity;
    }

    function setTokenState(
        TokenState state,
        string memory tokenType,
        uint256 gameID,
        uint256 holderID
    ) public onlyRole(CONTROLLER_ROLE) {
        tokenState[tokenType][gameID][holderID] = state;
    }

    function setAllTokenState(
        TokenState state,
        string memory tokenType
    ) public onlyRole(CONTROLLER_ROLE) {
        allTokenState[tokenType] = state;
    }

    // from ID + to ID can be player IDs or any other ID used in game.
    // use transferToZone or transferFromZone if not going between board and player
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

    function transferToZone(
        string memory tokenType,
        uint256 gameID,
        uint256 fromID,
        uint256 toZoneIndex,
        uint256 quantity
    ) public onlyRole(CONTROLLER_ROLE) {
        require(
            balance[tokenType][gameID][fromID] >= quantity,
            "from balance too low"
        );
        zoneBalance[tokenType][gameID][toZoneIndex] += quantity;
        balance[tokenType][gameID][fromID] -= quantity;
        emit TransferToZone(
            gameID,
            fromID,
            toZoneIndex,
            _msgSender(),
            tokenType,
            quantity
        );
    }

    function transferFromZone(
        string memory tokenType,
        uint256 gameID,
        uint256 fromZoneIndex,
        uint256 toID,
        uint256 quantity
    ) public onlyRole(CONTROLLER_ROLE) {
        require(
            zoneBalance[tokenType][gameID][fromZoneIndex] >= quantity,
            "from balance too low"
        );
        balance[tokenType][gameID][toID] += quantity;
        zoneBalance[tokenType][gameID][fromZoneIndex] -= quantity;
        emit TransferFromZone(
            gameID,
            fromZoneIndex,
            toID,
            _msgSender(),
            tokenType,
            quantity
        );
    }

    function transferZoneToZone(
        string memory tokenType,
        uint256 gameID,
        uint256 fromZoneIndex,
        uint256 toZoneIndex,
        uint256 quantity
    ) public onlyRole(CONTROLLER_ROLE) {
        require(
            zoneBalance[tokenType][gameID][fromZoneIndex] >= quantity,
            "from balance too low"
        );
        zoneBalance[tokenType][gameID][toZoneIndex] += quantity;
        zoneBalance[tokenType][gameID][fromZoneIndex] -= quantity;
        emit Transfer(
            gameID,
            fromZoneIndex,
            toZoneIndex,
            _msgSender(),
            tokenType,
            quantity
        );
    }

    function getTokenTypes() public view returns (string[] memory) {
        return tokenTypes;
    }

    function _setAllTokenState(
        string memory tokenType,
        TokenState state
    ) internal {
        allTokenState[tokenType] = state;
    }
}
