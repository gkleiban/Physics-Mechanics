/**
 * Reusable control panel: build sliders, number inputs, selects, checkboxes
 * from a config. Each simulation provides control definitions and gets
 * getValue / getValues / setValue and optional onChange.
 */

/**
 * @typedef {Object} ControlDef
 * @property {string} id - Unique id (used in getValue/setValue)
 * @property {string} label - Visible label
 * @property {'range'|'number'|'select'|'checkbox'|'display'} type
 * @property {number} [min] - For range/number
 * @property {number} [max] - For range/number
 * @property {number} [step] - For range/number
 * @property {number|string|boolean} [value] - Initial value
 * @property {Array<{value: string|number, label: string}>} [options] - For select
 * @property {string} [unit] - Shown after value (e.g. "m", "°")
 * @property {(value: number, getValues: () => Object) => string} [valueText] - Optional derived readout for range inputs.
 * @property {string} [ariaLabel] - Override for accessibility
 */

/**
 * Create a control panel from definitions.
 * @param {HTMLElement} container - Element to fill (e.g. #controls-panel)
 * @param {ControlDef[]} controlDefs
 * @param {{ onChange?: (id: string, value: number|string|boolean) => void }} [options]
 * @returns {{ getValue: (id: string) => number|string|boolean, getValues: () => Object, setValue: (id: string, value: number|string|boolean) => void }}
 */
export function createControlPanel(container, controlDefs, options = {}) {
  const { onChange } = options;
  const inputs = /** @type {Record<string, HTMLInputElement|HTMLSelectElement>} */ ({});
  /** @type {Array<{ def: { valueText?: (value: unknown, getValues: () => Object) => string }, el: HTMLElement }>} */
  const displayRefs = [];

  container.innerHTML = '';
  container.classList.remove('controls-placeholder');

  for (const def of controlDefs) {
    const row = document.createElement('div');
    row.className = 'control-row';

    const label = document.createElement('label');
    label.htmlFor = def.id;
    label.className = 'control-label';
    label.textContent = def.label;

    const wrap = document.createElement('div');
    wrap.className = 'control-input-wrap';

    let input;
    const ariaLabel = def.ariaLabel ?? def.label;

    switch (def.type) {
      case 'range': {
        input = document.createElement('input');
        input.type = 'range';
        input.id = def.id;
        input.min = String(def.min ?? 0);
        input.max = String(def.max ?? 100);
        input.step = String(def.step ?? ((def.max - def.min) / 100 || 1));
        input.value = String(def.value ?? def.min ?? 0);
        input.setAttribute('aria-label', ariaLabel);
        wrap.appendChild(input);

        const valueSpan = document.createElement('span');
        valueSpan.className = 'control-value';
        valueSpan.textContent = input.value + (def.unit ?? '');
        wrap.appendChild(valueSpan);

        const derivedSpan = typeof def.valueText === 'function' ? document.createElement('span') : null;
        if (derivedSpan) {
          derivedSpan.className = 'control-derived';
          derivedSpan.textContent = def.valueText(Number(input.value), getValues);
          wrap.appendChild(derivedSpan);
        }

        input.addEventListener('input', () => {
          valueSpan.textContent = input.value + (def.unit ?? '');
          if (derivedSpan && typeof def.valueText === 'function') {
            derivedSpan.textContent = def.valueText(Number(input.value), getValues);
          }
          onChange?.(def.id, Number(input.value));
        });
        break;
      }
      case 'number': {
        input = document.createElement('input');
        input.type = 'number';
        input.id = def.id;
        if (def.min != null) input.min = String(def.min);
        if (def.max != null) input.max = String(def.max);
        if (def.step != null) input.step = String(def.step);
        input.value = String(def.value ?? def.min ?? 0);
        input.setAttribute('aria-label', ariaLabel);
        if (def.unit) {
          const unitSpan = document.createElement('span');
          unitSpan.className = 'control-unit';
          unitSpan.textContent = ` ${def.unit}`;
          wrap.appendChild(input);
          wrap.appendChild(unitSpan);
        } else {
          wrap.appendChild(input);
        }
        input.addEventListener('input', () => onChange?.(def.id, Number(input.value)));
        break;
      }
      case 'select': {
        input = document.createElement('select');
        input.id = def.id;
        input.setAttribute('aria-label', ariaLabel);
        const opts = def.options ?? [];
        for (const opt of opts) {
          const option = document.createElement('option');
          option.value = String(opt.value);
          option.textContent = opt.label;
          if (opt.value === def.value) option.selected = true;
          input.appendChild(option);
        }
        wrap.appendChild(input);
        input.addEventListener('change', () => onChange?.(def.id, input.value));
        break;
      }
      case 'checkbox': {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.id = def.id;
        input.checked = Boolean(def.value);
        input.setAttribute('aria-label', ariaLabel);
        wrap.appendChild(input);
        input.addEventListener('change', () => onChange?.(def.id, input.checked));
        break;
      }
      case 'display': {
        const displayEl = document.createElement('div');
        displayEl.className = 'control-display';
        displayEl.setAttribute('aria-live', 'polite');
        if (def.label) {
          label.textContent = def.label;
          row.appendChild(label);
        }
        wrap.appendChild(displayEl);
        row.appendChild(wrap);
        container.appendChild(row);
        displayRefs.push({ def, el: displayEl });
        continue;
      }
      default:
        continue;
    }

    row.appendChild(label);
    row.appendChild(wrap);
    container.appendChild(row);
    inputs[def.id] = input;
  }

  function getValue(id) {
    const el = inputs[id];
    if (!el) return undefined;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') return el.checked;
      if (el.type === 'number') return Number(el.value);
      if (el.type === 'range') return Number(el.value);
    }
    if (el instanceof HTMLSelectElement) return el.value;
    return undefined;
  }

  function getValues() {
    const out = {};
    for (const id of Object.keys(inputs)) out[id] = getValue(id);
    return out;
  }

  function setValue(id, value) {
    const el = inputs[id];
    if (!el) return;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else el.value = String(value);
    } else if (el instanceof HTMLSelectElement) {
      el.value = String(value);
    }
    // Update displayed value for range
    const row = el.closest('.control-row');
    const valueSpan = row?.querySelector('.control-value');
    if (valueSpan && el instanceof HTMLInputElement && el.type === 'range') {
      const def = controlDefs.find((d) => d.id === id);
      valueSpan.textContent = String(value) + (def?.unit ?? '');
      const derivedSpan = row?.querySelector('.control-derived');
      if (derivedSpan && typeof def?.valueText === 'function') {
        derivedSpan.textContent = def.valueText(Number(el.value), getValues);
      }
    }
  }

  function refreshDisplays() {
    for (const { def, el } of displayRefs) {
      if (typeof def.valueText === 'function') {
        el.textContent = def.valueText(undefined, getValues);
      }
    }
  }

  refreshDisplays();

  return { getValue, getValues, setValue, refreshDisplays };
}
