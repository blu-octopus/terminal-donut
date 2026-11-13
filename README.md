# terminal-donut 🍩

A spinning 3D ASCII donut in your terminal that you can **steer by tilting your phone**.

Inspired by Andy Sloane's [donut.c](https://www.a1k0n.net/2011/07/20/donut-math.html).

## Run

Requires Node 18+.

```bash
npm install
npm start
```

1. A QR code appears over the donut. Scan it with your phone's camera. Keep `npm start` running: every run makes a new link.
2. Your phone becomes a controller (`donut.exe`). The donut renders on its screen too, and the terminal mirrors exactly what the phone shows:
   - **▶ tilt mode:** on iPhone, tap **Allow**. Lay the phone flat for a top-down view, then tilt to turn the donut. It eases in, cruises at a capped speed and eases out, and it never builds up spin.
   - **speed:** spin speed, or the maximum turning speed in tilt mode. ❚❚ pauses the spin.
   - **color:** vapor, pink, sunset, ocean, matcha, mono.

   Settings sync both ways between your phone and the terminal.

Just want the donut? Run `npm run donut`.

## Play it in the browser (no terminal)

The phone controller is also a standalone website: **https://blu-octopus.github.io/terminal-donut/**

Opened there, it runs in solo mode. The donut, tilt, speed and colors all work on the phone by themselves. It's served over https by GitHub Pages, so motion sensors are allowed.

To publish it (one-time setup): push to `main`, then go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**, and save. Every push to `main` updates the site.

### Keys

| key | does |
|---|---|
| `c` | cycle colors |
| `+` / `-` | faster / slower |
| `space` | pause the spin |
| arrows | nudge the donut |
| `p` | show/hide the QR code |
| `q` | quit |

## How it works

```
 phone browser                          your laptop
┌───────────────────┐  WebSocket  ┌─────────────────────────────┐
│ deviceorientation │ ──────────▶ │ server.js → main.js         │
│ α β γ angles      │   (https    │ angles → quaternion         │
└───────────────────┘   tunnel)   │ smooth (slerp) → renderer.js│
                                  └─────────────────────────────┘
```

- **[src/renderer.js](src/renderer.js)**: draws the donut to the terminal in 256 colors.
- **[src/math.js](src/math.js)**: quaternions turn your phone's tilt into a rotation that never glitches or flips, and blend smoothly between poses.
- **[src/server.js](src/server.js)**: a tiny web and WebSocket server, plus a free [Cloudflare quick tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/). Phones only share motion sensors with **https** pages, which is why the tunnel is needed.
- **[src/donut-core.js](src/donut-core.js)**: the shared engine (rendering, color themes, motion). The terminal and the phone both run this same file, so they always match.
- **[index.html](index.html)**: the controller your phone opens. It draws the donut on a canvas from its own sensor, so there's no lag, and sends settings back to the terminal.
- **[src/main.js](src/main.js)**: the terminal app: loop, keyboard controls and state syncing. While a phone is connected, it mirrors the phone's pose.
- **Feel:** the motion constants live at the top of the motion section in [src/donut-core.js](src/donut-core.js): `TILT_ACCEL`, `TILT_MAX_SPEED` and `SPIN_A`. If tilting feels backwards, set `TILT_DIRECTION = -1` in [src/math.js](src/math.js).
- **[ui/vapor.css](ui/vapor.css)**: the vaporwave design system (tokens plus window, button, slider, chip and background components). See them all at [design-system.html](design-system.html).

### The tunnel binary

`npm start` looks for `cloudflared` in `.bin/` (git-ignored) or on your PATH. To install it on an Apple Silicon Mac:

```bash
mkdir -p .bin && curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz | tar -xz -C .bin
```

While `npm start` is running, the tunnel gives you a random public URL. Anyone who has that URL can steer your donut, and nothing else. The tunnel closes when you quit.

## Learning path

Want to understand it from scratch? Step-by-step lessons live in [lessons/](lessons/) (`npm run step1` … `step5`), and the curriculum is in [LEARNING_PATH.md](LEARNING_PATH.md).
