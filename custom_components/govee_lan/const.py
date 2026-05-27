"""Constants for the Govee LAN integration."""

from __future__ import annotations

DOMAIN = "govee_lan"
PLATFORMS = ["light"]

CONF_SKU = "sku"
CONF_DEVICE_ID = "device_id"
CONF_POLL_STATUS = "poll_status"

DEFAULT_NAME = "Govee Lamp"
DEFAULT_SCAN_INTERVAL = 30

DEFAULT_ICON = "mdi:desk-lamp"
MODEL_ICONS = {
    "H610A": "mdi:led-strip-variant",
    "H619B": "mdi:led-strip-variant",
    "H619C": "mdi:led-strip-variant",
    "H619Z": "mdi:led-strip-variant",
    "H6062": "mdi:led-strip-variant",
    "H6065": "mdi:led-strip-variant",
    "H610B": "mdi:led-strip-variant",
    "H6117": "mdi:led-strip-variant",
    "H6159": "mdi:led-strip-variant",
    "H615E": "mdi:led-strip-variant",
    "H6163": "mdi:led-strip-variant",
    "H6172": "mdi:led-strip-variant",
    "H6173": "mdi:led-strip-variant",
    "H618A": "mdi:led-strip-variant",
    "H618C": "mdi:led-strip-variant",
    "H618E": "mdi:led-strip-variant",
    "H618F": "mdi:led-strip-variant",
    "H619A": "mdi:led-strip-variant",
    "H619D": "mdi:led-strip-variant",
    "H619E": "mdi:led-strip-variant",
    "H61A0": "mdi:led-strip-variant",
    "H61A1": "mdi:led-strip-variant",
    "H61A2": "mdi:led-strip-variant",
    "H61A3": "mdi:led-strip-variant",
    "H61A5": "mdi:led-strip-variant",
    "H61A8": "mdi:led-strip-variant",
    "H61E1": "mdi:led-strip-variant",
    "H7050": "mdi:lightbulb",
    "H7051": "mdi:lightbulb",
    "H7055": "mdi:lightbulb",
    "H6072": "mdi:floor-lamp",
    "H6073": "mdi:floor-lamp",
    "H6076": "mdi:floor-lamp",
    "H6078": "mdi:floor-lamp",
    "H7012": "mdi:string-lights",
    "H7013": "mdi:string-lights",
    "H7021": "mdi:string-lights",
    "H7028": "mdi:string-lights",
    "H7041": "mdi:string-lights",
    "H7042": "mdi:string-lights",
    "H7052": "mdi:string-lights",
    "H7060": "mdi:light-flood-down",
    "H7061": "mdi:light-flood-down",
    "H7062": "mdi:light-flood-down",
    "H6046": "mdi:television-ambient-light",
    "H6047": "mdi:television-ambient-light",
    "H6168": "mdi:television-ambient-light",
    "H61B2": "mdi:television-ambient-light",
    "H60A1": "mdi:ceiling-light",
    "H6056": "mdi:led-strip",
    "H6059": "mdi:lightbulb-night",
    "H6061": "mdi:hexagon-multiple",
    "H6066": "mdi:hexagon-multiple",
    "H6067": "mdi:triangle",
    "H6022": "mdi:desk-lamp",
    "H6051": "mdi:desk-lamp",
    "H6087": "mdi:wall-sconce",
    "H705A": "mdi:outdoor-lamp",
    "H705B": "mdi:outdoor-lamp",
    "H7065": "mdi:lightbulb-spot",
}

DEFAULT_COLOR_TEMP_KELVIN = (2000, 9000)
MODEL_COLOR_TEMP_KELVIN = {
    "H60A1": (2200, 6500),
    "H6022": (2700, 6500),
}


SIMPLE_SCENE_DEFAULT_COLORS: list[tuple[int, int, int]] = [
    (0xFF, 0x00, 0x00), (0xFF, 0x7F, 0x00), (0xFF, 0xFF, 0x00),
    (0x00, 0xFF, 0x00), (0x00, 0x00, 0xFF), (0x00, 0xFF, 0xFF), (0x8B, 0x00, 0xFF),
]

# H6022 music visualizer modes discovered from BLE captures.
MUSIC_MODES: dict[str, int] = {
    "Music: Hopping": 0x33,
    "Music: Rhythm": 0x38,
    "Music: Energic": 0x39,
    "Music: Spectrum": 0x54,
    "Music: Color Painting": 0x55,
    "Music: Light Waves": 0x63,
    "Music: Dandelion": 0x64,
    "Music: Meteor Shower": 0x65,
}
MUSIC_MODE_SKUS = {"H6022"}
MUSIC_MODE_DEFAULT_SENSITIVITY = 100

H6022_MATRIX_SCENE_CODE = 8505
H6022_MATRIX_LED_COUNT = 132
H6022_MATRIX_MODES: dict[str, int] = {
    "twinkle": 0x00,
    "up": 0x01,
    "down": 0x02,
    "left": 0x03,
    "right": 0x04,
    "up-left": 0x05,
    "up-right": 0x06,
    "down-left": 0x07,
    "down-right": 0x08,
}
