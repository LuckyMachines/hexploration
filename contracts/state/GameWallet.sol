// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "../tokens/GameToken.sol";

contract GameWallet is AccessControlEnumerable {
    // token address => token type
    address[] public tokenAddresses;
    string[] public tokenTypes;
    mapping(address => mapping(string => bool)) public tokenTypeSet;

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function addTokenTypes(
        address[] memory _tokenAddresses,
        string[] memory _tokenTypes
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            tokenAddresses.length == tokenTypes.length,
            "array length mismatch"
        );
        for (uint256 i = 0; i < tokenAddresses.length; i++) {
            address tokenAddress = _tokenAddresses[i];
            string memory tokenType = _tokenTypes[i];
            if (!tokenTypeSet[tokenAddress][tokenType]) {
                tokenAddresses.push(tokenAddress);
                tokenTypes.push(tokenType);
                tokenTypeSet[tokenAddress][tokenType] = true;
            }
        }
    }

    function allBalances(uint256 gameID, uint256 playerID)
        public
        view
        returns (
            address[] memory addresses,
            string[] memory types,
            uint256[] memory balances
        )
    {
        addresses = tokenAddresses;
        types = tokenTypes;
        balances = new uint256[](addresses.length);
        for (uint256 i = 0; i < addresses.length; i++) {
            balances[i] = GameToken(addresses[i]).balance(
                types[i],
                gameID,
                playerID
            );
        }
    }
}
