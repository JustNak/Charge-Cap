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
  dischargedPercent: 0,
  coveredUntil: 0
})
assert.deepStrictEqual(Model.parseCycleLedger("{\"version\":3,\"dischargedPercent\":12.5,\"coveredUntil\":9}\n"), {
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
  ["/bin/sh", "-c", [
    "mkdir -p -- \"$1\" || exit 1",
    "tmp=$(mktemp \"$1/cycles.json.XXXXXX\") || exit 1",
    "if ! printf '%s\\n' \"$2\" > \"$tmp\"; then rm -f -- \"$tmp\"; exit 1; fi",
    "mv -f -- \"$tmp\" \"$1/cycles.json\""
  ].join("\n"), "cycle-cap", "/tmp/charge-cap-cycles",
    "{\"version\":3,\"dischargedPercent\":10.5,\"coveredUntil\":99}"]
)

assert.strictEqual(Model.dischargeStateCounts(undefined), true)
assert.strictEqual(Model.dischargeStateCounts(NaN), true)
assert.strictEqual(Model.dischargeStateCounts(0), true)
assert.strictEqual(Model.dischargeStateCounts(1), false)
assert.strictEqual(Model.dischargeStateCounts(2), true)
assert.strictEqual(Model.dischargeStateCounts(3), true)
assert.strictEqual(Model.dischargeStateCounts(4), false)
assert.strictEqual(Model.dischargeStateCounts(5), false)
assert.strictEqual(Model.dischargeStateCounts(6), true)

const pendingLimit = Model.advanceCycleLedger(null, [
  { t: 1000, percent: 80, state: 5 },
  { t: 1000 + 180, percent: 78, state: 5 },
  { t: 1000 + 200, percent: 79, state: 5 }
])
assert.strictEqual(pendingLimit.cycles, 0)

const realDrain = Model.advanceCycleLedger(null, [
  { t: 1000, percent: 80, state: 2 },
  { t: 1000 + 180, percent: 78, state: 2 },
  { t: 1000 + 200, percent: 79, state: 2 }
])
assert.strictEqual(realDrain.dischargedPercent, 2)
assert.strictEqual(realDrain.cycles, 0.02)

const limitThenDischarge = Model.advanceCycleLedger(null, [
  { t: 1000, percent: 80, state: 5 },
  { t: 1000 + 2 * 3600, percent: 40, state: 2 }
])
assert.strictEqual(limitThenDischarge.dischargedPercent, 40)

assert.deepStrictEqual(
  Model.beginCycleTracking('{"version":2,"dischargedPercent":1108,"coveredUntil":1790130677}'),
  { ledger: { dischargedPercent: 0, coveredUntil: 0 }, ready: true, corrupt: false }
)
assert.deepStrictEqual(
  Model.beginCycleTracking('{"version":3,"dischargedPercent":743,"coveredUntil":9}'),
  { ledger: { dischargedPercent: 743, coveredUntil: 9 }, ready: true, corrupt: false }
)
assert.deepStrictEqual(
  Model.beginCycleTracking("{"),
  { ledger: { dischargedPercent: 0, coveredUntil: 0 }, ready: true, corrupt: true }
)

const notReady = {
  ready: false,
  ledger: { dischargedPercent: 0, coveredUntil: 0 },
  dirty: false,
  firmwareCycles: -1,
  calculatedCycles: -1
}
assert.strictEqual(
  Model.reduceCycleReport(notReady, "firmware\t0\npoint\t1000\t80\t2\npoint\t5000\t40\t2\n"),
  notReady
)

const continued = Model.reduceCycleReport(
  {
    ready: true,
    dirty: false,
    firmwareCycles: -1,
    calculatedCycles: 7.43,
    ledger: { dischargedPercent: 743, coveredUntil: 5000 }
  },
  "firmware\t0\npoint\t6000\t80\t2\npoint\t9600\t70\t2\n"
)
assert.ok(continued.ledger.dischargedPercent >= 743)
assert.ok(continued.ledger.coveredUntil >= 5000)
assert.strictEqual(continued.ledger.dischargedPercent, 753)
assert.strictEqual(continued.firmwareCycles, -1)

const newer = [
  { t: 2000, percent: 90, state: 2 },
  { t: 5600, percent: 80, state: 2 }
]
assert.ok(Model.advanceCycleLedger(null, newer).dischargedPercent < 743)
const heldNewer = Model.reduceCycleReport(
  {
    ready: true,
    dirty: false,
    firmwareCycles: -1,
    calculatedCycles: 7.43,
    ledger: { dischargedPercent: 743, coveredUntil: 1000 }
  },
  "firmware\t0\npoint\t2000\t90\t2\npoint\t5600\t80\t2\n"
)
assert.ok(heldNewer.ledger.dischargedPercent >= 743)
assert.ok(heldNewer.ledger.coveredUntil >= 1000)

const heldOld = Model.reduceCycleReport(
  {
    ready: true,
    dirty: false,
    firmwareCycles: -1,
    calculatedCycles: 7.43,
    ledger: { dischargedPercent: 743, coveredUntil: 5000 }
  },
  "firmware\t0\npoint\t1000\t90\t2\npoint\t4000\t40\t2\n"
)
assert.strictEqual(heldOld.ledger.dischargedPercent, 743)

const settled = Model.settleCycleLedger(
  { dischargedPercent: 743, coveredUntil: 50 },
  { dischargedPercent: 10, coveredUntil: 999, cycles: 0.1 }
)
assert.strictEqual(settled.dischargedPercent, 743)
assert.strictEqual(settled.coveredUntil, 50)
assert.strictEqual(settled.cycles, 743 / 100)

const rewound = Model.settleCycleLedger(
  { dischargedPercent: 793, coveredUntil: 10000 },
  { dischargedPercent: 793, coveredUntil: 3000, cycles: 7.93 }
)
assert.strictEqual(rewound.dischargedPercent, 793)
assert.strictEqual(rewound.coveredUntil, 10000)

function reportFrom(points) {
  return "firmware\t0\n" + points.map(function(p) {
    return "point\t" + p.t + "\t" + p.percent + "\t" + p.state
  }).join("\n") + "\n"
}
const saved = {
  ready: true,
  dirty: false,
  firmwareCycles: -1,
  calculatedCycles: 7.93,
  ledger: { dischargedPercent: 793, coveredUntil: 10000 }
}
const tail = [
  { t: 1000, percent: 80, state: 2 },
  { t: 2000, percent: 50, state: 2 },
  { t: 3000, percent: 80, state: 2 }
]
const withGap = tail.concat([
  { t: 8000, percent: 80, state: 2 },
  { t: 9000, percent: 50, state: 2 }
])
const trimmed = Model.reduceCycleReport(saved, reportFrom(tail))
assert.strictEqual(trimmed.ledger.dischargedPercent, 793)
assert.strictEqual(trimmed.ledger.coveredUntil, 10000)
assert.strictEqual(trimmed.dirty, false)
const replayed = Model.reduceCycleReport(
  {
    ready: true,
    dirty: trimmed.dirty,
    firmwareCycles: -1,
    calculatedCycles: trimmed.calculatedCycles,
    ledger: trimmed.ledger
  },
  reportFrom(withGap)
)
assert.strictEqual(replayed.ledger.dischargedPercent, 793)
assert.strictEqual(replayed.ledger.coveredUntil, 10000)

assert.ok(reportCmd[2].indexOf("type") >= 0)
assert.ok(reportCmd[2].indexOf("scope") >= 0)
assert.ok(reportCmd[2].indexOf("Device") >= 0)
assert.ok(reportCmd[2].indexOf("native-path") >= 0)
assert.ok(reportCmd[2].indexOf("point\\t%s\\t%s\\t%s") !== -1 || reportCmd[2].indexOf("point\t%s\t%s\t%s") !== -1)

console.log("ok")
