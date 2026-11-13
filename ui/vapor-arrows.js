// vapor-arrows.js: pixel chevron arrows for vapor.css (HUD direction indicators).
//
//   import { createArrow } from './ui/vapor-arrows.js';
//   const right = createArrow('right');        // 'up' | 'down' | 'left' | 'right'
//   hud.append(right);
//   right.classList.toggle('is-active', true); // lit, glitchy, flowing
//   right.style.setProperty('--power', 0.8);   // 0…1: how hard it pushes and glows
//   applyArrowTheme(hud, palette);             // recolor every arrow inside `hud`
//   const btn = createArrowButton('left', 'turn left');  // a clickable arrow
//   btn.setAttribute('aria-pressed', true);              // mark it selected
//
// Each arrow is a double chevron drawn on a 9×9 pixel grid as SVG squares with
// small gaps, filled with a cyan → pink gradient. CSS (.vw-arrow in vapor.css)
// handles rotation, the inactive dim state and the active glitch glow.

const GRID = 9;
let uid = 0;

// Right-pointing double chevron. Each row y has a tail chevron (2 px thick)
// and a tip chevron 3 px further right; the point sits at the middle row.
function cells(group) {
  const out = [];
  for (let y = 0; y < GRID; y++) {
    const x = 4 - Math.abs(y - 4);
    if (group === 'tail') out.push([x, y], [x + 1, y]);
    else out.push([x + 3, y], [x + 4, y]);
  }
  return out;
}

const pixels = (group) =>
  cells(group).map(([x, y]) => `<rect x="${x + 0.08}" y="${y + 0.08}" width="0.84" height="0.84"/>`).join('');

export function createArrow(direction = 'right') {
  const gradient = `vw-arrow-gradient-${++uid}`;
  const el = document.createElement('span');
  el.className = `vw-arrow vw-arrow--${direction}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <svg viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges">
      <defs>
        <linearGradient id="${gradient}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${GRID}" y2="0">
          <stop offset="0" style="stop-color: var(--vw-arrow-from, var(--vw-cyan))"/>
          <stop offset="1" style="stop-color: var(--vw-arrow-to, var(--vw-pink))"/>
        </linearGradient>
      </defs>
      <g class="vw-arrow__tail" fill="url(#${gradient})">${pixels('tail')}</g>
      <g class="vw-arrow__tip" fill="url(#${gradient})">${pixels('tip')}</g>
    </svg>`;
  return el;
}

// Recolors arrows from a theme: `palette` is 12 CSS colors, dim → bright.
// Set on a parent (e.g. the HUD) and every arrow inside picks it up.
export function applyArrowTheme(el, palette) {
  const vars = {
    '--vw-arrow-from': palette[6],
    '--vw-arrow-to': palette[11],
    '--vw-arrow-glow': palette[8],
    '--vw-arrow-ghost-1': palette[4],
    '--vw-arrow-ghost-2': palette[10],
    '--vw-arrow-off': `color-mix(in srgb, ${palette[9]} 22%, transparent)`,
  };
  for (const [name, value] of Object.entries(vars)) el.style.setProperty(name, value);
}

// A clickable arrow: <button class="vw-arrow-btn"> around a .vw-arrow.
// `.arrow` on the returned button is the arrow inside, for toggling is-active.
export function createArrowButton(direction, label = direction) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'vw-arrow-btn';
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', 'false');
  button.arrow = createArrow(direction);
  button.append(button.arrow);
  return button;
}
