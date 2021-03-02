import { ContractTransaction, BigNumber } from "ethers"
import { IMethodOverrides } from "./contract-utils"
import { IProcessStatus, IProcessResults } from "./data-wrappers"

///////////////////////////////////////////////////////////////////////////////
// ENS TYPES
///////////////////////////////////////////////////////////////////////////////

/** Custom Smart Contract operations for an ENS Registry contract */
export interface EnsRegistryContractMethods {
    setRecord(node: string, owner: string, resolver: string, ttl: BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setSubnodeRecord(node: string, label: string, owner: string, resolver: string, ttl: BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setOwner(node: string, owner: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setSubnodeOwner(node: string, label: string, owner: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setResolver(node: string, resolver: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setTTL(node: string, ttl: BigNumber, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    setApprovalForAll(operator: string, approved: Boolean, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    owner(node: string): Promise<string>,
    resolver(node: string): Promise<string>,
    ttl(node: string): Promise<BigNumber>,
    recordExists(node: string): Promise<boolean>,
    isApprovedForAll(_owner: string, operator: string): Promise<boolean>,
}

/** Custom Smart Contract operations for a Public Resolver contract */
export interface EnsPublicResolverContractMethods {
    /** Whether the resolver supports an interface */
    supportsInterface(interfaceID: string): Promise<boolean>

    /** Get the address associated with the given node */
    addr(node: string): Promise<string>
    /** Sets the address for the given node */
    setAddr(node: string, address: string, overrides?: IMethodOverrides): Promise<ContractTransaction>

    /**
     * Returns the text associated with an ENS node and key.
     * @param hashedEntityAddress The ENS node to query.
     * @param key The key to retrieve.
     * @return The record's text.
     */
    text(hashedEntityAddress: string, key: string): Promise<string>
    /**
     * Sets the text of the ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param hashedEntityAddress The ENS node to modify. @see ensHashAddress()
     * @param key The key to modify.
     * @param value The text to store.
     */
    setText(hashedEntityAddress: string, key: string, value: string, overrides?: IMethodOverrides): Promise<ContractTransaction>
}

///////////////////////////////////////////////////////////////////////////////
// PROCESS TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for a Voting Process contract */
export interface ProcessContractMethods {
    // HELPERS

    /** Retrieves the amount of processes that the entity has created */
    getEntityProcessCount(entityAddress: string): Promise<BigNumber>,
    /** Get the process ID that would be assigned to the next process */
    getNextProcessId(entityAddress: string, namespace: number): Promise<string>,
    /** Compute the process ID that corresponds to the given parameters */
    getProcessId(entityAddress: string, processCountIndex: number, namespace: number, chainId: number | BigNumber): Promise<string>,

    // GLOBAL VARIABLES
    /** The block at which the contract became active. If it is zero, then it still needs activation from its predecessor. */
    activationBlock(): Promise<BigNumber>
    /** The address of the contract in operation before us. It if is zero, it means that we are the first instance. */
    predecessorAddress(): Promise<string>
    /** The address of our successor. If zero, it means that we are the current active instance.
     * Otherwise, new processes need to be created on the last successor instance.
     */
    successorAddress(): Promise<string>
    /** The address of the contract that defined the details of all namespaces */
    namespaceAddress(): Promise<string>
    /** The address of the token storage proofs contract used by EVM census processes */
    tokenStorageProofAddress(): Promise<string>
    /** The chain ID of the Ethereum network where the contract lives */
    chainId(): Promise<BigNumber>

    // GETTERS

    /**
     * Retrieve the on-chain parameters for the given process:
     * 
     * ```[
        mode_envelopeType_censusOrigin: number[],
        entityAddress: string,  
        metadata_censusRoot_censusUri: string[],
        startBlock_blockCount: number[],
        status: IProcessStatus,
        questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites: number[],
        maxTotalCost_costExponent_namespace: number[]
     * ]```
     */
    get(processId: string): Promise<IProcessStateTuple>,
    /** Retrieve the available results for the given process */
    getParamsSignature(processId: string): Promise<{ paramsSignature: string }>
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<IProcessResults>
    /** Gets the address of the process instance where the given processId was originally created. 
     * This allows to know where to send update transactions, after a fork has occurred. */
    getCreationInstance(processId): Promise<string>,

    // GLOBAL METHODS

    /** Sets the current instance as active, if not already */
    activate(overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Sets the target instance as the successor and deactivates the current one */
    activateSuccessor(successor: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Updates the address of the contract holding the details of the active namespaces */
    setNamespaceAddress(namespaceAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,

    // PER-PROCESS METHODS

    /**
     * Publish a new voting process using the given parameters
     * 
     * ```[
        mode_envelopeType_censusOrigin: number[],
        metadata_censusRoot_censusUri: string[],
        tokenContractAddress: string,  
        startBlock_blockCount: number[],
        questionCount_maxCount_maxValue_maxVoteOverwrites: number[],
        maxTotalCost_costExponent_namespace: number[],
        paramsSignature: string,
        overrides?: IMethodOverrides?
     * ]```
     * */
    newProcess(...args: IProcessCreateParamsTuple): Promise<ContractTransaction>,
    /** Update the process status that corresponds to the given ID */
    setStatus(processId: string, status: IProcessStatus, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Increments the index of the current question (only when INCREMENTAL mode is set) */
    incrementQuestionIndex(processId: string, overrides?: IMethodOverrides): Promise<ContractTransaction>
    /** Updates the census of the given process (only if the mode allows dynamic census) */
    setCensus(processId: string, censusRoot: string, censusUri: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Sets the given results for the given process */
    setResults(processId: string, tally: number[][], height: number, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Adds the given signature to the given process results */
    addResultsSignature(processId: string, signature: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Adds the given proof to the given process results */
    addResultsProof(processId: string, proof: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
}

export type IProcessCreateParamsTuple = [
    number[], // mode_envelopeType_censusOrigin
    string,   // tokenContractAddress
    string[], // metadata_censusRoot_censusUri
    number[], // startBlock_blockCount
    number[], // questionCount_maxCount_maxValue_maxVoteOverwrites
    number[], // maxTotalCost_costExponent_namespace
    number, // evmBlockHeight
    string, // paramsSignature
    IMethodOverrides? // (Optional) Ethereum transaction overrides
]
export type IProcessStateTuple = [
    number[], // mode_envelopeType_censusOrigin
    string,   // entityAddress
    string[], // metadata_censusRoot_censusUri
    number[], // startBlock_blockCount
    IProcessStatus, // status
    number[], // questionIndex_questionCount_maxCount_maxValue_maxVoteOverwrites
    number[], // maxTotalCost_costExponent_namespace
    BigNumber // evmBlockHeight
]

///////////////////////////////////////////////////////////////////////////////
// GENESIS TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for a Genesis instance */
export interface GenesisContractMethods {
    // GETTERS

    /** Retrieve all the fields of the given namespace: `[ chainId: string, genesis: string,validators: string[],oracles: string[] ]` */
    getNamespace(namespace: number): Promise<[string, string, string[], string[]]>,
    /** Checks whether the given public key is registered as a validator in the given namespace */
    isValidator(namespace: number, validatorPublicKey: string): Promise<boolean>,
    /** Checks whether the given address is registered as an oracle in the given namespace */
    isOracle(namespace: number, oracleAddress: string): Promise<boolean>,

    // SETTERS
    setNamespace(namespace: number, chainId: string, genesis: string, validators: string[], oracles: string[], overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Update the Chain ID of the given namespace */
    setChainId(namespace: number, chainId: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Update the genesis of the given namespace */
    setGenesis(namespace: number, genesisData: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Registers the public key of a new validator */
    addValidator(namespace: number, validatorPublicKey: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Removes the public key at the given index for a validator */
    removeValidator(namespace: number, idx: number, validatorPublicKey: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Registers the address of a new oracle */
    addOracle(namespace: number, oracleAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Removes the address at the given index for an oracle */
    removeOracle(namespace: number, idx: number, oracleAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
}

///////////////////////////////////////////////////////////////////////////////
// NAMESPACE TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for a Namespace */
export interface NamespaceContractMethods {
    // GETTERS

    /** Retrieve all the fields of the given namespace: `[ chainId: string, genesis: string,validators: string[],oracles: string[] ]` */
    getNamespace(namespace: number): Promise<[string, string, string[], string[]]>,
    /** Checks whether the given public key is registered as a validator in the given namespace */
    isValidator(namespace: number, validatorPublicKey: string): Promise<boolean>,
    /** Checks whether the given address is registered as an oracle in the given namespace */
    isOracle(namespace: number, oracleAddress: string): Promise<boolean>,

    // SETTERS
    setNamespace(namespace: number, chainId: string, genesis: string, validators: string[], oracles: string[], overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Update the Chain ID of the given namespace */
    setChainId(namespace: number, chainId: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Update the genesis of the given namespace */
    setGenesis(namespace: number, genesisData: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Registers the public key of a new validator */
    addValidator(namespace: number, validatorPublicKey: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Removes the public key at the given index for a validator */
    removeValidator(namespace: number, idx: number, validatorPublicKey: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Registers the address of a new oracle */
    addOracle(namespace: number, oracleAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
    /** Removes the address at the given index for an oracle */
    removeOracle(namespace: number, idx: number, oracleAddr: string, overrides?: IMethodOverrides): Promise<ContractTransaction>,
}

///////////////////////////////////////////////////////////////////////////////
// STORAGE PROOF TYPES
///////////////////////////////////////////////////////////////////////////////

/** Smart Contract operations for Storage Proofs */
export interface TokenStorageProofContractMethods {
    // GETTERS

    /** Determines whether the given address is registered as an ERC token contract */
    isRegistered(ercTokenAddress: string): Promise<boolean>

    /** Retrieves the token addresses registered at the given index. If it doesn't exist, the request throws an error. */
    tokenAddresses(idx: number): Promise<string>,

    /** Retrieves the amount of ERC20 tokens registered on the contract.  */
    tokenCount(): Promise<number>,

    /** Fetches a Merkle Proof for the sender, validating that he/she had some balance on the contract at a given block number */
    getProof(ercTokenAddress: string, blockNumber: number | BigNumber): Promise<Buffer>

    /** Fetches a Merkle Proof for the sender, validating that he/she had some balance on the contract at a given block number */
    getBalance(token: string, holder: string, blockNumber: number | BigNumber, storageProof: Buffer, balanceMappingPosition: number): Promise<BigNumber>

    /** Fetches the balance mapping position stored for a given token */
    getBalanceMappingPosition(ercTokenAddress: string): Promise<BigNumber>

    /** Fetches the storage root for an account of the State Trie on a specific lock number */
    getStorageRoot(account: string, blockNumber: number | BigNumber, blockHeaderRLP: Buffer, accountStateProof: Buffer): Promise<String>

    /** Fetches the storage content of the Storage Tree of an account on the State trie given a proof for that account */
    getStorage(slot: number | BigNumber, stateRoot: string, storageProof: Buffer): Promise<BigNumber>

    /** Fetches the holder storage slot given the holder address */
    getHolderBalanceSlot(holder: string, balanceMappingPosition: number | BigNumber)

    /** Fetches the balance of a holder of a token and validates the data through merkle proofs */
    getBalance(token: string, holder: string, blockNumber: number | BigNumber, blockHeaderRLP: Buffer, accountStateProof: Buffer, storageProof: Buffer, balanceMappingPosition: number | BigNumber): Promise<BigNumber>

    /** Fetches the block header State root hash given an RLP encoded block */
    getBlockHeaderStateRoot(blockHeaderRLP: Buffer, blockhash: string): Promise<string>

    // SETTERS

    /** Checks that the given contract is an ERC token, validates that the balance of the sender matches the one obtained from the storage position and registers the token address */
    registerToken(tokenAddress: string, balanceMappingPosition: number | BigNumber, blockNumber: number | BigNumber, blockHeaderRLP: Buffer, accountStateProof: Buffer, storageProof: Buffer, overrides?: IMethodOverrides): Promise<ContractTransaction>
}

///////////////////////////////////////////////////////////////////////////////
// TEST TYPES
///////////////////////////////////////////////////////////////////////////////

export interface TokenStorageProofTestContractMethods {
    exposedVerify(siblings: Buffer, rootHash: string, key: string): Promise<string>
    testVerify(): Promise<number | BigNumber>
    testExclusion(): Promise<string>
    verifyAccountProof(proof: Buffer, hash: string, account: string): Promise<string>
}
