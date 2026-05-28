"""Govee scene encoding for the Home Assistant LAN component."""

import base64


class GoveeLanError(Exception):
    """Raised when a Govee LAN command cannot be encoded or sent."""


def _finish(data: list[int]) -> list[int]:
    checksum = 0
    for b in data:
        checksum ^= b
    data = list(data)
    while len(data) < 19:
        data.append(0)
    data.append(checksum)
    return data


# Model-specific BLE scene encoding parameters.
# Reference: https://github.com/AlgoClaw/Govee/blob/main/decoded/v1.2/model_specific_parameters.json
_GENERIC_SCENE_SKUS = {
    "H6039",
    "H6072",
    "H6167",
    "H6172",
    "H619C",
    "H61A2",
    "H61A8",
    "H61F2",
    "H7039",
    "H7075",
    "H70C2",
    "H805A",
}
_GENERIC_SCENE_TYPE = {"remove": b"", "add": b"\x02", "suffix": b""}
_NO_PREFIX_SCENE_TYPE = {"remove": b"", "add": b"", "suffix": b""}
_GENERIC_SCENE_PROFILE = {
    "multi_prefix": 0xa3,
    "on_command": False,
    "types": [_GENERIC_SCENE_TYPE],
}
_UNKNOWN_SCENE_PROFILE = {
    "multi_prefix": 0xa3,
    "on_command": False,
    "types": [],
}
_SCENE_PROFILES: dict[str, dict] = {
    sku: _GENERIC_SCENE_PROFILE for sku in _GENERIC_SCENE_SKUS
}
_SCENE_PROFILES.update(
    {
        "H610A": {
            "multi_prefix": 0xa3,
            "on_command": False,
            "types": [_NO_PREFIX_SCENE_TYPE],
        },
        "H6079": {
            "multi_prefix": 0xa3,
            "on_command": True,
            "types": [_NO_PREFIX_SCENE_TYPE],
        },
        "H6022": {
            "multi_prefix": 0xa3,
            "on_command": False,
            "types": [
                {"remove": b"\x41", "add": b"\x58\x5a", "suffix": b""},
                {"remove": b"\x00", "add": b"\x04", "suffix": b""},
            ],
        },
        "H6065": {
            "multi_prefix": 0xa3,
            "on_command": False,
            "types": [
                {
                    "remove": b"\x12\x00\x0c\x00\x0f",
                    "add": b"\x04",
                    "suffix": b"\x02\x47",
                },
                {
                    "remove": b"\x12\x00\x00\x00\x00",
                    "add": b"\x04",
                    "suffix": b"\x00\x47",
                },
            ],
        },
        "H6066": {
            "multi_prefix": 0xa3,
            "on_command": False,
            "types": [
                {
                    "remove": b"\x12\x00\x00\x00\x00",
                    "add": b"\x04",
                    "suffix": b"",
                },
                {"remove": b"\x1d", "add": b"", "suffix": b""},
            ],
        },
        "H6092": {
            "multi_prefix": 0xa3,
            "on_command": True,
            "types": [
                {"remove": b"\x21", "add": b"\x56\x0b", "suffix": b""},
            ],
        },
        "H70C4": {
            "multi_prefix": 0xa4,
            "on_command": False,
            "types": [_NO_PREFIX_SCENE_TYPE],
        },
        "H6052": {
            "multi_prefix": 0xa3,
            "on_command": False,
            "types": [
                {"remove": b"\x01\x11", "add": b"\x07", "suffix": b""},
            ],
        },
    }
)


