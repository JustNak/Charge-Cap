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

const path = "/sys/class/power_supply/BAT0/charge_control_end_threshold"
const asus = { kind: "asusctl" }
const sysfs = { kind: "sysfs", path: path, privileged: false }
const pkexec = { kind: "sysfs", path: path, privileged: true }

assert.strictEqual(Model.isThresholdPath(path), true)
assert.strictEqual(Model.isThresholdPath("/tmp/charge_control_end_threshold"), false)
assert.strictEqual(Model.isThresholdPath("/sys/class/power_supply/BAT0/uevent"), false)
assert.strictEqual(Model.findThresholdPath("nope\n" + path + "\n"), path)
assert.strictEqual(Model.findThresholdPath(""), null)

assert.deepStrictEqual(Model.pickWriter({}), { kind: "none" })
assert.deepStrictEqual(
  Model.pickWriter({ thresholdPath: path, hasAsusctl: true, sysfsWritable: true, hasPkexec: true }),
  { kind: "asusctl" }
)
assert.deepStrictEqual(
  Model.pickWriter({ thresholdPath: path, hasAsusctl: false, sysfsWritable: true, hasPkexec: true }),
  sysfs
)
assert.deepStrictEqual(
  Model.pickWriter({ thresholdPath: path, hasAsusctl: false, sysfsWritable: false, hasPkexec: true }),
  pkexec
)
assert.deepStrictEqual(
  Model.pickWriter({ thresholdPath: path, hasAsusctl: false, sysfsWritable: false, hasPkexec: false }),
  { kind: "none" }
)
assert.deepStrictEqual(
  Model.pickWriter({ thresholdPath: "/etc/passwd", hasPkexec: true }),
  { kind: "none" }
)

assert.deepStrictEqual(
  Model.writeCommand(asus, 80),
  ["/usr/bin/asusctl", "battery", "limit", "80"]
)
assert.deepStrictEqual(
  Model.writeCommand(sysfs, 80),
  ["/bin/sh", "-c", "printf '%s\\n' \"$1\" > \"$2\"", "charge-cap", "80", path]
)
assert.deepStrictEqual(
  Model.writeCommand(pkexec, 80),
  ["/usr/bin/pkexec", "/bin/sh", "-c", "printf '%s\\n' \"$1\" > \"$2\"", "charge-cap", "80", path]
)
assert.strictEqual(Model.writeCommand({ kind: "none" }, 80), null)
assert.strictEqual(Model.writeCommand({ kind: "sysfs", path: "/tmp/x", privileged: true }, 80), null)

assert.deepStrictEqual(Model.readState("80", asus), { kind: "ready", value: 80 })
assert.deepStrictEqual(Model.readState("20", pkexec), { kind: "ready", value: 60 })
assert.deepStrictEqual(Model.readState("80", { kind: "none" }), { kind: "unavailable" })
assert.deepStrictEqual(Model.readState("", asus), { kind: "unavailable" })
assert.deepStrictEqual(Model.readState("nope", asus), { kind: "unavailable" })

assert.strictEqual(Model.chargeLimitMin(), 60)
assert.strictEqual(Model.chargeLimitMax(), 100)

console.log("ok")
