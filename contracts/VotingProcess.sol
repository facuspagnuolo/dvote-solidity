pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

contract VotingProcess {
    // GLOBAL STRUCTS

    struct Process {
        string processType; // One of: snark-vote, poll-vote, petition-sign
        address entityAddress; // The Ethereum address of the Entity
        uint256 startBlock; // Tendermint block number on which the voting process starts
        uint256 numberOfBlocks; // Amount of Tendermint blocks during which the voting process is active
        string metadata; // Content Hashed URI of the JSON meta data (See Data Origins)
        string censusMerkleRoot; // Hex string with the Merkle Root hash of the census
        string censusMerkleTree; // Content Hashed URI of the exported Merkle Tree (not including the public keys)
        string voteEncryptionPrivateKey; // Key published after the vote ends so that scrutiny can start
        bool canceled; // Can be used by organization to cancel the project
        uint32[][] results; // [ question1:[option1,option2], question2:[option1,option2], ...]
    }

    // GLOBAL DATA

    address contractOwner;
    string[] validators; // Public key array
    address[] oracles; // Public key array
    string genesis; // Content Hashed URI
    uint256 chainId;

    // PER-PROCESS DATA

    Process[] public processes; // Array of Process struct
    mapping(bytes32 => uint256) processesIndex; // Mapping of processIds with processess idx
    mapping(address => uint256) public entityProcessCount; // index of the last process for a given address

    // EVENTS

    event GenesisChanged(string genesis);
    event ChainIdChanged(uint256 chainId);
    event ProcessCreated(
        address indexed entityAddress,
        bytes32 processId,
        string merkleTree
    );
    event ProcessCanceled(address indexed entityAddress, bytes32 processId);
    event ValidatorAdded(string validatorPublicKey);
    event ValidatorRemoved(string validatorPublicKey);
    event OracleAdded(address oracleAddress);
    event OracleRemoved(address oracleAddress);
    event PrivateKeyPublished(bytes32 indexed processId, string privateKey);
    event ResultsPublished(bytes32 indexed processId, uint32[][] results);

    // MODIFIERS

    modifier onlyEntity(bytes32 processId) {
        uint256 processIdx = getProcessIndex(processId);
        require(
            processes[processIdx].entityAddress == msg.sender,
            "Invalid entity"
        );
        _;
    }

    modifier onlyOracle {
        for (uint256 i = 0; i < oracles.length; i++) {
            if (msg.sender == oracles[i]) {
                _;
                return;
            }
        }
        revert("unauthorized");
    }


    modifier onlyContractOwner() {
        require(msg.sender == contractOwner, "Only contract owner");
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

    // METHODS

    constructor(uint256 chainIdValue) public {
        contractOwner = msg.sender;
        chainId = chainIdValue;
    }

    function setGenesis(string memory newValue) public onlyContractOwner() {
        require(
            equalStrings(genesis, newValue) == false,
            "New genesis can't be the same"
        );

        genesis = newValue;

        emit GenesisChanged(genesis);
    }

    function getGenesis() public view returns (string memory) {
        return genesis;
    }

    function setChainId(uint256 newValue) public onlyContractOwner() {
        require(chainId != newValue, "New chainId can't be the same");
        chainId = newValue;

        emit ChainIdChanged(chainId);
    }

    function getChainId() public view returns (uint256) {
        return chainId;
    }

    function create(
        string memory processType,
        string memory metadata,
        string memory merkleRoot,
        string memory merkleTree,
        uint256 startBlock,
        uint256 numberOfBlocks
    ) public {
        require(bytes(metadata).length > 0, "Empty metadata");
        require(bytes(merkleRoot).length > 0, "Empty merkleRoot");
        require(bytes(merkleTree).length > 0, "Empty merkleTree");

        address entityAddress = msg.sender;
        bytes32 processId = getNextProcessId(entityAddress);
        // require(processesIndex[processId] == 0, "ProcessId already exists");

        Process memory process = Process({
            processType: processType,
            entityAddress: entityAddress,
            startBlock: startBlock,
            numberOfBlocks: numberOfBlocks,
            metadata: metadata,
            censusMerkleRoot: merkleRoot,
            censusMerkleTree: merkleTree,
            voteEncryptionPrivateKey: "",
            canceled: false,
            results: new uint32[][](0)
        });

        processes.push(process);
        processesIndex[processId] = processes.length - 1;
        entityProcessCount[entityAddress]++;

        emit ProcessCreated(entityAddress, processId, merkleTree);
    }

    function get(bytes32 processId)
        public
        view
        returns (
            string memory processType,
            address entityAddress,
            uint256 startBlock,
            uint256 numberOfBlocks,
            string memory metadata,
            string memory censusMerkleRoot,
            string memory censusMerkleTree,
            string memory voteEncryptionPrivateKey,
            bool canceled
        )
    {
        uint256 processIndex = processesIndex[processId];
        processType = processes[processIndex].processType;
        entityAddress = processes[processIndex].entityAddress;
        startBlock = processes[processIndex].startBlock;
        numberOfBlocks = processes[processIndex].numberOfBlocks;
        metadata = processes[processIndex].metadata;
        censusMerkleRoot = processes[processIndex].censusMerkleRoot;
        censusMerkleTree = processes[processIndex].censusMerkleTree;
        voteEncryptionPrivateKey = processes[processIndex]
            .voteEncryptionPrivateKey;
        canceled = processes[processIndex].canceled;
    }

    function cancel(bytes32 processId) public onlyEntity(processId) {
        uint256 processIndex = getProcessIndex(processId);
        require(
            processes[processIndex].canceled == false,
            "Process must not be canceled"
        );

        processes[processIndex].canceled = true;

        emit ProcessCanceled(msg.sender, processId);
    }

    function addValidator(string memory validatorPublicKey)
        public
        onlyContractOwner()
    {
        validators.push(validatorPublicKey);

        emit ValidatorAdded(validatorPublicKey);
    }

    function removeValidator(uint256 idx, string memory validatorPublicKey)
        public
        onlyContractOwner()
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

    function addOracle(address oracleAddress)
        public
        onlyContractOwner()
    {
        oracles.push(oracleAddress);

        emit OracleAdded(oracleAddress);
    }

    function removeOracle(uint256 idx, address oracleAddress)
        public
        onlyContractOwner()
    {
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

    function publishPrivateKey(bytes32 processId, string memory privateKey)
        public
        onlyOracle()
    {
        uint256 processIndex = getProcessIndex(processId);
        require(
            processes[processIndex].canceled == false,
            "Process must not be canceled"
        );

        processes[processIndex].voteEncryptionPrivateKey = privateKey;

        emit PrivateKeyPublished(processId, privateKey);
    }

    function getPrivateKey(bytes32 processId)
        public
        view
        returns (string memory privateKey)
    {
        uint256 processIndex = getProcessIndex(processId);
        privateKey = processes[processIndex].voteEncryptionPrivateKey;
    }

    function publishResults(bytes32 processId, uint32[][] memory results)
        public
        onlyOracle()
    {
        uint256 processIndex = getProcessIndex(processId);
        require(
            processes[processIndex].canceled == false,
            "Process must not be canceled"
        );
        processes[processIndex].results = results;

        emit ResultsPublished(processId, results);
    }

    function getResults(bytes32 processId)
        public
        view
        returns (uint32[][] memory results)
    {
        uint256 processIndex = getProcessIndex(processId);
        results = processes[processIndex].results;
    }
}
