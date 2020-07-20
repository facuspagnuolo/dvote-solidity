const { expect } = require("chai")
const { addCompletionHooks } = require("./utils/mocha-hooks")
const { Wallet, providers, Contract, ContractFactory, utils, ContractTransaction } = require("ethers")
const ganache = require("ganache-cli")

const { abi: publicResolverAbi, bytecode: publicResolverByteCode } = require("../build/ens-public-resolver.json")

const mnemonic = "myth like bonus scare over problem client lizard pioneer submit female collect"
const localProvider = new providers.Web3Provider(ganache.provider({ time: new Date(), mnemonic }))


const wallets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(idx => {
    return Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${idx}`).connect(localProvider)
})

const accounts = []
Promise.all(wallets.map(wallet => {
    return wallet.getAddress().then(address => {
        accounts.push({
            privateKey: wallet.privateKey,
            address,
            provider: wallet.provider,
            wallet
        })
    })
}))


let baseAccount
let entityAccount
let randomAccount
let randomAccount1
let randomAccount2
let contractInstance
let entityId
let tx

addCompletionHooks()

async function buildInstance() {
    const resolverFactory = new ContractFactory(publicResolverAbi, publicResolverByteCode, baseAccount.wallet)
    const contractInstance = await resolverFactory.deploy("0x0000000000000000000000000000000000000000")
    const instance = await contractInstance.deployed()
    return instance.connect(entityAccount.wallet)
}

describe('Entity Resolver', function () {
    const textRecordKey1 = "vnd.vocdoni.record1"

    beforeEach(async () => {
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
        randomAccount1 = accounts[3]
        randomAccount2 = accounts[4]
        tx = null

        entityId = utils.solidityKeccak256(["address"], [entityAccount.address])
        contractInstance = await buildInstance()
    })

    it("Should deploy the contract", async () => {
        const resolverFactory = new ContractFactory(publicResolverAbi, publicResolverByteCode, entityAccount.wallet)
        const localInstance = await resolverFactory.deploy("0x0000000000000000000000000000000000000000")

        expect(localInstance).to.be.ok
        expect(localInstance.address.match(/^0x[0-9a-fA-F]{40}$/)).to.be.ok
    })

    describe("Text Records", () => {

        it("Should set a Text record and keep the right value", async () => {
            const result1 = await contractInstance.text(entityId, textRecordKey1)
            expect(result1).to.eq("")

            const inputValue = "Text record string 1"
            tx = await contractInstance.setText(entityId, textRecordKey1, inputValue)
            expect(tx).to.be.ok
            await tx.wait()

            const result2 = await contractInstance.text(entityId, textRecordKey1)
            expect(result2).to.eq(inputValue, "Values should match")
        })

        it("Should override an existing Text record", async () => {
            const inputValue2 = "Text record string 2"
            tx = await contractInstance.setText(entityId, textRecordKey1, inputValue2)
            await tx.wait()

            const value = await contractInstance.text(entityId, textRecordKey1)
            expect(value).to.eq(inputValue2, "Values should match")
        })

        it("Should reject updates from extraneous accounts", async () => {
            contractInstance = await buildInstance()

            const result1 = await contractInstance.text(entityId, textRecordKey1)
            expect(result1).to.eq("")

            try {
                tx = await contractInstance.connect(randomAccount1.wallet).setText(entityId, "name", "Evil corp")
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok
            }

            try {
                tx = await contractInstance.connect(randomAccount1.wallet).setText(entityId, textRecordKey1, "Evil value")
                await tx.wait()

                throw new Error("The transaction should have thrown an error")
            }
            catch (err) {
                expect(err.message.match(/revert/)).to.be.ok
            }

            const result2 = await contractInstance.text(entityId, "name")
            expect(result2).to.eq("")

            const result3 = await contractInstance.text(entityId, textRecordKey1)
            expect(result3).to.eq("")
        })

        it("Should override the entity name", async () => {
            const name1 = "Entity Name"
            const name2 = "New Entity Name"

            tx = await contractInstance.setText(entityId, "name", name1)
            await tx.wait()
            let entityName = await contractInstance.text(entityId, "name")
            expect(entityName).to.eq(name1, "The name should be set")

            tx = await contractInstance.setText(entityId, "name", name2)
            await tx.wait()
            entityName = await contractInstance.text(entityId, "name")
            expect(entityName).to.eq(name2, "The name should be updated")
        })

        it("Should emit an event", async () => {
            const inputValue = "Text record string 1"

            const result = await new Promise((resolve, reject) => {
                contractInstance.on("TextChanged", (node, keyIdx, key) => {
                    resolve({ node, keyIdx, key })
                })
                contractInstance.setText(entityId, textRecordKey1, inputValue).then(tx => tx.wait()).catch(reject)
            })
            
            expect(result.node).to.equal(entityId)
            expect(result.keyIdx.hash).to.equal(utils.solidityKeccak256(["string"], [textRecordKey1]))
            expect(result.key).to.equal(textRecordKey1)
        }).timeout(16000)
    })

}).timeout(4000)
