# How DOUGHNUT3D works (and how to push it further)

This guide explains every layer of the project: the math behind the donut, the motion, the inputs, the two renderers and the design system. Each section ends with ideas for improving it. Read it top to bottom once, then use it as a map when you want to change something.

---

## 1. The big picture

```
                ┌──────────────── src/donut-core.js ─────────────────┐
                │ torus math · rotation · projection · z-buffer ·    │
                │ lighting · color themes · motion (pose)            │
                └──────────┬───────────────────────────┬─────────────┘
                           │   same file, two hosts    │
        ┌──────────────────▼──────────────┐  ┌─────────▼───────────────────────┐
        │ index.html (phone / browser)    │  │ src/main.js (terminal, Node)    │
        │ canvas · tilt / mouse · UI      │  │ ANSI 256-color renderer         │
        │ sounds + haptics (vapor-fx.js)  │  │ keyboard controls               │
        │ vapor.css design system         │  │                                 │
        └─────────────────────────────────┘  └─────────────────────────────────┘
```

There's one engine (`donut-core.js`) and two places that draw it: a `<canvas>` in the browser and ANSI text in a terminal. Each one turns its own input (tilt, mouse or keys) into the donut's pose (which way it's facing) and draws it.
## 2. Tech stack

| Layer | What | Why this choice |
|---|---|---|
| Language | Plain JavaScript (ES modules) | The same file runs in Node and the browser, with no build step |
| Terminal app | Node.js 18+, zero dependencies | `process.stdout` + ANSI escape codes draw the frames, and raw-mode stdin reads keys |
| Browser rendering | Canvas 2D `fillText` | Draws each character at an exact grid cell, colored per shade |
| Sensors | [DeviceOrientation API](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent) | Phone tilt angles (beta = forward/back, gamma = left/right) |
| Sound | [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) | Synthesizes every sound live, so there are no audio files |
| Haptics | [Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) (Android) + native switch trick (iOS 18+) | iPhone Safari has no vibration API |
| Styling | Hand-written CSS: custom properties, `@property`, `backdrop-filter`, 3D transforms | The whole design system is one stylesheet, `ui/vapor.css` |
| Fonts | [Silkscreen](https://fonts.google.com/specimen/Silkscreen), [VT323](https://fonts.google.com/specimen/VT323) | Pixel display type and a terminal-style body font |
| Hosting | GitHub Pages | Free static **https** hosting, which phones require before they'll share motion sensors |

There's no framework, no bundler and no build step. Every file you see is exactly what runs.

---

## 3. The donut engine (`src/donut-core.js`)

This is Andy Sloane's [donut math](https://www.a1k0n.net/2011/07/20/donut-math.html), restructured for readability. If you want to build it up one piece at a time, the step-by-step versions are in [`lessons/`](../lessons).

1. **Build a torus.** Take a circle of radius `R1`, push it out from the center by `R2`, and sweep it around the vertical axis. Every pair of angles (θ around the tube, φ around the ring) gives one point on the surface:
   `(R2 + R1·cos θ, R1·sin θ, 0)`, rotated around y by φ.
2. **Rotate it** with a 3×3 matrix built from the current pose quaternion (see section 4).
3. **Project it** with perspective: push the donut `K2` units away and divide by distance:
   `screenX = K1·x / z`, `screenY = K1·y / z`. Character cells are about twice as tall as they are wide, so x is multiplied by 2 (`ASPECT`).
4. **Hide the back with a z-buffer.** Many points land on the same cell, so we keep the closest one. The buffer stores `1/z`, so "bigger means closer" and an empty cell (0) always loses.
5. **Light it.** Each point carries its **surface normal** (the arrow pointing straight out of the surface), rotated just like the point. Brightness is the **dot product** of the normal and the light direction: 1 means it faces the light, and 0 or less means it's in shadow. That's [Lambert's cosine law](https://en.wikipedia.org/wiki/Lambert%27s_cosine_law).
6. **Shade it.** Brightness picks a character from `.,-~:;=!*#$@` (dim to bright) and a color from the theme's 12-step palette.

`render(grid, matrix)` only fills a `shade` array with numbers. Turning those numbers into characters and colors is the job of whoever draws them (canvas or terminal). Keeping the math separate from the drawing is the most reusable idea in this project.

**Improve it**
- **Braille rendering:** each braille character (`⠁…⣿`) is a 2×4 grid of dots, so you get 8× the resolution in the same space.
- **Specular highlights:** add a shiny spot using the [Blinn–Phong model](https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_reflection_model) (`max(0, n·h)^shininess`).
- **Other shapes:** a sphere, a Möbius strip, or a twisted torus (add a twist to θ that depends on φ).
- **Speed:** precompute `cos`/`sin` tables, and skip the inner loop's array allocation (it already avoids most of it).

---

## 4. Motion and feel

### Quaternions, not angles
A rotation is stored as a **quaternion**: four numbers `[w, x, y, z]` ([`src/math.js`](../src/math.js)). Unlike stacking three Euler angles, quaternions never hit **gimbal lock** (a pose where you lose a direction of rotation), and you can blend two of them smoothly with **slerp** (spherical linear interpolation), which was introduced to animation by Ken Shoemake in 1985 ([paper](https://doi.org/10.1145/325165.325242)).

### Tilt → pose
- `fromTilt(beta, gamma)` turns the phone's front/back and left/right tilt into a quaternion. Alpha (compass heading) is ignored, so a phone lying flat reads as "no rotation" no matter which way it points.
- That rotation is applied on top of `TOP_DOWN` (the donut turned to face you), so **flat phone = looking straight down at the donut**.
- Sensor readings jitter, so they're smoothed first with exponential smoothing (`SENSOR_SMOOTHING`).

### Eased, capped motion
`moveToward()` uses a **trapezoidal motion profile**, the same idea motor controllers use:
- Speed up at a constant rate (`TILT_ACCEL`), which gives the ease-in.
- Never go faster than `TILT_MAX_SPEED × speed slider`. That's the cap.
- Start slowing down exactly when needed to stop on the target. From physics, you can still stop if `v² ≤ 2·a·distance`, so speed is limited to `√(2·a·distance)`. That's the ease-out.

Speed is recalculated toward the target every frame and never accumulates, so the donut can't build up spin.

### Frame-rate independence
Everything multiplies by `dt` (seconds since the last frame). Exponential smoothing uses `1 - exp(-k·dt)` instead of a fixed `0.1`, so the motion feels identical at 30fps and 120fps.

**Improve it**
- **Springs:** replace the trapezoid with a damped spring (stiffness + damping) for a bouncier, more physical feel. Try values the way you'd tune easing curves in Figma.
- **Flick to spin:** read `devicemotion`'s `rotationRate`, and turn a quick wrist flick into an impulse that decays with friction.
- **Calibration:** a "set as flat" button that stores the current tilt as the neutral pose, for people who hold their phone at an angle.
- **Dead zone:** ignore tilts under ~2° so a resting hand doesn't wobble the donut.

---

## 5. Input: phone tilt and the mouse

- **Phone:** the `deviceorientation` event gives `beta` and `gamma` in degrees. Two rules make it tricky:
  1. **Only https pages get sensor data.** GitHub Pages is https, so tilt works there. A local `http://` server doesn't.
  2. **iOS asks permission**, via `DeviceOrientationEvent.requestPermission()`, and only lets you call it from a tap. That's why tilt starts from the START button.
- **Desktop:** `matchMedia('(hover: hover) and (pointer: fine)')` detects a mouse or trackpad. There, START makes the donut's face follow the cursor: the cursor position becomes fake `beta`/`gamma` values (up to `MOUSE_TILT` = 55° at the window edges) that go through **the exact same `setTilt()` path** as the phone. Different inputs feeding one interface is the "input → state → render" pattern.

**Improve it**
- **Gamepad API:** steer with a controller's analog stick (`navigator.getGamepads()`), using the same `setTilt` call.
- **Keyboard tilt** on desktop (arrow keys), for accessibility.
- **Drag to rotate:** touch-drag on phones that deny motion access, as a fallback.

---

## 6. Retired: the phone ↔ terminal link

An earlier version let your phone drive the donut in your terminal: the terminal app ran a small Node server with WebSockets ([`ws`](https://github.com/websockets/ws)), opened a [Cloudflare quick tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/) for an https link, and printed it as a QR code. The phone sent its donut pose about 30 times a second and the terminal mirrored it.

It's retired from this repo to keep the project simple, and saved for a future "phone as a game controller" project. The working version is in git history at commit `0f9cd60`.

The design lesson worth keeping: **send results, not raw inputs.** When two screens show the same thing, let one side own the state and broadcast it, or tiny timing differences make them drift apart.

---

## 7. Two renderers

- **Terminal** ([`src/renderer.js`](../src/renderer.js)): builds one big string per frame, sets colors with `\x1b[38;5;Nm` ([256-color ANSI codes](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit)), and moves the cursor home with `\x1b[H` instead of clearing the screen, which would flicker. It only emits a color code when the color changes, which keeps the output small.
- **Canvas** ([`index.html`](../index.html)): cells are sized off the screen's **shorter side** (`min(width/28, height/46)`), so the donut is always about 22 characters across. The font is measured so that one glyph is exactly one cell wide. Palettes are stored as xterm color numbers and converted to CSS by `xtermToCss()`, so both screens show identical colors.

---

## 8. The design system (`ui/vapor.css`)

Built from a vaporwave moodboard: retro OS windows, ink outlines, hard offset shadows, pastel gradients and pixel type.

- **Tokens** (`--vw-*` custom properties) cover color, gradients, glass, borders, shadows, type and spacing.
- **Components:**
  - `.vw-logo`, `.vw-window` (+ `--glass`) and `.vw-titlebar`
  - `.vw-btn` (`--primary`, `--hot`, `--glass`, `--icon`, `--block`), `.vw-slider` and `.vw-chip`
  - `.vw-label` and `.vw-dot`
  - backgrounds: `.vw-sky`, `.vw-grid` and `.vw-scanlines`
- **Scaling:** every size is in `rem`. The donut page sets `html { font-size: clamp(13px, 1.6vmin + 7px, 19px) }`, so the whole UI keeps its proportions from a small phone to a big monitor.
- **Hover states** live inside `@media (hover: hover) and (pointer: fine)`, so phones never get "sticky" hover styles.
- **Theme-colored sky:** `@property` registers `--sky-1/2/3` as real colors, which lets CSS *animate* a gradient (normally impossible) when the theme changes.
- **The synthwave floor:** the `.vw-grid` box is the floor's area, and its top edge is the horizon. The grid itself is a `::before` plane tilted 80° in 3D with `perspective-origin` at the top. One gotcha: if the plane is deeper than the CSS camera distance, it passes "behind the camera" and the browser stops drawing it, so the plane is kept just shy of that distance.

Every component is shown in [`design-system.html`](../design-system.html). The easter egg: tap the DOUGHNUT3D logo.

**Improve it**
- **Dark/light variants** of the tokens.
- **Focus styles** for keyboard users on every control (buttons already have one).
- **Publish it:** `vapor.css` + `vapor-fx.js` could become their own tiny package.

---

## 9. Sound and haptics (`ui/vapor-fx.js`)

- **Sound:** each effect is two slightly **detuned** sawtooth oscillators (the chorus-y "cheap 80s synth" sound), passed through a **low-pass filter**, shaped by a quick attack / exponential decay **envelope**, and fed into a **feedback delay** for the dreamy echo.
  - START: a rising Cmaj9 arpeggio
  - Colors: each one plays its own note from a pentatonic scale, so any combination sounds pleasant
  - Logo: a pitch-dropping zap plus a burst of filtered noise, like a tape stop
- **Autoplay rules:** browsers only allow audio after a user gesture, so the audio context is created on the first click.
- **Haptics:**
  - Android: `navigator.vibrate(ms)`.
  - iPhone: Safari has no Vibration API, but since iOS 18 toggling a native `<input type="checkbox" switch>` produces a system haptic tap, so `haptic()` clicks a hidden one.

**Improve it:** a soft looping ambient pad while tilting, with filter cutoff tied to tilt angle so the sound "opens up" as you lean.

---

## 10. Bugs we hit (worth remembering)

| Symptom | Cause | Lesson |
|---|---|---|
| Phone stuck on "reconnecting…" (retired link) | `npm start` wasn't running, or the phone had an old tunnel link | Every run created a new URL. Make failure states say *what to do* |
| Speed slider looked tiny | The empty part of the track was the same dark ink as the glass behind it | Check contrast of every *state* of a control, not just the filled one |
| Grid floor vanished | The 3D plane was deeper than the CSS perspective distance, so it was culled | CSS 3D has a real camera; stay in front of it |
| Old styles after editing | Browser cache | Hard refresh (Cmd+Shift+R); GitHub Pages caches for ~10 minutes |
| Logo link "did nothing" | The tab pointed at a test server that had been shut down | When something "doesn't work", first check what's actually being served |
| Tilt felt backwards | Phone axes point out of the screen, scene axes point in | One sign flip (`TILT_DIRECTION` in `math.js`) controls it |

---

## 11. Where to go next

Rough order, from a weekend to a bigger project:

1. **Tune the feel:** `TILT_ACCEL`, `TILT_MAX_SPEED`, `SENSOR_SMOOTHING` in `donut-core.js`. Change one number at a time and describe how it *feels*.
2. **Add a theme:** add an entry to `THEMES` (12 [xterm color numbers](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit), dim to bright). It shows up everywhere automatically.
3. **Braille mode** for 8× resolution.
4. **Spring physics + flick to spin.**
5. **Port to WebGL/three.js:** the same math as a real 3D mesh, then render it back to ASCII with a shader (three.js has an `AsciiEffect`).
6. **Write it up:** a portfolio case study. The bug table above is great material for it.
