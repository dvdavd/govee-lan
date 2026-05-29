"""Light platform for Govee LAN."""

from __future__ import annotations

import asyncio
import base64
from datetime import timedelta
import logging
from typing import Any

import voluptuous as vol

from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_COLOR_TEMP_KELVIN,
    ATTR_EFFECT,
    ATTR_RGB_COLOR,
    ColorMode,
    LightEntity,
    LightEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_HOST, CONF_NAME
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.entity_platform import (
    AddConfigEntryEntitiesCallback,
    async_get_current_platform,
)
from homeassistant.helpers.storage import Store

from .api import GoveeLanClient
from .const import (
    CONF_POLL_STATUS,
    CONF_SKU,
    DEFAULT_ICON,
    DEFAULT_SCAN_INTERVAL,
    DEFAULT_COLOR_TEMP_KELVIN,
    H6022_MATRIX_LED_COUNT,
    H6022_MATRIX_MODES,
    H6022_MATRIX_SCENE_CODE,
    MUSIC_MODE_DEFAULT_SENSITIVITY,
    MUSIC_MODE_SKUS,
    MUSIC_MODES,
    DOMAIN,
    MODEL_COLOR_TEMP_KELVIN,
    MODEL_ICONS,
    SIMPLE_SCENE_DEFAULT_COLORS,
)
from .scenes import BUILTIN_SCENES

_LOGGER = logging.getLogger(__name__)
SCAN_INTERVAL = timedelta(seconds=DEFAULT_SCAN_INTERVAL)
NORMAL_EFFECT_ALIASES = {
    "Dream 2": "Dreamlike",
    "Graffiti 3": "Graffiti",
}


def _sg_scene_controls(scene: dict) -> tuple[int, int] | None:
    """Return simple-scene-generator control bytes, if this scene is one."""
    param = scene.get("param", "")
    if not param:
        return None
    try:
        raw = base64.b64decode(param + "==")
    except Exception:
        return None
    if len(raw) >= 3 and raw[0] == 0x00:
        return raw[1], raw[2]
    return None


def _parse_sg_scenes(scenes: list[dict]) -> dict[str, tuple[int, int]]:
    """Extract simple-scene-generator scenes from API data (0x00-prefix params)."""
    name_counts: dict[str, int] = {}
    candidates: list[tuple[dict, int, int]] = []
    for scene in scenes:
        if scene.get("category") == "Custom":
            continue
        controls = _sg_scene_controls(scene)
        if controls is None:
            continue
        c0, c1 = controls
        name_counts[scene["name"]] = name_counts.get(scene["name"], 0) + 1
        candidates.append((scene, c0, c1))
    result: dict[str, tuple[int, int]] = {}
    for scene, c0, c1 in candidates:
        name = scene["name"]
        if name_counts[name] > 1:
            name = f"{scene['category']}: {name}"
        result.setdefault(f"SG: {name}", (c0, c1))
    return result


ATTR_COLOR_TEMP_MIRED = "color_temp"
ATTR_KELVIN = "kelvin"
SCENE_CACHE_VERSION = 1
SCENE_CACHE_KEY = f"{DOMAIN}_scenes"
SG_SCENE_OPTIONS_CACHE_VERSION = 1
SG_SCENE_OPTIONS_CACHE_KEY = f"{DOMAIN}_sg_scene_options"
MATRIX_SCENE_PRESETS_CACHE_VERSION = 1
MATRIX_SCENE_PRESETS_CACHE_KEY = f"{DOMAIN}_matrix_scene_presets"
MATRIX_LIGHTS_DATA_KEY = "matrix_lights"
MATRIX_EFFECT_PREFIX = "Matrix: "
_MATRIX_GROUP_SCHEMA = vol.Schema(
    {
        vol.Required("color"): vol.ExactSequence(
            [vol.All(vol.Coerce(int), vol.Range(0, 255))] * 3
        ),
        vol.Required("leds"): vol.All(
            cv.ensure_list,
            [
                vol.All(
                    vol.Coerce(int),
                    vol.Range(min=0, max=H6022_MATRIX_LED_COUNT - 1),
                )
            ],
            vol.Length(min=1, max=255),
        ),
    }
)