def _scene_packets(sku: str, scene_code: int, scene_param: str) -> list[str]:
    """Encode a scene command for the ptReal LAN API.

    For scenes with no sceneParam only the scene-code packet is sent.
    For scenes with sceneParam the payload is wrapped in multi-packets
    with model-specific prefix transforms applied first.

    References:
    - https://github.com/AlgoClaw/Govee/blob/main/decoded/v1.2/explanation_v1.2.md
    - https://github.com/egold555/Govee-Reverse-Engineering/issues/11
    """
    lo = scene_code & 0xFF
    hi = (scene_code >> 8) & 0xFF
    packets: list[int] = []
    profile = _SCENE_PROFILES.get(sku.upper(), _UNKNOWN_SCENE_PROFILE)
    scene_type = {"suffix": b""}

    if profile["on_command"]:
        packets.extend(_finish([0x33, 0x01, 0x01]))

    if scene_param:
        raw = bytearray(base64.b64decode(scene_param))
        if not profile["types"]:
            raise GoveeLanError(
                f"Scene parameter encoding is not known for SKU {sku.upper()}"
            )

        for pt in profile["types"]:
            remove = pt["remove"]
            if raw.startswith(remove):
                scene_type = pt
                raw = bytearray(pt["add"]) + raw[len(remove):]
                break
        else:
            scene_type = _GENERIC_SCENE_TYPE
            raw = bytearray(_GENERIC_SCENE_TYPE["add"]) + raw

        multi_prefix = profile["multi_prefix"]
        data: list[int] = [multi_prefix, 0x00, 0x01, 0x00]
        num_lines = 0
        last_line_marker = 1
        for b in raw:
            if len(data) % 19 == 0:
                num_lines += 1
                data.append(multi_prefix)
                last_line_marker = len(data)
                data.append(num_lines)
            data.append(b)
        data[last_line_marker] = 0xff
        data[3] = num_lines + 1
        for i in range(0, len(data), 19):
            packets.extend(_finish(data[i:i + 19]))

    packets.extend(_finish([0x33, 0x05, 0x04, lo, hi, *scene_type["suffix"]]))
    return [base64.b64encode(bytes(packets[i:i + 20])).decode() for i in range(0, len(packets), 20)]

# Scene code used by all H6022 simple-scene-generator presets.
_SIMPLE_SCENE_CODE = 15626  # 0x3D0A — lo=0x0a, hi=0x3d


def simple_scene_packets(
    type_byte: int,
    subtype_byte: int,
    speed: int,
    colors: list[tuple[int, int, int]],
) -> list[str]:
    """Build H6022 simple-scene-generator packets (base64-encoded 20-byte packets).

    type_byte, subtype_byte: animation type from capture
    speed: 0-100
    colors: list of (r, g, b) tuples, 1-7 colors
    """
    color_bytes = [c for rgb in colors for c in (rgb[0] & 0xFF, rgb[1] & 0xFF, rgb[2] & 0xFF)]
    raw = [0x04, type_byte & 0xFF, subtype_byte & 0xFF, speed & 0xFF, len(color_bytes)] + color_bytes

    data: list[int] = [0xa3, 0x00, 0x01, 0x00]
    num_lines = 0
    last_line_marker = 1
    for b in raw:
        if len(data) % 19 == 0:
            num_lines += 1
            data.append(0xa3)
            last_line_marker = len(data)
            data.append(num_lines)
        data.append(b)
    data[last_line_marker] = 0xff

    if num_lines == 0:
        # Small payload fits in one slot; device requires seq=0x00 on the first
        # packet and a separate a3 ff terminator (always 2 packets minimum).
        data[1] = 0x00
        data[3] = 2
        while len(data) < 19:
            data.append(0x00)
        data.extend([0xa3, 0xff])
    else:
        data[3] = num_lines + 1

    packets: list[int] = []
    for i in range(0, len(data), 19):
        packets.extend(_finish(data[i:i + 19]))

    lo = _SIMPLE_SCENE_CODE & 0xFF
    hi = (_SIMPLE_SCENE_CODE >> 8) & 0xFF
    packets.extend(_finish([0x33, 0x05, lo, hi]))
    return [base64.b64encode(bytes(packets[i:i + 20])).decode() for i in range(0, len(packets), 20)]


