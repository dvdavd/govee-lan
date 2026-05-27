"""Config flow for Govee LAN."""

from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_NAME
from homeassistant.data_entry_flow import FlowResult

from .api import GoveeDevice, GoveeLanClient, discover
from .const import CONF_DEVICE_ID, CONF_POLL_STATUS, CONF_SKU, DEFAULT_NAME, DOMAIN

CONF_DEVICE = "device"
MANUAL_DEVICE = "__manual__"
NO_DEVICES = "__none__"


class GoveeLanConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Govee LAN."""

    VERSION = 1
    _discovered_devices: dict[str, GoveeDevice]

    async def async_step_user(
        self, user_input: dict[str, str] | None = None
    ) -> FlowResult:
        """Discover devices before falling back to manual setup."""
        if user_input is not None:
            device_key = user_input[CONF_DEVICE]
            if device_key in {MANUAL_DEVICE, NO_DEVICES}:
                return await self.async_step_manual()

            device = self._discovered_devices[device_key]
            await self.async_set_unique_id(device.device)
            self._abort_if_unique_id_configured(
                updates={CONF_HOST: device.ip, CONF_SKU: device.sku.upper()}
            )
            return self.async_create_entry(
                title=f"Govee {device.sku}",
                data={
                    CONF_HOST: device.ip,
                    CONF_DEVICE_ID: device.device,
                    CONF_NAME: f"Govee {device.sku}",
                    CONF_POLL_STATUS: True,
                    CONF_SKU: device.sku.upper(),
                },
            )

        try:
            devices = await self.hass.async_add_executor_job(discover)
        except OSError:
            devices = []

        self._discovered_devices = {
            f"{device.device}_{device.ip}": device for device in devices
        }

        options = {
            key: f"{device.sku} ({device.device}) at {device.ip}"
            for key, device in self._discovered_devices.items()
        }
        if not options:
            options[NO_DEVICES] = "No devices found"
        options[MANUAL_DEVICE] = "Enter manually"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {vol.Required(CONF_DEVICE, default=MANUAL_DEVICE): vol.In(options)}
            ),
        )

    async def async_step_manual(
        self, user_input: dict[str, str] | None = None
    ) -> FlowResult:
        """Handle manual setup."""
        errors: dict[str, str] = {}

        if user_input is not None:
            host = user_input[CONF_HOST]
            sku = user_input[CONF_SKU].upper()
            await self.async_set_unique_id(f"{sku}_{host}")
            self._abort_if_unique_id_configured()

            client = GoveeLanClient(host, sku)
            skip_validation = user_input.get("skip_validation", False)
            try:
                status = await self.hass.async_add_executor_job(client.get_status)
            except OSError:
                status = None

            if status is not None or skip_validation:
                return self.async_create_entry(
                    title=user_input[CONF_NAME],
                    data={
                        CONF_HOST: host,
                        CONF_NAME: user_input[CONF_NAME],
                        CONF_POLL_STATUS: status is not None and not skip_validation,
                        CONF_SKU: sku,
                    },
                )
            errors["base"] = "cannot_connect"

        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default=DEFAULT_NAME): str,
                vol.Required(CONF_HOST): str,
                vol.Required(CONF_SKU): str,
                vol.Optional("skip_validation", default=False): bool,
            }
        )
        return self.async_show_form(
            step_id="manual", data_schema=schema, errors=errors
        )
