// Tiny rendering helpers. Panels render HTML strings; buttons carry the engine
// action they trigger in data-act, handled by one delegated listener in main.js.
export function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function actAttr(action) {
  return `data-act="${esc(JSON.stringify(action))}"`;
}

export function actButton(action, label, { cls = '', disabled = false, title = '' } = {}) {
  return `<button class="${cls}" ${actAttr(action)}${disabled ? ' disabled' : ''}${title ? ` title="${esc(title)}"` : ''}>${label}</button>`;
}

export function hpBar(hp, maxHp) {
  const pct = maxHp ? Math.round((hp / maxHp) * 100) : 0;
  const level = hp === 0 ? 'out' : pct <= 25 ? 'low' : pct <= 50 ? 'mid' : 'ok';
  return `<span class="hp"><span class="hp-bar"><span class="hp-fill ${level}" style="width:${pct}%"></span></span><span class="hp-num">❤ ${hp}/${maxHp}</span></span>`;
}