def _h6022_block_header(gsize: int, num_groups: int) -> bytearray:
    """6-byte block-info header used in both the main 12-byte header and inter-block headers."""
    return bytearray([gsize + 15, 0x00, 0x03, gsize + 1, 0x00, num_groups])


def _h6022_groups_bytes(groups: list[tuple[tuple[int, int, int], list[int]]]) -> bytearray:
    data = bytearray()
    for (r, g, b), indices in groups:
        if len(indices) > 255:
            raise ValueError(f"Group has {len(indices)} indices; max 255")
        data += bytearray([len(indices), r & 0xFF, g & 0xFF, b & 0xFF])
        data += bytearray(i & 0xFF for i in indices)
    return data


def build_h6022_matrix_scene(
    groups: list[tuple[tuple[int, int, int], list[int]]],
    *,
    level: int = 100,
    mode: int = 0x00,
    rate: int = 0x50,
    background: tuple[int, int, int] = (0, 0, 0),
    bg_brightness: int = 0x00,
) -> str:
    """Build an H6022 matrix scene param (base64) from colour groups and animation params.

    groups:       list of ((r, g, b), [led_index, ...]) pairs.
                  LED indices 0–131; row = index // 12, col = index % 12.
    rate:         movement/twinkle cadence byte; 0x70 appears to stop moving layers.
    level:        0–100, apparent brightness/duty level.
    mode:         direction byte.
    background:   (r, g, b) background/ambient colour stored in the header.
    bg_brightness: background opacity (0–100); 0x00=transparent, 0x64=full.
    """
    groups_data = _h6022_groups_bytes(groups)
    gsize = len(groups_data)
    tail = bytearray([rate & 0xFF, level & 0xFF, mode & 0xFF, 0x00, 0x01,
                      0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00])
    br, bg, bb = background
    main_header = bytearray([
        br & 0xFF, bg & 0xFF, bb & 0xFF,
        bg_brightness & 0xFF,  # background opacity (confirmed by live test 2026-05-27)
        0x00,         # mode: 0x00 = layer (simultaneous), 0x01 = carousel (sequential)
        0x01,         # block count
    ]) + _h6022_block_header(gsize, len(groups))
    data = bytearray([0x41]) + main_header + groups_data + tail
    return base64.b64encode(bytes(data)).decode()


def build_h6022_matrix_scene_multi(
    blocks: list[dict],
    *,
    background: tuple[int, int, int] = (0, 0, 0),
    bg_brightness: int = 0x00,
) -> str:
    """Build a multi-block H6022 matrix scene param.

    blocks: list of dicts, each with:
        'groups': list of ((r, g, b), [led_index, ...]) pairs
        'rate':   movement/twinkle cadence byte (default 0x50)
        'level':  0–100 apparent brightness/duty level (default 100)
        'mode':   direction byte (default 0x00)
    background:   (r, g, b) stored in main header.
    bg_brightness: background opacity (0–100); 0x00=transparent, 0x64=full.

    Blocks are rendered in z-order: block 0 is topmost (obscures later blocks
    on overlapping LEDs). Sending all blocks with the same z-order byte causes
    the firmware to blend additively instead.
    """
    if not blocks:
        raise ValueError("at least one block required")
    rendered: list[tuple[bytearray, bytearray]] = []
    for i, blk in enumerate(blocks):
        grps = blk["groups"]
        rate = blk.get("rate",   0x50) & 0xFF
        lvl  = blk.get("level",  100) & 0xFF
        md   = blk.get("mode",   0x00) & 0xFF
        z_order = (i + 1) & 0xFF  # 1 = topmost, increments per block
        gdata = _h6022_groups_bytes(grps)
        tail  = bytearray([rate, lvl, md, 0x00, z_order, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x00])
        rendered.append((gdata, tail))

    first_gdata, _ = rendered[0]
    br, bg, bb = background
    main_header = bytearray([
        br & 0xFF, bg & 0xFF, bb & 0xFF,
        bg_brightness & 0xFF,  # background opacity (confirmed by live test 2026-05-27)
        0x00,         # mode: 0x00 = layer (simultaneous), 0x01 = carousel (sequential)
        len(blocks),
    ]) + _h6022_block_header(len(first_gdata), len(blocks[0]["groups"]))

    data = bytearray([0x41]) + main_header
    for i, (gdata, tail) in enumerate(rendered):
        if i > 0:
            data += _h6022_block_header(len(gdata), len(blocks[i]["groups"]))
        data += gdata + tail
    return base64.b64encode(bytes(data)).decode()


