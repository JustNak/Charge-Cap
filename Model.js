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
  var limit = Number(i.limit)
  if (!isFinite(limit) || limit < 0) return null

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
    isThresholdPath: isThresholdPath,
    findThresholdPath: findThresholdPath,
    noneWriter: noneWriter,
    writerAvailable: writerAvailable,
    pickWriter: pickWriter,
    writeCommand: writeCommand,
    readState: readState
  }
}
