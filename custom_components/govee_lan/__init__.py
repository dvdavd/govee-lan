"""Govee LAN custom integration."""

from __future__ import annotations

import logging
from pathlib import Path

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .api import GoveeLanClient
from .const import CONF_DEVICE_ID, CONF_SKU, DOMAIN, PLATFORMS

_LOGGER = logging.getLogger(__name__)

SCENE_CARD_FILENAME = "govee-scene-card.js"
SCENE_CARD_URL_BASE = f"/{DOMAIN}"
SCENE_CARD_RESOURCE_URL = f"{SCENE_CARD_URL_BASE}/{SCENE_CARD_FILENAME}"


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry
) -> bool:
    """Set up Govee LAN from a config entry."""
    fallback_unique_id = f"{entry.data[CONF_SKU]}_{entry.data['host']}"
    device_id = entry.data.get(CONF_DEVICE_ID)
    if device_id is None and entry.unique_id != fallback_unique_id:
        device_id = entry.unique_id
    client = GoveeLanClient(
        entry.data["host"], entry.data[CONF_SKU], device_id
    )
    entry.runtime_data = client
    await _async_register_scene_card(hass)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(
    hass: HomeAssistant, entry: ConfigEntry
) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_register_scene_card(hass: HomeAssistant) -> None:
    """Serve and register the bundled Lovelace scene card."""
    try:
        await hass.http.async_register_static_paths(
            [
                StaticPathConfig(
                    SCENE_CARD_URL_BASE,
                    Path(__file__).parent,
                    False,
                )
            ]
        )
    except RuntimeError:
        # The path is global, so a second config entry may find it registered.
        pass

    lovelace_data = hass.data.get("lovelace")
    if isinstance(lovelace_data, dict):
        resources = lovelace_data.get("resources")
    else:
        resources = getattr(lovelace_data, "resources", None)

    if resources is None:
        _LOGGER.debug(
            "Lovelace resources are not available; scene card not auto-registered"
        )
        return

    if not getattr(resources, "loaded", False):
        await resources.async_load()

    for item in resources.async_items():
        resource_url = item["url"].split("?", 1)[0]
        if not resource_url.endswith(f"/{SCENE_CARD_FILENAME}"):
            continue

        if (
            resource_url != SCENE_CARD_RESOURCE_URL
            and hasattr(resources, "async_update_item")
        ):
            await resources.async_update_item(
                item["id"], {"url": SCENE_CARD_RESOURCE_URL}
            )
        return

    if not hasattr(resources, "async_create_item"):
        _LOGGER.debug(
            "Lovelace is in YAML mode; scene card resource must be added manually"
        )
        return

    await resources.async_create_item(
        {"res_type": "module", "url": SCENE_CARD_RESOURCE_URL}
    )
