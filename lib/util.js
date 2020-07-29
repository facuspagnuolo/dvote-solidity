const HDWalletProvider = require("truffle-hdwallet-provider")
const Web3 = require("web3")
const dotenv = require("dotenv")
const fs = require("fs")

const { abi: ensRegistryAbi, bytecode: ensRegistryByteCode } = require("../build/ens-registry.json")
const { abi: ensPublicResolverAbi, bytecode: ensPublicResolverByteCode } = require("../build/ens-public-resolver.json")
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../build/voting-process.json")

const config = getConfig()
const provider = new HDWalletProvider(config.MNEMONIC, config.GATEWAY_URL, 0, 10)
const web3 = new Web3(provider)

///////////////////////////////////////////////////////////////////////////////
// ENV HELPERS
///////////////////////////////////////////////////////////////////////////////

/**
 * Read process.env and .env into a unified config
 */
function getConfig() {
	const envDefault = dotenv.parse(fs.readFileSync("./.env"))

	return Object.assign({}, envDefault, process.env)
}

function getWeb3() {
	return web3
}

function getProvider() {
	return provider
}

///////////////////////////////////////////////////////////////////////////////
// DEPLOYMENT
///////////////////////////////////////////////////////////////////////////////

function deployEnsRegistry() {
	var account, nonce
	return web3.eth.getAccounts().then(accounts => {
		account = accounts[0]
		return web3.eth.getTransactionCount(accounts[0])
	}).then(n => {
		nonce = n
		return new web3.eth.Contract(ensRegistryAbi)
			.deploy({ data: ensRegistryByteCode })
			.send({
				from: account,
				gas: "2350000",
				nonce
			})
	})
}

function deployEnsPublicResolver(registryAddress) {
	if (!registryAddress) throw new Error("Invalid registryAddress")

	var account, nonce
	return web3.eth.getAccounts().then(accounts => {
		account = accounts[0]
		return web3.eth.getTransactionCount(accounts[0])
	}).then(n => {
		nonce = n
		return new web3.eth.Contract(ensPublicResolverAbi)
			.deploy({ data: ensPublicResolverByteCode, arguments: [registryAddress] })
			.send({
				from: account,
				gas: "3350000",
				nonce
			})
	})
}

function deployVotingProcess(deployAddress, chainId) {
	return web3.eth.getTransactionCount(deployAddress).then(nonce => {
		return new web3.eth.Contract(votingProcessAbi)
			.deploy({ data: votingProcessByteCode, arguments: [chainId] })
			.send({
				from: deployAddress,
				gas: "3000000",
				nonce
			})
	})
}

///////////////////////////////////////////////////////////////////////////////
// TESTING UTILS (timestamp)
///////////////////////////////////////////////////////////////////////////////

/**
 * Increase the timestamp of the blockchain by <N> seconds
 * @param {number} seconds 
 * @returns Promise
 * 
 * Make sure to invoke ganache with -t "YYYY MM DD" parameter
 */
function increaseTimestamp(seconds = 10) {
	return new Promise((resolve, reject) => {
		const transaction = {
			jsonrpc: "2.0",
			method: "evm_increaseTime",
			params: [seconds],
			id: Date.now(),
		}
		web3.currentProvider.send(
			transaction,
			error => error ? reject(error) : resolve()
		)
	}).then(() => mineBlock())
}

/**
 * Force to mine a block
 */
function mineBlock() {
	return new Promise((resolve, reject) => {
		const transaction = {
			jsonrpc: "2.0",
			method: "evm_mine",
			params: [],
			id: Date.now(),
		}
		web3.currentProvider.send(
			transaction,
			error => error ? reject(error) : resolve()
		)
	})
}

module.exports = {
	getConfig,
	getWeb3,
	getProvider,

	deployEnsRegistry,
	deployEnsPublicResolver,
	deployVotingProcess,

	increaseTimestamp
}
