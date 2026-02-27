// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "./HexplorationBoard.sol";
import "./HexplorationZone.sol";
import "./CharacterCard.sol";
import "./TokenInventory.sol";

contract RelicManagement is AccessControlEnumerable {
    bytes32 public constant VERIFIED_CONTROLLER_ROLE =
        keccak256("VERIFIED_CONTROLLER_ROLE");

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    function addVerifiedController(
        address vcAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(VERIFIED_CONTROLLER_ROLE, vcAddress);
    }

    /// @notice Reveal a mystery relic tile, returning the specific relic Tile enum.
    /// @dev Called when a player lands on a RelicMystery zone during movement.
    ///      Uses randomness to pick which relic type (Relic1-Relic5) this zone becomes.
    ///      Updates the board's relic tracking and zone tile.
    function revealRelic(
        address gameBoardAddress,
        uint256 gameID,
        string memory zoneAlias,
        uint256 randomness
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) returns (HexplorationZone.Tile) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        TokenInventory ti = TokenInventory(board.tokenInventory());

        // Get all relic token types; index 0 = "Mystery", 1+ = named relics
        string[] memory relicTypes = ti.RELIC_TOKEN().getTokenTypes();
        require(relicTypes.length > 1, "No named relics configured");

        // Pick a named relic (indices 1..length-1)
        uint256 namedRelicCount = relicTypes.length - 1;
        uint256 chosenIndex = (randomness % namedRelicCount) + 1;
        string memory chosenRelic = relicTypes[chosenIndex];

        // Map chosen relic index to Tile enum: Relic1=7, Relic2=8, ...
        HexplorationZone.Tile revealedTile = HexplorationZone.Tile(6 + chosenIndex);

        // Transfer mystery relic token out of zone, replace with named relic
        uint256 zoneIdx = board.zoneIndex(zoneAlias);

        // Remove mystery token from zone
        ti.RELIC_TOKEN().transferFromZone(
            relicTypes[0], // "Mystery"
            gameID,
            zoneIdx,
            0, // to bank
            1
        );

        // Place named relic token in zone
        ti.RELIC_TOKEN().transferToZone(
            chosenRelic,
            gameID,
            0, // from bank
            zoneIdx,
            1
        );

        // Track relic location and update tile on board
        board.addRelic(gameID, chosenRelic, zoneAlias);
        board.setRelicTile(gameID, chosenRelic, revealedTile);

        return revealedTile;
    }

    /// @notice Pick up a relic from a zone and assign it to a player.
    /// @dev Called when a player ends movement on a revealed relic tile (Relic1-Relic5).
    function pickupRelic(
        address gameBoardAddress,
        address characterCardAddress,
        uint256 gameID,
        uint256 playerID,
        string memory zoneAlias,
        HexplorationZone.Tile zoneTile
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        HexplorationBoard board = HexplorationBoard(gameBoardAddress);
        CharacterCard cc = CharacterCard(characterCardAddress);
        TokenInventory ti = TokenInventory(board.tokenInventory());

        // Determine which relic type from tile enum (Relic1=7 → index 1, etc.)
        uint256 relicTypeIndex = uint256(zoneTile) - 6;
        string[] memory relicTypes = ti.RELIC_TOKEN().getTokenTypes();
        require(relicTypeIndex < relicTypes.length, "Invalid relic tile");
        string memory relicType = relicTypes[relicTypeIndex];

        uint256 zoneIdx = board.zoneIndex(zoneAlias);

        // Transfer relic token from zone to player
        ti.RELIC_TOKEN().transferFromZone(
            relicType,
            gameID,
            zoneIdx,
            playerID,
            1
        );

        // Record on character card
        cc.setRelic(relicType, gameID, playerID);

        // Set zone tile to empty (relic picked up)
        board.setRelicTile(gameID, relicType, HexplorationZone.Tile.RelicEmpty);
    }
}
