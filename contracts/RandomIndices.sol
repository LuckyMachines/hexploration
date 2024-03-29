// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.8.0;

abstract contract RandomIndices {
    enum RandomIndex {
        P1DigPassFail,
        P1DigCardDraw,
        P1DigCardOutcome,
        P2DigPassFail,
        P2DigCardDraw,
        P2DigCardOutcome,
        P3DigPassFail,
        P3DigCardDraw,
        P3DigCardOutcome,
        P4DigPassFail,
        P4DigCardDraw,
        P4DigCardOutcome,
        TieDispute,
        P1DayEventType,
        P1DayEventCardDraw,
        P1DayEventRoll,
        P2DayEventType,
        P2DayEventCardDraw,
        P2DayEventRoll,
        P3DayEventType,
        P3DayEventCardDraw,
        P3DayEventRoll,
        P4DayEventType,
        P4DayEventCardDraw,
        P4DayEventRoll,
        P1TileReveal1,
        P1TileReveal2,
        P1TileReveal3,
        P1TileReveal4,
        P2TileReveal1,
        P2TileReveal2,
        P2TileReveal3,
        P2TileReveal4,
        P3TileReveal1,
        P3TileReveal2,
        P3TileReveal3,
        P3TileReveal4,
        P4TileReveal1,
        P4TileReveal2,
        P4TileReveal3,
        P4TileReveal4
    }

    function expandNumber(uint256 number, RandomIndex index)
        internal
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encode(number, index)));
    }

    function expandNumber(uint256 number, uint256 indexAsNumber)
        internal
        pure
        returns (uint256)
    {
        return uint256(keccak256(abi.encode(number, indexAsNumber)));
    }
}
