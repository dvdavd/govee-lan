"""Small blocking client for the Govee LAN UDP API."""

from __future__ import annotations

import base64
from dataclasses import dataclass
import json
import socket
import threading
import time
import urllib.request

from .govee_scene import (
    GoveeLanError,
    _finish,
    _scene_packets,
    simple_scene_packets as _simple_scene_packets,
    build_h6022_matrix_scene as _h6022_matrix_scene_param,
    build_h6022_matrix_scene_multi as _h6022_matrix_scene_param_multi,
)

from .scenes import BUILTIN_SCENES

MULTICAST_ADDR = "239.255.255.250"
SCAN_PORT = 4001
CLIENT_PORT = 4002
CONTROL_PORT = 4003
DISCOVER_TIMEOUT = 3
_RECV_LOCK = threading.Lock()


@dataclass(frozen=True)
class GoveeDevice:
    """Discovered Govee device."""

    ip: str
    device: str
    sku: str


def _make_socket(bind_port: int | None = None) -> socket.socket:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    if bind_port:
        sock.bind(("", bind_port))
    return sock


def discover(timeout: float = DISCOVER_TIMEOUT) -> list[GoveeDevice]:
    """Broadcast a scan and return all responding Govee devices."""
    with _RECV_LOCK:
        payload = json.dumps(
            {"msg": {"cmd": "scan", "data": {"account_topic": "reserve"}}}
        ).encode()
        recv_sock = _make_socket(CLIENT_PORT)
        recv_sock.settimeout(timeout)
        send_sock = _make_socket()
        send_sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)

        devices: dict[str, GoveeDevice] = {}
        try:
            send_sock.sendto(payload, (MULTICAST_ADDR, SCAN_PORT))
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                try:
                    data, _ = recv_sock.recvfrom(4096)
                    msg = json.loads(data)["msg"]
                    if msg.get("cmd") != "scan":
                        continue
                    dev = msg["data"]
                    device = GoveeDevice(
                        ip=dev["ip"], device=dev["device"], sku=dev["sku"]
                    )
                    devices[device.device] = device
                except TimeoutError:
                    break
                except (KeyError, json.JSONDecodeError):
                    continue
        finally:
            send_sock.close()
            recv_sock.close()

    return list(devices.values())


