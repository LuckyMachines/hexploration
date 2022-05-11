// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/GameController.sol";
import "./HexplorationBoard.sol";
import "./HexplorationZone.sol";

contract HexplorationController is GameController {
    // functions are meant to be called directly by players by default
    // we are adding the ability of a Controller Admin or Keeper to
    // execute the game aspects not directly controlled by players
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    // TODO:
    // Connect to Chainlink VRF for random seeds when needed
    // submit move + space choice
    // use / swap item

    modifier onlyAdminKeeper() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
                hasRole(KEEPER_ROLE, _msgSender()),
            "Admin or Keeper role required"
        );
        _;
    }

    constructor() GameController(_msgSender()) {}

    function addKeeper(address keeperAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(KEEPER_ROLE, keeperAddress);
    }
}
