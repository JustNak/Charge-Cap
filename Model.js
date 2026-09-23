function clampIndex(index, length) {
  if (length <= 0) return 0
  return Math.max(0, Math.min(length - 1, index))
}

function selectProfileIndex(index, delta, profiles) {
  var values = Array.isArray(profiles) ? profiles : []
  if (values.length === 0) return 0
  return clampIndex(index + delta, values.length)
}

function parseKeyValue(raw) {
  var next = {}
  var lines = String(raw || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var idx = lines[i].indexOf("\t")
    if (idx <= 0) continue
    next[lines[i].substring(0, idx)] = lines[i].substring(idx + 1).trim()
  }
  return next
}

function parseProfiles(raw, previousIndex) {
  var lines = String(raw || "").split("\n")
  var list = []
  var active = ""
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (!line) continue
    var parts = line.split("\t")
    list.push(parts[0])
    if (parts[1] === "1") active = parts[0]
  }
  return {
    profiles: list,
    activeProfile: active,
    profileIndex: clampIndex(previousIndex || 0, list.length)
  }
}

function profileIcon(name) {
  if (name === "power-saver") return "󰌪"
  if (name === "balanced") return "󰊚"
  if (name === "performance") return "󰓅"
  return "󰂄"
}

function batteryFraction(device) {
  return device && device.isPresent ? Math.max(0, Math.min(1, device.percentage)) : 0
}

function chargeThresholdActive(device, onBattery, states) {
  var d = device || {}
  var s = states || {}
  if (!(d && d.isPresent && !onBattery)) return false

  var fraction = batteryFraction(d)
  if (d.state === s.Discharging) return false
  if (d.state === s.PendingCharge) return true
  if (d.state === s.FullyCharged && fraction < 0.99) return true
  if (d.state !== s.Charging || fraction >= 0.99) return false

  return Number(d.changeRate || 0) <= 0.2 || Number(d.timeToFull || 0) >= 8 * 60 * 60
}

function batteryIcon(device, onBattery, states) {
  var d = device || {}
  if (!d.isPresent) return ""

  var chargingIcons = ["󰢜", "󰂆", "󰂇", "󰂈", "󰢝", "󰂉", "󰢞", "󰂊", "󰂋", "󰂅"]
  var defaultIcons = ["󰁺", "󰁻", "󰁼", "󰁽", "󰁾", "󰁿", "󰂀", "󰂁", "󰂂", "󰁹"]
  var index = Math.max(0, Math.min(9, Math.floor(d.percentage * 10)))
  var threshold = chargeThresholdActive(d, onBattery, states)

  if (threshold) return defaultIcons[index]
  if (d.state === states.FullyCharged) return "󰂅"
  if (!onBattery) return chargingIcons[index]
  return defaultIcons[index]
}

function modeLabel(device, onBattery, states) {
  var d = device || {}
  if (!d.isPresent) return ""

  var percentage = d.isPresent ? d.percentage : 0
  if (chargeThresholdActive(d, onBattery, states)) return "Threshold"
  if (onBattery) return "On battery"
  if (!onBattery && percentage >= 1) return "Fully charged"
  return "Charging"
}

function chargeLimitMin() {
  return 60
}

function chargeLimitMax() {
  return 100
}

function clampChargeLimit(n) {
  var v = Math.round(Number(n))
  if (!isFinite(v)) v = chargeLimitMin()
  return Math.max(chargeLimitMin(), Math.min(chargeLimitMax(), v))
}

function parseChargeLimit(raw) {
  var text = String(raw || "").trim()
  if (!text) return null
  var match = text.match(/^(\d{1,3})\s*%?$/)
  if (!match) match = text.match(/(\d{1,3})\s*%/)
  if (!match) return null
  var n = Number(match[1])
  if (!isFinite(n) || n < 0 || n > 100) return null
  return n
}

function parseLeadingNumber(raw) {
  var match = String(raw || "").match(/-?\d+(?:\.\d+)?/)
  if (!match) return NaN
  return Number(match[0])
}

function parseThresholdEnd(raw) {
  var text = String(raw || "").trim()
  if (!text) return null
  var matches = text.match(/\d{1,3}(?=\s*%)/g)
  if (matches && matches.length > 0) {
    var n = Number(matches[matches.length - 1])
    if (isFinite(n) && n >= 0 && n <= 100) return n
  }
  return parseChargeLimit(text)
}