def _validate_matrix_groups(groups: list[dict]) -> list[dict]:
    """Validate H6022 matrix group data fits the one-byte block header."""
    group_data_size = sum(4 + len(group["leds"]) for group in groups)
    if not groups:
        raise vol.Invalid("at least one matrix group is required")
    if group_data_size > 240:
        raise vol.Invalid("matrix group data is too large")
    return groups


_MATRIX_LAYER_SCHEMA = vol.Schema(
    {
        vol.Required("groups"): vol.All(
            cv.ensure_list,
            [_MATRIX_GROUP_SCHEMA],
            _validate_matrix_groups,
        ),
        vol.Optional("mode", default="twinkle"): vol.In(list(H6022_MATRIX_MODES)),
        vol.Optional("level", default=100): vol.All(vol.Coerce(int), vol.Range(0, 100)),
        vol.Optional("rate", default=0x50): vol.All(vol.Coerce(int), vol.Range(0, 255)),
        vol.Optional("style"): vol.Coerce(int),  # accepted but ignored; z_order is now auto-assigned
    }
)


def _matrix_scene_service_schema(require_name: bool = False) -> dict:
    """Return the shared schema for H6022 matrix scene services."""
    schema = {
        vol.Optional("groups"): vol.All(
            cv.ensure_list,
            [_MATRIX_GROUP_SCHEMA],
            _validate_matrix_groups,
        ),
        vol.Optional("layers"): vol.All(
            cv.ensure_list,
            [_MATRIX_LAYER_SCHEMA],
            vol.Length(min=1, max=3),
        ),
        vol.Optional("mode", default="twinkle"): vol.In(list(H6022_MATRIX_MODES)),
        vol.Optional("level", default=100): vol.All(
            vol.Coerce(int), vol.Range(0, 100)
        ),
        vol.Optional("rate", default=0x50): vol.All(
            vol.Coerce(int), vol.Range(0, 255)
        ),
        vol.Optional("background", default=[0, 0, 0]): vol.ExactSequence(
            [vol.All(vol.Coerce(int), vol.Range(0, 255))] * 3
        ),
        vol.Optional("bg_brightness", default=0): vol.All(
            vol.Coerce(int), vol.Range(0, 100)
        ),
    }
    if require_name:
        schema[vol.Required("name")] = cv.string
    return schema


def _light_unique_id(client: GoveeLanClient) -> str:
    """Return the stable Home Assistant light unique ID."""
    return client.device_id or f"{client.sku}_{client.host}"


