import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { ArbitrageExecuted } from "../generated/schema"
import { ArbitrageExecuted as ArbitrageExecutedEvent } from "../generated/FlashloanArbitrage/FlashloanArbitrage"
import { handleArbitrageExecuted } from "../src/flashloan-arbitrage"
import { createArbitrageExecutedEvent } from "./flashloan-arbitrage-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let token = Address.fromString("0x0000000000000000000000000000000000000001")
    let amount = BigInt.fromI32(234)
    let profit = BigInt.fromI32(234)
    let newArbitrageExecutedEvent = createArbitrageExecutedEvent(
      token,
      amount,
      profit
    )
    handleArbitrageExecuted(newArbitrageExecutedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("ArbitrageExecuted created and stored", () => {
    assert.entityCount("ArbitrageExecuted", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "ArbitrageExecuted",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "token",
      "0x0000000000000000000000000000000000000001"
    )
    assert.fieldEquals(
      "ArbitrageExecuted",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "amount",
      "234"
    )
    assert.fieldEquals(
      "ArbitrageExecuted",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "profit",
      "234"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
