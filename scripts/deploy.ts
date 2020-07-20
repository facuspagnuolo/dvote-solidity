import { Wallet, providers, Contract, ContractFactory, utils as utils2 } from "ethers"
import { EnsPublicResolverContractMethods } from "../lib";

const utils = require('web3-utils');
const namehash = require('eth-ens-namehash');

require("dotenv").config()

const ENDPOINT = process.env.ENDPOINT
const MNEMONIC = process.env.MNEMONIC
const CHAIN_ID = process.env.CHAINID || 0

const PATH = "m/44'/60'/0'/0/0"

const { abi: ENSRegistryAbi, bytecode: ENSRegistryBytecode } = require("../build/ens-registry.json")
const { abi: ENSPublicResolverAbi, bytecode: ENSPublicResolverBytecode } = require("../build/ens-public-resolver.json")
//const { abi: ENSEntityResolverAbi, bytecode: ENSEntityResolverBytecode } = require("../build/ens-entity-resolver.json")
const { abi: VotingProcessAbi, bytecode: VotingProcessBytecode } = require("../build/voting-process.json")

const deployOptions = { gasPrice: utils2.parseUnits("1", "gwei") }

async function deploy() {
    const provider = new providers.JsonRpcProvider(ENDPOINT, { chainId: 100, name: "xdai", ensAddress: "0x0000000000000000000000000000000000000000" })
    const wallet = Wallet.fromMnemonic(MNEMONIC, PATH).connect(provider)

    // Deploy
    console.log("Deploying from", wallet.address, "\n")
    // ENS Registry
    const ensRegistryFactory = new ContractFactory(ENSRegistryAbi, ENSRegistryBytecode, wallet)
    const ensRegistryContract = await ensRegistryFactory.deploy(deployOptions)
    const ensRegistryInstance = await ensRegistryContract.deployed()
    console.log("ENS Registry deployed at", ensRegistryInstance.address)

    // ENS Public resolver
    const ensPublicResolverFactory = new ContractFactory(ENSPublicResolverAbi, ENSPublicResolverBytecode, wallet)
    const ensPublicResolverContract = await ensPublicResolverFactory.deploy(ensRegistryContract.address, deployOptions)
    const ensPublicResolverInstance = await ensPublicResolverContract.deployed() as Contract & EnsPublicResolverContractMethods
    console.log("ENS PublicResolver deployed at", ensPublicResolverInstance.address)

    // Voting Process
    const votingProcessFactory = new ContractFactory(VotingProcessAbi, VotingProcessBytecode, wallet)
    const votingProcessContract = await votingProcessFactory.deploy(CHAIN_ID, deployOptions)
    const votingProcessInstance = await votingProcessContract.deployed()
    console.log("Voting Process deployed at", votingProcessInstance.address)
    console.log()

    // ENS DEPLOYMENT

    // create .eth TLD
    const rootNode = namehash.hash("") // 0x0000000000000000000000000000000000000000000000000000000000000000

    // check TLD added succesfully
    var rootOwner = await ensRegistryInstance.owner(rootNode)
    console.log("Root owner", rootOwner)

    // create .eth
    const ethLabel = utils.keccak256("eth")
    var tx = await ensRegistryInstance.setSubnodeOwner(rootNode, ethLabel, wallet.address, deployOptions)
    await tx.wait()

    // check TLD added succesfully
    const ethNode = namehash.hash("eth")
    var ethOwner = await ensRegistryInstance.owner(ethNode)
    console.log("'eth' owner", ethOwner)

    // create vocdoni.eth
    const vocdoniLabel = utils.keccak256("vocdoni")
    var tx2 = await ensRegistryInstance.setSubnodeOwner(ethNode, vocdoniLabel, wallet.address, deployOptions)
    await tx2.wait()

    // check vocdonni.eth added succesfully
    const vocdoniEthNode = namehash.hash("vocdoni.eth")
    var vocdoniEthOwner = await ensRegistryInstance.owner(vocdoniEthNode)
    console.log("'vocdoni.eth' owner", vocdoniEthOwner)

    // create entity-resolver.vocdoni.eth
    const entityResolverLabel = utils.keccak256("entity-resolver")
    var tx3 = await ensRegistryInstance.setSubnodeOwner(vocdoniEthNode, entityResolverLabel, wallet.address, deployOptions)
    await tx3.wait()

    // check TLD added succesfully
    const entityResolverVocdoniEthNode = namehash.hash("entity-resolver.vocdoni.eth")
    var entityResolverVocdoniEthOwner = await ensRegistryInstance.owner(entityResolverVocdoniEthNode)
    console.log("'entity-resolver.vocdoni.eth' owner", entityResolverVocdoniEthOwner)

    // create voting-process.vocdoni.eth
    const votingProcessLabel = utils.keccak256("voting-process")
    var tx4 = await ensRegistryInstance.setSubnodeOwner(vocdoniEthNode, votingProcessLabel, wallet.address, deployOptions)
    await tx4.wait()

    // check TLD added succesfully
    const votingProcessVocdoniEthNode = namehash.hash("voting-process.vocdoni.eth")
    var votingProcessVocdoniEthOwner = await ensRegistryInstance.owner(votingProcessVocdoniEthNode)
    console.log("'voting-process.vocdoni.eth' owner", votingProcessVocdoniEthOwner)

    // set entity resolver
    var tx5 = await ensRegistryInstance.setResolver(votingProcessVocdoniEthNode, ensPublicResolverInstance.address, deployOptions)
    await tx5.wait()
    var tx6 = await ensRegistryInstance.setResolver(entityResolverVocdoniEthNode, ensPublicResolverInstance.address, deployOptions)
    await tx6.wait()

    console.log()

    // set resolver voting process addr
    // console.log("Resolver", await ensRegistryInstance.resolver(votingProcessVocdoniEthNode))
    var tx7 = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](votingProcessVocdoniEthNode, votingProcessInstance.address, deployOptions)
    await tx7.wait()
    console.log("'entity-resolver.vocdoni.eth' address", await ensPublicResolverInstance.addr(entityResolverVocdoniEthNode))

    var tx8 = await ensPublicResolverInstance.functions["setAddr(bytes32,address)"](entityResolverVocdoniEthNode, ensPublicResolverInstance.address, deployOptions)
    await tx8.wait()
    console.log("'voting-process.vocdoni.eth' address", await ensPublicResolverInstance.addr(votingProcessVocdoniEthNode))

    // Set the bootnode URL on the entity of Vocdoni
    const BOOTNODES_KEY = "vnd.vocdoni.boot-nodes"
    const entityId = utils2.keccak256(wallet.address)
    const tx9 = await ensPublicResolverInstance.setText(entityId, BOOTNODES_KEY, "https://bootnodes.vocdoni.net/gateways.json")
    await tx9.wait()

    console.log("ENS Text of", entityId, BOOTNODES_KEY, "is", await ensPublicResolverInstance.text(entityId, BOOTNODES_KEY))

    // done
    console.log()
    console.log("Done")
}

deploy().catch(err => console.log(err))