class GoveeLanClient:
    """Blocking Govee LAN client."""

    def __init__(self, host: str, sku: str, device_id: str | None = None) -> None:
        self.host = host
        self.sku = sku.upper()
        self.device_id = device_id

    def turn(self, on: bool) -> None:
        """Turn the light on or off."""
        self._send({"msg": {"cmd": "turn", "data": {"value": 1 if on else 0}}})

    def set_brightness(self, value: int) -> None:
        """Set brightness from 1 to 100."""
        value = max(1, min(100, value))
        self._send({"msg": {"cmd": "brightness", "data": {"value": value}}})

    def set_color(self, r: int, g: int, b: int) -> None:
        """Set RGB color."""
        r, g, b = (max(0, min(255, x)) for x in (r, g, b))
        self._send(
            {
                "msg": {
                    "cmd": "colorwc",
                    "data": {
                        "color": {"r": r, "g": g, "b": b},
                        "colorTemInKelvin": 0,
                    },
                }
            }
        )

    def set_temperature(self, kelvin: int) -> None:
        """Set color temperature in Kelvin."""
        kelvin = max(2000, min(9000, kelvin))
        self._send(
            {
                "msg": {
                    "cmd": "colorwc",
                    "data": {
                        "color": {"r": 0, "g": 0, "b": 0},
                        "colorTemInKelvin": kelvin,
                    },
                }
            }
        )

    def get_status(self) -> dict | None:
        """Return device status or None on timeout."""
        resp = self._send_recv({"msg": {"cmd": "devStatus", "data": {}}})
        if resp:
            return resp.get("msg", {}).get("data")
        return None

    def rediscover(self) -> bool:
        """Update host from LAN discovery using the stable device ID."""
        if not self.device_id:
            return False
        for device in discover(timeout=2):
            if device.device != self.device_id:
                continue
            self.host = device.ip
            self.sku = device.sku.upper()
            return True
        return False

    def fetch_scenes(self) -> list[dict]:
        """Fetch scene metadata for this device model from Govee."""
        if self.sku in BUILTIN_SCENES:
            return BUILTIN_SCENES[self.sku]

        url = (
            "https://app2.govee.com/appsku/v1/light-effect-libraries"
            f"?sku={self.sku}"
        )
        req = urllib.request.Request(url, headers={"AppVersion": "5.6.01"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.load(resp)

        scenes = []
        for cat in data.get("data", {}).get("categories", []):
            category = cat.get("categoryName", "")
            for scene in cat.get("scenes", []):
                for effect in scene.get("lightEffects", []):
                    code = effect.get("sceneCode", 0)
                    param = effect.get("diyEffectStr") or effect.get("sceneParam", "")
                    if code:
                        scenes.append(
                            {
                                "category": category,
                                "name": scene.get("sceneName", "").replace(
                                    "\xa0", " "
                                ),
                                "code": code,
                                "param": param,
                            }
                        )
        return scenes

    def set_simple_scene(
        self,
        type_byte: int,
        subtype_byte: int,
        speed: int,
        colors: list[tuple[int, int, int]],
    ) -> None:
        """Activate a simple-scene-generator animation."""
        self._send(
            {
                "msg": {
                    "cmd": "ptReal",
                    "data": {
                        "command": _simple_scene_packets(
                            type_byte, subtype_byte, speed, colors
                        )
                    },
                }
            }
        )

    def set_music_mode(self, preset_id: int, sensitivity: int = 100) -> None:
        """Activate a music visualizer preset."""
        self._send(
            {
                "msg": {
                    "cmd": "ptReal",
                    "data": {
                        "command": _music_mode_packets(preset_id, sensitivity)
                    },
                }
            }
        )

    def set_h6022_matrix_scene(
        self,
        groups: list[tuple[tuple[int, int, int], list[int]]],
        scene_code: int,
        level: int,
        mode: int,
        rate: int,
        background: tuple[int, int, int],
        bg_brightness: int = 0,
    ) -> None:
        """Activate a custom H6022 matrix scene."""
        self.set_scene(
            scene_code,
            _h6022_matrix_scene_param(
                groups,
                level=level,
                mode=mode,
                rate=rate,
                background=background,
                bg_brightness=bg_brightness,
            ),
        )

    def set_h6022_matrix_scene_multi(
        self,
        blocks: list[dict],
        scene_code: int,
        background: tuple[int, int, int] = (0, 0, 0),
        bg_brightness: int = 0,
    ) -> None:
        """Activate a custom multi-layer H6022 matrix scene."""
        self.set_scene(
            scene_code,
            _h6022_matrix_scene_param_multi(blocks, background=background, bg_brightness=bg_brightness),
        )

    def set_scene(self, scene_code: int, scene_param: str) -> None:
        """Activate a scene by code and encoded parameter blob."""
        self._send(
            {
                "msg": {
                    "cmd": "ptReal",
                    "data": {
                        "command": _scene_packets(
                            self.sku, scene_code, scene_param
                        )
                    },
                }
            }
        )

    def _send(self, command: dict) -> None:
        payload = json.dumps(command).encode()
        with _make_socket() as sock:
            sock.sendto(payload, (self.host, CONTROL_PORT))

    def _send_recv(self, command: dict, timeout: float = 3.0) -> dict | None:
        with _RECV_LOCK:
            payload = json.dumps(command).encode()
            recv_sock = _make_socket(CLIENT_PORT)
            recv_sock.settimeout(timeout)
            send_sock = _make_socket()
            try:
                send_sock.sendto(payload, (self.host, CONTROL_PORT))
                deadline = time.monotonic() + timeout
                while time.monotonic() < deadline:
                    try:
                        remaining = max(0.1, deadline - time.monotonic())
                        recv_sock.settimeout(remaining)
                        data, addr = recv_sock.recvfrom(4096)
                    except TimeoutError:
                        return None
                    if addr[0] != self.host:
                        continue
                    return json.loads(data)
                return None
            except json.JSONDecodeError:
                return None
            finally:
                send_sock.close()
                recv_sock.close()


def _music_mode_packets(preset_id: int, sensitivity: int) -> list[str]:
    preset_id &= 0xFF
    sensitivity = max(0, min(100, sensitivity))
    sensitivity_byte = round(sensitivity * 0x63 / 100)
    flag = 0x01
    if preset_id == 0x33:
        flag = 0x19
    elif preset_id == 0x65:
        flag = 0x00

    packets: list[int] = []
    packets.extend(
        _finish(
            [
                0xA3, 0x00, 0x01, 0x02, 0x41, preset_id, 0x07,
                0xFF, 0x00, 0x00, 0xFF, 0x7F, 0x00, 0xFF,
                0xFF, 0x00, 0x00, 0xFF, 0x00,
            ]
        )
    )
    packets.extend(
        _finish(
            [
                0xA3, 0xFF, 0x00, 0x00, 0xFF, 0x00, 0xFF,
                0xFF, 0x8B, 0x00, 0xFF, flag,
            ]
        )
    )
    packets.extend(_finish([0xA3, 0x41, preset_id]))
    packets.extend(_finish([0x33, 0x05, 0x13, preset_id, sensitivity_byte]))
    return [
        base64.b64encode(bytes(packets[i : i + 20])).decode()
        for i in range(0, len(packets), 20)
    ]
