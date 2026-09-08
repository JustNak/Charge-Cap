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

assert.strictEqual(Model.parseLeadingNumber("8.7W"), 8.7)
assert.strictEqual(Model.parseLeadingNumber("66Wh"), 66)
assert.strictEqual(Model.parseLeadingNumber("79%"), 79)
assert.ok(Number.isNaN(Model.parseLeadingNumber("")))
assert.ok(Number.isNaN(Model.parseLeadingNumber("nope")))

assert.strictEqual(Model.parseThresholdEnd("80%"), 80)
assert.strictEqual(Model.parseThresholdEnd("75-80%"), 80)
assert.strictEqual(Model.parseThresholdEnd("80"), 80)
assert.strictEqual(Model.parseThresholdEnd(""), null)

assert.strictEqual(Model.formatDuration(0), "0m")
assert.strictEqual(Model.formatDuration(20), "<1m")
assert.strictEqual(Model.formatDuration(30), "1m")
assert.strictEqual(Model.formatDuration(59 * 60), "59m")
assert.strictEqual(Model.formatDuration(60 * 60), "1h")
assert.strictEqual(Model.formatDuration(90 * 60), "1h 30m")
assert.strictEqual(Model.formatDuration(2 * 60 * 60), "2h")
assert.strictEqual(Model.formatDuration(NaN), "")

const live = {
  percent: 79,
  limit: 80,
  rateW: 8.714,
  capacityWh: 66.238,
  energyWh: 52.286,
  timeToFull: 1.6 * 3600
}
assert.strictEqual(Model.timeUntilChargeLimit(live), "5m")
assert.ok(Math.abs(Model.secondsUntilChargeLimit(live) - 291) < 1)

const toHundred = Object.assign({}, live, { limit: 100 })
assert.strictEqual(Model.timeUntilChargeLimit(toHundred), "1h 36m")

assert.strictEqual(Model.timeUntilChargeLimit(Object.assign({}, live, { percent: 80, energyWh: 52.9904 })), "-")
assert.strictEqual(Model.timeUntilChargeLimit({ percent: 79, limit: 80, timeToFull: 1.6 * 3600 }), "5m")
assert.strictEqual(Model.timeUntilChargeLimit({ percent: 50, limit: 80, rateW: 20, capacityWh: 60 }), "54m")
assert.strictEqual(Model.timeUntilChargeLimit({ limit: NaN, rateW: 8.7, capacityWh: 66, percent: 79 }), null)
assert.strictEqual(Model.timeUntilChargeLimit({ limit: null, rateW: 8.7, capacityWh: 66, percent: 79, energyWh: 52 }), null)

console.log("ok")
