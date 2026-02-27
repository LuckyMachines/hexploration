// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

/**
 * @title StringToUint
 * @notice Minimal implementation of IStringToUint for Band VRF callback path.
 *         In mock VRF mode this contract is never called, but the address
 *         is required by the RandomnessConsumer constructor.
 */
contract StringToUint {
    function stringToUint(string calldata s)
        external
        pure
        returns (uint256 result)
    {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 48 && c <= 57) {
                result = result * 10 + (c - 48);
            }
        }
    }
}
