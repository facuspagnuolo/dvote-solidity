const assert = require("assert")
const Web3Utils = require("web3-utils")
const { utils } = require("ethers")

const { getWeb3, deployEnsPublicResolver } = require("../lib/util")

const web3 = getWeb3()

let accounts
let instance

let entityAddress, maliciousEntityAddress, randomAddress2
let entityId

describe('PublicResolver', function () {
    const textRecordKey1 = "vnd.vocdoni.record1"

    beforeEach(async () => {
        accounts = await web3.eth.getAccounts()

        entityAddress = accounts[1]
        maliciousEntityAddress = accounts[2]
        randomAddress2 = accounts[3]
        entityId = utils.keccak256(entityAddress)

        instance = await deployEnsPublicResolver("0x0000000000000000000000000000000000000000")
    })

    it("Should deploy the contract", async () => {
        const localInstance = await deployEnsPublicResolver("0x0000000000000000000000000000000000000000")

        assert.ok(localInstance)
        assert.ok(localInstance.options)
        assert.ok(localInstance.options.address.match(/^0x[0-9a-fA-F]{40}$/))
    })

    describe("Text Records", () => {

        it("Should set a Text record and keep the right value", async () => {
            const result1 = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(result1, "")

            const inputValue = "Text record string 1"
            const tx = await instance.methods.setText(entityId, textRecordKey1, inputValue).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(tx)
            assert.ok(tx.transactionHash)
            assert.ok(tx.events)
            assert.ok(tx.events.TextChanged)

            const result2 = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(result2, inputValue, "Values should match")
        })

        it("Should override an existing Text record", async () => {
            const inputValue2 = "Text record string 2"
            await instance.methods.setText(entityId, textRecordKey1, inputValue2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const value = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(value, inputValue2, "Values should match")
        })

        it("Should reject updates from extraneous accounts", async () => {
            const result1 = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(result1, "")

            try {
                await instance.methods.setText(entityId, "name", "Evil coorp").send({
                    from: maliciousEntityAddress,
                    nonce: await web3.eth.getTransactionCount(maliciousEntityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            try {
                await instance.methods.setText(entityId, textRecordKey1, "Evil value").send({
                    from: maliciousEntityAddress,
                    nonce: await web3.eth.getTransactionCount(maliciousEntityAddress)
                })

                assert.fail("The transaction should have thrown an error")
            }
            catch (err) {
                assert(err.message.match(/revert/), "The transaction threw an unexpected error:\n" + err.message)
            }

            const result2 = await instance.methods.text(entityId, "name").call()
            assert.equal(result2, "")

            const result3 = await instance.methods.text(entityId, textRecordKey1).call()
            assert.equal(result3, "")
        })

        it("Should override the entity name", async () => {
            const name1 = "Entity Name"
            const name2 = "New Entity Name"
            await instance.methods.setText(entityId, "name", name1).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })
            await instance.methods.setText(entityId, "name", name2).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            const entityName = await instance.methods.text(entityId, "name").call()
            assert.equal(entityName, name2, "The name should be updated")
        })

        it("Should emit an event", async () => {
            const inputValue = "Text record string 1"
            const tx = await instance.methods.setText(entityId, textRecordKey1, inputValue).send({
                from: entityAddress,
                nonce: await web3.eth.getTransactionCount(entityAddress)
            })

            assert.ok(tx)
            assert.ok(tx.transactionHash)
            assert.ok(tx.events)
            assert.ok(tx.events.TextChanged)
            assert.ok(tx.events.TextChanged.returnValues)
            assert.equal(tx.events.TextChanged.event, "TextChanged")
            assert.equal(tx.events.TextChanged.returnValues.indexedKey, textRecordKey1)
        })
    })
})
