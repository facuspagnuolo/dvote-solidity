import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../utils/mocha-hooks"
import { ProcessContractParameters } from "../../lib"
import { BigNumber } from "ethers"

addCompletionHooks()

describe("Process contract parameter wrapper", () => {
    it("should wrap the 'create' input parameters", () => {
        const params1 = ProcessContractParameters.fromParams({
            mode: 1,
            envelopeType: 2,
            censusOrigin: 3,
            tokenAddress: "4",
            metadata: "56",
            censusRoot: "78",
            censusUri: "90",
            startBlock: 11,
            blockCount: 22,
            questionCount: 33,
            maxCount: 44,
            maxValue: 55,
            maxVoteOverwrites: 66,
            maxTotalCost: 77,
            costExponent: 88,
            namespace: 99,
            evmBlockHeight: 100,
            paramsSignature: "0x0110"
        }).toContractParams()

        expect(params1[0][0]).to.eq(1)
        expect(params1[0][1]).to.eq(2)
        expect(params1[0][2]).to.eq(3)
        expect(params1[1]).to.eq("4")
        expect(params1[2][0]).to.eq("56")
        expect(params1[2][1]).to.eq("78")
        expect(params1[2][2]).to.eq("90")
        expect(params1[3][0]).to.eq(11)
        expect(params1[3][1]).to.eq(22)
        expect(params1[4][0]).to.eq(33)
        expect(params1[4][1]).to.eq(44)
        expect(params1[4][2]).to.eq(55)
        expect(params1[4][3]).to.eq(66)
        expect(params1[5][0]).to.eq(77)
        expect(params1[5][1]).to.eq(88)
        expect(params1[5][2]).to.eq(99)
        expect(params1[6]).to.eq(100)
        expect(params1[7]).to.eq("0x0110")

        const params2 = ProcessContractParameters.fromParams({
            mode: 9,
            envelopeType: 2,
            censusOrigin: 1,
            // tokenAddress
            metadata: "65",
            censusRoot: "87",
            censusUri: "09",
            startBlock: 111,
            blockCount: 222,
            questionCount: 34,
            maxCount: 45,
            maxValue: 56,
            maxVoteOverwrites: 67,
            maxTotalCost: 777,
            costExponent: 888,
            namespace: 999,
            evmBlockHeight: 1000,
            paramsSignature: "0x1100"
        }).toContractParams({ gasLimit: 100 })

        expect(params2[0][0]).to.eq(9)
        expect(params2[0][1]).to.eq(2)
        expect(params2[0][2]).to.eq(1)
        expect(params2[1]).to.eq("0x0000000000000000000000000000000000000000")
        expect(params2[2][0]).to.eq("65")
        expect(params2[2][1]).to.eq("87")
        expect(params2[2][2]).to.eq("09")
        expect(params2[3][0]).to.eq(111)
        expect(params2[3][1]).to.eq(222)
        expect(params2[4][0]).to.eq(34)
        expect(params2[4][1]).to.eq(45)
        expect(params2[4][2]).to.eq(56)
        expect(params2[4][3]).to.eq(67)
        expect(params2[5][0]).to.eq(777)
        expect(params2[5][1]).to.eq(888)
        expect(params2[5][2]).to.eq(999)
        expect(params2[6]).to.eq(1000)
        expect(params2[7]).to.eq("0x1100")
        expect(params2[8]).to.deep.eq({ gasLimit: 100 })
    })

    it("should unwrap the 'get' response values", () => {
        const json1 = ProcessContractParameters.fromContract([
            [1, 2, 3],
            "0x3",
            ["0x4", "0x5", "0x6"],
            [7, 8],
            0,
            [11, 12, 13, 14, 15],
            [16, 17, 18],
            BigNumber.from(19)
        ])

        expect(json1.mode.value).to.eq(1)
        expect(json1.envelopeType.value).to.eq(2)
        expect(json1.censusOrigin.value).to.eq(3)
        expect(json1.entityAddress).to.eq("0x3")
        expect(json1.metadata).to.eq("0x4")
        expect(json1.censusRoot).to.eq("0x5")
        expect(json1.censusUri).to.eq("0x6")
        expect(json1.startBlock).to.eq(7)
        expect(json1.blockCount).to.eq(8)
        expect(json1.status.value).to.eq(0)
        expect(json1.questionIndex).to.eq(11)
        expect(json1.questionCount).to.eq(12)
        expect(json1.maxCount).to.eq(13)
        expect(json1.maxValue).to.eq(14)
        expect(json1.maxVoteOverwrites).to.eq(15)
        expect(json1.maxTotalCost).to.eq(16)
        expect(json1.costExponent).to.eq(17)
        expect(json1.namespace).to.eq(18)
        expect(json1.evmBlockHeight).to.eq(19)

        const json2 = ProcessContractParameters.fromContract([
            [10, 3, 2],
            "0x30",
            ["0x40", "0x50", "0x60"],
            [70, 80],
            1,
            [110, 120, 99, 140, 150],
            [160, 170, 180],
            BigNumber.from(190)
        ])

        expect(json2.mode.value).to.eq(10)
        expect(json2.envelopeType.value).to.eq(3)
        expect(json2.censusOrigin.value).to.eq(2)
        expect(json2.entityAddress).to.eq("0x30")
        expect(json2.metadata).to.eq("0x40")
        expect(json2.censusRoot).to.eq("0x50")
        expect(json2.censusUri).to.eq("0x60")
        expect(json2.startBlock).to.eq(70)
        expect(json2.blockCount).to.eq(80)
        expect(json2.status.value).to.eq(1)
        expect(json2.questionIndex).to.eq(110)
        expect(json2.questionCount).to.eq(120)
        expect(json2.maxCount).to.eq(99)
        expect(json2.maxValue).to.eq(140)
        expect(json2.maxVoteOverwrites).to.eq(150)
        expect(json2.maxTotalCost).to.eq(160)
        expect(json2.costExponent).to.eq(170)
        expect(json2.namespace).to.eq(180)
        expect(json2.evmBlockHeight).to.eq(190)
    })
})
