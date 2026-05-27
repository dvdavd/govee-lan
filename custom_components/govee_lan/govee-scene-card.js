// govee-scene-card.js - bundled by the Govee LAN integration for Lovelace
// Config: entity (required), default_scene (optional), default_speed (optional)
// Also bundles custom:govee-matrix-card for H6022 12x11 matrix scenes.

const DEFAULT_PALETTE = [
  "#ff0000", "#ff7f00", "#ffff00", "#00ff00", "#0000ff", "#00ffff", "#8b00ff",
];

const MAX_COLORS = 8;
const STORAGE_KEY = "govee_lan_scene_card_settings";
const MATRIX_STORAGE_KEY = "govee_lan_matrix_card_settings";
const MATRIX_WIDTH = 12;
const MATRIX_HEIGHT = 11;
const MATRIX_PIXEL_COUNT = MATRIX_WIDTH * MATRIX_HEIGHT;
const MATRIX_MAX_SPEED = 100;
const MATRIX_MAX_COLORS = 40;
const MATRIX_DEFAULT_PALETTE = [
  "#ff0000", "#ff3300", "#ff6600", "#ff9900", "#ffcc00", "#ffff00", "#ccff00", "#99ff00",
  "#33ff00", "#00ff00", "#00ff66", "#00cc66", "#009944", "#006622", "#00ffaa", "#00ffff",
  "#00ccff", "#0099ff", "#0066ff", "#0033ff", "#0000ff", "#3300ff", "#6600ff", "#9900ff",
  "#cc00ff", "#ff00ff", "#ff0080", "#990000", "#663300", "#003366", "#330066", "#ffffff",
];
const MATRIX_DIRECTIONS = [
  ["twinkle", "Twinkle"],
  ["up", "Up"],
  ["down", "Down"],
  ["left", "Left"],
  ["right", "Right"],
  ["up-left", "Up left"],
  ["up-right", "Up right"],
  ["down-left", "Down left"],
  ["down-right", "Down right"],
];
const MATRIX_TOOLS = [
  ["pencil", "Pixel"],
  ["brush", "Brush"],
  ["line", "Line"],
  ["circle", "Circle"],
  ["rect", "Rect"],
  ["fill", "Fill"],
  ["picker", "Pick colour"],
  ["eraser", "Erase"],
];
const MATRIX_TOOL_ICONS = {
  pencil: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" /></svg>`,
  brush: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21v-4a4 4 0 1 1 4 4h-4" /><path d="M21 3a16 16 0 0 0 -12.8 10.2" /><path d="M21 3a16 16 0 0 1 -10.2 12.8" /><path d="M10.6 9a9 9 0 0 1 4.4 4.4" /></svg>`,
  line: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19l16 -14" /></svg>`,
  circle: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" /></svg>`,
  rect: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" /></svg>`,
  fill: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737" /><path d="M13.737 9.737c2.299 -2.3 3.23 -5.095 2.081 -6.245c-1.15 -1.15 -3.945 -.217 -6.244 2.082c-2.3 2.299 -3.231 5.095 -2.082 6.244c1.15 1.15 3.946 .218 6.245 -2.081" /><path d="M7.492 11.818c.362 .362 .768 .676 1.208 .934l6.895 4.047c1.078 .557 2.255 -.075 3.692 -1.512c1.437 -1.437 2.07 -2.614 1.512 -3.692c-.372 -.718 -1.72 -3.017 -4.047 -6.895a6.015 6.015 0 0 0 -.934 -1.208" /></svg>`,
  picker: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 7l6 6" /><path d="M4 16l11.7 -11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4l-11.7 11.7h-4v-4" /></svg>`,
  eraser: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3" /><path d="M18 13.3l-6.3 -6.3" /></svg>`,
  trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>`,
  floppy: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2" /><path d="M10 14a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M14 4l0 4l-6 0l0 -4" /></svg>`,
};

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function sanitizePalette(palette) {
  if (!Array.isArray(palette)) return [...DEFAULT_PALETTE];
  const colors = palette.filter(isHexColor).slice(0, MAX_COLORS);
  return colors.length ? colors : [...DEFAULT_PALETTE];
}

const CSS = `
  :host { display: block; }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 13px;
    padding-top: 0;
  }
  :host(.no-title) .card-content {
    padding-top: 16px;
  }

  .field { display: flex; flex-direction: column; gap: 5px; }
  .field.palette-field { padding-bottom: 4px; }

  .label {
    font-size: 12px;
    font-weight: 500;
    color: var(--secondary-text-color);
  }

  select {
    width: 100%;
    background-color: var(--secondary-background-color, rgba(0,0,0,0.04));
    border: 1px solid var(--divider-color, rgba(0,0,0,0.18));
    border-radius: 8px;
    color: var(--primary-text-color, #e5e5e7);
    font-size: 14px;
    padding: 8px 32px 8px 10px;
    cursor: pointer;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238e8e93' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 11px center;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  select:hover { border-color: var(--secondary-text-color, #8e8e93); }
  select:focus { border-color: var(--primary-color, #03a9f4); }
  select option {
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color, #1c1c1e);
  }

  .speed-row { display: flex; align-items: center; gap: 10px; }

  input[type=range] {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 3px;
    border-radius: 2px;
    background: var(--divider-color, rgba(0,0,0,0.18));
    outline: none;
    cursor: pointer;
  }
  input[type=range]::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 2px;
    background: var(--divider-color, rgba(0,0,0,0.18));
  }
  input[type=range]::-moz-range-track {
    height: 3px;
    border-radius: 2px;
    background: var(--divider-color, rgba(0,0,0,0.18));
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--primary-color, #03a9f4);
    cursor: pointer;
    box-shadow: 0 0 0 3px rgba(3,169,244,0.20);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  input[type=range]::-webkit-slider-thumb:hover {
    transform: scale(1.18);
    box-shadow: 0 0 0 5px rgba(3,169,244,0.25);
  }
  input[type=range]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--primary-color, #03a9f4);
    border: none;
    cursor: pointer;
  }

  .speed-value {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    min-width: 26px;
    text-align: right;
    color: var(--primary-text-color, #e5e5e7);
    flex-shrink: 0;
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(8, minmax(26px, 1fr));
    align-items: center;
    justify-items: center;
    column-gap: 2px;
    row-gap: 7px;
    min-height: 26px;
  }

  .swatch-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .swatch {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.18);
    display: block;
    position: relative;
    cursor: pointer;
    transition: transform 0.15s, border-color 0.15s;
    overflow: hidden;
  }
  .swatch:hover { transform: scale(1.12); border-color: rgba(255,255,255,0.4); }

  .swatch.empty {
    background: transparent;
    border: 1.5px dashed rgba(255,255,255,0.18);
    color: var(--secondary-text-color, #8e8e93);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    line-height: 1;
    cursor: default;
  }
  .swatch.empty.can-add {
    cursor: pointer;
  }
  .swatch.empty.can-add:hover {
    background: rgba(255,255,255,0.07);
    border-color: var(--primary-color, #03a9f4);
    color: var(--primary-color, #03a9f4);
  }

  .swatch input[type=color] {
    position: absolute;
    inset: -4px;
    width: calc(100% + 8px);
    height: calc(100% + 8px);
    opacity: 0;
    cursor: pointer;
    border: none;
    padding: 0;
  }

  .remove-btn {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(28,28,30,0.95);
    border: 1px solid rgba(255,255,255,0.18);
    color: var(--secondary-text-color, #8e8e93);
    font-size: 10px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 2;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .remove-btn:hover {
    background: rgba(255,59,48,0.9);
    color: #fff;
    border-color: transparent;
  }

  .palette-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .reset-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    color: var(--secondary-text-color, #8e8e93);
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.15s, color 0.15s;
  }
  .reset-btn:hover { opacity: 1; color: var(--primary-text-color, #e5e5e7); }

  .set-btn {
    width: 100%;
    padding: 10px;
    border-radius: 8px;
    border: none;
    background: var(--primary-color, #03a9f4);
    color: #fff;
    font-size: 13.5px;
    font-weight: 600;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  .set-btn:hover:not(:disabled) {
    opacity: 0.88;
  }
  .set-btn:active:not(:disabled) {
    transform: translateY(0);
    opacity: 0.75;
  }
  .set-btn:disabled { opacity: 0.45; cursor: not-allowed; }
`;

