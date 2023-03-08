// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.7.0 <0.9.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

interface IStringToUint {
    function stringToUint(string calldata s)
        external
        pure
        returns (uint256 result);
}

// Band VRF Provider
interface IBandVRFProvider {
    function requestRandomData(string calldata seed) external payable;
}

interface IBandVRFConsumer {
    function consume(
        string calldata seed,
        uint64 time,
        bytes32 result
    ) external;
}

contract RandomnessConsumer is
    AccessControlEnumerable,
    VRFConsumerBaseV2,
    IBandVRFConsumer
{
    // String to Uint utility
    IStringToUint STRING_TO_UINT;

    // Chainlink
    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);

    VRFCoordinatorV2Interface COORDINATOR;
    uint64 subscriptionId;

    bytes32 keyHash;
    uint32 callbackGasLimit = 2500000;
    uint16 requestConfirmations = 3;

    // Band VRF
    event BandRequestSent(uint256 requestId);
    IBandVRFProvider public BAND_PROVIDER;
    uint256 bandID; // for creating unique IDs for band requests
    uint256 bandFee; // amount to send with each request

    // Universal
    struct RequestStatus {
        bool fulfilled; // whether the request has been successfully fulfilled
        bool exists; // whether a requestId exists
        uint256[] randomWords;
        string seed; // seed used if band request
        uint64 time; // time fulfilled if band request
    }
    // Mappings from request ID
    mapping(uint256 => RequestStatus) public randomnessRequests; /* requestId --> requestStatus */
    mapping(uint256 => uint256) public ids;
    mapping(uint256 => address) public addresses;
    // mapping(uint256 => uint256) public gameIDs;
    // mapping(uint256 => address) public gameBoardAddresses;

    // Mappings from game ID
    mapping(uint256 => uint256) public requestIDs;
    mapping(uint256 => bool) idExists;

    // past requests Id.
    uint256[] public requestIDHistory;
    uint256 public lastRequestId;

    // Mock Requests
    uint256[] mockRequests;
    uint256 mockID;

    // Settings
    uint32 numWords = 1;

    bool public useBandVRF;
    bool public useChainlinkVRF;
    bool public testingEnabled; // for manually sending randomness
    bool public useMockVRF; // for testing on local network

    constructor(
        uint64 _vrfSubscriptionID,
        address _vrfCoordinator,
        bytes32 _vrfKeyHash,
        address _provider,
        address _stringToUint
    ) VRFConsumerBaseV2(_vrfCoordinator) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        if (_vrfKeyHash == 0 && _provider == address(0)) {
            useMockVRF = true;
        }
        STRING_TO_UINT = IStringToUint(_stringToUint);
        COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
        subscriptionId = _vrfSubscriptionID;
        keyHash = _vrfKeyHash;
        BAND_PROVIDER = IBandVRFProvider(_provider);
        useChainlinkVRF = true; // default to chainlink
    }

    receive() external payable {}

    function setVRFSubscriptionID(uint64 _subscriptionID)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        subscriptionId = _subscriptionID;
        useMockVRF = subscriptionId == 0;
    }

    function setTestingEnabled(bool enabled)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _setTestingEnabled(enabled);
    }

    // Chainlink

    function requestRandomnessFromChainlink(uint256 id, address _address)
        internal
        returns (uint256 requestId)
    {
        // Will revert if subscription is not set and funded.
        requestId = COORDINATOR.requestRandomWords(
            keyHash,
            subscriptionId,
            requestConfirmations,
            callbackGasLimit,
            numWords
        );
        randomnessRequests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false,
            seed: "",
            time: 0
        });
        idExists[requestId] = true;
        ids[requestId] = id;
        addresses[requestId] = _address;
        requestIDs[id] = requestId;
        requestIDHistory.push(requestId);
        lastRequestId = requestId;
        emit RequestSent(requestId, numWords);
        // return requestId;
    }

    // Contracts that inherit from this should override + call super function then custom stuff...
    function fulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) internal override {
        fulfillRandomness(
            _requestId,
            _randomWords,
            "",
            uint64(block.timestamp)
        );
    }

    // Band
    function requestRandomnessFromBand(uint256 id, address _address)
        internal
        returns (uint256 requestId)
    {
        bool canUseID = false;
        while (!canUseID) {
            ++bandID;
            if (!idExists[bandID]) {
                canUseID = true;
                requestId = bandID;
            }
        }
        idExists[requestId] = true;

        string memory seed = Strings.toString(requestId);
        BAND_PROVIDER.requestRandomData{value: bandFee}(seed);

        randomnessRequests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false,
            seed: seed,
            time: 0
        });
        idExists[requestId] = true;
        ids[requestId] = id;
        addresses[requestId] = _address;
        requestIDs[id] = requestId;
        requestIDHistory.push(requestId);
        lastRequestId = requestId;
        emit BandRequestSent(requestId);
    }

    function consume(
        string calldata seed,
        uint64 time,
        bytes32 result
    ) external {
        require(
            msg.sender == address(BAND_PROVIDER),
            "Caller is not the provider"
        );

        uint256 idFromString = STRING_TO_UINT.stringToUint(seed);

        // expand random number into as many numbers as requested...
        uint256[] memory randomness = new uint256[](numWords);
        for (uint256 i = 0; i < numWords; i++) {
            randomness[i] = uint256(keccak256(abi.encode(result, i)));
        }

        fulfillRandomness(idFromString, randomness, seed, time);
    }

    // Testing
    function testRequestRandomWords(uint256 id, address _address)
        internal
        returns (uint256 requestId)
    {
        requestId = id;
        randomnessRequests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false,
            seed: "",
            time: 0
        });
        ids[requestId] = id;
        addresses[requestId] = _address;
        requestIDs[id] = requestId;
        requestIDHistory.push(requestId);
        lastRequestId = requestId;
        emit RequestSent(requestId, numWords);
        // return requestId;
    }

    function testFulfillRandomWords(
        uint256 _requestId,
        uint256[] memory _randomWords
    ) public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        require(testingEnabled, "Not in test mode");
        require(randomnessRequests[_requestId].exists, "request not found");
        randomnessRequests[_requestId].fulfilled = true;
        randomnessRequests[_requestId].randomWords = _randomWords;
        emit RequestFulfilled(_requestId, _randomWords);
    }

    // Mock Randomness
    // Fulfilling mock request delivers unpredictable value, as opposed to test fulfill which fulfills with specified randomness
    function mockRequestRandomWords(uint256 id, address _address)
        internal
        returns (uint256 requestId)
    {
        ++mockID;
        requestId = mockID;
        ids[requestId] = id;
        addresses[requestId] = _address;
        requestIDs[id] = requestId;
        requestIDHistory.push(requestId);
        lastRequestId = requestId;
        uint256[] memory randomWords = new uint256[](numWords);
        for (uint256 i = 0; i < randomWords.length; i++) {
            randomWords[i] = uint256(
                keccak256(abi.encode(block.timestamp, mockID, i))
            );
        }
        randomnessRequests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false,
            seed: "",
            time: 0
        });
        mockRequests.push(requestId);
        emit RequestSent(requestId, numWords);
    }

    // fulfill all mock randomness requests
    function fulfillNextMockRandomness(uint256 randomness) public {
        require(useMockVRF, "Mock VRF not enabled");
        uint256 numZeros = 0;
        uint256 fulfillments = 0;
        if (mockRequests.length > 0) {
            for (uint256 i = 0; i < mockRequests.length; i++) {
                if (mockRequests[i] != 0) {
                    if (fulfillments == 0) {
                        uint256 requestId = mockRequests[i];
                        uint256[] memory randomWords = new uint256[](1);
                        randomWords[0] = randomness;
                        fulfillRandomWords(requestId, randomWords);
                        ++fulfillments;
                        delete mockRequests[i];
                        ++numZeros;
                        break;
                    }
                } else {
                    ++numZeros;
                }
            }
        }
        // cleanup zeros
        if (numZeros > 0) {
            uint256 position = 0;
            uint256[] memory zeroIndices = new uint256[](numZeros);
            for (uint256 i = 0; i < mockRequests.length; i++) {
                if (mockRequests[i] == 0) {
                    zeroIndices[position] = i;
                    ++position;
                }
            }
            for (uint256 i = 0; i < zeroIndices.length; i++) {
                uint256 zeroIndex = zeroIndices[i];
                for (uint256 j = zeroIndex; i < mockRequests.length - 1; i++) {
                    mockRequests[j] = mockRequests[j + 1];
                }
                mockRequests.pop();
            }
        }
    }

    function fulfillMockRandomness() public {
        require(useMockVRF, "Mock VRF not enabled");
        uint256 MAX_FULFILLMENTS = 4;
        uint256 numZeros = 0;
        uint256 fulfillments = 0;
        if (mockRequests.length > 0) {
            for (uint256 i = 0; i < mockRequests.length; i++) {
                if (mockRequests[i] != 0) {
                    if (fulfillments < MAX_FULFILLMENTS) {
                        uint256 requestId = mockRequests[i];
                        uint256[] memory randomWords = new uint256[](numWords);
                        for (uint256 j = 0; j < randomWords.length; j++) {
                            randomWords[j] = uint256(
                                keccak256(
                                    abi.encode(block.timestamp, mockID, j)
                                )
                            );
                        }
                        fulfillRandomWords(requestId, randomWords);
                        ++fulfillments;
                        delete mockRequests[i];
                        ++numZeros;
                    }
                } else {
                    ++numZeros;
                }
            }
        }
        // cleanup zeros
        if (numZeros > 0) {
            uint256 position = 0;
            uint256[] memory zeroIndices = new uint256[](numZeros);
            for (uint256 i = 0; i < mockRequests.length; i++) {
                if (mockRequests[i] == 0) {
                    zeroIndices[position] = i;
                    ++position;
                }
            }
            for (uint256 i = 0; i < zeroIndices.length; i++) {
                uint256 zeroIndex = zeroIndices[i];
                for (uint256 j = zeroIndex; i < mockRequests.length - 1; i++) {
                    mockRequests[j] = mockRequests[j + 1];
                }
                mockRequests.pop();
            }
        }
    }

    function getMockRequests() public view returns (uint256[] memory) {
        return mockRequests;
    }

    // Universal
    function fulfillRandomness(
        uint256 _requestId,
        uint256[] memory _randomness,
        string memory _seed,
        uint64 _time
    ) internal virtual {
        require(randomnessRequests[_requestId].exists, "request not found");
        randomnessRequests[_requestId].fulfilled = true;
        randomnessRequests[_requestId].randomWords = _randomness;
        randomnessRequests[_requestId].seed = _seed;
        randomnessRequests[_requestId].time = _time;
        emit RequestFulfilled(_requestId, _randomness);
    }

    function requestRandomness(uint256 id, address _address)
        internal
        returns (uint256 requestId)
    {
        if (useMockVRF) {
            requestId = mockRequestRandomWords(id, _address);
        } else if (useBandVRF) {
            requestId = requestRandomnessFromBand(id, _address);
        } else {
            // Chainlink
            requestId = requestRandomnessFromChainlink(id, _address);
        }
    }

    function getRequestStatus(uint256 _requestId)
        external
        view
        returns (bool fulfilled, uint256[] memory randomWords)
    {
        require(randomnessRequests[_requestId].exists, "request not found");
        RequestStatus memory request = randomnessRequests[_requestId];
        return (request.fulfilled, request.randomWords);
    }

    // internal
    function _setNumWords(uint32 numberOfWords) internal {
        numWords = numberOfWords;
    }

    function _setTestingEnabled(bool enabled) internal {
        testingEnabled = enabled;
    }

    // admin

    function setBandFee(uint256 amount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        bandFee = amount;
    }

    function useBand() public onlyRole(DEFAULT_ADMIN_ROLE) {
        useBandVRF = true;
        useChainlinkVRF = false;
    }

    function useChainlink() public onlyRole(DEFAULT_ADMIN_ROLE) {
        useBandVRF = false;
        useChainlinkVRF = true;
    }

    function withdraw(uint256 amount, address payable to)
        public
        virtual
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Failed to withdraw");
    }
}
