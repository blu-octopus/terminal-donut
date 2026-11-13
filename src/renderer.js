// Draws a donut grid (from donut-core.js) to the terminal in color.

import { createGrid, SHADES } from './donut-core.js';

export function createTerminalGrid() {
  const width = process.stdout.columns || 80;
  const height = Math.max(4, (process.stdout.rows || 24) - 1); // last row = status bar
  return createGrid(width, height);
}

// Turn the shade buffer into one string of text + color codes.
// `overlay` (optional): { lines: string[] } drawn centered on top, uncolored.
export function present(grid, theme, status, overlay) {
  const { width, height, shade } = grid;
  let ox = -1, oy = -1, oLines = null;
  if (overlay) {
    oLines = overlay.lines;
    const ow = Math.max(...oLines.map((l) => l.length));
    ox = Math.max(0, Math.floor((width - ow) / 2));
    oy = Math.max(0, Math.floor((height - oLines.length) / 2));
  }

  let out = '\x1b[H';
  for (let y = 0; y < height; y++) {
    let color = -1;
    const oLine = oLines && y >= oy && y < oy + oLines.length ? oLines[y - oy] : null;
    for (let x = 0; x < width; x++) {
      if (oLine && x >= ox && x < ox + oLine.length) {
        if (color !== -1) { out += '\x1b[0m'; color = -1; }
        out += oLine[x - ox];
        continue;
      }
      const s = shade[y * width + x];
      if (s < 0) {
        out += ' ';
        continue;
      }
      const c = theme.colors[s];
      if (c !== color) {
        out += `\x1b[38;5;${c}m`;
        color = c;
      }
      out += SHADES[s];
    }
    out += '\x1b[0m\n';
  }
  // Status bar on the last row, dimmed, padded to full width.
  const bar = status.length > width ? status.slice(0, width) : status.padEnd(width);
  out += `\x1b[2m${bar}\x1b[0m`;
  process.stdout.write(out);
}
