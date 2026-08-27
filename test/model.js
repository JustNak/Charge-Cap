const assert = require("assert")
const Model = require("../Model.js")

assert.strictEqual(Model.parseChargeLimit("80"), 80)
assert.strictEqual(Model.parseChargeLimit("80\n"), 80)
assert.strictEqual(Model.parseChargeLimit("80%"), 80)
assert.strictEqual(Model.parseChargeLimit("Current battery charge limit: 80%"), 80)
assert.strictEqual(Model.parseChargeLimit(""), null)
assert.strictEqual(Model.parseChargeLimit("nope"), null)
assert.strictEqual(Model.parseChargeLimit("101"), null)
assert.strictEqual(Model.parseChargeLimit("-1"), null)

assert.strictEqual(Model.clampChargeLimit(80), 80)
assert.strictEqual(Model.clampChargeLimit(59), 60)
assert.strictEqual(Model.clampChargeLimit(101), 100)
assert.strictEqual(Model.clampChargeLimit(60.4), 60)
assert.strictEqual(Model.clampChargeLimit(60.6), 61)

assert.deepStrictEqual(Model.readState("80", true), { kind: "ready", value: 80 })
assert.deepStrictEqual(Model.readState("20", true), { kind: "ready", value: 60 })
assert.deepStrictEqual(Model.readState("80", false), { kind: "unavailable" })
assert.deepStrictEqual(Model.readState("", true), { kind: "unavailable" })
assert.deepStrictEqual(Model.readState("nope", true), { kind: "unavailable" })

assert.strictEqual(Model.chargeLimitMin(), 60)
assert.strictEqual(Model.chargeLimitMax(), 100)

console.log("ok")
