// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

abstract contract Utilities {
    function stringsMatch(string memory s1, string memory s2)
        internal
        pure
        returns (bool)
    {
        return
            keccak256(abi.encodePacked(s1)) == keccak256(abi.encodePacked(s2));
    }
}