function buildEditorSchema(sgScenes) {
  return [
    {
      name: "entity",
      required: true,
      selector: { entity: { domain: "light", integration: "govee_lan" } },
    },
    {
      name: "default_scene",
      selector: sgScenes.length
        ? { select: { options: sgScenes.map((s) => ({ value: s, label: s })), mode: "dropdown" } }
        : { text: {} },
    },
    {
      name: "default_speed",
      selector: { number: { min: 0, max: 100, mode: "slider" } },
    },
    {
      name: "show_title",
      selector: { boolean: {} },
    },
  ];
}

const EDITOR_LABELS = {
  entity: "Light entity",
  default_scene: "Default scene",
  default_speed: "Default speed",
  show_title: "Show card title",
};

class GoveeSceneCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _getSgScenes() {
    const state = this._hass?.states[this._config.entity];
    return (state?.attributes?.effect_list || []).filter((s) => s.startsWith("SG: "));
  }

  _render() {
    const root = this.shadowRoot;
    if (!root.querySelector("ha-form")) {
      const form = document.createElement("ha-form");
      form.addEventListener("value-changed", (e) => {
        this.dispatchEvent(
          new CustomEvent("config-changed", { detail: { config: e.detail.value } })
        );
      });
      root.appendChild(form);
    }
    const form = root.querySelector("ha-form");
    form.hass = this._hass;
    form.schema = buildEditorSchema(this._getSgScenes());
    form.data = this._config;
    form.computeLabel = (s) => EDITOR_LABELS[s.name] ?? s.name;
  }
}

customElements.define("govee-scene-card-editor", GoveeSceneCardEditor);

class GoveeSceneCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._palette = [...DEFAULT_PALETTE];
    this._scene = "";
    this._speed = 50;
    this._sending = false;
  }

  setConfig(config) {
    if (!config.entity) throw new Error("govee-scene-card: 'entity' is required");
    this._config = config;
    this._scene = config.default_scene ?? "";
    this._speed = config.default_speed ?? 50;
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateSceneSelect();
  }

  getCardSize() { return 3; }

  _getSgScenes() {
    const state = this._hass?.states[this._config.entity];
    return (state?.attributes?.effect_list || []).filter((s) => s.startsWith("SG: "));
  }

  _updateSceneSelect() {
    const select = this.shadowRoot?.getElementById("scene-select");
    if (!select) return;
    const scenes = this._getSgScenes();
    if (!scenes.length) return;
    const current = this._scene || scenes[0];
    select.innerHTML = scenes
      .map((s) => `<option value="${s}">${s}</option>`)
      .join("");
    if (!scenes.includes(this._scene)) {
      this._scene = scenes[0];
    }
    select.value = this._scene;
    this._applySceneSettings();
  }

  static getStubConfig() {
    return { entity: "", default_scene: "", default_speed: 50, show_title: true };
  }

  static getConfigElement() {
    return document.createElement("govee-scene-card-editor");
  }

  _build() {
    const root = this.shadowRoot;

    const style = document.createElement("style");
    style.textContent = CSS;

    const card = document.createElement("ha-card");
    if (this._config.show_title !== false) {
      card.setAttribute("header", "Govee Scene Editor");
      this.classList.remove("no-title");
    } else {
      this.classList.add("no-title");
    }
    card.innerHTML = `
      <div class="card-content">
        <div class="field">
          <div class="label">Scene</div>
          <select id="scene-select"></select>
        </div>
        <div class="field">
          <div class="label">Speed</div>
          <div class="speed-row">
            <ha-slider id="speed-slider" min="0" max="100" value="${this._speed}" step="1" style="flex:1"></ha-slider>
            <span class="speed-value" id="speed-value">${this._speed}</span>
          </div>
        </div>
        <div class="field palette-field">
          <div class="palette-header">
            <div class="label">Palette</div>
            <button class="reset-btn" id="reset-btn">Reset</button>
          </div>
          <div class="swatches" id="swatches"></div>
        </div>
        <button class="set-btn" id="set-btn">Save and Apply</button>
      </div>
    `;

    root.innerHTML = "";
    root.appendChild(style);
    root.appendChild(card);

    this._bindEvents();
    this._renderSwatches();
    this._updateSceneSelect();
  }

  _bindEvents() {
    const root = this.shadowRoot;

    root.getElementById("scene-select").addEventListener("change", (e) => {
      this._saveSceneSettings();
      this._scene = e.target.value;
      this._applySceneSettings();
    });

    const slider = root.getElementById("speed-slider");
    const speedVal = root.getElementById("speed-value");
    const onSpeedLive = (e) => {
      const v = parseInt(e.detail?.value ?? e.target?.value, 10);
      if (isNaN(v)) return;
      this._speed = v;
      speedVal.textContent = v;
    };
    const onSpeedCommit = (e) => {
      const v = parseInt(e.detail?.value ?? e.target?.value, 10);
      if (isNaN(v)) return;
      this._speed = v;
      speedVal.textContent = v;
      this._saveSceneSettings();
    };
    slider.addEventListener("value-changing", onSpeedLive);
    slider.addEventListener("input", onSpeedLive);
    slider.addEventListener("value-changed", onSpeedCommit);
    slider.addEventListener("change", onSpeedCommit);

    root.getElementById("reset-btn").addEventListener("click", () => {
      this._palette = [...DEFAULT_PALETTE];
      this._saveSceneSettings();
      this._renderSwatches();
    });

    root.getElementById("set-btn").addEventListener("click", () => this._setScene());
  }

  _renderSwatches() {
    const container = this.shadowRoot.getElementById("swatches");

    container.replaceChildren();

    for (let i = 0; i < MAX_COLORS; i++) {
      const wrap = document.createElement("div");
      wrap.className = "swatch-wrap";

      const swatch = document.createElement("div");
      const color = this._palette[i];

      if (!color) {
        swatch.className = i === this._palette.length ? "swatch empty can-add" : "swatch empty";
        swatch.textContent = i === this._palette.length ? "+" : "";
        if (i === this._palette.length) {
          const input = document.createElement("input");
          input.type = "color";
          input.value = "#ffffff";
          input.addEventListener("change", (e) => {
            this._palette.push(e.target.value);
            this._saveSceneSettings();
            this._renderSwatches();
          });

          swatch.title = "Add colour";
          swatch.addEventListener("click", () => input.click());
          swatch.appendChild(input);
        }
        wrap.appendChild(swatch);
        container.appendChild(wrap);
        continue;
      }

      swatch.className = "swatch";
      swatch.style.background = color;
      swatch.style.boxShadow = `0 0 8px ${color}99`;

      const input = document.createElement("input");
      input.type = "color";
      input.value = color;
      input.addEventListener("input", (e) => {
        const c = e.target.value;
        this._palette[i] = c;
        swatch.style.background = c;
        swatch.style.boxShadow = `0 0 8px ${c}99`;
        this._saveSceneSettings();
      });

      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.title = "Remove";
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._palette.splice(i, 1);
        this._saveSceneSettings();
        this._renderSwatches();
      });

      swatch.appendChild(input);
      wrap.appendChild(swatch);
      wrap.appendChild(removeBtn);
      container.appendChild(wrap);
    }
  }

  _loadStoredSettings() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch (_err) {
      return {};
    }
  }

  _writeStoredSettings(data) {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_err) {
      // Ignore storage failures; the card still works for the current session.
    }
  }

  _applySceneSettings() {
    if (!this._scene || !this._config.entity) return;
    const settings = this._loadStoredSettings()?.[this._config.entity]?.[this._scene] || {};
    const savedSpeed = Number.isInteger(settings.speed) ? settings.speed : this._config.default_speed;
    this._speed = Math.max(0, Math.min(100, savedSpeed ?? 50));
    this._palette = sanitizePalette(settings.palette);

    const slider = this.shadowRoot?.getElementById("speed-slider");
    const speedVal = this.shadowRoot?.getElementById("speed-value");
    if (slider) slider.value = this._speed;
    if (speedVal) speedVal.textContent = this._speed;
    this._renderSwatches();
  }

  _saveSceneSettings() {
    if (!this._scene || !this._config.entity) return;
    const data = this._loadStoredSettings();
    data[this._config.entity] = data[this._config.entity] || {};
    data[this._config.entity][this._scene] = {
      speed: this._speed,
      palette: sanitizePalette(this._palette),
    };
    this._writeStoredSettings(data);
  }

  async _setScene() {
    if (!this._hass || this._sending) return;
    this._sending = true;

    const btn = this.shadowRoot.getElementById("set-btn");
    btn.disabled = true;
    const originalText = "Save and Apply";
    btn.textContent = "Sending…";

    const colors = this._palette.map(hexToRgb);

    try {
      this._saveSceneSettings();
      await this._hass.callService("govee_lan", "set_simple_scene", {
        entity_id: this._config.entity,
        scene: this._scene,
        speed: this._speed,
        colors,
      });
      btn.textContent = "✓ Done";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        this._sending = false;
      }, 1500);
    } catch (_err) {
      btn.textContent = "✗ Failed";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        this._sending = false;
      }, 2000);
    }
  }
}

