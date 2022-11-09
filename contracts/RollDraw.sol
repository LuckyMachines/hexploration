// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "./CardDeck.sol";
import "./HexplorationQueue.sol";
import "./RandomIndices.sol";

contract RollDraw is AccessControlEnumerable, RandomIndices {
    CardDeck EVENT_DECK;
    CardDeck TREASURE_DECK;
    CardDeck AMBUSH_DECK;
    HexplorationQueue QUEUE;

    enum CardType {
        None,
        Event,
        Ambush,
        Treasure
    }

    // Mapping from queue ID => player ID
    mapping(uint256 => mapping(uint256 => uint256)) _drawRandomness;
    mapping(uint256 => mapping(uint256 => uint256[3])) _playerRolls;
    mapping(uint256 => mapping(uint256 => uint256)) _dayPhaseDrawRandomness;
    mapping(uint256 => mapping(uint256 => uint256[3])) _dayPhaseRolls;

    constructor(
        address eventDeckAddress,
        address treasureDeckAddress,
        address ambushDeckAddress
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        EVENT_DECK = CardDeck(eventDeckAddress);
        TREASURE_DECK = CardDeck(treasureDeckAddress);
        AMBUSH_DECK = CardDeck(ambushDeckAddress);
    }

    function setQueue(address queueAddress)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        QUEUE = HexplorationQueue(queueAddress);
    }

    // TODO: set access control for this, this should not be public, it changes the state
    // Set hexploration gameplay to be verified controller
    function setRandomnessForPlayer(
        uint256 playerID,
        uint256 queueID,
        bool dayEvent
    ) public {
        uint256 drawIndex;
        uint256 rollIndex;
        (drawIndex, rollIndex) = randomIndicesForPlayer(playerID, false);
        uint256 dayPhaseDrawIndex;
        uint256 dayPhaseRollIndex;
        if (dayEvent) {
            (dayPhaseDrawIndex, dayPhaseRollIndex) = randomIndicesForPlayer(
                playerID,
                true
            );
            _dayPhaseDrawRandomness[queueID][playerID] = QUEUE.randomness(
                queueID,
                dayPhaseDrawIndex
            );
            _dayPhaseRolls[queueID][playerID] = playerRolls(
                queueID,
                playerID,
                dayPhaseRollIndex
            );
        }

        _drawRandomness[queueID][playerID] = QUEUE.randomness(
            queueID,
            drawIndex
        );

        _playerRolls[queueID][playerID] = playerRolls(
            queueID,
            playerID,
            rollIndex
        );
    }

    // public get functions
    /*
    mapping(uint256 => mapping(uint256 => uint256)) _drawRandomness;
    mapping(uint256 => mapping(uint256 => uint256[3])) _playerRolls;
    mapping(uint256 => mapping(uint256 => uint256)) _dayPhaseDrawRandomness;
    mapping(uint256 => mapping(uint256 => uint256[3])) _dayPhaseRolls;
    */
    function getDrawRandomness(uint256 queueID, uint256 playerID)
        public
        view
        returns (uint256)
    {
        return _drawRandomness[queueID][playerID];
    }

    function getPlayerRolls(uint256 queueID, uint256 playerID)
        public
        view
        returns (uint256[3] memory)
    {
        return _playerRolls[queueID][playerID];
    }

    function getDayPhaseDrawRandomness(uint256 queueID, uint256 playerID)
        public
        view
        returns (uint256)
    {
        return _dayPhaseDrawRandomness[queueID][playerID];
    }

    function getDayPhaseRolls(uint256 queueID, uint256 playerID)
        public
        view
        returns (uint256[3] memory)
    {
        return _dayPhaseRolls[queueID][playerID];
    }

    function randomIndicesForPlayer(uint256 playerID, bool dayEvent)
        internal
        pure
        returns (uint256 drawRandomnessIndex, uint256 rollRandomnessIndex)
    {
        RandomIndex _drawRandomnessIndex;
        RandomIndex _rollRandomnessIndex;
        if (dayEvent) {
            if (playerID == 1) {
                _drawRandomnessIndex = RandomIndex.P1DayEventCardDraw;
                _rollRandomnessIndex = RandomIndex.P1DayEventRoll;
            } else if (playerID == 2) {
                _drawRandomnessIndex = RandomIndex.P2DayEventCardDraw;
                _rollRandomnessIndex = RandomIndex.P2DayEventRoll;
            } else if (playerID == 3) {
                _drawRandomnessIndex = RandomIndex.P3DayEventCardDraw;
                _rollRandomnessIndex = RandomIndex.P3DayEventRoll;
            } else {
                _drawRandomnessIndex = RandomIndex.P4DayEventCardDraw;
                _rollRandomnessIndex = RandomIndex.P4DayEventRoll;
            }
        } else {
            if (playerID == 1) {
                _drawRandomnessIndex = RandomIndex.P1DigCardDraw;
                _rollRandomnessIndex = RandomIndex.P1DigCardOutcome;
            } else if (playerID == 2) {
                _drawRandomnessIndex = RandomIndex.P2DigCardDraw;
                _rollRandomnessIndex = RandomIndex.P2DigCardOutcome;
            } else if (playerID == 3) {
                _drawRandomnessIndex = RandomIndex.P3DigCardDraw;
                _rollRandomnessIndex = RandomIndex.P3DigCardOutcome;
            } else {
                _drawRandomnessIndex = RandomIndex.P4DigCardDraw;
                _rollRandomnessIndex = RandomIndex.P4DigCardOutcome;
            }
        }
        drawRandomnessIndex = uint256(_drawRandomnessIndex);
        rollRandomnessIndex = uint256(_rollRandomnessIndex);
    }

    function drawCard(
        CardType cardType,
        uint256 queueID,
        uint256 playerID,
        bool dayPhase
    )
        public
        view
        returns (
            string memory card,
            int8 movementAdjust,
            int8 agilityAdjust,
            int8 dexterityAdjust,
            string memory itemTypeLoss,
            string memory itemTypeGain,
            string memory handLoss,
            string memory outcome
        )
    {
        // get randomness from queue QUEUE.randomness(queueID)
        // outputs should match up with what's returned from deck draw

        if (cardType == CardType.Event) {
            // draw from event deck
            (
                card,
                movementAdjust,
                agilityAdjust,
                dexterityAdjust,
                itemTypeLoss,
                itemTypeGain,
                handLoss,
                outcome
            ) = dayPhase
                ? EVENT_DECK.drawCard(
                    _dayPhaseDrawRandomness[queueID][playerID],
                    _dayPhaseRolls[queueID][playerID]
                )
                : EVENT_DECK.drawCard(
                    _drawRandomness[queueID][playerID],
                    _playerRolls[queueID][playerID]
                );
        } else if (cardType == CardType.Ambush) {
            // draw from ambush deck
            (
                card,
                movementAdjust,
                agilityAdjust,
                dexterityAdjust,
                itemTypeLoss,
                itemTypeGain,
                handLoss,
                outcome
            ) = dayPhase
                ? AMBUSH_DECK.drawCard(
                    _dayPhaseDrawRandomness[queueID][playerID],
                    _dayPhaseRolls[queueID][playerID]
                )
                : AMBUSH_DECK.drawCard(
                    _drawRandomness[queueID][playerID],
                    _playerRolls[queueID][playerID]
                );
        } else {
            // draw from treasure deck
            (
                card,
                movementAdjust,
                agilityAdjust,
                dexterityAdjust,
                itemTypeLoss,
                itemTypeGain,
                handLoss,
                outcome
            ) = dayPhase
                ? TREASURE_DECK.drawCard(
                    _dayPhaseDrawRandomness[queueID][playerID],
                    _dayPhaseRolls[queueID][playerID]
                )
                : TREASURE_DECK.drawCard(
                    _drawRandomness[queueID][playerID],
                    _playerRolls[queueID][playerID]
                );
        }
    }

    function drawCard(
        CardType cardType,
        uint256 queueID,
        uint256 playerID,
        bool dayPhase,
        bool /* return stats as int8[3] */
    )
        public
        view
        returns (
            string memory card,
            int8[3] memory stats,
            string memory itemTypeLoss,
            string memory itemTypeGain,
            string memory handLoss,
            string memory outcome
        )
    {
        if (cardType == CardType.Event) {
            // draw from event deck
            (
                card,
                stats[0],
                stats[1],
                stats[2],
                itemTypeLoss,
                itemTypeGain,
                handLoss,
                outcome
            ) = dayPhase
                ? EVENT_DECK.drawCard(
                    _dayPhaseDrawRandomness[queueID][playerID],
                    _dayPhaseRolls[queueID][playerID]
                )
                : EVENT_DECK.drawCard(
                    _drawRandomness[queueID][playerID],
                    _playerRolls[queueID][playerID]
                );
        } else if (cardType == CardType.Ambush) {
            // draw from ambush deck
            (
                card,
                stats[0],
                stats[1],
                stats[2],
                itemTypeLoss,
                itemTypeGain,
                handLoss,
                outcome
            ) = dayPhase
                ? AMBUSH_DECK.drawCard(
                    _dayPhaseDrawRandomness[queueID][playerID],
                    _dayPhaseRolls[queueID][playerID]
                )
                : AMBUSH_DECK.drawCard(
                    _drawRandomness[queueID][playerID],
                    _playerRolls[queueID][playerID]
                );
        } else {
            // draw from treasure deck
            (
                card,
                stats[0],
                stats[1],
                stats[2],
                itemTypeLoss,
                itemTypeGain,
                handLoss,
                outcome
            ) = dayPhase
                ? TREASURE_DECK.drawCard(
                    _dayPhaseDrawRandomness[queueID][playerID],
                    _dayPhaseRolls[queueID][playerID]
                )
                : TREASURE_DECK.drawCard(
                    _drawRandomness[queueID][playerID],
                    _playerRolls[queueID][playerID]
                );
        }
    }

    function attributeRoll(
        uint256 numDice,
        uint256 queueID,
        uint256 randomnessIndex
    ) public view returns (uint256 rollTotal) {
        uint8[] memory die = new uint8[](3);
        die[0] = 0;
        die[1] = 1;
        die[2] = 2;
        rollTotal = _rollDice(queueID, die, numDice, randomnessIndex);
    }

    function d6Roll(
        uint256 numDice,
        uint256 queueID,
        uint256 randomnessIndex
    ) public view returns (uint256 rollTotal) {
        uint8[] memory die = new uint8[](6);
        die[0] = 1;
        die[1] = 2;
        die[2] = 3;
        die[3] = 4;
        die[4] = 5;
        die[5] = 6;
        rollTotal = _rollDice(queueID, die, numDice, randomnessIndex);
    }

    function _rollDice(
        uint256 queueID,
        uint8[] memory diceValues,
        uint256 diceQty,
        uint256 randomnessIndex
    ) internal view returns (uint256 rollTotal) {
        rollTotal = 0;
        // Simulated dice roll, get max possible roll value and use randomness to get total
        uint256 maxValue = uint256(diceValues[0]);
        for (uint256 i = 1; i < diceValues.length; i++) {
            if (diceValues[i] > diceValues[i - 1]) {
                maxValue = uint256(diceValues[i]);
            }
        }
        rollTotal =
            QUEUE.randomness(queueID, randomnessIndex) %
            ((maxValue * diceQty) + 1);
    }

    function playerRolls(
        uint256 queueID,
        uint256 playerID,
        uint256 randomnessIndex
    ) internal view returns (uint256[3] memory rolls) {
        // TODO: update to use randomness provided, no roll seeds
        // use same randomness for all rolls, only one will be used but all 3 are prepared
        uint8[3] memory playerStats = QUEUE.getStatsAtSubmission(
            queueID,
            playerID
        );
        rolls[0] = attributeRoll(playerStats[0], queueID, randomnessIndex);
        rolls[1] = attributeRoll(playerStats[1], queueID, randomnessIndex);
        rolls[2] = attributeRoll(playerStats[2], queueID, randomnessIndex);
    }

    // function getRollSeed(uint256 playerID) public view returns (uint256 seed) {
    //     if (QUEUE.isInTestMode()) {
    //         seed = playerID;
    //     } else {
    //         seed = playerID * block.timestamp;
    //     }
    // }

    // function getRollSeeds(uint256 playerID, uint256 numSeeds)
    //     public
    //     view
    //     returns (uint256[] memory seeds)
    // {
    //     seeds = new uint256[](numSeeds);
    //     if (QUEUE.isInTestMode()) {
    //         for (uint256 i = 0; i < numSeeds; i++) {
    //             seeds[i] = playerID + i;
    //         }
    //     } else {
    //         for (uint256 i = 0; i < numSeeds; i++) {
    //             seeds[i] = (playerID + (4 * playerID)) * i * block.timestamp;
    //         }
    //     }
    // }
}
