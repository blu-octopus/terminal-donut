// STEP 1 — The terminal is a screen made of characters.
//
// Big idea: a "frame buffer". Before we draw anything, we keep an array with
// one slot per character cell. We write into the array, then print the whole
// thing at once. Every renderer you'll ever touch (canvas, GPU, game engines)
// works this way — ours just uses letters instead of pixels.
//
// Run:  npm run step1

const width = process.stdout.columns || 80;
const height = (process.stdout.rows || 24) - 1; // leave one row for the prompt

// One flat array, read row by row: index = y * width + x
const buffer = new Array(width * height).fill(' ');

// plot() is our only drawing primitive. Everything later is built on it.
function plot(x, y, ch) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= width || y < 0 || y >= height) return; // clip off-screen
  buffer[y * width + x] = ch;
}

// A border so you can see the edges of your "screen"
for (let x = 0; x < width; x++) {
  plot(x, 0, '-');
  plot(x, height - 1, '-');
}
for (let y = 0; y < height; y++) {
  plot(0, y, '|');
  plot(width - 1, y, '|');
}

// A 10×10 "square". Look at it — it isn't square! Terminal cells are roughly
// twice as tall as they are wide. Remember this: it's the ASPECT ratio, and
// every step from here on corrects for it.
for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 10; x++) plot(4 + x, 3 + y, '#');
}

// Center marker
plot(width / 2, height / 2, '@');

// Turn the flat array back into lines and print.
// '\x1b[2J' clears the screen, '\x1b[H' moves the cursor to the top-left.
// These are ANSI escape codes — the terminal's tiny drawing API.
let out = '';
for (let y = 0; y < height; y++) {
  out += buffer.slice(y * width, (y + 1) * width).join('') + '\n';
}
process.stdout.write('\x1b[2J\x1b[H' + out);

// TRY THIS
// 1. Make the square look square by drawing 20 columns × 10 rows.
// 2. Draw a diagonal line from the top-left to the center.
// 3. Write your name in the middle of the screen using plot().
