// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./math/SafeAdd.sol";

/*
Process Mode flags

The process mode defines how the process behaves externally. It affects both the Vochain, the contract itself and even the metadata.
0x00011111
     |||||
     ||||`- autoStart
     |||`-- interruptible
     ||`--- dynamicCensus
     |`---- allowVoteOverride
     `----- encryptedMetadata
*/

/*
Envelope Type flags

The envelope type tells how the vote envelope will be formatted and handled. Its value is generated by combining the flags below.
0x00000111
       |||
       ||`- serial
       |`-- anonymous
       `--- encryptedVote
*/

contract VotingProcess {
    // CONSTANTS AND ENUMS

    // Process Mode flags
    uint8 constant MODE_AUTO_START = 1 << 0;
    uint8 constant MODE_INTERRUPTIBLE = 1 << 1;
    uint8 constant MODE_DYNAMIC_CENSUS = 1 << 2;
    uint8 constant MODE_ALLOW_VOTE_OVERWRITE = 1 << 3;
    uint8 constant MODE_ENCRYPTED_METADATA = 1 << 4;

    // Envelope Type flags
    uint8 constant ENV_TYPE_SERIAL = 1 << 0;
    uint8 constant ENV_TYPE_ANONYMOUS = 1 << 1;
    uint8 constant ENV_TYPE_ENCRYPTED_VOTE = 1 << 2;

    // Process status
    enum Status {OPEN, ENDED, CANCELED, PAUSED}

    // LIBRARIES

    using SafeAdd for uint8;

    // GLOBAL DATA

    address contractOwner; // See `onlyContractOwner`
    string[] validators; // Public key array
    address[] oracles; // Address array. See `onlyContractOwner`
    string genesis; // Content Hashed URI
    uint256 chainId;

    // DATA STRUCTS

    struct Process {
        uint8 mode; // The selected process mode. See: https://vocdoni.io/docs/#/architecture/components/process
        uint8 envelopeType; // One of valid envelope types, see: https://vocdoni.io/docs/#/architecture/components/process
        address entityAddress; // The Ethereum address of the Entity
        uint64 startBlock; // Tendermint block number on which the voting process starts
        uint32 blockCount; // Amount of Tendermint blocks during which the voting process should be active
        string metadata; // Content Hashed URI of the JSON meta data (See Data Origins)
        string censusMerkleRoot; // Hex string with the Merkle Root hash of the census
        string censusMerkleTree; // Content Hashed URI of the exported Merkle Tree (not including the public keys)
        Status status; // One of 0 [open], 1 [ended], 2 [canceled], 3 [paused]
        uint8 questionIndex; // The index of the currently active question (only assembly processes)
        // How many choices should be on every question.
        // questionCount >= 1
        uint8 questionCount;
        // Determines the acceptable value range.
        // N => valid votes will range from 1 to N (inclusive)
        uint8 maxValue;
        // Choices for a question cannot appear twice or more
        bool uniqueValues;
        // Limits up to how much cost, the values of a vote can add up to (if applicable).
        // 0 => No limit / Not applicable
        uint16 maxTotalCost;
        // Defines the exponent that will be used to compute the "cost" of the options voted and compare it against `maxTotalCost`.
        // totalCost = Σ (value[i] ** costExponent) <= maxTotalCost
        //
        // Exponent range:
        // - 0 => 0.0000
        // - 65535 => 6.5535
        uint16 costExponent;
        uint8 maxVoteOverwrites; // How many times a vote can be replaced (only the last counts)
        bytes32 paramsSignature; // entity.sign({...}) // fields that the oracle uses to authentify process creation
        // Self-assign to a certain namespace.
        // This will determine the oracles that listen and react to it.
        // Indirectly, it will also determine the Vochain that hosts this process.
        uint16 namespace;
        string results; // string containing the results
    }

    // PER-PROCESS DATA

    Process[] public processes; // Array of processes. Index [0] is reserved (see setResults)
    mapping(bytes32 => uint256) processesIndex; // Mapping between processId's and their index in `processes[]`
    mapping(address => uint256) public entityProcessCount; // Index of the last process for each entity address

    // EVENTS

    event GenesisUpdated(string genesis);
    event ChainIdUpdated(uint256 chainId);
    event ProcessCreated(
        address indexed entityAddress,
        bytes32 processId,
        string merkleTree
    );
    event StatusUpdated(
        address indexed entityAddress,
        bytes32 processId,
        uint8 status
    );
    event CensusUpdated(address indexed entityAddress, bytes32 processId);
    event ValidatorAdded(string validatorPublicKey);
    event ValidatorRemoved(string validatorPublicKey);
    event OracleAdded(address oracleAddress);
    event OracleRemoved(address oracleAddress);
    event QuestionIndexIncremented(
        address indexed entityAddress,
        bytes32 processId,
        uint8 newIndex
    );
    event ResultsUpdated(bytes32 indexed processId, string results);

    // MODIFIERS

    modifier onlyEntity(bytes32 processId) {
        uint256 processIdx = getProcessIndex(processId);
        require(
            processes[processIdx].entityAddress == msg.sender,
            "Invalid entity"
        );
        _;
    }

    modifier onlyContractOwner {
        require(msg.sender == contractOwner, "Only contract owner");
        _;
    }

    modifier onlyOracle {
        bool authorized = false;
        for (uint256 i = 0; i < oracles.length; i++) {
            if (msg.sender == oracles[i]) {
                authorized = true;
                break;
            }
        }
        require(authorized == true, "unauthorized");
        _;
    }

    // HELPERS

    function getEntityProcessCount(address entityAddress)
        public
        view
        returns (uint256)
    {
        return entityProcessCount[entityAddress];
    }

    // Get the next process ID to use for an entity
    function getNextProcessId(address entityAddress)
        public
        view
        returns (bytes32)
    {
        uint256 idx = getEntityProcessCount(entityAddress);
        return getProcessId(entityAddress, idx);
    }

    // Compute a process ID
    function getProcessId(address entityAddress, uint256 processCountIndex)
        public
        view
        returns (bytes32)
    {
        return
            keccak256(
                abi.encodePacked(
                    entityAddress,
                    processCountIndex,
                    genesis,
                    chainId
                )
            );
    }

    function getProcessIndex(bytes32 processId) public view returns (uint256) {
        return processesIndex[processId];
    }

    function equalStrings(string memory str1, string memory str2)
        public
        pure
        returns (bool)
    {
        return
            keccak256(abi.encodePacked((str1))) ==
            keccak256(abi.encodePacked((str2)));
    }

    function isValidator(string memory validatorPublicKey)
        public
        view
        returns (bool)
    {
        for (uint256 i = 0; i < validators.length; i++) {
            if (equalStrings(validators[i], validatorPublicKey)) {
                return true;
            }
        }
        return false;
    }

    function isOracle(address oracleAddress) public view returns (bool) {
        for (uint256 i = 0; i < oracles.length; i++) {
            if (oracles[i] == oracleAddress) {
                return true;
            }
        }
        return false;
    }

    // GLOBAL METHODS

    constructor(uint256 chainIdValue) public {
        contractOwner = msg.sender;
        chainId = chainIdValue;

        // Create an empty process at index 0.
        // This way, existing processes will always have a positive index on processesIndex.
        // See `setResults`
        Process memory process = Process({
            mode: 0,
            envelopeType: 0,
            entityAddress: address(0x0),
            startBlock: 0,
            blockCount: 0,
            metadata: "",
            censusMerkleRoot: "",
            censusMerkleTree: "",
            status: Status.CANCELED,
            questionIndex: 0,
            questionCount: 0,
            maxValue: 0,
            uniqueValues: false,
            maxTotalCost: 0,
            costExponent: 0,
            maxVoteOverwrites: 0,
            paramsSignature: 0,
            namespace: 0,
            results: ""
        });
        processes.push(process); // Take the [0] index
    }

    function setGenesis(string memory newValue) public onlyContractOwner {
        require(
            equalStrings(genesis, newValue) == false,
            "Genesis is the same"
        );

        genesis = newValue;

        emit GenesisUpdated(genesis);
    }

    function getGenesis() public view returns (string memory) {
        return genesis;
    }

    function setChainId(uint256 newValue) public onlyContractOwner {
        require(chainId != newValue, "chainId is the same");
        chainId = newValue;

        emit ChainIdUpdated(chainId);
    }

    function getChainId() public view returns (uint256) {
        return chainId;
    }

    function addValidator(string memory validatorPublicKey)
        public
        onlyContractOwner
    {
        require(
            isValidator(validatorPublicKey) == false,
            "Validator already exists"
        );
        validators.push(validatorPublicKey);

        emit ValidatorAdded(validatorPublicKey);
    }

    function removeValidator(uint256 idx, string memory validatorPublicKey)
        public
        onlyContractOwner
    {
        require(
            equalStrings(validators[idx], validatorPublicKey),
            "Validator to remove does not match index"
        );
        // swap with the last element from the list
        validators[idx] = validators[validators.length - 1];
        validators.pop();

        emit ValidatorRemoved(validatorPublicKey);
    }

    function getValidators() public view returns (string[] memory) {
        return validators;
    }

    function addOracle(address oracleAddress) public onlyContractOwner {
        require(isOracle(oracleAddress) == false, "Oracle already exists");
        oracles.push(oracleAddress);

        emit OracleAdded(oracleAddress);
    }

    function removeOracle(uint256 idx, address oracleAddress)
        public
        onlyContractOwner
    {
        require(idx < oracles.length, "Invalid index");
        require(
            oracles[idx] == oracleAddress,
            "Oracle to remove does not match index"
        );

        // swap with the last element from the list
        oracles[idx] = oracles[oracles.length - 1];
        oracles.pop();

        emit OracleRemoved(oracleAddress);
    }

    function getOracles() public view returns (address[] memory) {
        return oracles;
    }

    // ENTITY METHODS

    function create(
        uint8 mode,
        uint8 envelopeType,
        string memory metadata,
        string memory merkleRoot,
        string memory merkleTree,
        uint64 startBlock,
        uint32 blockCount,
        uint8 questionCount,
        uint8 maxValue,
        bool uniqueValues,
        uint16 maxTotalCost,
        uint16 costExponent,
        uint8 maxVoteOverwrites,
        bytes32 paramsSignature,
        uint16 namespace
    ) public {
        require(bytes(metadata).length > 0, "Empty metadata");
        require(bytes(merkleRoot).length > 0, "Empty merkleRoot");
        require(bytes(merkleTree).length > 0, "Empty merkleTree");
        require(questionCount > 0, "Empty questionCount");
        require(maxValue > 0, "Empty maxValue");
        if (mode & MODE_AUTO_START != 0) {
            require(startBlock > 0, "AUTO_START requires startBlock > 0");
        }

        address entityAddress = msg.sender;
        bytes32 processId = getNextProcessId(entityAddress);

        // by default status is OPEN
        uint8 status = uint8(Status.OPEN);
        if (mode & MODE_AUTO_START != 0) {
            // by default on-demand processes status is PAUSED
            status = uint8(Status.PAUSED);
        }

        Process memory process = Process({
            mode: mode,
            envelopeType: envelopeType,
            entityAddress: entityAddress,
            startBlock: startBlock,
            blockCount: blockCount,
            metadata: metadata,
            censusMerkleRoot: merkleRoot,
            censusMerkleTree: merkleTree,
            status: Status(status),
            questionIndex: 0,
            questionCount: questionCount,
            maxValue: maxValue,
            uniqueValues: uniqueValues,
            maxTotalCost: maxTotalCost,
            costExponent: costExponent,
            maxVoteOverwrites: maxVoteOverwrites,
            paramsSignature: paramsSignature,
            namespace: namespace,
            results: ""
        });

        processesIndex[processId] = processes.length; // N - 1 after the entry is pushed to the processes list
        processes.push(process);
        entityProcessCount[entityAddress]++;

        emit ProcessCreated(entityAddress, processId, merkleTree);
    }

    function get(bytes32 processId)
        public
        view
        returns (
            uint8 mode,
            uint8 envelopeType,
            address entityAddress,
            uint64 startBlock,
            uint32 blockCount,
            string memory metadata,
            string memory censusMerkleRoot,
            string memory censusMerkleTree,
            uint8 status,
            uint8 questionIndex,
            uint8 questionCount,
            uint8 maxValue,
            bool uniqueValues,
            uint16 maxTotalCost,
            uint16 costExponent,
            uint8 maxVoteOverwrites,
            bytes32 paramsSignature,
            uint16 namespace
        )
    {
        uint256 processIndex = getProcessIndex(processId);
        require(processIndex > 0, "Process not found");

        mode = processes[processIndex].mode;
        envelopeType = processes[processIndex].envelopeType;
        entityAddress = processes[processIndex].entityAddress;
        startBlock = processes[processIndex].startBlock;
        blockCount = processes[processIndex].blockCount;
        metadata = processes[processIndex].metadata;
        censusMerkleRoot = processes[processIndex].censusMerkleRoot;
        censusMerkleTree = processes[processIndex].censusMerkleTree;
        status = uint8(processes[processIndex].status);
        questionIndex = processes[processIndex].questionIndex;
        questionCount = processes[processIndex].questionCount;
        maxValue = processes[processIndex].maxValue;
        uniqueValues = processes[processIndex].uniqueValues;
        maxTotalCost = processes[processIndex].maxTotalCost;
        costExponent = processes[processIndex].costExponent;
        maxVoteOverwrites = processes[processIndex].maxVoteOverwrites;
        paramsSignature = processes[processIndex].paramsSignature;
        namespace = processes[processIndex].namespace;
    }

    function setStatus(bytes32 processId, uint8 newStatus)
        public
        onlyEntity(processId)
    {
        require(
            newStatus >= uint8(Status.OPEN) &&
                newStatus <= uint8(Status.PAUSED),
            "Invalid status code"
        );

        uint256 processIndex = getProcessIndex(processId);

        // processId is guaranteed to exist since onlyEntity(processId) enforces that
        // such process has been created by msg.sender

        require(
            processes[processIndex].mode & MODE_INTERRUPTIBLE != 0,
            "Process not interruptible"
        );

        // check status code and conditions for changing it
        if (newStatus == uint8(Status.OPEN)) {
            require(
                processes[processIndex].status == Status.PAUSED,
                "Process not paused"
            );
        } else if (
            newStatus == uint8(Status.ENDED) ||
            newStatus == uint8(Status.CANCELED)
        ) {
            require(
                processes[processIndex].status == Status.OPEN ||
                    processes[processIndex].status == Status.PAUSED,
                "Already ended or canceled"
            );
        } else if (newStatus == uint8(Status.PAUSED)) {
            require(
                processes[processIndex].status == Status.OPEN,
                "Process not open"
            );
        }

        processes[processIndex].status = Status(newStatus);

        emit StatusUpdated(msg.sender, processId, newStatus);
    }

    function incrementQuestionIndex(bytes32 processId)
        public
        onlyEntity(processId)
    {
        uint256 processIndex = getProcessIndex(processId);

        // processId is guaranteed to exist since onlyEntity(processId) enforces that
        // such process has been created by msg.sender

        require(
            processes[processIndex].status == Status.OPEN ||
                processes[processIndex].status == Status.PAUSED,
            "Process not active"
        );
        require(
            processes[processIndex].envelopeType & ENV_TYPE_SERIAL != 0,
            "Process is not SERIAL"
        );

        uint8 nextIdx = processes[processIndex].questionIndex.add8(1);

        if (nextIdx < processes[processIndex].questionCount) {
            processes[processIndex].questionIndex = nextIdx;

            emit QuestionIndexIncremented(msg.sender, processId, nextIdx);
        } else {
            // End the process if already at the last questionIndex
            setStatus(processId, uint8(Status.ENDED));
        }
    }

    function setCensus(
        bytes32 processId,
        string memory censusMerkleRoot,
        string memory censusMerkleTree
    ) public onlyEntity(processId) {
        require(bytes(censusMerkleRoot).length > 0, "Empty Merkle Root");
        require(bytes(censusMerkleTree).length > 0, "Empty Merkle Tree");

        uint256 processIndex = getProcessIndex(processId);

        // processId is guaranteed to exist since onlyEntity(processId) enforces that
        // such process has been created by msg.sender

        require(
            processes[processIndex].status == Status.OPEN ||
                processes[processIndex].status == Status.PAUSED,
            "Process not active"
        );
        require(
            processes[processIndex].mode & MODE_DYNAMIC_CENSUS != 0,
            "Read-only census"
        );

        processes[processIndex].censusMerkleRoot = censusMerkleRoot;
        processes[processIndex].censusMerkleTree = censusMerkleTree;

        emit CensusUpdated(msg.sender, processId);
    }

    function setResults(bytes32 processId, string memory results)
        public
        onlyOracle
    {
        require(bytes(results).length > 0, "Empty results");

        uint256 processIndex = getProcessIndex(processId);
        require(processIndex > 0, "Process not found");

        require(
            processes[processIndex].entityAddress != address(0x0),
            "Empty process"
        );

        // cannot publish results of a canceled process
        require(
            processes[processIndex].status != Status.CANCELED,
            "Process is canceled"
        );
        // results can only be published once
        require(
            bytes(processes[processIndex].results).length == 0,
            "Results already set"
        );

        processes[processIndex].results = results;

        emit ResultsUpdated(processId, results);
    }

    function getResults(bytes32 processId)
        public
        view
        returns (string memory results)
    {
        uint256 processIndex = getProcessIndex(processId);
        require(processIndex > 0, "Process not found");

        results = processes[processIndex].results;
    }
}
