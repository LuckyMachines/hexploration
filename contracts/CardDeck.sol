// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.34;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";

contract CardDeck is AccessControlEnumerable {
    // This is an infinite deck, cards drawn are not removed from deck
    // We can set card "quantities" for desireable probability

    // controller role should be set to a controller contract
    // not used by default, provided if going to make custom deck with limited access
    bytes32 public constant CONTROLLER_ROLE = keccak256("CONTROLLER_ROLE");

    string[] private _cards;

    // mappings from card name
    // should all store same size array of values, even if empty
    mapping(string => string) public description;
    mapping(string => uint16) public quantity;
    mapping(string => int8[3]) public movementAdjust;
    mapping(string => int8[3]) public agilityAdjust;
    mapping(string => int8[3]) public dexterityAdjust;
    mapping(string => string[3]) public itemGain;
    mapping(string => string[3]) public itemLoss;
    mapping(string => string[3]) public handLoss; // ["Left", "Right", ""];
    mapping(string => int256[3]) public movementX;
    mapping(string => int256[3]) public movementY;
    mapping(string => uint256[3]) public rollThresholds; // [0, 3, 4] what to roll to receive matching index of mapping
    mapping(string => string[3]) public outcomeDescription;
    mapping(string => uint256) public rollTypeRequired; // 0 = movement, 1 = agility, 2 = dexterity, 3 = none

    // buffs that don't require a roll
    mapping(string => int8) public movementBuff;
    mapping(string => int8) public agilityBuff;
    mapping(string => int8) public dexterityBuff;
    mapping(string => int8) public digOddsBuff;
    mapping(string => int8) public combatBuff;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    // this function does not provide randomness,
    // passing the same random word will yield the same draw.
    // randomness should come from controller

    // Choose a card from the deck, pass roll values though some cards may not require them
    function chooseCard(
        string memory cardName,
        uint256[3] memory rollValues
    )
        public
        view
        virtual
        returns (
            string memory _card,
            int8 _movementAdjust,
            int8 _agilityAdjust,
            int8 _dexterityAdjust,
            string memory _itemLoss,
            string memory _itemGain,
            string memory _handLoss,
            string memory _outcomeDescription
        )
    {
        uint256 rollType = rollTypeRequired[cardName];
        uint256 rollValue = rollValues[rollType];
        uint256[3] memory thresholds = rollThresholds[cardName];
        uint256 rollIndex = 0;
        for (uint256 i = thresholds.length - 1; i >= 0; i--) {
            if (rollValue >= thresholds[i]) {
                rollIndex = i;
                break;
            }
            if (i == 0) {
                break;
            }
        }
        _card = cardName;
        _movementAdjust = movementAdjust[cardName][rollIndex];
        _agilityAdjust = agilityAdjust[cardName][rollIndex];
        _dexterityAdjust = dexterityAdjust[cardName][rollIndex];
        _itemLoss = itemLoss[cardName][rollIndex];
        _itemGain = itemGain[cardName][rollIndex];
        _handLoss = handLoss[cardName][rollIndex];
        _outcomeDescription = outcomeDescription[cardName][rollIndex];
    }

    // Draws card with randomness
    // pass along movement, agility, dexterity rolls - will use whatever is appropriate
    function drawCard(
        uint256 randomWord,
        uint256[3] memory rollValues
    )
        public
        view
        virtual
        returns (
            string memory _card,
            int8 _movementAdjust,
            int8 _agilityAdjust,
            int8 _dexterityAdjust,
            string memory _itemLoss,
            string memory _itemGain,
            string memory _handLoss,
            string memory _outcomeDescription
        )
    {
        uint256 cardIndex = randomWord % _cards.length;
        string memory card = _cards[cardIndex];
        return chooseCard(card, rollValues);
    }

    function getDeck() public view returns (string[] memory) {
        return _cards;
    }

    // Admin Functions
    function addCards(
        string[] memory titles,
        string[] memory descriptions,
        uint16[] memory quantities
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            titles.length == descriptions.length &&
                titles.length == quantities.length,
            "array quantity mismatch"
        );
        for (uint256 i = 0; i < titles.length; i++) {
            // only add if not already added and set quantity is not 0
            string memory title = titles[i];
            if (quantity[title] == 0 && quantities[i] != 0) {
                _cards.push(title);
                description[title] = descriptions[i];
                quantity[title] = quantities[i];
            }
        }
    }

    function addCardsWithItemGains(
        string[] memory titles,
        string[] memory descriptions,
        uint16[] memory quantities,
        string[3][] memory itemGains,
        string[3][] memory itemLosses,
        string[3][] memory outcomeDescriptions
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            titles.length == descriptions.length &&
                titles.length == quantities.length,
            "array quantity mismatch"
        );
        for (uint256 i = 0; i < titles.length; i++) {
            // only add if not already added and set quantity is not 0
            string memory title = titles[i];
            if (quantity[title] == 0 && quantities[i] != 0) {
                _cards.push(title);
                description[title] = descriptions[i];
                quantity[title] = quantities[i];
                itemGain[title] = itemGains[i];
                itemLoss[title] = itemLosses[i];
                outcomeDescription[title] = outcomeDescriptions[i];
            }
        }
    }

    function addCardsWithStatAdjustments(
        string[] memory titles,
        string[] memory descriptions,
        uint16[] memory quantities,
        uint256[3][] memory rollThresholdValues,
        string[3][] memory outcomeDescriptions,
        int8[3][] memory movementAdjustments,
        int8[3][] memory agilityAdjustments,
        int8[3][] memory dexterityAdjustments,
        uint256[] memory rollTypesRequired
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            titles.length == descriptions.length &&
                titles.length == quantities.length,
            "array quantity mismatch"
        );
        for (uint256 i = 0; i < titles.length; i++) {
            // only add if not already added and set quantity is not 0
            string memory title = titles[i];
            if (quantity[title] == 0 && quantities[i] != 0) {
                _cards.push(title);
                description[title] = descriptions[i];
                quantity[title] = quantities[i];
                rollThresholds[title] = rollThresholdValues[i];
                outcomeDescription[title] = outcomeDescriptions[i];
                movementAdjust[title] = movementAdjustments[i];
                agilityAdjust[title] = agilityAdjustments[i];
                dexterityAdjust[title] = dexterityAdjustments[i];
                rollTypeRequired[title] = rollTypesRequired[i];
            }
        }
    }

    function addCardsWithStatBuffs(
        string[] memory titles,
        string[] memory descriptions,
        uint16[] memory quantities,
        int8[] memory movementBuffs,
        int8[] memory agilityBuffs,
        int8[] memory dexterityBuffs,
        int8[] memory digOddsBuffs,
        int8[] memory combatBuffs
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            titles.length == descriptions.length &&
                titles.length == quantities.length,
            "array quantity mismatch"
        );
        for (uint256 i = 0; i < titles.length; i++) {
            // only add if not already added and set quantity is not 0
            string memory title = titles[i];
            if (quantity[title] == 0 && quantities[i] != 0) {
                _cards.push(title);
                description[title] = descriptions[i];
                quantity[title] = quantities[i];
                movementBuff[title] = movementBuffs[i];
                agilityBuff[title] = agilityBuffs[i];
                dexterityBuff[title] = dexterityBuffs[i];
                digOddsBuff[title] = digOddsBuffs[i];
                combatBuff[title] = combatBuffs[i];
            }
        }
    }

    function setDescription(
        string memory _description,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        description[_cardName] = _description;
    }

    function setQuantity(
        uint16 _quantity,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        quantity[_cardName] = _quantity;
    }

    function setMovementAdjust(
        int8[3] memory _movementAdjust,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        movementAdjust[_cardName] = _movementAdjust;
    }

    function setAgilityAdjust(
        int8[3] memory _agilityAdjust,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        agilityAdjust[_cardName] = _agilityAdjust;
    }

    function setDexterityAdjust(
        int8[3] memory _dexterityAdjust,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        dexterityAdjust[_cardName] = _dexterityAdjust;
    }

    function setMovementBuff(
        int8 _buffValue,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        movementBuff[_cardName] = _buffValue;
    }

    function setAgilityBuff(
        int8 _buffValue,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        agilityBuff[_cardName] = _buffValue;
    }

    function setDexterityBuff(
        int8 _buffValue,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        dexterityBuff[_cardName] = _buffValue;
    }

    function setDigOddsBuff(
        int8 _buffValue,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        digOddsBuff[_cardName] = _buffValue;
    }

    function setCombatBuff(
        int8 _buffValue,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        combatBuff[_cardName] = _buffValue;
    }

    function setItemGain(
        string[3] memory _itemGain,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        itemGain[_cardName] = _itemGain;
    }

    function setItemLoss(
        string[3] memory _itemLoss,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        itemLoss[_cardName] = _itemLoss;
    }

    function setHandLoss(
        string[3] memory _handLoss,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        //["Left","Left","Right"];
        // or ["", "", "Right"];
        handLoss[_cardName] = _handLoss;
    }

    function setMovementX(
        int256[3] memory _movementX,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        movementX[_cardName] = _movementX;
    }

    function setMovementY(
        int256[3] memory _movementY,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        movementY[_cardName] = _movementY;
    }

    function setRollThresholds(
        uint256[3] memory _rollThresholds,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        rollThresholds[_cardName] = _rollThresholds;
    }

    function setOutcomeDescription(
        string[3] memory _outcomeDescription,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        outcomeDescription[_cardName] = _outcomeDescription;
    }

    function setRollTypeRequired(
        uint256 _rollTypeRequired,
        string memory _cardName
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        rollTypeRequired[_cardName] = _rollTypeRequired;
    }

    function changeCardTitle(
        string memory originalTitle,
        string memory newTitle
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        int8[3] memory resetInt8x3 = [int8(0), int8(0), int8(0)];
        int256[3] memory resetInt256x3 = [int256(0), int256(0), int256(0)];

        description[newTitle] = description[originalTitle];
        description[originalTitle] = "";

        quantity[newTitle] = quantity[originalTitle];
        quantity[originalTitle] = 0;

        movementAdjust[newTitle] = movementAdjust[originalTitle];
        movementAdjust[originalTitle] = resetInt8x3;

        agilityAdjust[newTitle] = agilityAdjust[originalTitle];
        agilityAdjust[originalTitle] = resetInt8x3;

        dexterityAdjust[newTitle] = dexterityAdjust[originalTitle];
        dexterityAdjust[originalTitle] = resetInt8x3;

        itemGain[newTitle] = itemGain[originalTitle];
        itemGain[originalTitle] = ["", "", ""];

        itemLoss[newTitle] = itemLoss[originalTitle];
        itemLoss[originalTitle] = ["", "", ""];

        handLoss[newTitle] = handLoss[originalTitle];
        handLoss[originalTitle] = ["", "", ""];

        movementX[newTitle] = movementX[originalTitle];
        movementX[originalTitle] = resetInt256x3;

        movementY[newTitle] = movementY[originalTitle];
        movementY[originalTitle] = resetInt256x3;

        rollThresholds[newTitle] = rollThresholds[originalTitle];
        rollThresholds[originalTitle] = [0, 0, 0];

        outcomeDescription[newTitle] = outcomeDescription[originalTitle];
        outcomeDescription[originalTitle] = ["", "", ""];

        rollTypeRequired[newTitle] = rollTypeRequired[originalTitle];
        rollTypeRequired[originalTitle] = 0;
    }

    /*
    mapping(string => uint256[3]) public rollThresholds; // [0, 3, 4] what to roll to receive matching index of mapping
    mapping(string => string[3]) public outcomeDescription;
    mapping(string => uint256) public rollTypeRequired;
    */
    function getDescription(
        string memory cardTitle
    ) public view returns (string memory) {
        return description[cardTitle];
    }

    function getQuantity(string memory cardTitle) public view returns (uint16) {
        return quantity[cardTitle];
    }

    function getMovementAdjust(
        string memory cardTitle
    ) public view returns (int8[3] memory) {
        return movementAdjust[cardTitle];
    }

    function getAgilityAdjust(
        string memory cardTitle
    ) public view returns (int8[3] memory) {
        return agilityAdjust[cardTitle];
    }

    function getDexterityAdjust(
        string memory cardTitle
    ) public view returns (int8[3] memory) {
        return dexterityAdjust[cardTitle];
    }

    function getItemGain(
        string memory cardTitle
    ) public view returns (string[3] memory) {
        return itemGain[cardTitle];
    }

    function getItemLoss(
        string memory cardTitle
    ) public view returns (string[3] memory) {
        return itemLoss[cardTitle];
    }

    function getHandLoss(
        string memory cardTitle
    ) public view returns (string[3] memory) {
        return handLoss[cardTitle];
    }

    function getMovementX(
        string memory cardTitle
    ) public view returns (int256[3] memory) {
        return movementX[cardTitle];
    }

    function getMovementY(
        string memory cardTitle
    ) public view returns (int256[3] memory) {
        return movementY[cardTitle];
    }

    function getRollThresholds(
        string memory cardTitle
    ) public view returns (uint256[3] memory) {
        return rollThresholds[cardTitle];
    }

    function getOutcomeDescription(
        string memory cardTitle
    ) public view returns (string[3] memory) {
        return outcomeDescription[cardTitle];
    }

    function getRollTypeRequired(
        string memory cardTitle
    ) public view returns (uint256) {
        return rollTypeRequired[cardTitle];
    }
}