function formatDuration(seconds) {
  var s = Number(seconds)
  if (!isFinite(s) || s < 0) return ""
  if (s === 0) return "0m"
  var totalMinutes = Math.round(s / 60)
  if (totalMinutes < 1) return "<1m"
  if (totalMinutes < 60) return totalMinutes + "m"
  var hours = Math.floor(totalMinutes / 60)
  var minutes = totalMinutes % 60
  if (minutes === 0) return hours + "h"
  return hours + "h " + minutes + "m"
}

function secondsUntilChargeLimit(input) {
  var i = input || {}
  if (i.limit == null || i.limit === "") return null
  var limit = Number(i.limit)
  if (!isFinite(limit) || limit <= 0) return null

  var percent = Number(i.percent)
  var energy = Number(i.energyWh)
  var capacity = Number(i.capacityWh)
  if ((!isFinite(capacity) || capacity <= 0) && isFinite(energy) && energy > 0 && isFinite(percent) && percent > 0) {
    capacity = energy / (percent / 100)
  }

  var currentEnergy = NaN
  if (isFinite(energy) && energy >= 0) currentEnergy = energy
  else if (isFinite(capacity) && capacity > 0 && isFinite(percent)) currentEnergy = capacity * percent / 100

  if (isFinite(currentEnergy) && isFinite(capacity) && capacity > 0) {
    var remaining = capacity * Math.min(limit, 100) / 100 - currentEnergy
    if (remaining <= 0) return 0
    var rate = Number(i.rateW)
    if (!isFinite(rate) || rate <= 0) rate = Number(i.changeRate)
    if (isFinite(rate) && rate > 0) return remaining / rate * 3600
  }

  // UPower's timeToFull is to 100%, not the charge-end threshold.
  var ttf = Number(i.timeToFull)
  if (!isFinite(ttf) || ttf <= 0 || !isFinite(percent)) return null
  var toLimit = limit - percent
  if (toLimit <= 0) return 0
  var toFull = 100 - percent
  if (toFull <= 0) return 0
  return ttf * toLimit / toFull
}

function timeUntilChargeLimit(input) {
  var seconds = secondsUntilChargeLimit(input)
  if (seconds === null) return null
  if (seconds <= 0) return "-"
  return formatDuration(seconds)
}

// Kernel ABI: cycle_count of 0 means the firmware did not report a counter.
function firmwareCycleCount(raw) {
  var text = String(raw == null ? "" : raw).trim()
  if (!/^\d+$/.test(text)) return null
  var n = Number(text)
  if (!isFinite(n) || n <= 0) return null
  return n
}

function parseCycleReport(raw) {
  var firmware = null
  var sawFirmware = false
  var points = []
  var lines = String(raw || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var parts = lines[i].trim().split("\t")
    if (parts[0] === "firmware" && parts.length >= 2) {
      sawFirmware = true
      firmware = firmwareCycleCount(parts[1])
    } else if (parts[0] === "point" && parts.length >= 3) {
      var t = Number(parts[1])
      var percent = Number(parts[2])
      if (isFinite(t) && isFinite(percent)) {
        var state = parts.length >= 4 ? Number(parts[3]) : NaN
        points.push({ t: t, percent: percent, state: state })
      }
    }
  }
  if (!sawFirmware && points.length === 0) return null
  return { firmware: firmware, points: points }
}

function parseCycleLedger(raw) {
  if (!raw || !String(raw).trim()) return { dischargedPercent: 0, coveredUntil: 0 }
  var parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  // Version 3 is the state-aware ledger. Older files are replayed from history.
  if (Number(parsed.version) !== 3) return { dischargedPercent: 0, coveredUntil: 0 }
  var discharged = Number(parsed.dischargedPercent)
  var coveredUntil = Number(parsed.coveredUntil)
  if (!isFinite(discharged) || discharged < 0 || !isFinite(coveredUntil) || coveredUntil < 0) return null
  return { dischargedPercent: discharged, coveredUntil: coveredUntil }
}

function dischargeStateCounts(state) {
  var n = Number(state)
  if (!isFinite(n)) return true
  if (n === 1 || n === 4 || n === 5) return false
  return true
}