def _matrix_scene_preset_data(
    groups: list[dict] | None,
    layers: list[dict] | None,
    mode: str,
    level: int,
    rate: int,
    background: list[int] | None,
    bg_brightness: int,
) -> dict[str, Any]:
    """Return normalized matrix scene service data."""
    return {
        "groups": groups,
        "layers": layers,
        "mode": mode,
        "level": level,
        "rate": rate,
        "background": background or [0, 0, 0],
        "bg_brightness": bg_brightness,
    }


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry[GoveeLanClient],
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up a Govee LAN light."""
    async_add_entities([GoveeLanLight(entry.runtime_data, entry)], False)

    platform = async_get_current_platform()
    platform.async_register_entity_service(
        "set_simple_scene",
        {
            vol.Required("scene"): cv.string,
            vol.Optional("colors"): vol.All(
                cv.ensure_list,
                [vol.ExactSequence([vol.All(vol.Coerce(int), vol.Range(0, 255))] * 3)],
            ),
            vol.Optional("speed"): vol.All(
                vol.Coerce(int), vol.Range(0, 100)
            ),
            vol.Optional("remember", default=True): cv.boolean,
        },
        "async_set_simple_scene",
    )
    platform.async_register_entity_service(
        "set_matrix_scene",
        _matrix_scene_service_schema(),
        "async_set_matrix_scene",
    )
    platform.async_register_entity_service(
        "save_matrix_scene",
        _matrix_scene_service_schema(require_name=True),
        "async_save_matrix_scene",
    )
    platform.async_register_entity_service(
        "delete_matrix_scene",
        {vol.Required("name"): cv.string},
        "async_delete_matrix_scene",
    )


class GoveeLanLight(LightEntity):
    """Representation of a Govee LAN light."""

    _attr_has_entity_name = True
    _attr_supported_color_modes = {ColorMode.RGB, ColorMode.COLOR_TEMP}
    _attr_assumed_state = False
    _attr_should_poll = False
    _attr_supported_features = LightEntityFeature.EFFECT

    def __init__(
        self, client: GoveeLanClient, entry: ConfigEntry[GoveeLanClient]
    ) -> None:
        self._client = client
        self._entry = entry
        self._poll_status = entry.data.get(CONF_POLL_STATUS, True)
        self._min_kelvin, self._max_kelvin = MODEL_COLOR_TEMP_KELVIN.get(
            client.sku, DEFAULT_COLOR_TEMP_KELVIN
        )
        self._attr_min_color_temp_kelvin = self._min_kelvin
        self._attr_max_color_temp_kelvin = self._max_kelvin
        self._attr_min_mireds = round(1_000_000 / self._max_kelvin)
        self._attr_max_mireds = round(1_000_000 / self._min_kelvin)
        self._attr_icon = MODEL_ICONS.get(client.sku, DEFAULT_ICON)
        self._attr_name = None
        self._attr_unique_id = _light_unique_id(client)
        self._attr_device_info = {
            "identifiers": {(DOMAIN, self._attr_unique_id)},
            "manufacturer": "Govee",
            "model": client.sku,
            "name": entry.data[CONF_NAME],
        }
        self._attr_effect_list: list[str] | None = None
        self._scenes_by_name: dict[str, dict] = {}
        self._sg_scenes: dict[str, tuple[int, int]] = {}
        self._sg_scene_options: dict[str, dict[str, Any]] = {}
        self._sg_supported: bool = False
        self._matrix_scene_presets: dict[str, dict[str, Any]] = {}
        self._attr_is_on = False
        self._attr_brightness = None
        self._attr_rgb_color = None
        self._attr_color_temp_kelvin = None
        self._attr_color_mode = ColorMode.RGB
        self._attr_available = True

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Expose saved matrix preset data for the Lovelace editor."""
        attrs: dict[str, Any] = {}
        if self._matrix_scene_presets:
            attrs["matrix_scene_presets"] = self._matrix_scene_presets
        return attrs

    async def async_added_to_hass(self) -> None:
        """Load scene names when the entity is added."""
        matrix_lights = self.hass.data.setdefault(DOMAIN, {}).setdefault(
            MATRIX_LIGHTS_DATA_KEY, set()
        )
        matrix_lights.add(self)
        self.async_on_remove(lambda: matrix_lights.discard(self))

        if self._poll_status:
            self.async_on_remove(
                async_track_time_interval(
                    self.hass, self._async_poll_and_write_state, SCAN_INTERVAL
                )
            )

        scenes = await self._async_load_scenes()
        if scenes:
            self._sg_scenes = _parse_sg_scenes(scenes)
            self._sg_supported = bool(self._sg_scenes)
            self._set_scenes(scenes)

        if self._sg_supported:
            self._sg_scene_options = await self._async_load_sg_scene_options()
            self._attr_effect_list = list(self._sg_scenes) + (self._attr_effect_list or [])
        if self._client.sku.upper() in MUSIC_MODE_SKUS:
            self._attr_effect_list = (self._attr_effect_list or []) + list(MUSIC_MODES)
        if self._client.sku.upper() == "H6022":
            self._matrix_scene_presets = await self._async_load_matrix_scene_presets()
            self._refresh_matrix_effects()
        self.async_write_ha_state()

    async def _async_load_scenes(self) -> list[dict]:
        """Load scenes from bundled data, cache, or Govee metadata endpoint."""
        if self._client.sku in BUILTIN_SCENES:
            return await self.hass.async_add_executor_job(self._client.fetch_scenes)

        cached = await self._async_load_cached_scenes()
        if cached:
            return cached

        try:
            scenes = await self.hass.async_add_executor_job(self._client.fetch_scenes)
        except Exception as err:
            _LOGGER.debug("Could not load Govee scenes for %s: %s", self.name, err)
            return []

        if scenes:
            await self._async_store_cached_scenes(scenes)
        return scenes

    async def _async_load_cached_scenes(self) -> list[dict]:
        """Load cached scenes for this SKU from Home Assistant storage."""
        store = Store(self.hass, SCENE_CACHE_VERSION, SCENE_CACHE_KEY)
        data = await store.async_load()
        if not isinstance(data, dict):
            return []
        scenes_by_sku = data.get("skus")
        if not isinstance(scenes_by_sku, dict):
            return []
        scenes = scenes_by_sku.get(self._client.sku)
        if isinstance(scenes, list):
            _LOGGER.debug("Loaded cached Govee scenes for %s", self._client.sku)
            return scenes
        return []

    async def _async_store_cached_scenes(self, scenes: list[dict]) -> None:
        """Store downloaded scenes for this SKU in Home Assistant storage."""
        store = Store(self.hass, SCENE_CACHE_VERSION, SCENE_CACHE_KEY)
        data = await store.async_load()
        if not isinstance(data, dict):
            data = {}
        scenes_by_sku = data.get("skus")
        if not isinstance(scenes_by_sku, dict):
            scenes_by_sku = {}
        scenes_by_sku[self._client.sku] = scenes
        data["skus"] = scenes_by_sku
        await store.async_save(data)
        _LOGGER.debug("Cached %d Govee scenes for %s", len(scenes), self._client.sku)

    async def _async_load_sg_scene_options(self) -> dict[str, dict[str, Any]]:
        """Load remembered simple-scene-generator settings for this entity."""
        store = Store(
            self.hass, SG_SCENE_OPTIONS_CACHE_VERSION, SG_SCENE_OPTIONS_CACHE_KEY
        )
        data = await store.async_load()
        if not isinstance(data, dict):
            return {}
        options_by_entity = data.get("entities")
        if not isinstance(options_by_entity, dict):
            return {}
        options = options_by_entity.get(self._attr_unique_id)
        if not isinstance(options, dict):
            return {}
        return {
            scene: settings
            for scene, settings in options.items()
            if scene in self._sg_scenes and isinstance(settings, dict)
        }

    async def _async_store_sg_scene_options(
        self, scene: str, speed: int, colors: list[tuple[int, int, int]]
    ) -> None:
        """Remember simple-scene-generator settings for future effect selection."""
        self._sg_scene_options[scene] = {
            "speed": max(0, min(100, int(speed))),
            "colors": [[r, g, b] for r, g, b in colors],
        }
        store = Store(
            self.hass, SG_SCENE_OPTIONS_CACHE_VERSION, SG_SCENE_OPTIONS_CACHE_KEY
        )
        data = await store.async_load()
        if not isinstance(data, dict):
            data = {}
        options_by_entity = data.get("entities")
        if not isinstance(options_by_entity, dict):
            options_by_entity = {}
        options_by_entity[self._attr_unique_id] = self._sg_scene_options
        data["entities"] = options_by_entity
        await store.async_save(data)

    @property
    def _matrix_scene_preset_scope(self) -> str:
        """Return the shared compatibility scope for matrix presets."""
        return self._client.sku.upper()

    def _sanitize_matrix_scene_presets(
        self, presets: Any
    ) -> dict[str, dict[str, Any]]:
        """Return only valid saved matrix preset entries."""
        if not isinstance(presets, dict):
            return {}
        return {
            name: preset
            for name, preset in presets.items()
            if isinstance(name, str) and name and isinstance(preset, dict)
        }

    async def _async_load_matrix_scene_presets(self) -> dict[str, dict[str, Any]]:
        """Load saved H6022 matrix presets for compatible devices."""
        store = Store(
            self.hass,
            MATRIX_SCENE_PRESETS_CACHE_VERSION,
            MATRIX_SCENE_PRESETS_CACHE_KEY,
        )
        data = await store.async_load()
        if not isinstance(data, dict):
            return {}
        presets_by_sku = data.get("skus")
        if not isinstance(presets_by_sku, dict):
            return {}
        return self._sanitize_matrix_scene_presets(
            presets_by_sku.get(self._matrix_scene_preset_scope)
        )

    async def _async_store_matrix_scene_presets(self) -> None:
        """Store saved H6022 matrix presets for compatible devices."""
        store = Store(
            self.hass,
            MATRIX_SCENE_PRESETS_CACHE_VERSION,
            MATRIX_SCENE_PRESETS_CACHE_KEY,
        )
        data = await store.async_load()
        if not isinstance(data, dict):
            data = {}
        presets_by_sku = data.get("skus")
        if not isinstance(presets_by_sku, dict):
            presets_by_sku = {}
        presets_by_sku[self._matrix_scene_preset_scope] = self._matrix_scene_presets
        data["skus"] = presets_by_sku
        await store.async_save(data)

    async def _async_refresh_compatible_matrix_presets(self) -> None:
        """Reload shared matrix presets on all compatible loaded entities."""
        matrix_lights = self.hass.data.get(DOMAIN, {}).get(
            MATRIX_LIGHTS_DATA_KEY, set()
        )
        for light in list(matrix_lights):
            if (
                not isinstance(light, GoveeLanLight)
                or light._matrix_scene_preset_scope != self._matrix_scene_preset_scope
            ):
                continue
            light._matrix_scene_presets = await light._async_load_matrix_scene_presets()
            light._refresh_matrix_effects()
            light.async_write_ha_state()

    def _refresh_matrix_effects(self) -> None:
        """Expose saved matrix presets as Home Assistant effects."""
        effects = [
            effect
            for effect in (self._attr_effect_list or [])
            if not effect.startswith(MATRIX_EFFECT_PREFIX)
        ]
        effects.extend(
            f"{MATRIX_EFFECT_PREFIX}{name}"
            for name in sorted(self._matrix_scene_presets)
        )
        self._attr_effect_list = effects

    def _set_scenes(self, scenes: list[dict]) -> None:
        """Expose scene metadata as Home Assistant effects."""
        non_sg_effect_names = {
            NORMAL_EFFECT_ALIASES.get(scene["name"], scene["name"])
            for scene in scenes
            if _sg_scene_controls(scene) is None
        }
        visible_scenes = [
            scene
            for scene in scenes
            if _sg_scene_controls(scene) is None
            or (
                scene["name"] in NORMAL_EFFECT_ALIASES
                and NORMAL_EFFECT_ALIASES[scene["name"]] not in non_sg_effect_names
            )
        ]

        scene_name_counts = {}
        for scene in visible_scenes:
            effect_name = NORMAL_EFFECT_ALIASES.get(scene["name"], scene["name"])
            scene_name_counts[effect_name] = (
                scene_name_counts.get(effect_name, 0) + 1
            )

        self._scenes_by_name = {}
        for scene in visible_scenes:
            effect_name = NORMAL_EFFECT_ALIASES.get(scene["name"], scene["name"])
            if scene_name_counts[effect_name] > 1:
                effect_name = f"{scene['category']}: {effect_name}"
            self._scenes_by_name.setdefault(effect_name, scene)

        if self._scenes_by_name:
            self._attr_effect_list = sorted(self._scenes_by_name)
            self.async_write_ha_state()

    def _sg_scene_settings(
        self,
        scene: str,
        speed: int | None = None,
        colors: list | None = None,
    ) -> tuple[int, list[tuple[int, int, int]]]:
        """Return validated simple-scene-generator settings."""
        saved = self._sg_scene_options.get(scene, {})
        saved_speed = saved.get("speed", 50)
        try:
            scene_speed = int(saved_speed if speed is None else speed)
        except (TypeError, ValueError):
            scene_speed = 50
        scene_speed = max(0, min(100, scene_speed))

        raw_colors = saved.get("colors")
        if colors is not None:
            raw_colors = colors
        scene_colors: list[tuple[int, int, int]] = []
        if isinstance(raw_colors, list):
            for color in raw_colors:
                if not isinstance(color, (list, tuple)) or len(color) != 3:
                    continue
                try:
                    r, g, b = (max(0, min(255, int(c))) for c in color)
                except (TypeError, ValueError):
                    continue
                scene_colors.append((r, g, b))
        if not scene_colors:
            scene_colors = list(SIMPLE_SCENE_DEFAULT_COLORS)
        return scene_speed, scene_colors

    async def _async_rediscover_and_get_status(self) -> dict | None:
        """Try to find the lamp at a new IP and read status."""
        try:
            found = await self.hass.async_add_executor_job(self._client.rediscover)
        except OSError as err:
            _LOGGER.debug("Could not rediscover Govee lamp for %s: %s", self.name, err)
            return None
        if not found:
            return None
        _LOGGER.info("Rediscovered %s at %s", self.name, self._client.host)
        self._async_save_discovered_host()
        try:
            return await self.hass.async_add_executor_job(self._client.get_status)
        except OSError as err:
            _LOGGER.debug(
                "Could not poll rediscovered Govee lamp for %s: %s", self.name, err
            )
            return None

    async def _async_call_client(self, method_name: str, *args: Any) -> None:
        """Call a client method and retry once after rediscovery on socket errors."""
        method = getattr(self._client, method_name)
        try:
            await self.hass.async_add_executor_job(method, *args)
            return
        except OSError as err:
            _LOGGER.debug(
                "Govee command %s failed for %s: %s", method_name, self.name, err
            )

        try:
            found = await self.hass.async_add_executor_job(self._client.rediscover)
        except OSError as err:
            _LOGGER.debug("Could not rediscover Govee lamp for %s: %s", self.name, err)
            return
        if found:
            _LOGGER.info("Rediscovered %s at %s", self.name, self._client.host)
            self._async_save_discovered_host()
            method = getattr(self._client, method_name)
            await self.hass.async_add_executor_job(method, *args)

    def _async_save_discovered_host(self) -> None:
        """Persist a rediscovered host in the config entry."""
        self.hass.config_entries.async_update_entry(
            self._entry,
            data={
                **self._entry.data,
                CONF_HOST: self._client.host,
                CONF_SKU: self._client.sku,
            },
        )

    async def _async_poll_and_write_state(self, now: Any) -> None:
        """Refresh state in the background without delaying user commands."""
        await self.async_update()
        self.async_write_ha_state()

    def _log_label(self) -> str:
        """Return a stable label for logs, even before Home Assistant names it."""
        device_id = self._client.device_id or "manual"
        return f"{self.name or self._attr_unique_id} [{self._client.host}, {device_id}]"

    async def async_update(self) -> None:
        """Fetch latest state from the device."""
        if not self._poll_status:
            self._attr_available = True
            return

        try:
            status = await self.hass.async_add_executor_job(self._client.get_status)
        except OSError as err:
            _LOGGER.debug("Could not poll Govee status for %s: %s", self.name, err)
            self._attr_available = False
            return

        if status is None:
            status = await self._async_rediscover_and_get_status()
        if status is None:
            self._attr_available = False
            return

        _LOGGER.debug("Polled Govee status for %s: %s", self._log_label(), status)
        self._attr_available = True
        brightness = status.get("brightness")
        self._attr_is_on = status.get("onOff") == 1
        if isinstance(brightness, int):
            self._attr_brightness = round(brightness * 255 / 100)

        kelvin = status.get("colorTemInKelvin") or 0
        if kelvin:
            self._attr_color_mode = ColorMode.COLOR_TEMP
            self._attr_color_temp_kelvin = kelvin
        else:
            color = status.get("color") or {}
            self._attr_color_mode = ColorMode.RGB
            self._attr_rgb_color = (
                color.get("r", 0),
                color.get("g", 0),
                color.get("b", 0),
            )

    async def async_turn_on(self, **kwargs) -> None:
        """Turn the light on and apply requested attributes."""
        _LOGGER.debug(
            "Turning on Govee light %s with kwargs: %s", self._log_label(), kwargs
        )
        effect = kwargs.get(ATTR_EFFECT)
        color_temp_kelvin = self._color_temp_kelvin_from_kwargs(kwargs)
        self._attr_available = True
        self._attr_is_on = True

        if effect:
            if (
                effect in self._sg_scenes
                or effect in MUSIC_MODES
                or self._matrix_scene_preset_name(effect) is not None
                or self._scenes_by_name.get(effect) is not None
            ):
                self._attr_effect = effect

        if ATTR_RGB_COLOR in kwargs:
            self._attr_rgb_color = kwargs[ATTR_RGB_COLOR]
            self._attr_color_mode = ColorMode.RGB

        if color_temp_kelvin is not None:
            self._attr_color_temp_kelvin = color_temp_kelvin
            self._attr_color_mode = ColorMode.COLOR_TEMP

        if ATTR_BRIGHTNESS in kwargs:
            self._attr_brightness = kwargs[ATTR_BRIGHTNESS]

        self.async_write_ha_state()
        await self._async_call_client("turn", True)

        if effect:
            if effect in self._sg_scenes and self._sg_supported:
                type_byte, subtype_byte = self._sg_scenes[effect]
                remember_sg_settings = False
                if ATTR_RGB_COLOR in kwargs:
                    speed, colors = self._sg_scene_settings(
                        effect, colors=[kwargs[ATTR_RGB_COLOR]]
                    )
                    remember_sg_settings = True
                else:
                    speed, colors = self._sg_scene_settings(effect)
                await self._async_call_client(
                    "set_simple_scene", type_byte, subtype_byte, speed, colors
                )
                if remember_sg_settings:
                    await self._async_store_sg_scene_options(effect, speed, colors)
            elif effect in MUSIC_MODES and self._client.sku.upper() in MUSIC_MODE_SKUS:
                await self._async_call_client(
                    "set_music_mode",
                    MUSIC_MODES[effect],
                    MUSIC_MODE_DEFAULT_SENSITIVITY,
                )
            elif (preset_name := self._matrix_scene_preset_name(effect)) is not None:
                preset = self._matrix_scene_presets.get(preset_name)
                if preset is not None:
                    await self._async_apply_matrix_scene_data(preset, effect_name=effect)
            else:
                scene = self._scenes_by_name.get(effect)
                if scene is not None:
                    await self._async_call_client(
                        "set_scene", scene["code"], scene["param"]
                    )

        if ATTR_RGB_COLOR in kwargs and not effect:
            await self._async_call_client("set_color", *kwargs[ATTR_RGB_COLOR])

        if color_temp_kelvin is not None:
            await self._async_call_client("set_temperature", color_temp_kelvin)

        if ATTR_BRIGHTNESS in kwargs:
            if color_temp_kelvin is not None or ATTR_RGB_COLOR in kwargs:
                await asyncio.sleep(0.15)
            percent = max(1, min(100, round(kwargs[ATTR_BRIGHTNESS] * 100 / 255)))
            await self._async_call_client("set_brightness", percent)

        self.async_write_ha_state()

    def _matrix_scene_preset_name(self, effect: str) -> str | None:
        """Return saved matrix preset name for an effect-list value."""
        if not effect.startswith(MATRIX_EFFECT_PREFIX):
            return None
        name = effect.removeprefix(MATRIX_EFFECT_PREFIX)
        return name if name in self._matrix_scene_presets else None

    async def async_set_simple_scene(
        self,
        scene: str,
        colors: list | None = None,
        speed: int | None = None,
        remember: bool = True,
    ) -> None:
        """Service handler: activate a simple-scene-generator animation."""
        if scene not in self._sg_scenes or not self._sg_supported:
            return
        type_byte, subtype_byte = self._sg_scenes[scene]
        scene_speed, palette = self._sg_scene_settings(scene, speed, colors)
        self._attr_is_on = True
        self._attr_effect = scene
        self.async_write_ha_state()
        await self._async_call_client("turn", True)
        await self._async_call_client(
            "set_simple_scene", type_byte, subtype_byte, scene_speed, palette
        )
        if remember:
            await self._async_store_sg_scene_options(scene, scene_speed, palette)
        self.async_write_ha_state()

    async def async_set_matrix_scene(
        self,
        groups: list[dict] | None = None,
        layers: list[dict] | None = None,
        mode: str = "twinkle",
        level: int = 100,
        rate: int = 0x50,
        background: list[int] | None = None,
        bg_brightness: int = 0,
    ) -> None:
        """Service handler: activate a custom H6022 matrix scene."""
        if self._client.sku.upper() != "H6022":
            return
        if not groups and not layers:
            raise ValueError("either 'groups' or 'layers' is required")
        await self._async_apply_matrix_scene_data(
            _matrix_scene_preset_data(
                groups, layers, mode, level, rate, background, bg_brightness
            )
        )

    async def async_save_matrix_scene(
        self,
        name: str,
        groups: list[dict] | None = None,
        layers: list[dict] | None = None,
        mode: str = "twinkle",
        level: int = 100,
        rate: int = 0x50,
        background: list[int] | None = None,
        bg_brightness: int = 0,
    ) -> None:
        """Service handler: save a custom H6022 matrix scene as an effect."""
        if self._client.sku.upper() != "H6022":
            return
        preset_name = name.strip()
        if not preset_name:
            raise ValueError("'name' is required")
        if not groups and not layers:
            raise ValueError("either 'groups' or 'layers' is required")
        self._matrix_scene_presets[preset_name] = _matrix_scene_preset_data(
            groups, layers, mode, level, rate, background, bg_brightness
        )
        await self._async_store_matrix_scene_presets()
        await self._async_refresh_compatible_matrix_presets()

    async def async_delete_matrix_scene(self, name: str) -> None:
        """Service handler: delete a saved H6022 matrix scene preset."""
        if self._client.sku.upper() != "H6022":
            return
        preset_name = name.strip()
        if preset_name not in self._matrix_scene_presets:
            raise ValueError(f"No matrix scene preset named '{preset_name}'")
        del self._matrix_scene_presets[preset_name]
        await self._async_store_matrix_scene_presets()
        await self._async_refresh_compatible_matrix_presets()

    async def _async_apply_matrix_scene_data(
        self, preset: dict[str, Any], effect_name: str = "Matrix Scene"
    ) -> None:
        """Apply validated matrix scene service/preset data."""
        groups = preset.get("groups")
        layers = preset.get("layers")
        bg = tuple(preset.get("background") or [0, 0, 0])
        bg_brightness = int(preset.get("bg_brightness") or 0)
        self._attr_is_on = True
        self._attr_effect = effect_name
        self.async_write_ha_state()
        await self._async_call_client("turn", True)
        if layers:
            blocks = [
                {
                    "groups": [(tuple(g["color"]), list(g["leds"])) for g in layer["groups"]],
                    "rate": layer.get("rate", 0x50),
                    "level": layer.get("level", 100),
                    "mode": H6022_MATRIX_MODES[layer.get("mode", "twinkle")],
                }
                for layer in layers
            ]
            await self._async_call_client(
                "set_h6022_matrix_scene_multi",
                blocks,
                H6022_MATRIX_SCENE_CODE,
                bg,
                bg_brightness,
            )
        else:
            matrix_groups = [
                (tuple(group["color"]), list(group["leds"])) for group in groups
            ]
            await self._async_call_client(
                "set_h6022_matrix_scene",
                matrix_groups,
                H6022_MATRIX_SCENE_CODE,
                preset.get("level", 100),
                H6022_MATRIX_MODES[preset.get("mode", "twinkle")],
                preset.get("rate", 0x50),
                bg,
                bg_brightness,
            )
        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs) -> None:
        """Turn the light off."""
        _LOGGER.debug(
            "Turning off Govee light %s with kwargs: %s", self._log_label(), kwargs
        )
        self._attr_available = True
        self._attr_is_on = False
        self.async_write_ha_state()
        await self._async_call_client("turn", False)
        self.async_write_ha_state()


    def _color_temp_kelvin_from_kwargs(self, kwargs: dict[str, Any]) -> int | None:
        """Extract a color temperature from HA turn_on kwargs."""
        if ATTR_COLOR_TEMP_KELVIN in kwargs:
            return self._clamp_kelvin(kwargs[ATTR_COLOR_TEMP_KELVIN])
        if ATTR_KELVIN in kwargs:
            return self._clamp_kelvin(kwargs[ATTR_KELVIN])
        if ATTR_COLOR_TEMP_MIRED in kwargs:
            mired = kwargs[ATTR_COLOR_TEMP_MIRED]
            if mired:
                return self._clamp_kelvin(round(1_000_000 / mired))
        return None

    def _clamp_kelvin(self, value: int | float) -> int:
        """Clamp color temperature to the device range."""
        return max(self._min_kelvin, min(self._max_kelvin, round(value)))
