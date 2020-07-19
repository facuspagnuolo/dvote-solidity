import * as EnsRegistry from "./ens-registry.json"
import * as EnsPublicResolver from "./ens-public-resolver.json"
import * as VotingProcess from "./voting-process.json"

import { ContractTransaction } from "ethers"
import { BigNumber } from "ethers/utils"

///////////////////////////////////////////////////////////////////////////////
// SMART CONTRACTS ABI + BYTECODE
///////////////////////////////////////////////////////////////////////////////

export { EnsRegistry }
export { EnsPublicResolver }
export { VotingProcess }

///////////////////////////////////////////////////////////////////////////////
// ENTITY RESOLVER TYPES
///////////////////////////////////////////////////////////////////////////////

/** Custom Smart Contract operations for an ENS Registry contract */
export type EnsRegistryContractMethods = {
    setRecord(node: string, owner: string, resolver: string, ttl: BigNumber): Promise<ContractTransaction>,
    setSubnodeRecord(node: string, label: string, owner: string, resolver: string, ttl: BigNumber): Promise<ContractTransaction>,
    setOwner(node: string, owner: string): Promise<ContractTransaction>,
    setSubnodeOwner(node: string, label: string, owner: string): Promise<ContractTransaction>,
    setResolver(node: string, resolver: string): Promise<ContractTransaction>,
    setTTL(node: string, ttl: BigNumber): Promise<ContractTransaction>,
    setApprovalForAll(operator: string, approved: Boolean): Promise<ContractTransaction>,
    owner(node: string): Promise<string>,
    resolver(node: string): Promise<string>,
    ttl(node: string): Promise<BigNumber>,
    recordExists(node: string): Promise<boolean>,
    isApprovedForAll(_owner: string, operator: string): Promise<boolean>,
}

/** Custom Smart Contract operations for a Public Resolver contract */
export type EnsPublicResolverContractMethods = {
    /** Whether the resolver supports an interface */
    supportsInterface(interfaceID: string): Promise<boolean>

    /** Get the address associated with the given node */
    addr(node: string): Promise<string>
    /** Sets the address for the given node */
    setAddr(node: string, address: string): Promise<ContractTransaction>

    /**
     * Returns the text associated with an ENS node and key.
     * @param entityId The ENS node to query.
     * @param key The key to retrieve.
     * @return The record's text.
     */
    text(entityId: string, key: string): Promise<string>
    /**
     * Sets the text of the ENS node and key.
     * May only be called by the owner of that node in the ENS registry.
     * @param entityId The ENS node to modify.
     * @param key The key to modify.
     * @param value The text to store.
     */
    setText(entityId: string, key: string, value: string): Promise<ContractTransaction>
}

///////////////////////////////////////////////////////////////////////////////
// VOTING PROCESS TYPES
///////////////////////////////////////////////////////////////////////////////

type ProcessType = "snark-vote" | "poll-vote" | "petition-sign"

/** Smart Contract operations for a Voting Process contract */
export interface VotingProcessContractMethods {
    /** Retrieves the amount of voting processes that the entity has created */
    getEntityProcessCount(entityAddress: string): Promise<BigNumber>,
    /** Get the process ID that would be assigned to the next voting process */
    getNextProcessId(entityAddress: string): Promise<string>,
    /** Compute the process ID that corresponds to the given parameters */
    getProcessId(entityAddress: string, processCountIndex: number): Promise<string>,
    /** Get the windex within the global array where the given process is stored */
    getProcessIndex(processId: string): Promise<BigNumber>,

    /** Update the genesis link and hash */
    setGenesis(genesisData: string): Promise<ContractTransaction>,
    /** Retrieve the current genesis block content link */
    getGenesis(): Promise<string>,

    /** Update the Chain ID */
    setChainId(newChainId: number): Promise<ContractTransaction>,
    /** Retrieve the current Chain ID */
    getChainId(): Promise<BigNumber>,

    /** Publish a new voting process using the given metadata link */
    create(processType: ProcessType, metadata: string, censusMerkleRoot: string, censusMerkleTree: string, startBlock: number | BigNumber, numberOfBlocks: number | BigNumber): Promise<ContractTransaction>,
    /** Retrieve the current data for the given process */
    get(processId: string): Promise<{ processType: ProcessType, entityAddress: string, startBlock: BigNumber, numberOfBlocks: BigNumber, metadata: string, censusMerkleRoot: string, censusMerkleTree: string, voteEncryptionPrivateKey: string, canceled: boolean }>,
    /** Cancel the voting process that corresponds to the given Id */
    cancel(processId: string): Promise<ContractTransaction>,

    /** Register the public key of a new validator */
    addValidator(validatorPublicKey: string): Promise<ContractTransaction>,
    /** Remove the public key at the given index for a validator */
    removeValidator(idx: number, validatorPublicKey: string): Promise<ContractTransaction>,
    /** Retrieve the current list of validators on the Vocchain */
    getValidators(): Promise<string[]>,

    /** Register the public key of a new oracle */
    addOracle(oraclePublicKey: string): Promise<ContractTransaction>,
    /** Remove the public key at the given index for an oracle */
    removeOracle(idx: number, oraclePublicKey: string): Promise<ContractTransaction>,
    /** Retrieve the current list of oracles on the Vocchain */
    getOracles(): Promise<string[]>,

    /** Reveal the private key for the given voting process */
    publishPrivateKey(processId: string, privateKey: string): Promise<ContractTransaction>,
    /** Retrieve the current decryption key for the given process */
    getPrivateKey(processId: string): Promise<string>,

    /** Publish the results for the given process */
    publishResults(processId: string, results: string): Promise<ContractTransaction>,
    /** Retrieve the available results for the given process */
    getResults(processId: string): Promise<{ results: string }>
}
