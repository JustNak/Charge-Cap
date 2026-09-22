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

assert.strictEqual(Model.firmwareCycleCount("0"), null)
assert.strictEqual(Model.firmwareCycleCount(" 0\n"), null)
assert.strictEqual(Model.firmwareCycleCount(""), null)
assert.strictEqual(Model.firmwareCycleCount("N/A"), null)
assert.strictEqual(Model.firmwareCycleCount("26"), 26)

const report = Model.parseCycleReport("firmware\t0\npoint\t1000\t80\npoint\t1002\t79\npoint\t8200\t55\npoint\t8202\t0\npoint\t8202\t55\n")
assert.strictEqual(report.firmware, null)
assert.strictEqual(report.points.length, 5)
assert.strictEqual(Model.parseCycleReport(""), null)

const first = Model.advanceCycleLedger(null, report.points)
assert.strictEqual(first.dischargedPercent, 25)
assert.strictEqual(first.coveredUntil, 8200)
assert.strictEqual(first.cycles, 0.25)
const again = Model.advanceCycleLedger(first, report.points)
assert.strictEqual(again.dischargedPercent, 25)
assert.strictEqual(again.coveredUntil, 8202)
assert.strictEqual(again.cycles, 0.25)

const closed = Model.advanceCycleLedger(first, report.points.concat([{ t: 20000, percent: 80 }]))
assert.strictEqual(closed.dischargedPercent, 25)
assert.strictEqual(closed.coveredUntil, 20000)
assert.strictEqual(closed.cycles, 0.25)
const closedAgain = Model.advanceCycleLedger(closed, report.points.concat([{ t: 20000, percent: 80 }]))
assert.strictEqual(closedAgain.dischargedPercent, 25)
assert.strictEqual(closedAgain.cycles, 0.25)

const glitch = Model.advanceCycleLedger(null, [
  { t: 10, percent: 90 },
  { t: 12, percent: 50 }
])
assert.strictEqual(glitch.cycles, 0)

const sleep = Model.advanceCycleLedger(null, [
  { t: 1000, percent: 90 },
  { t: 1000 + 4 * 3600, percent: 70 }
])
assert.strictEqual(sleep.cycles, 0.2)

const bounce = Model.advanceCycleLedger(null, [
  { t: 1000, percent: 80 },
  { t: 1030, percent: 79 },
  { t: 1060, percent: 80 }
])
assert.strictEqual(bounce.cycles, 0)
assert.strictEqual(bounce.dischargedPercent, 0)

const chatter = Model.advanceCycleLedger(null, [
  { t: 1000, percent: 80 },
  { t: 1020, percent: 79 },
  { t: 1040, percent: 78 },
  { t: 1100, percent: 80 }
])
assert.strictEqual(chatter.cycles, 0)

const used = Model.advanceCycleLedger(null, [
  { t: 1000, percent: 100 },
  { t: 1000 + 2 * 3600, percent: 50 },
  { t: 1000 + 3 * 3600, percent: 100 }
])
assert.strictEqual(used.dischargedPercent, 50)
assert.strictEqual(used.cycles, 0.5)
assert.strictEqual(Model.advanceCycleLedger(used, [
  { t: 1000, percent: 100 },
  { t: 1000 + 2 * 3600, percent: 50 },
  { t: 1000 + 3 * 3600, percent: 100 }
]).dischargedPercent, 50)

assert.deepStrictEqual(Model.parseCycleLedger(""), { dischargedPercent: 0, coveredUntil: 0 })
assert.strictEqual(Model.parseCycleLedger("{"), null)
assert.deepStrictEqual(Model.parseCycleLedger("{\"dischargedPercent\":1049,\"coveredUntil\":9}\n"), {
  dischargedPercent: 0,
  coveredUntil: 0
})
assert.deepStrictEqual(Model.parseCycleLedger("{\"version\":2,\"dischargedPercent\":12.5,\"coveredUntil\":9}\n"), {
  dischargedPercent: 12.5,
  coveredUntil: 9
})

assert.strictEqual(Model.formatChargeCycles(10.5), "10.5")
assert.strictEqual(Model.formatChargeCycles(10), "10")
assert.strictEqual(Model.formatChargeCycles(0), "0")
assert.strictEqual(Model.formatChargeCycles(-1), "")

const reportCmd = Model.cycleReportCommand()
assert.strictEqual(reportCmd[0], "/bin/sh")
assert.ok(reportCmd[2].indexOf("printf 'firmware\\t%s\\n'") !== -1 || reportCmd[2].indexOf("printf 'firmware\t%s\n'") !== -1)
assert.ok(reportCmd[2].indexOf("GetHistory suu charge 0 60") >= 0)
assert.strictEqual(Model.cycleLedgerWriteCommand("", { dischargedPercent: 1, coveredUntil: 2 }), null)
assert.deepStrictEqual(
  Model.cycleLedgerWriteCommand("/tmp/charge-cap-cycles", { dischargedPercent: 10.5, coveredUntil: 99 }),
  ["/bin/sh", "-c", "mkdir -p -- \"$1\" && printf '%s\\n' \"$2\" > \"$1/cycles.json\"", "cycle-cap", "/tmp/charge-cap-cycles",
    "{\"version\":2,\"dischargedPercent\":10.5,\"coveredUntil\":99}"]
)

console.log("ok")
