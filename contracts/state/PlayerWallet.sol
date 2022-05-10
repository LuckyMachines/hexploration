// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "./GameWallet.sol";

contract PlayerWallet is GameWallet {
    constructor() GameWallet() {}
}