function validChargePoint(point) {
  var percent = Number(point && point.percent)
  var t = Number(point && point.t)
  if (!(percent > 0 && percent <= 100) || !(t > 0)) return null
  return { t: t, percent: percent, state: Number(point.state) }
}

// About 200W on a laptop pack. A larger step that fast is a bad sample, not use.
function plausibleDischarge(drop, dtSeconds) {
  if (!(drop > 0) || drop > 100) return false
  if (drop <= 2) return true
  if (!(dtSeconds > 0)) return false
  return drop / (dtSeconds / 3600) <= 300
}

// One charge cycle is 100 percentage points discharged, including partial drains.
// Depth is measured from a local peak to the trough before the battery rises.
// A dip of 2% or less that returns to that peak within two minutes is gauge
// chatter at a charge limit, not a cycle. A drain that is already deeper than
// that, or older than two minutes, is stored at the trough so the next sample
// only adds further decline. Charging, fully charged, and pending-charge at
// the trough are limit dips: anchor them, but do not count them.
function accountDischarge(points, coveredUntil) {
  var until = Number(coveredUntil)
  if (!isFinite(until) || until < 0) until = 0
  var sorted = (points || []).slice().sort(function(a, b) { return a.t - b.t })
  var peak = null
  var trough = null
  var closed = 0
  var endT = until
  for (var i = 0; i < sorted.length; i++) {
    var point = validChargePoint(sorted[i])
    if (!point) continue
    endT = point.t
    if (point.t <= until) {
      peak = point
      trough = point
      continue
    }
    if (!peak) {
      peak = point
      trough = point
      continue
    }
    if (point.percent < trough.percent - 0.05) {
      var depth = peak.percent - point.percent
      if (plausibleDischarge(depth, point.t - peak.t)) trough = point
      continue
    }
    if (point.percent <= trough.percent + 0.05) continue
    var drop = peak.percent - trough.percent
    if (drop > 0.05) {
      var span = point.t - peak.t
      var restored = point.percent >= peak.percent - 0.05
      var chatter = drop <= 2 && restored && span <= 120
      if (!chatter && plausibleDischarge(drop, trough.t - peak.t) && dischargeStateCounts(trough.state)) closed += drop
    }
    peak = point
    trough = point
  }
  var openDrop = 0
  var persistUntil = endT
  if (peak && trough && peak.percent - trough.percent > 0.05) {
    var open = peak.percent - trough.percent
    var age = trough.t - peak.t
    // Commit a drain once it is too deep or too old to be a two-minute blip,
    // and remember the trough. A later sample then only adds further decline.
    if ((open > 2 || age > 120) && plausibleDischarge(open, age)) {
      if (dischargeStateCounts(trough.state)) openDrop = open
      persistUntil = trough.t
    } else {
      persistUntil = peak.t
    }
  }
  return {
    closed: Math.round(closed * 1000) / 1000,
    openDrop: Math.round(openDrop * 1000) / 1000,
    coveredUntil: persistUntil
  }
}

function advanceCycleLedger(ledger, points) {
  var base = 0
  var until = 0
  if (ledger) {
    var discharged = Number(ledger.dischargedPercent)
    var covered = Number(ledger.coveredUntil)
    if (isFinite(discharged) && discharged >= 0) base = discharged
    if (isFinite(covered) && covered >= 0) until = covered
  }
  var delta = accountDischarge(points, until)
  var total = Math.round((base + delta.closed + delta.openDrop) * 1000) / 1000
  return {
    dischargedPercent: total,
    coveredUntil: delta.coveredUntil,
    cycles: total / 100
  }
}

function settleCycleLedger(previous, next) {
  if (!previous) return next
  var prevTotal = Number(previous.dischargedPercent)
  var prevUntil = Number(previous.coveredUntil)
  if (!isFinite(prevTotal) || !isFinite(prevUntil)) return next
  var nextTotal = Number(next && next.dischargedPercent)
  if (isFinite(nextTotal) && prevTotal - nextTotal > 1e-6) {
    return {
      dischargedPercent: prevTotal,
      coveredUntil: prevUntil,
      cycles: prevTotal / 100
    }
  }
  return next
}

