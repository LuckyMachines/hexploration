// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

// TODO: start using this for state updating outside of controller
// Controller should only be used by users / UI directly sending
// commands. This does things that can only imagine...

// This should be only associated with one board...

import "./HexplorationController.sol";
import "./HexplorationBoard.sol";
import "./decks/CardDeck.sol";
import "./state/CharacterCard.sol";
import "./HexplorationGameplay.sol";

contract HexplorationStateUpdate is AccessControlEnumerable {
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");
    /*
    Controller can access all game tokens with the following methods:

    function mint(
        string memory tokenType,
        uint256 gameID,
        uint256 quantity
    )

    function transfer(
        string memory tokenType,
        uint256 gameID,
        uint256 fromID,
        uint256 toID,
        uint256 quantity
    )
*/
    HexplorationBoard internal GAME_BOARD;
    CharacterCard internal CHARACTER_CARD;
    modifier onlyAdminVC() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, _msgSender()) ||
                hasRole(VERIFIED_CONTROLLER_ROLE, _msgSender()),
            "Admin or Keeper role required"
        );
        _;
    }

    // set other addresses going to need here
    // decks, tokens?
    constructor(address gameBoardAddress, address characterCardAddress) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        GAME_BOARD = HexplorationBoard(gameBoardAddress);
        CHARACTER_CARD = CharacterCard(characterCardAddress);
    }

    // Admin Functions

    function addVerifiedController(address vcAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    function postUpdates(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // go through values and post everything, transfer all the tokens, and pray
        // use gamestate update contract to post everything
        updatePlayerPositions(updates, gameID);
        updatePlayerStats(updates, gameID);
        updatePlayerHands(updates, gameID);
        transferPlayerItems(updates, gameID);
        transferZoneItems(updates, gameID);
    }

    /*

    struct PlayUpdates {
        uint256[] playerPositionIDs;
        uint256[] spacesToMove;
        uint256[] playerEquipIDs;
        uint256[] playerEquipHands;
        uint256[] zoneTransfersTo;
        uint256[] zoneTransfersFrom;
        uint256[] zoneTransferQtys;
        uint256[] playerTransfersTo;
        uint256[] playerTransfersFrom;
        uint256[] playerTransferQtys;
        uint256[] playerStatUpdateIDs;
        uint256[3][] playerStatUpdates;
        uint256[] playerActiveActionIDs;
        string gamePhase;
        string[7][] playerMovementOptions; // TODO: set this to max # of spaces possible
        string[] playerEquips;
        string[] zoneTransferItemTypes;
        string[] playerTransferItemTypes;
        string[] activeActions;
        string[] activeActionOptions;
    }
    */

    function updatePlayerPositions(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        for (uint256 i = 0; i < updates.playerPositionIDs.length; i++) {
            uint256 spacesToMove = updates.spacesToMove[i];
            string[] memory path = new string[](spacesToMove);
            for (uint256 j = 0; j < spacesToMove; j++) {
                path[j] = updates.playerMovementOptions[i][j];
            }
            moveThroughPath(
                path,
                gameID,
                updates.playerPositionIDs[i],
                updates.randomness
            );
        }
    }

    function updatePlayerStats(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {}

    function updatePlayerHands(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {
        for (uint256 i = 0; i < updates.playerEquipIDs.length; i++) {
            bool leftHand = updates.playerEquipHands[i] == 0;
            if (leftHand) {
                CHARACTER_CARD.setLeftHandItem(
                    updates.playerEquips[i],
                    gameID,
                    updates.playerEquipIDs[i]
                );
            } else {
                CHARACTER_CARD.setRightHandItem(
                    updates.playerEquips[i],
                    gameID,
                    updates.playerEquipIDs[i]
                );
            }
        }
    }

    function transferPlayerItems(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {}

    function transferZoneItems(
        HexplorationGameplay.PlayUpdates memory updates,
        uint256 gameID
    ) internal {}

    function moveThroughPath(
        string[] memory zonePath,
        uint256 gameID,
        uint256 playerID,
        uint256 randomness
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        //TODO: pick tiles from deck

        HexplorationZone.Tile[] memory tiles = new HexplorationZone.Tile[](
            zonePath.length
        );
        uint256[] memory randomNumbers = new uint256[](zonePath.length);
        randomNumbers[0] = randomness;
        // TODO: expand to more random numbers for length of zone
        // use this when drawing from tile deck
        for (uint256 i = 0; i < zonePath.length; i++) {
            tiles[i] = i == 0 ? HexplorationZone.Tile.Jungle : i == 1
                ? HexplorationZone.Tile.Plains
                : HexplorationZone.Tile.Mountain;
        }

        GAME_BOARD.moveThroughPath(zonePath, playerID, gameID, tiles);
    }
}
