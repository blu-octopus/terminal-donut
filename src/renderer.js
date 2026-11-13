// Draws a donut grid (from donut-core.js) to the terminal in color.

import { createGrid, SHADES } from './donut-core.js';

export function createTerminalGrid() {
  const width = process.stdout.columns || 80;
  const height = Math.max(4, (process.stdout.rows || 24) - 1); // last row = status bar
  return createGrid(width, height);
}

// Turn the shade buffer into one string of text + color codes.
export function present(grid, theme, status) {
  const { width, height, shade } = grid;

  let out = '\x1b[H';
  for (let y = 0; y < height; y++) {
    let color = -1;
    for (let x = 0; x < width; x++) {
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