function beginCycleTracking(raw) {
  var parsed = parseCycleLedger(raw)
  if (parsed === null) {
    return { ledger: { dischargedPercent: 0, coveredUntil: 0 }, ready: true, corrupt: true }
  }
  return { ledger: parsed, ready: true, corrupt: false }
}

function reduceCycleReport(state, raw) {
  if (!state || state.ready !== true) return state
  var report = parseCycleReport(raw)
  if (report === null) return state
  if (report.firmware !== null) {
    return {
      ready: state.ready,
      ledger: state.ledger,
      firmwareCycles: report.firmware,
      calculatedCycles: state.calculatedCycles,
      dirty: state.dirty
    }
  }
  var ledger = state.ledger || { dischargedPercent: 0, coveredUntil: 0 }
  if (report.points.length === 0) {
    var calculated = state.calculatedCycles
    var discharged = Number(ledger.dischargedPercent)
    var covered = Number(ledger.coveredUntil)
    if (discharged > 0 || covered > 0) calculated = discharged / 100
    return {
      ready: state.ready,
      ledger: ledger,
      firmwareCycles: -1,
      calculatedCycles: calculated,
      dirty: state.dirty
    }
  }
  var next = settleCycleLedger(ledger, advanceCycleLedger(ledger, report.points))
  var changed = Number(next.dischargedPercent) !== Number(ledger.dischargedPercent) ||
    Number(next.coveredUntil) !== Number(ledger.coveredUntil)
  return {
    ready: state.ready,
    ledger: {
      dischargedPercent: next.dischargedPercent,
      coveredUntil: next.coveredUntil
    },
    firmwareCycles: -1,
    calculatedCycles: next.cycles,
    dirty: state.dirty === true || changed
  }
}

function formatChargeCycles(cycles) {
  var n = Number(cycles)
  if (!isFinite(n) || n < 0) return ""
  var rounded = Math.round(n * 10) / 10
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded))
  return rounded.toFixed(1)
}

function cycleReportCommand() {
  var script = [
    "bat=",
    "for d in /sys/class/power_supply/*; do",
    "[ -r \"$d/type\" ] || continue",
    "[ \"$(cat \"$d/type\")\" = \"Battery\" ] || continue",
    "if [ -e \"$d/scope\" ] && [ \"$(cat \"$d/scope\" 2>/dev/null)\" = \"Device\" ]; then continue; fi",
    "if [ -r \"$d/energy_now\" ] || [ -r \"$d/charge_now\" ] || [ -r \"$d/capacity\" ]; then bat=$d; break; fi",
    "done",
    "[ -n \"$bat\" ] || exit 0",
    "fw=0",
    "if [ -r \"$bat/cycle_count\" ]; then fw=$(cat \"$bat/cycle_count\"); fi",
    "printf 'firmware\\t%s\\n' \"$fw\"",
    "name=$(basename \"$bat\")",
    "obj=",
    "for p in $(upower -e 2>/dev/null); do",
    "np=$(upower -i \"$p\" 2>/dev/null | awk '/native-path/ { sub(/^.*native-path:[[:space:]]*/, \"\"); sub(/[[:space:]]+$/, \"\"); print; exit }')",
    "[ \"$np\" = \"$name\" ] || continue",
    "obj=$p",
    "break",
    "done",
    "if [ -z \"$obj\" ]; then",
    "obj=$(upower -e 2>/dev/null | awk '/\\/battery_/ && !/DisplayDevice/ && !/hid/ { print; exit }')",
    "fi",
    "if [ -n \"$obj\" ]; then",
    "busctl call org.freedesktop.UPower \"$obj\" org.freedesktop.UPower.Device GetHistory suu charge 0 60 2>/dev/null | awk '{ for (i = 3; i + 2 <= NF; i += 3) printf \"point\\t%s\\t%s\\t%s\\n\", $i, $(i+1), $(i+2) }'",
    "fi"
  ].join("\n")
  return ["/bin/sh", "-c", script]
}

