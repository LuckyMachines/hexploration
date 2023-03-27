// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@luckymachines/game-core/contracts/src/v0.0/custom_boards/HexGrid.sol";
import "./HexplorationZone.sol";

contract HexplorationBoard is HexGrid {
    // This role is a hybrid controller, assumes on chain verification of moves before submission

    HexplorationZone internal HEX_ZONE;
    address public characterCard;
    address public tokenInventory;
    address public gameplayQueue;
    // mapping from gameID
    mapping(uint256 => bool) public gameOver;
    mapping(uint256 => string[]) public relics;
    // game ID => relic type
    mapping(uint256 => mapping(string => string)) public relicLocation;
    // game ID => zone alias
    mapping(uint256 => mapping(string => bool)) public zoneEnabled;
    mapping(uint256 => mapping(string => bool)) public artifactFound; // can only dig on space if false
    // game ID => playerID
    mapping(uint256 => mapping(uint256 => string[])) public artifactsRetrieved; // get artifacts retrieved by player ID

    constructor(
        address adminAddress,
        uint256 _gridWidth,
        uint256 _gridHeight,
        address _zoneAddress
    ) HexGrid(adminAddress, _gridWidth, _gridHeight, _zoneAddress) {
        HEX_ZONE = HexplorationZone(_zoneAddress);
    }

    function hexZoneAddress() public view returns (address) {
        return address(HEX_ZONE);
    }

    function getAliasAddress(
        uint256 gameID,
        string memory zAlias
    ) public view returns (address) {
        return zoneAlias[gameID][zAlias];
    }

    function getArtifactsRetrieved(
        uint256 gameID,
        uint256 playerID
    ) public view returns (string[] memory) {
        return artifactsRetrieved[gameID][playerID];
    }

    function getRelics(uint256 gameID) public view returns (string[] memory) {
        return relics[gameID];
    }

    function hasOutput(
        string memory fromZone,
        string memory toZone
    ) public view returns (bool zoneHasOutput) {
        string[] memory outputs = getOutputs(0, fromZone);
        zoneHasOutput = false;
        for (uint256 i = 0; i < outputs.length; i++) {
            if (
                keccak256(abi.encode(outputs[i])) ==
                keccak256(abi.encode(toZone))
            ) {
                zoneHasOutput = true;
                break;
            }
        }
    }

    // VERIFIED CONTROLLER functions
    // We can assume these have been pre-verified
    function setCharacterCard(
        address characterCardAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        characterCard = characterCardAddress;
    }

    function setTokenInventory(
        address tokenInventoryAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        tokenInventory = tokenInventoryAddress;
    }

    function setGameplayQueue(
        address gameplayQueueAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        gameplayQueue = gameplayQueueAddress;
    }

    function setPlayerRegistry(
        address playerRegistryAddress
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        PLAYER_REGISTRY = PlayerRegistry(playerRegistryAddress);
    }

    function setArtifactFound(
        uint256 gameID,
        string memory _zoneAlias
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        artifactFound[gameID][_zoneAlias] = true;
    }

    function setArtifactRetrieved(
        uint256 gameID,
        uint256 playerID,
        string memory artifact
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        artifactsRetrieved[gameID][playerID].push(artifact);
    }

    function setGameOver(
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        gameOver[gameID] = true;
    }

    function addRelic(
        uint256 gameID,
        string memory relicType,
        string memory _zoneAlias
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        relics[gameID].push(relicType);
        relicLocation[gameID][relicType] = _zoneAlias;
    }

    function setRelicTile(
        uint256 gameID,
        string memory relicType,
        HexplorationZone.Tile tile
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        HEX_ZONE.setTile(tile, gameID, relicLocation[gameID][relicType]);
    }

    function registerPlayer(
        address playerAddress,
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        PLAYER_REGISTRY.registerPlayer(playerAddress, gameID);
    }

    function lockRegistration(
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        PLAYER_REGISTRY.lockRegistration(gameID);
    }

    function enterPlayer(
        address playerAddress,
        uint256 gameID,
        string memory zone
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        HEX_ZONE.enterPlayer(playerAddress, gameID, zone);
    }

    /*
// TODO: call this when player credits run out
    function exitPlayer(
        address playerAddress,
        uint256 gameID,
        string memory zone
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        HEX_ZONE.exitPlayer(playerAddress, gameID, zone);
    }
*/
    function requestNewGame(
        address gameRegistryAddress,
        uint256 maxPlayers
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        uint256 gameSize = maxPlayers > 4 ? 4 : maxPlayers == 0
            ? 1
            : maxPlayers;
        uint256 gameID = GameRegistry(gameRegistryAddress).registerGame();
        // TODO: set this to whatever size rooms we want (up to 4)
        PLAYER_REGISTRY.setRegistrationLimit(gameSize, gameID);
    }

    function setGameState(
        uint256 gs,
        uint256 gameID
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        // 0 start
        // 1 inititalizing
        // 2 initialized
        gameState[gameID] = gs;
    }

    function start(uint256 gameID) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        _gamesNeedUpdates.push(gameID);
    }

    function enableZone(
        string memory _zoneAlias,
        HexplorationZone.Tile tile,
        uint256 gameID
    ) public onlyRole(VERIFIED_CONTROLLER_ROLE) {
        if (!zoneEnabled[gameID][_zoneAlias]) {
            HEX_ZONE.setTile(tile, gameID, _zoneAlias);
            zoneEnabled[gameID][_zoneAlias] = true;
        } else if (
            HEX_ZONE.tile(gameID, _zoneAlias) ==
            HexplorationZone.Tile.RelicMystery
        ) {
            // allow setting tile since relic needs to be revealed
            HEX_ZONE.setTile(tile, gameID, _zoneAlias);
        }
    }

    // pass path and what tiles should be
    // pass current zone as first argument
    function moveThroughPath(
        string[] memory zonePath,
        uint256 playerID,
        uint256 gameID,
        HexplorationZone.Tile[] memory tiles
    ) external onlyRole(VERIFIED_CONTROLLER_ROLE) {
        string memory currentZone = currentPlayZone[gameID][playerID];
        address playerAddress = PLAYER_REGISTRY.playerAddress(gameID, playerID);
        HEX_ZONE.exitPlayer(playerAddress, gameID, currentZone);
        HEX_ZONE.enterPlayer(
            playerAddress,
            gameID,
            zonePath[zonePath.length - 1]
        );
        for (uint256 i = 0; i < zonePath.length; i++) {
            enableZone(zonePath[i], tiles[i], gameID);
        }
    }

    function openGames(
        address gameRegistryAddress
    )
        public
        view
        returns (
            uint256[] memory availableGames,
            uint256[] memory playerLimit,
            uint256[] memory currentRegistrations
        )
    {
        uint256[] memory allGames = GameRegistry(gameRegistryAddress)
            .allGames();
        uint256 openGamesCount = 0;
        for (uint256 i = 0; i < allGames.length; i++) {
            uint256 gameID = allGames[i];

            if (
                PLAYER_REGISTRY.totalRegistrations(gameID) <
                PLAYER_REGISTRY.registrationLimit(gameID) &&
                !PLAYER_REGISTRY.registrationLocked(gameID)
            ) {
                openGamesCount++;
            }
        }
        uint256 position = 0;
        availableGames = new uint256[](openGamesCount);
        playerLimit = new uint256[](openGamesCount);
        currentRegistrations = new uint256[](openGamesCount);
        for (uint256 i = 0; i < allGames.length; i++) {
            uint256 gameID = allGames[i];
            uint256 registrationLimit = PLAYER_REGISTRY.registrationLimit(
                gameID
            );
            uint256 totalRegistrations = PLAYER_REGISTRY.totalRegistrations(
                gameID
            );
            if (
                totalRegistrations < registrationLimit &&
                !PLAYER_REGISTRY.registrationLocked(gameID)
            ) {
                availableGames[position] = gameID;
                playerLimit[position] = registrationLimit;
                currentRegistrations[position] = totalRegistrations;
                position++;
            }
        }
    }
}