_SHORT_PRESET_BASES: dict[str, dict] = {
    "breathe":  {"code": 8505, "controls": (0x05, 0x00, 0x23), "palette": [
        (0x00, 0x96, 0x14), (0xdd, 0xdf, 0x00), (0xe3, 0xe5, 0x16), (0xff, 0xab, 0x00),
        (0xf7, 0x79, 0x76), (0xd8, 0x83, 0xff), (0x93, 0x36, 0xfd), (0x3a, 0x86, 0xff),
    ]},
    "gradient": {"code": 8506, "controls": (0x00, 0x00, 0x08), "palette": [
        (0x5a, 0x00, 0x84), (0x6c, 0x00, 0xa5), (0x4b, 0x19, 0xb7), (0x00, 0x8c, 0x00),
        (0x00, 0x95, 0x4c), (0x06, 0x72, 0xff), (0x22, 0x23, 0xf6), (0x00, 0x34, 0xa0),
    ]},
    "graffiti": {"code": 8507, "controls": (0x52, 0x39, 0x48), "palette": [
        (0xff, 0xbe, 0x0b), (0xfb, 0x56, 0x07), (0xff, 0x00, 0x00), (0x83, 0x38, 0xec),
        (0x00, 0x3a, 0xb7), (0x00, 0xff, 0x00), (0x00, 0x00, 0xff), (0x00, 0xff, 0xff),
    ]},
    "dreamlike": {"code": 8508, "controls": (0x0e, 0x0e, 0x55), "palette": [
        (0x52, 0xe3, 0xe1), (0xff, 0xab, 0x00), (0xf7, 0x79, 0x76), (0xd8, 0x83, 0xff), (0x93, 0x36, 0xfd),
    ]},
    "fire": {"code": 8505, "controls": (0x0f, 0x00, 0x23), "palette": [
        (0xff, 0x00, 0x00), (0xff, 0x50, 0x00), (0xff, 0xb4, 0x00), (0xff, 0xff, 0x00),
    ]},
}


def build_h6022_short_preset(
    controls: tuple[int, int, int],
    palette: list[tuple[int, int, int]],
    pairs: list[tuple[int, int]] | None = None,
) -> str:
    """Build an H6022 short-preset scene param (base64).

    controls: (control0, control1, control2) bytes — renderer and speed knobs
    palette:  list of (r, g, b) tuples, 1–8 colors
    pairs:    optional trailing byte pairs for the control0=0xff variant
    """
    import base64 as _b64
    if not palette:
        raise ValueError("palette must have at least 1 color")
    if len(palette) > 8:
        raise ValueError("palette may have at most 8 colors")
    c0, c1, c2 = (x & 0xFF for x in controls)
    palette_bytes = bytearray(b for rgb in palette for b in (rgb[0] & 0xFF, rgb[1] & 0xFF, rgb[2] & 0xFF))
    data = bytearray([0x00, c0, c1, c2, len(palette_bytes)]) + palette_bytes
    if pairs:
        pair_bytes = bytearray(b for pair in pairs for b in (pair[0] & 0xFF, pair[1] & 0xFF))
        if len(pair_bytes) > 255:
            raise ValueError("pair byte data may be at most 255 bytes")
        data.append(len(pair_bytes))
        data.extend(pair_bytes)
    return _b64.b64encode(bytes(data)).decode()
