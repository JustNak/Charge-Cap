# Charge Cap

Charge Cap replaces the Omarchy battery widget with the same popover plus a CHARGE LIMIT slider. The slider writes the firmware charge end threshold through `asusctl`.

## Install

If another clone of `omarchy.power` is already on the bar, such as `zeusveilmon.power`, disable or remove it first. Enable only replaces `omarchy.power` in place.

```sh
omarchy plugin add https://github.com/JustNak/Charge-Cap.git --enable
```

Click the battery button. CHARGE LIMIT sits above POWER PROFILE. Drag the slider and release to apply. Escape closes the popover.

## Hardware

The slider is shown only when both of these exist:

- `/sys/class/power_supply/BAT*/charge_control_end_threshold`
- `/usr/bin/asusctl` (asusd)

Writes use `asusctl battery limit N`. That command talks to asusd over D-Bus. It does not prompt for sudo. The kernel node is root-writable, so a raw sysfs write is not used.

The control range is 60 to 100 percent. asusd itself allows 20 to 100. Charge Cap does not expose values below 60. Persistence is firmware and asusd, not a file in this plugin.

## Remove

```sh
omarchy plugin remove justnak.charge-cap --yes
```

Removal puts `omarchy.power` back in the same bar slot.

## Check

```sh
omarchy plugin validate .
node test/model.js
```