function cycleLedgerWriteCommand(dir, ledger) {
  var directory = String(dir || "")
  if (directory.charAt(0) !== "/" || directory.indexOf("\n") >= 0) return null
  var entry = ledger || {}
  var discharged = Number(entry.dischargedPercent)
  var coveredUntil = Number(entry.coveredUntil)
  if (!isFinite(discharged) || discharged < 0 || !isFinite(coveredUntil) || coveredUntil < 0) return null
  var payload = JSON.stringify({
    version: 3,
    dischargedPercent: Math.round(discharged * 1000) / 1000,
    coveredUntil: coveredUntil
  })
  var script = [
    "mkdir -p -- \"$1\" || exit 1",
    "tmp=$(mktemp \"$1/cycles.json.XXXXXX\") || exit 1",
    "if ! printf '%s\\n' \"$2\" > \"$tmp\"; then rm -f -- \"$tmp\"; exit 1; fi",
    "mv -f -- \"$tmp\" \"$1/cycles.json\""
  ].join("\n")
  return ["/bin/sh", "-c", script, "cycle-cap", directory, payload]
}

function isThresholdPath(path) {
  return /^\/sys\/class\/power_supply\/BAT[A-Za-z0-9._-]+\/charge_control_end_threshold$/.test(String(path || ""))
}

function findThresholdPath(listing) {
  var lines = String(listing || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (isThresholdPath(line)) return line
  }
  return null
}

function noneWriter() {
  return { kind: "none" }
}

function writerAvailable(writer) {
  return !!(writer && writer.kind && writer.kind !== "none")
}

function pickWriter(facts) {
  var f = facts || {}
  var path = isThresholdPath(f.thresholdPath) ? f.thresholdPath : null
  if (!path) return noneWriter()
  if (f.hasAsusctl) return { kind: "asusctl" }
  if (f.sysfsWritable) return { kind: "sysfs", path: path, privileged: false }
  if (f.hasPkexec) return { kind: "sysfs", path: path, privileged: true }
  return noneWriter()
}

function writeCommand(writer, percent) {
  var n = clampChargeLimit(percent)
  if (!writer) return null
  if (writer.kind === "asusctl")
    return ["/usr/bin/asusctl", "battery", "limit", String(n)]
  if (writer.kind === "sysfs" && isThresholdPath(writer.path)) {
    var script = "printf '%s\\n' \"$1\" > \"$2\""
    var argv = ["/bin/sh", "-c", script, "charge-cap", String(n), writer.path]
    if (writer.privileged) argv.unshift("/usr/bin/pkexec")
    return argv
  }
  return null
}

function readState(raw, writer) {
  if (!writerAvailable(writer)) return { kind: "unavailable" }
  var parsed = parseChargeLimit(raw)
  if (parsed === null) return { kind: "unavailable" }
  return { kind: "ready", value: clampChargeLimit(parsed) }
}

if (typeof module !== "undefined") {
  module.exports = {
    clampIndex: clampIndex,
    selectProfileIndex: selectProfileIndex,
    parseKeyValue: parseKeyValue,
    parseProfiles: parseProfiles,
    profileIcon: profileIcon,
    batteryFraction: batteryFraction,
    chargeThresholdActive: chargeThresholdActive,
    batteryIcon: batteryIcon,
    modeLabel: modeLabel,
    chargeLimitMin: chargeLimitMin,
    chargeLimitMax: chargeLimitMax,
    clampChargeLimit: clampChargeLimit,
    parseChargeLimit: parseChargeLimit,
    parseLeadingNumber: parseLeadingNumber,
    parseThresholdEnd: parseThresholdEnd,
    formatDuration: formatDuration,
    secondsUntilChargeLimit: secondsUntilChargeLimit,
    timeUntilChargeLimit: timeUntilChargeLimit,
    firmwareCycleCount: firmwareCycleCount,
    dischargeStateCounts: dischargeStateCounts,
    parseCycleReport: parseCycleReport,
    parseCycleLedger: parseCycleLedger,
    settleCycleLedger: settleCycleLedger,
    beginCycleTracking: beginCycleTracking,
    reduceCycleReport: reduceCycleReport,
    advanceCycleLedger: advanceCycleLedger,
    formatChargeCycles: formatChargeCycles,
    cycleReportCommand: cycleReportCommand,
    cycleLedgerWriteCommand: cycleLedgerWriteCommand,
    isThresholdPath: isThresholdPath,
    findThresholdPath: findThresholdPath,
    noneWriter: noneWriter,
    writerAvailable: writerAvailable,
    pickWriter: pickWriter,
    writeCommand: writeCommand,
    readState: readState
  }
}