customElements.define("govee-scene-card", GoveeSceneCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "govee-scene-card",
  name: "Govee Scene Card",
  description: "Control Govee lamp scenes",
  preview: true,
});

const MATRIX_CSS = `
  :host { display: block; }
  .card-content {
    display: flex;
    flex-direction: column;
    gap: 13px;
    padding-top: 0;
  }
  :host(.no-title) .card-content { padding-top: 16px; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .label {
    font-size: 12px;
    font-weight: 500;
    color: var(--secondary-text-color);
  }
  .layer-tabs {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .layer-control {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .layer-tab {
    position: relative;
    width: 22px;
    height: 22px;
    padding: 0;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0,0,0,0.18));
    background: var(--secondary-background-color, rgba(0,0,0,0.04));
    color: var(--secondary-text-color);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.1s;
  }
  .layer-tab:hover { border-color: var(--secondary-text-color, #8e8e93); }
  .layer-tab.active {
    border-color: var(--primary-color, #03a9f4);
    background: rgba(3,169,244,0.12);
    color: var(--primary-color, #03a9f4);
    font-weight: 600;
  }
  .layer-tab.has-pixels::after {
    content: '';
    position: absolute;
    top: 2px;
    right: 2px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--primary-color, #03a9f4);
    opacity: 0.8;
  }
  .toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: end;
  }
  .preset-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 8px;
    align-items: center;
  }
  .preset-row .icon-btn {
    width: 34px;
    height: 34px;
  }
  select {
    width: 100%;
    background-color: var(--secondary-background-color, rgba(0,0,0,0.04));
    border: 1px solid var(--divider-color, rgba(0,0,0,0.18));
    border-radius: 8px;
    color: var(--primary-text-color, #e5e5e7);
    font-size: 14px;
    padding: 8px 32px 8px 10px;
    cursor: pointer;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238e8e93' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 11px center;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  select:hover { border-color: var(--secondary-text-color, #8e8e93); }
  select:focus { border-color: var(--primary-color, #03a9f4); }
  select option {
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color, #1c1c1e);
  }
  .speed-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 35px;
  }
  input[type=range] {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 3px;
    border-radius: 2px;
    background: var(--divider-color, rgba(0,0,0,0.18));
    outline: none;
    cursor: pointer;
  }
  input[type=range]::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 2px;
    background: var(--divider-color, rgba(0,0,0,0.18));
  }
  input[type=range]::-moz-range-track {
    height: 3px;
    border-radius: 2px;
    background: var(--divider-color, rgba(0,0,0,0.18));
  }
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--primary-color, #03a9f4);
    cursor: pointer;
    box-shadow: 0 0 0 3px rgba(3,169,244,0.20);
    transition: transform 0.1s, box-shadow 0.1s;
  }
  input[type=range]::-webkit-slider-thumb:hover {
    transform: scale(1.18);
    box-shadow: 0 0 0 5px rgba(3,169,244,0.25);
  }
  input[type=range]::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--primary-color, #03a9f4);
    border: none;
    cursor: pointer;
  }
  .speed-value {
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    min-width: 26px;
    text-align: right;
    color: var(--primary-text-color, #e5e5e7);
    flex-shrink: 0;
  }
  .palette {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .palette-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .reset-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 11px;
    color: var(--secondary-text-color, #8e8e93);
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.15s, color 0.15s;
  }
  .reset-btn:hover { opacity: 1; color: var(--primary-text-color, #e5e5e7); }
  .pixel-header-left {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .paint-target-tabs {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .paint-target-tab {
    height: 22px;
    padding: 0 7px;
    border-radius: 6px;
    border: 1px solid var(--divider-color, rgba(0,0,0,0.18));
    background: var(--secondary-background-color, rgba(0,0,0,0.04));
    color: var(--secondary-text-color);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .paint-target-tab:hover { border-color: var(--secondary-text-color, #8e8e93); }
  .paint-target-tab.active {
    border-color: var(--primary-color, #03a9f4);
    background: rgba(3,169,244,0.12);
    color: var(--primary-color, #03a9f4);
    font-weight: 600;
  }
  .bg-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bg-brightness-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
  }
  .palette-swatch.bg-selected {
    border-color: #f5a623;
    transform: translateY(-1px);
    box-shadow: 0 0 0 2px rgba(245,166,35,0.25);
  }
  .tool-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .paint-area {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 7px;
    align-items: start;
  }
  .paint-tools {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: center;
  }
  .paint-tools .spacer {
    flex: 1;
    min-height: 8px;
  }
  .tool-btn,
  .icon-btn {
    width: 28px;
    height: 28px;
    padding: 4px;
    border-radius: 8px;
    border: 1px solid var(--divider-color, rgba(0,0,0,0.18));
    background: var(--secondary-background-color, rgba(0,0,0,0.04));
    color: var(--secondary-text-color, #8e8e93);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.1s;
  }
  .tool-btn svg,
  .icon-btn svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  @media (hover: hover) and (pointer: fine) {
    .tool-btn:hover,
    .icon-btn:hover { border-color: var(--secondary-text-color, #8e8e93); }

    .icon-btn.danger:hover {
      border-color: rgba(255,59,48,0.9);
      color: #fff;
      background: rgba(255,59,48,0.9);
    }
  }
  .tool-btn.active {
    border-color: var(--primary-color, #03a9f4);
    background: rgba(3,169,244,0.12);
    color: var(--primary-color, #03a9f4);
  }
  .palette-swatch-wrap {
    position: relative;
    flex: 0 0 22px;
  }
  .palette-swatch {
    position: relative;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid rgba(255,255,255,0.18);
    cursor: pointer;
    display: block;
    overflow: hidden;
    transition: border-color 0.12s, transform 0.12s;
  }
  .palette-swatch.selected {
    border-color: var(--primary-color, #03a9f4);
    transform: translateY(-1px);
    box-shadow: 0 0 0 2px rgba(3,169,244,0.20);
  }
  .palette-swatch.empty {
    background: transparent;
    border: 1.5px dashed rgba(255,255,255,0.18);
    color: var(--secondary-text-color, #8e8e93);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
    line-height: 1;
  }
  .palette-swatch.empty:hover {
    background: rgba(255,255,255,0.07);
    border-color: var(--primary-color, #03a9f4);
    color: var(--primary-color, #03a9f4);
  }
  .palette-swatch.none-swatch {
    background: transparent;
    overflow: visible;
  }
  .palette-swatch.none-swatch:hover {
    border-color: var(--secondary-text-color, #8e8e93);
  }
  .palette-swatch.none-swatch svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .palette-swatch input[type=color] {
    position: absolute;
    inset: -4px;
    width: calc(100% + 8px);
    height: calc(100% + 8px);
    opacity: 0;
    pointer-events: none;
  }
  .remove-btn {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(28,28,30,0.95);
    border: 1px solid rgba(255,255,255,0.18);
    color: var(--secondary-text-color, #8e8e93);
    font-size: 10px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    z-index: 2;
    transition: background 0.12s, color 0.12s, border-color 0.12s;
  }
  .remove-btn:hover {
    background: rgba(255,59,48,0.9);
    color: #fff;
    border-color: transparent;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 0;
    touch-action: none;
    user-select: none;
    align-self: start;
  }
  .pixel {
    position: relative;
    aspect-ratio: 1;
    min-width: 0;
    border-radius: 0;
    border: 1px solid var(--card-background-color, #fff);
    background: var(--secondary-background-color, rgba(0,0,0,0.22));
    cursor: crosshair;
    box-sizing: border-box;
    box-shadow: none;
  }
  .pixel:hover {
    border-color: var(--primary-color, #03a9f4);
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .btn {
    width: 100%;
    padding: 10px;
    border-radius: 8px;
    border: none;
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .preset-row .btn {
    width: auto;
    white-space: nowrap;
    padding-left: 14px;
    padding-right: 14px;
  }
  .btn:hover:not(:disabled) {
    opacity: 0.88;
  }
  .btn.secondary {
    background: var(--secondary-background-color, rgba(0,0,0,0.04));
    color: var(--primary-text-color, #e5e5e7);
    border: 1px solid var(--divider-color, rgba(0,0,0,0.18));
  }
  .btn.primary {
    background: var(--primary-color, #03a9f4);
    color: #fff;
  }
  @media (hover: hover) and (pointer: fine) {
    .btn.danger:hover:not(:disabled) {
      border-color: rgba(255,59,48,0.9);
      color: #fff;
      background: rgba(255,59,48,0.9);
      opacity: 1;
    }
  }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const MATRIX_LAYER_COUNT = 3;

function newMatrixLayer() {
  return { pixels: Array(MATRIX_PIXEL_COUNT).fill(null), direction: "twinkle", speed: 80 };
}

function sanitizeMatrixPixels(pixels) {
  if (!Array.isArray(pixels)) return Array(MATRIX_PIXEL_COUNT).fill(null);
  return Array.from({ length: MATRIX_PIXEL_COUNT }, (_v, i) =>
    isHexColor(pixels[i]) ? pixels[i] : null
  );
}

function sanitizeMatrixPalette(palette) {
  if (!Array.isArray(palette)) return [...MATRIX_DEFAULT_PALETTE];
  const colors = palette.filter(isHexColor).slice(0, MATRIX_MAX_COLORS);
  if (!colors.length) return [...MATRIX_DEFAULT_PALETTE];
  while (colors.length < MATRIX_DEFAULT_PALETTE.length) {
    colors.push(MATRIX_DEFAULT_PALETTE[colors.length] ?? "#ffffff");
  }
  return colors;
}

function matrixLedIndex(row, col) {
  return row * MATRIX_WIDTH + col;
}

function sanitizeMatrixTool(tool) {
  return MATRIX_TOOLS.some(([value]) => value === tool) ? tool : "pencil";
}

function buildMatrixEditorSchema() {
  return [
    {
      name: "entity",
      required: true,
      selector: { entity: { domain: "light", integration: "govee_lan" } },
    },
    {
      name: "show_title",
      selector: { boolean: {} },
    },
  ];
}

const MATRIX_EDITOR_LABELS = {
  entity: "Light entity",
  show_title: "Show card title",
};

class GoveeMatrixCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _render() {
    const root = this.shadowRoot;
    if (!root.querySelector("ha-form")) {
      const form = document.createElement("ha-form");
      form.addEventListener("value-changed", (e) => {
        this.dispatchEvent(
          new CustomEvent("config-changed", { detail: { config: e.detail.value } })
        );
      });
      root.appendChild(form);
    }
    const form = root.querySelector("ha-form");
    form.hass = this._hass;
    form.schema = buildMatrixEditorSchema();
    form.data = this._config;
    form.computeLabel = (s) => MATRIX_EDITOR_LABELS[s.name] ?? s.name;
  }
}

customElements.define("govee-matrix-card-editor", GoveeMatrixCardEditor);

class GoveeMatrixCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._palette = [...MATRIX_DEFAULT_PALETTE];
    this._selectedColor = this._palette[0];
    this._layers = Array.from({ length: MATRIX_LAYER_COUNT }, newMatrixLayer);
    this._activeLayer = 0;
    this._tool = "pencil";
    this._lastPaintTool = "pencil";
    this._paintTarget = "fg";
    this._bgColor = null;
    this._bgBrightness = 100;
    this._sending = false;
    this._painting = false;
    this._shapeStart = null;
    this._previewIndices = [];
    this._activePresetName = null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error("govee-matrix-card: 'entity' is required");
    this._config = config;
    this._loadSettings();
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    this._updatePresetSelect();
  }

  getCardSize() { return 5; }

  static getStubConfig() {
    return { entity: "", show_title: true };
  }

  static getConfigElement() {
    return document.createElement("govee-matrix-card-editor");
  }

  _build() {
    const root = this.shadowRoot;
    const style = document.createElement("style");
    style.textContent = MATRIX_CSS;

    const card = document.createElement("ha-card");
    if (this._config.show_title !== false) {
      card.setAttribute("header", "Govee Matrix Editor");
      this.classList.remove("no-title");
    } else {
      this.classList.add("no-title");
    }
    const layer = this._layers[this._activeLayer];
    card.innerHTML = `
      <div class="card-content">
        <div class="field">
          <div class="palette-header">
            <div class="label">Paint</div>
            <button class="reset-btn" id="matrix-reset-btn">Reset</button>
          </div>
          <div class="palette" id="matrix-palette"></div>
          <div class="bg-controls" id="bg-controls" style="display:${(this._paintTarget === "bg" && this._bgColor !== null) ? "" : "none"}">
            <div class="bg-brightness-row" id="bg-brightness-row">
              <span class="label">Brightness</span>
              <ha-slider id="bg-brightness-slider" min="0" max="100" value="${this._bgBrightness}" step="1" style="flex:1"></ha-slider>
              <span class="speed-value" id="bg-brightness-value">${this._bgBrightness}</span>
            </div>
          </div>
        </div>
        <div class="field">
          <div class="palette-header pixel-header">
            <div class="pixel-header-left">
              <div class="label">Pixel Editor</div>
              <div class="paint-target-tabs">
                <button class="paint-target-tab${this._paintTarget === "fg" ? " active" : ""}" id="paint-fg-btn">FG</button>
                <button class="paint-target-tab${this._paintTarget === "bg" ? " active" : ""}" id="paint-bg-btn">BG</button>
              </div>
            </div>
            <div class="layer-control">
              <div class="label">Layer</div>
              <div class="layer-tabs">
                ${Array.from({ length: MATRIX_LAYER_COUNT }, (_, i) => {
                  const cls = [
                    "layer-tab",
                    i === this._activeLayer ? "active" : "",
                    this._layers[i].pixels.some(isHexColor) ? "has-pixels" : "",
                  ].filter(Boolean).join(" ");
                  return `<button class="${cls}" id="layer-tab-${i}" title="Layer ${i + 1}" aria-label="Layer ${i + 1}">${i + 1}</button>`;
                }).join("")}
              </div>
            </div>
          </div>
          <div class="paint-area">
            <div class="paint-tools">
              ${MATRIX_TOOLS.map(([value, label]) =>
                `<button class="tool-btn${value === this._tool ? " active" : ""}" id="tool-${value}" data-tool="${value}" title="${label}" aria-label="${label}">${MATRIX_TOOL_ICONS[value]}</button>`
              ).join("")}
              <div class="spacer"></div>
              <button class="icon-btn danger" id="clear-btn" title="Clear layer" aria-label="Clear layer">${MATRIX_TOOL_ICONS.trash}</button>
            </div>
            <div class="grid" id="matrix-grid"></div>
          </div>
        </div>
        <div class="toolbar">
          <div class="field">
            <div class="label">Direction</div>
            <select id="direction-select">
              ${MATRIX_DIRECTIONS.map(([value, label]) =>
                `<option value="${value}"${value === layer.direction ? " selected" : ""}>${label}</option>`
              ).join("")}
            </select>
          </div>
          <div class="field">
            <div class="label">Speed</div>
            <div class="speed-row">
              <ha-slider id="speed-slider" min="0" max="${MATRIX_MAX_SPEED}" value="${layer.speed}" step="1" style="flex:1"></ha-slider>
              <span class="speed-value" id="speed-value">${layer.speed}</span>
            </div>
          </div>
        </div>
        <div class="field">
          <div class="label">Saved Preset</div>
          <div class="preset-row">
            <select id="preset-select"></select>
            <button class="icon-btn" id="save-btn" title="Save preset" aria-label="Save preset">${MATRIX_TOOL_ICONS.floppy}</button>
            <button class="icon-btn danger" id="delete-preset-btn" title="Delete preset" aria-label="Delete preset">${MATRIX_TOOL_ICONS.trash}</button>
          </div>
        </div>
        <div class="actions">
          <button class="btn secondary danger" id="clear-preset-btn">Clear</button>
          <button class="btn primary" id="apply-btn">Apply Matrix</button>
        </div>
      </div>
    `;

    root.innerHTML = "";
    root.appendChild(style);
    root.appendChild(card);

    this._bindMatrixEvents();
    this._renderPalette();
    this._renderGrid();
  }

  _bindMatrixEvents() {
    const root = this.shadowRoot;

    root.getElementById("preset-select").addEventListener("change", (e) => {
      if (e.target.value) {
        this._loadPreset(e.target.value);
      } else {
        this._activePresetName = null;
        this._updatePresetSelect();
      }
    });

    root.getElementById("delete-preset-btn").addEventListener("click", () => {
      if (this._activePresetName) this._deletePreset(this._activePresetName);
    });

    root.getElementById("clear-preset-btn").addEventListener("click", () => {
      this._layers = Array.from({ length: MATRIX_LAYER_COUNT }, newMatrixLayer);
      this._activeLayer = 0;
      this._activePresetName = null;
      this._bgColor = null;
      this._bgBrightness = 100;
      this._saveSettings();
      this._updatePresetSelect();
      this._updateLayerTabs();
      this._updateLayerControls();
      this._updateBgControls();
      this._renderPalette();
      this._renderGrid();
    });

    for (let i = 0; i < MATRIX_LAYER_COUNT; i++) {
      root.getElementById(`layer-tab-${i}`).addEventListener("click", () => {
        this._activeLayer = i;
        this._updateLayerTabs();
        this._updateLayerControls();
        this._renderGrid();
      });
    }

    root.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextTool = btn.dataset.tool;
        if (nextTool === "picker") {
          if (this._tool !== "picker") this._lastPaintTool = this._tool;
        } else {
          this._lastPaintTool = nextTool;
        }
        this._tool = nextTool;
        this._updateToolButtons();
        this._saveSettings();
      });
    });

    root.getElementById("direction-select").addEventListener("change", (e) => {
      this._layers[this._activeLayer].direction = e.target.value;
      this._saveSettings();
    });

    const slider = root.getElementById("speed-slider");
    const speedVal = root.getElementById("speed-value");
    const onMatrixSpeedLive = (e) => {
      const v = parseInt(e.detail?.value ?? e.target?.value, 10);
      if (isNaN(v)) return;
      this._layers[this._activeLayer].speed = v;
      speedVal.textContent = v;
    };
    const onMatrixSpeedCommit = (e) => {
      const v = parseInt(e.detail?.value ?? e.target?.value, 10);
      if (isNaN(v)) return;
      this._layers[this._activeLayer].speed = v;
      speedVal.textContent = v;
      this._saveSettings();
    };
    slider.addEventListener("value-changing", onMatrixSpeedLive);
    slider.addEventListener("input", onMatrixSpeedLive);
    slider.addEventListener("value-changed", onMatrixSpeedCommit);
    slider.addEventListener("change", onMatrixSpeedCommit);

    const clearBtn = root.getElementById("clear-btn");
    clearBtn.addEventListener("click", () => {
      this._layers[this._activeLayer].pixels = Array(MATRIX_PIXEL_COUNT).fill(null);
      this._saveSettings();
      this._updateLayerTabs();
      this._renderGrid();
      clearBtn.blur();
    });

    root.getElementById("apply-btn").addEventListener("click", () => this._setMatrix());
    root.getElementById("save-btn").addEventListener("click", () => this._saveMatrixPreset());
    root.getElementById("matrix-reset-btn").addEventListener("click", () => {
      this._palette = [...MATRIX_DEFAULT_PALETTE];
      this._selectedColor = this._palette[0];
      this._saveSettings();
      this._renderPalette();
    });

    root.getElementById("paint-fg-btn").addEventListener("click", () => {
      this._paintTarget = "fg";
      this._updatePaintTargetButtons();
      this._updateBgControls();
      this._renderPalette();
      this._saveSettings();
    });

    root.getElementById("paint-bg-btn").addEventListener("click", () => {
      this._paintTarget = "bg";
      this._updatePaintTargetButtons();
      this._updateBgControls();
      this._renderPalette();
      this._saveSettings();
    });

    const onBgBrightnessLive = (e) => {
      const v = parseInt(e.detail?.value ?? e.target?.value, 10);
      if (isNaN(v)) return;
      this._bgBrightness = v;
      root.getElementById("bg-brightness-value").textContent = v;
      this._renderGrid();
    };
    const onBgBrightnessCommit = (e) => {
      const v = parseInt(e.detail?.value ?? e.target?.value, 10);
      if (isNaN(v)) return;
      this._bgBrightness = v;
      root.getElementById("bg-brightness-value").textContent = v;
      this._renderGrid();
      this._saveSettings();
    };
    const bgSlider = root.getElementById("bg-brightness-slider");
    bgSlider.addEventListener("value-changing", onBgBrightnessLive);
    bgSlider.addEventListener("input", onBgBrightnessLive);
    bgSlider.addEventListener("value-changed", onBgBrightnessCommit);
    bgSlider.addEventListener("change", onBgBrightnessCommit);

    const grid = root.getElementById("matrix-grid");
    grid.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const index = this._indexFromPoint(e.clientX, e.clientY);
      if (!Number.isInteger(index)) return;
      this._shapeStart = index;
      this._painting = true;
      grid.setPointerCapture?.(e.pointerId);
      this._handleToolDown(index);
    });
    grid.addEventListener("pointermove", (e) => {
      if (!this._painting) return;
      e.preventDefault();
      const index = this._indexFromPoint(e.clientX, e.clientY);
      if (Number.isInteger(index)) this._handleToolMove(index);
    });
    grid.addEventListener("pointerup", (e) => {
      const index = this._indexFromPoint(e.clientX, e.clientY);
      if (Number.isInteger(index)) this._handleToolUp(index);
      this._clearPreview();
      this._painting = false;
      this._shapeStart = null;
      grid.releasePointerCapture?.(e.pointerId);
    });

    window.addEventListener("pointerup", () => {
      this._clearPreview();
      this._painting = false;
      this._shapeStart = null;
    });
  }

  _matrixPresets() {
    const presets = this._hass?.states?.[this._config.entity]?.attributes?.matrix_scene_presets;
    return presets && typeof presets === "object" ? presets : {};
  }

  _updatePresetSelect() {
    const select = this.shadowRoot?.getElementById("preset-select");
    const deleteBtn = this.shadowRoot?.getElementById("delete-preset-btn");
    if (!select) return;
    const presets = this._matrixPresets();
    const names = Object.keys(presets).sort();
    const noPresets = !names.length;
    if (this._activePresetName && !names.includes(this._activePresetName)) {
      this._activePresetName = null;
      this._saveSettings();
    }
    select.innerHTML = noPresets
      ? `<option value="">No saved presets</option>`
      : [`<option value="">— unsaved —</option>`, ...names.map((n) => `<option value="${n}">${n}</option>`)].join("");
    select.disabled = noPresets;
    if (this._activePresetName && names.includes(this._activePresetName)) {
      select.value = this._activePresetName;
    } else {
      select.value = "";
    }
    if (deleteBtn) deleteBtn.disabled = !this._activePresetName;
  }

  async _deletePreset(name) {
    if (!this._hass || this._sending) return;
    if (!window.confirm?.(`Delete preset "${name}"?`)) return;
    this._sending = true;
    const btn = this.shadowRoot.getElementById("delete-preset-btn");
    btn.disabled = true;
    try {
      await this._hass.callService("govee_lan", "delete_matrix_scene", {
        entity_id: this._config.entity,
        name,
      });
      this._activePresetName = null;
      this._updatePresetSelect();
    } finally {
      this._sending = false;
      btn.disabled = false;
    }
  }

  _loadPreset(name) {
    const preset = this._matrixPresets()[name];
    if (!preset) return;
    const state = this._matrixEditorStateFromPreset(preset);
    if (!state) return;
    this._layers = state.layers;
    this._bgColor = state.bgColor;
    this._bgBrightness = state.bgBrightness;
    this._activeLayer = 0;
    this._activePresetName = name;
    this._saveSettings();
    this._updatePresetSelect();
    this._updateLayerTabs();
    this._updateLayerControls();
    this._updateBgControls();
    this._renderPalette();
    this._renderGrid();
  }

  _layersFromPreset(preset) {
    const layers = Array.from({ length: MATRIX_LAYER_COUNT }, newMatrixLayer);
    const sourceLayers = Array.isArray(preset.layers)
      ? preset.layers
      : [{
        groups: preset.groups,
        mode: preset.mode,
        rate: preset.rate,
      }];

    sourceLayers.slice(0, MATRIX_LAYER_COUNT).forEach((source, i) => {
      const layer = layers[i];
      if (MATRIX_DIRECTIONS.some(([value]) => value === source?.mode)) {
        layer.direction = source.mode;
      }
      if (Number.isInteger(source?.rate)) {
        layer.speed = Math.max(0, Math.min(MATRIX_MAX_SPEED, source.rate));
      }
      if (!Array.isArray(source?.groups)) return;
      source.groups.forEach((group) => {
        if (!Array.isArray(group?.color) || group.color.length !== 3 || !Array.isArray(group.leds)) {
          return;
        }
        const color = `#${group.color.map((c) =>
          Math.max(0, Math.min(255, Number(c) || 0)).toString(16).padStart(2, "0")
        ).join("")}`;
        group.leds.forEach((led) => {
          if (Number.isInteger(led) && led >= 0 && led < MATRIX_PIXEL_COUNT) {
            layer.pixels[led] = color;
          }
        });
      });
    });
    return layers;
  }

  _matrixEditorStateFromPreset(preset) {
    if (!preset || typeof preset !== "object") return null;
    const bg = Array.isArray(preset.background) && preset.background.length === 3
      ? preset.background
      : [0, 0, 0];
    const bgBrightness = Number.isInteger(preset.bg_brightness)
      ? Math.max(0, Math.min(100, preset.bg_brightness))
      : 0;
    return {
      layers: this._layersFromPreset(preset),
      bgColor: bgBrightness > 0 ? `#${bg.map((c) =>
        Math.max(0, Math.min(255, Number(c) || 0)).toString(16).padStart(2, "0")
      ).join("")}` : null,
      bgBrightness: bgBrightness > 0 ? bgBrightness : 100,
    };
  }

  _updateLayerTabs() {
    const root = this.shadowRoot;
    for (let i = 0; i < MATRIX_LAYER_COUNT; i++) {
      const tab = root.getElementById(`layer-tab-${i}`);
      if (!tab) return;
      tab.className = [
        "layer-tab",
        i === this._activeLayer ? "active" : "",
        this._layers[i].pixels.some(isHexColor) ? "has-pixels" : "",
      ].filter(Boolean).join(" ");
    }
  }

  _updateLayerControls() {
    const root = this.shadowRoot;
    const layer = this._layers[this._activeLayer];
    const dirSelect = root.getElementById("direction-select");
    const speedSlider = root.getElementById("speed-slider");
    const speedVal = root.getElementById("speed-value");
    if (dirSelect) dirSelect.value = layer.direction;
    if (speedSlider) speedSlider.value = layer.speed;
    if (speedVal) speedVal.textContent = layer.speed;
  }

  _updateToolButtons() {
    this.shadowRoot.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tool === this._tool);
    });
  }

  _switchBackFromPicker() {
    if (this._tool !== "picker") return;
    this._tool = sanitizeMatrixTool(this._lastPaintTool);
    if (this._tool === "picker") this._tool = "pencil";
    this._updateToolButtons();
    this._saveSettings();
  }

  _updatePaintTargetButtons() {
    const root = this.shadowRoot;
    root.getElementById("paint-fg-btn")?.classList.toggle("active", this._paintTarget === "fg");
    root.getElementById("paint-bg-btn")?.classList.toggle("active", this._paintTarget === "bg");
  }

  _updateBgControls() {
    const root = this.shadowRoot;
    const controls = root.getElementById("bg-controls");
    if (!controls) return;
    controls.style.display = (this._paintTarget === "bg" && this._bgColor !== null) ? "" : "none";
    const slider = root.getElementById("bg-brightness-slider");
    if (slider) slider.value = this._bgBrightness;
    const val = root.getElementById("bg-brightness-value");
    if (val) val.textContent = this._bgBrightness;
  }

  _updateSelectedPaletteSwatch(selectedSwatch) {
    this.shadowRoot.querySelectorAll(".palette-swatch.selected").forEach((swatch) => {
      swatch.classList.remove("selected");
    });
    selectedSwatch?.classList.add("selected");
  }

  _selectPaletteColor(color, selectedSwatch = null) {
    this._selectedColor = color;
    if (selectedSwatch) {
      this._updateSelectedPaletteSwatch(selectedSwatch);
      return;
    }
    const match = Array.from(this.shadowRoot.querySelectorAll(".palette-swatch")).find(
      (swatch) => swatch.dataset.color === color
    );
    this._updateSelectedPaletteSwatch(match);
  }

  _renderPalette() {
    const container = this.shadowRoot.getElementById("matrix-palette");
    container.replaceChildren();

    this._palette.forEach((color, i) => {
      const wrap = document.createElement("div");
      wrap.className = "palette-swatch-wrap";

      const swatch = document.createElement("button");
      swatch.type = "button";
      const isFgSelected = color === this._selectedColor;
      const isBgSelected = color === this._bgColor;
      swatch.className = [
        "palette-swatch",
        isFgSelected ? "selected" : "",
        isBgSelected ? "bg-selected" : "",
      ].filter(Boolean).join(" ");
      swatch.dataset.color = color;
      swatch.style.background = color;
      swatch.title = `${color} - double click to edit`;
      swatch.addEventListener("click", () => {
        if (this._paintTarget === "bg") {
          this._bgColor = color;
          this._updateBgControls();
          this._renderPalette();
          this._renderGrid();
          this._saveSettings();
        } else {
          this._selectPaletteColor(color, swatch);
        }
      });
      swatch.addEventListener("dblclick", () => input.click());

      const input = document.createElement("input");
      input.type = "color";
      input.value = color;
      input.addEventListener("input", (e) => {
        const next = e.target.value;
        this._palette[i] = next;
        if (this._selectedColor === color) this._selectedColor = next;
        const bgChanged = this._bgColor === color;
        if (bgChanged) this._bgColor = next;
        this._saveSettings();
        this._renderPalette();
        if (bgChanged) this._renderGrid();
      });
      swatch.appendChild(input);

      wrap.appendChild(swatch);

      if (i >= MATRIX_DEFAULT_PALETTE.length) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.title = "Remove";
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const removed = this._palette.splice(i, 1)[0];
          if (this._selectedColor === removed) this._selectedColor = this._palette[0] ?? null;
          if (this._bgColor === removed) this._bgColor = null;
          this._saveSettings();
          this._renderPalette();
        });
        wrap.appendChild(removeBtn);
      }

      container.appendChild(wrap);
    });

    const noneWrap = document.createElement("div");
    noneWrap.className = "palette-swatch-wrap";
    if (this._paintTarget !== "bg") noneWrap.style.display = "none";
    const noneSwatch = document.createElement("button");
    noneSwatch.type = "button";
    const noneIsSelected = this._bgColor === null;
    noneSwatch.className = ["palette-swatch", "none-swatch", noneIsSelected ? "bg-selected" : ""].filter(Boolean).join(" ");
    noneSwatch.title = "No background";
    noneSwatch.innerHTML = `<svg viewBox="0 0 22 22" aria-hidden="true"><line x1="2" y1="20" x2="20" y2="2" stroke="rgba(255,255,255,0.18)" stroke-width="2" stroke-linecap="round"/></svg>`;
    noneSwatch.addEventListener("click", () => {
      if (this._paintTarget !== "bg") return;
      this._bgColor = null;
      this._updateBgControls();
      this._renderPalette();
      this._renderGrid();
      this._saveSettings();
    });
    noneWrap.appendChild(noneSwatch);
    container.appendChild(noneWrap);

    if (this._palette.length < MATRIX_MAX_COLORS) {
      const wrap = document.createElement("div");
      wrap.className = "palette-swatch-wrap";

      const add = document.createElement("button");
      add.type = "button";
      add.className = "palette-swatch empty";
      add.title = "Add colour";
      add.textContent = "+";

      const input = document.createElement("input");
      input.type = "color";
      input.value = "#ffffff";
      input.addEventListener("change", (e) => {
        const color = e.target.value;
        this._palette.push(color);
        if (this._paintTarget === "bg") {
          this._bgColor = color;
          this._updateBgControls();
          this._renderGrid();
        } else {
          this._selectedColor = color;
        }
        this._saveSettings();
        this._renderPalette();
      });

      add.addEventListener("click", () => input.click());
      add.appendChild(input);
      wrap.appendChild(add);
      container.appendChild(wrap);
    }
  }

  _renderGrid() {
    const grid = this.shadowRoot.getElementById("matrix-grid");
    grid.replaceChildren();
    const pixels = this._layers[this._activeLayer].pixels;

    for (let row = 0; row < MATRIX_HEIGHT; row++) {
      for (let col = 0; col < MATRIX_WIDTH; col++) {
        const index = matrixLedIndex(row, col);
        const pixel = document.createElement("button");
        pixel.className = "pixel";
        pixel.dataset.index = String(index);
        this._applyPixelStyle(pixel, pixels[index] ?? null);
        grid.appendChild(pixel);
      }
    }
  }

  _indexFromPoint(clientX, clientY) {
    const element = this.shadowRoot.elementFromPoint?.(clientX, clientY);
    if (!element?.classList?.contains("pixel")) return null;
    return parseInt(element.dataset.index, 10);
  }

  _rowCol(index) {
    return { row: Math.floor(index / MATRIX_WIDTH), col: index % MATRIX_WIDTH };
  }

  _indexIfValid(row, col) {
    if (row < 0 || row >= MATRIX_HEIGHT || col < 0 || col >= MATRIX_WIDTH) return null;
    return matrixLedIndex(row, col);
  }

  _toolColor() {
    return this._tool === "eraser" ? null : this._selectedColor;
  }

  _handleToolDown(index) {
    if (this._tool === "picker") {
      this._pickPaletteColor(index);
      this._painting = false;
      return;
    }
    if (this._tool === "fill") {
      this._fillFrom(index, this._toolColor());
      this._painting = false;
      return;
    }
    if (this._tool === "pencil" || this._tool === "eraser") {
      this._paintIndices([index], this._toolColor());
      return;
    }
    if (this._tool === "brush") {
      this._paintIndices(this._brushIndices(index), this._toolColor());
    }
  }

  _handleToolMove(index) {
    if (this._tool === "pencil" || this._tool === "eraser") {
      this._paintIndices([index], this._toolColor());
      return;
    }
    if (this._tool === "brush") {
      this._paintIndices(this._brushIndices(index), this._toolColor());
      return;
    }
    if (this._tool === "line" || this._tool === "rect" || this._tool === "circle") {
      this._previewShape(index);
    }
  }

  _pickPaletteColor(index) {
    const color = this._layers[this._activeLayer].pixels[index];
    if (!isHexColor(color)) return;
    if (!this._palette.includes(color)) {
      if (this._palette.length >= MATRIX_MAX_COLORS) return;
      this._palette.push(color);
      this._saveSettings();
      this._renderPalette();
    }
    this._selectPaletteColor(color);
    this._switchBackFromPicker();
  }

  _handleToolUp(index) {
    if (!Number.isInteger(this._shapeStart)) return;
    const color = this._toolColor();
    if (this._tool === "line") {
      this._paintIndices(this._lineIndices(this._shapeStart, index), color);
    } else if (this._tool === "rect") {
      this._paintIndices(this._rectIndices(this._shapeStart, index), color);
    } else if (this._tool === "circle") {
      this._paintIndices(this._circleIndices(this._shapeStart, index), color);
    }
  }

  _shapeIndices(start, end) {
    if (this._tool === "line") return this._lineIndices(start, end);
    if (this._tool === "rect") return this._rectIndices(start, end);
    if (this._tool === "circle") return this._circleIndices(start, end);
    return [];
  }

  _previewShape(index) {
    if (!Number.isInteger(this._shapeStart)) return;
    this._clearPreview();
    const color = this._toolColor();
    this._previewIndices = this._shapeIndices(this._shapeStart, index);
    this._previewIndices.forEach((previewIndex) => {
      this._updatePixelElement(previewIndex, color, true);
    });
  }

  _clearPreview() {
    if (!this._previewIndices.length) return;
    const pixels = this._layers[this._activeLayer].pixels;
    this._previewIndices.forEach((index) => {
      this._updatePixelElement(index, pixels[index] ?? null);
    });
    this._previewIndices = [];
  }

  _brushIndices(index) {
    const { row, col } = this._rowCol(index);
    const indices = [];
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        const next = this._indexIfValid(r, c);
        if (next !== null) indices.push(next);
      }
    }
    return indices;
  }

  _lineIndices(start, end) {
    const from = this._rowCol(start);
    const to = this._rowCol(end);
    let x0 = from.col;
    let y0 = from.row;
    const x1 = to.col;
    const y1 = to.row;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    const indices = [];

    while (true) {
      indices.push(matrixLedIndex(y0, x0));
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return indices;
  }

  _rectIndices(start, end) {
    const a = this._rowCol(start);
    const b = this._rowCol(end);
    const top = Math.min(a.row, b.row);
    const bottom = Math.max(a.row, b.row);
    const left = Math.min(a.col, b.col);
    const right = Math.max(a.col, b.col);
    const indices = new Set();
    for (let col = left; col <= right; col++) {
      indices.add(matrixLedIndex(top, col));
      indices.add(matrixLedIndex(bottom, col));
    }
    for (let row = top; row <= bottom; row++) {
      indices.add(matrixLedIndex(row, left));
      indices.add(matrixLedIndex(row, right));
    }
    return Array.from(indices);
  }

  _circleIndices(start, end) {
    const a = this._rowCol(start);
    const b = this._rowCol(end);
    const top = Math.min(a.row, b.row);
    const bottom = Math.max(a.row, b.row);
    const left = Math.min(a.col, b.col);
    const right = Math.max(a.col, b.col);
    const height = bottom - top;
    const width = right - left;
    if (height === 0 && width === 0) return [start];

    const centerRow = top + height / 2;
    const centerCol = left + width / 2;
    const radius = Math.max(1, Math.min(width, height) / 2);
    const indices = new Set();
    const steps = Math.max(16, Math.ceil(radius * 16));
    for (let i = 0; i < steps; i++) {
      const angle = (Math.PI * 2 * i) / steps;
      const row = Math.round(centerRow + Math.sin(angle) * radius);
      const col = Math.round(centerCol + Math.cos(angle) * radius);
      const next = this._indexIfValid(row, col);
      if (next !== null) indices.add(next);
    }
    return Array.from(indices);
  }

  _fillFrom(index, color) {
    const pixels = this._layers[this._activeLayer].pixels;
    const target = pixels[index] ?? null;
    if (target === color) return;
    const queue = [index];
    const seen = new Set();
    const indices = [];

    while (queue.length) {
      const current = queue.shift();
      if (seen.has(current)) continue;
      seen.add(current);
      if ((pixels[current] ?? null) !== target) continue;
      indices.push(current);

      const { row, col } = this._rowCol(current);
      [
        this._indexIfValid(row - 1, col),
        this._indexIfValid(row + 1, col),
        this._indexIfValid(row, col - 1),
        this._indexIfValid(row, col + 1),
      ].forEach((next) => {
        if (next !== null && !seen.has(next)) queue.push(next);
      });
    }
    this._paintIndices(indices, color);
  }

  _paintIndices(indices, color) {
    const pixels = this._layers[this._activeLayer].pixels;
    Array.from(new Set(indices)).forEach((index) => {
      pixels[index] = color;
      this._updatePixelElement(index, color);
    });
    this._updateLayerTabs();
    this._saveSettings();
  }

  _updatePixelElement(index, color, preview = false) {
    const element = this.shadowRoot.querySelector(`.pixel[data-index="${index}"]`);
    if (!element) return;
    this._applyPixelStyle(element, color, preview);
  }

  _effectiveBgColor() {
    if (!this._bgColor) return null;
    const [r, g, b] = hexToRgb(this._bgColor).map((c) => Math.round(c * this._bgBrightness / 100));
    return `rgb(${r},${g},${b})`;
  }

  _applyPixelStyle(element, color, preview = false) {
    if (color) {
      element.style.background = color;
      element.style.zIndex = preview ? "2" : "1";
      element.style.boxShadow = preview
        ? `0 0 8px ${color}cc, inset 0 0 0 2px ${color}aa`
        : "";
      element.style.opacity = preview ? "0.72" : "";
    } else {
      const bg = this._effectiveBgColor();
      element.style.background = bg ?? "";
      element.style.zIndex = preview ? "2" : "";
      element.style.boxShadow = preview
        ? "inset 0 0 0 2px rgba(255,255,255,0.55)"
        : "";
      element.style.opacity = preview ? "0.55" : "";
    }
    if (!preview) element.style.opacity = "";
  }

  _loadStoredSettings() {
    try {
      const raw = window.localStorage?.getItem(MATRIX_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : {};
      return data && typeof data === "object" ? data : {};
    } catch (_err) {
      return {};
    }
  }

  _writeStoredSettings(data) {
    try {
      window.localStorage?.setItem(MATRIX_STORAGE_KEY, JSON.stringify(data));
    } catch (_err) {
      // Ignore storage failures; the card still works for the current session.
    }
  }

  _loadSettings() {
    if (!this._config.entity) return;
    const settings = this._loadStoredSettings()[this._config.entity] || {};
    this._palette = sanitizeMatrixPalette(settings.palette);
    this._selectedColor = isHexColor(settings.selectedColor)
      ? settings.selectedColor
      : this._palette[0];
    this._tool = sanitizeMatrixTool(settings.tool);
    this._lastPaintTool = this._tool === "picker" ? "pencil" : this._tool;
    this._paintTarget = settings.paintTarget === "bg" ? "bg" : "fg";
    this._bgColor = isHexColor(settings.bgColor) ? settings.bgColor : null;
    this._bgBrightness = Number.isInteger(settings.bgBrightness)
      ? Math.max(0, Math.min(100, settings.bgBrightness))
      : 100;
    this._activePresetName = settings.activePresetName
      && typeof settings.activePresetName === "string"
      ? settings.activePresetName
      : null;
    if (Array.isArray(settings.layers)) {
      this._layers = Array.from({ length: MATRIX_LAYER_COUNT }, (_, i) => {
        const l = settings.layers[i];
        if (!l) return newMatrixLayer();
        return {
          pixels: sanitizeMatrixPixels(l.pixels),
          direction: MATRIX_DIRECTIONS.some(([v]) => v === l.direction)
            ? l.direction
            : "twinkle",
          speed: Number.isInteger(l.speed)
            ? Math.max(0, Math.min(MATRIX_MAX_SPEED, l.speed))
            : 80,
        };
      });
    } else if (settings.pixels) {
      // Migrate old single-layer format
      this._layers = Array.from({ length: MATRIX_LAYER_COUNT }, newMatrixLayer);
      this._layers[0].pixels = sanitizeMatrixPixels(settings.pixels);
      if (MATRIX_DIRECTIONS.some(([v]) => v === settings.direction)) {
        this._layers[0].direction = settings.direction;
      }
      if (Number.isInteger(settings.speed)) {
        this._layers[0].speed = Math.max(0, Math.min(MATRIX_MAX_SPEED, settings.speed));
      }
    }
    this._activeLayer = 0;
  }

  _saveSettings() {
    if (!this._config.entity) return;
    const data = this._loadStoredSettings();
    data[this._config.entity] = {
      palette: sanitizeMatrixPalette(this._palette),
      selectedColor: this._selectedColor,
      tool: sanitizeMatrixTool(this._tool),
      paintTarget: this._paintTarget,
      bgColor: isHexColor(this._bgColor) ? this._bgColor : null,
      bgBrightness: this._bgBrightness,
      activePresetName: this._activePresetName,
      layers: this._layers.map((l) => ({
        pixels: l.pixels,
        direction: l.direction,
        speed: l.speed,
      })),
    };
    this._writeStoredSettings(data);
  }

  _buildLayers() {
    const activeLayers = this._layers
      .map((layer) => {
        const byColor = new Map();
        layer.pixels.forEach((color, index) => {
          if (!isHexColor(color)) return;
          if (!byColor.has(color)) byColor.set(color, []);
          byColor.get(color).push(index);
        });
        if (!byColor.size) return null;
        return {
          groups: Array.from(byColor.entries()).map(([color, leds]) => ({
            color: hexToRgb(color),
            leds,
          })),
          mode: layer.direction,
          rate: layer.speed,
          level: 100,
        };
      })
      .filter(Boolean);
    return activeLayers.length
      ? activeLayers
      : [{ groups: [{ color: [0, 0, 0], leds: [0] }], mode: "twinkle", rate: 80, level: 100 }];
  }

  _matrixServiceData() {
    const layers = this._buildLayers();
    const bgRgb = this._bgColor ? hexToRgb(this._bgColor) : [0, 0, 0];
    const bgBrightness = this._bgColor ? this._bgBrightness : 0;
    const serviceData = { entity_id: this._config.entity, background: bgRgb, bg_brightness: bgBrightness };
    if (layers.length === 1) {
      Object.assign(serviceData, {
        groups: layers[0].groups,
        mode: layers[0].mode,
        rate: layers[0].rate,
        level: layers[0].level,
      });
    } else {
      serviceData.layers = layers;
    }
    return serviceData;
  }

  async _saveMatrixPreset() {
    if (!this._hass || this._sending) return;
    let name = this._activePresetName;
    if (!name) {
      name = window.prompt?.("Save preset as:", "");
      if (!name?.trim()) return;
      name = name.trim();
    }

    this._sending = true;
    const btn = this.shadowRoot.getElementById("save-btn");
    btn.disabled = true;

    try {
      this._saveSettings();
      await this._hass.callService("govee_lan", "save_matrix_scene", {
        ...this._matrixServiceData(),
        name,
      });
      this._activePresetName = name;
      this._saveSettings();
      this._updatePresetSelect();
    } finally {
      btn.disabled = false;
      this._sending = false;
    }
  }

  async _setMatrix() {
    if (!this._hass || this._sending) return;
    this._sending = true;

    const btn = this.shadowRoot.getElementById("apply-btn");
    btn.disabled = true;
    const originalText = "Apply Matrix";
    btn.textContent = "Sending…";

    try {
      this._saveSettings();
      await this._hass.callService("govee_lan", "set_matrix_scene", this._matrixServiceData());
      btn.textContent = "✓ Done";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        this._sending = false;
      }, 1500);
    } catch (_err) {
      btn.textContent = "✗ Failed";
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        this._sending = false;
      }, 2000);
    }
  }
}

customElements.define("govee-matrix-card", GoveeMatrixCard);

window.customCards.push({
  type: "govee-matrix-card",
  name: "Govee Matrix Card",
  description: "Paint H6022 12x11 matrix pixels",
  preview: true,
});
