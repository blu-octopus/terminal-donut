# Learning path: terminal donut → tilt-controlled donut

The goal isn't just a cool donut. It's to learn how to **turn math into motion, and motion into feel**. That's the core skill of a design engineer.

Do one level per session. For each step: run it, read every comment, do the "TRY THIS" exercises, then **rebuild it from a blank file without looking**. Write in `notes/JOURNAL.md` whatever surprised you.

---

## Phase 1: The spinning donut (you are here)

| Step | File | You learn | The "aha" |
|---|---|---|---|
| 1 | `lessons/01-frame.js` | Frame buffers, ANSI escape codes, clipping | A screen is just an array you fill, then print |
| 2 | `lessons/02-circle.js` | Parametric shapes, aspect ratio, the animation loop, time-based motion | `cos`/`sin` of an angle traces a circle; tie motion to time, not frames |
| 3 | `lessons/03-torus.js` | 3D points, rotation matrices, sweeping a shape | A donut is a circle swept around another circle |
| 4 | `lessons/04-spin.js` | Perspective projection, z-buffer | Divide by distance, and keep whichever point is closest |
| 5 | `lessons/05-donut.js` | Surface normals, the dot product, diffuse lighting | Brightness = how much a surface faces the light |

**Done when:** you can explain each of these out loud in one sentence: frame buffer, parametric, rotation matrix, perspective divide, z-buffer, normal, dot product.

**Rebuild challenge:** write `my-donut.js` from scratch. Look things up whenever you need to, but don't copy and paste.

---

## Phase 2: Make it yours

Make the donut look and behave the way *you* want it to.

- **Color:** ANSI truecolor (`\x1b[38;2;R;G;Bm`). Map brightness to a palette instead of characters. Try a pink→white gradient.
- **Shading ramps:** experiment with different character sets (`░▒▓█`, braille `⠁⠃⠇⡇⣇⣧⣷⣿`). Braille gives you 2×4 sub-pixels per cell, so it's a resolution upgrade.
- **Keyboard control:** put stdin in raw mode (`process.stdin.setRawMode(true)`) and let the arrow keys change A and B.
  ⭐ This is the important one. You're splitting **input → state → render**. Once the angles come from "some input" rather than from the clock, swapping the keyboard for a phone is easy.
- **Refactor:** pull the math into `src/math.js`, the renderer into `src/render.js` and input into `src/input/keyboard.js`.

**Done when:** `render(state)` doesn't know or care where `state` came from.

---

## Phase 3: Device tilt 📱

**The problem:** most laptops don't give you an easy-to-read accelerometer, but your phone has a great one, and any web page can read it.

**Architecture:**

```
 phone browser                         your laptop (Node)
┌──────────────────┐   WebSocket   ┌──────────────────────────┐
│ deviceorientation│ ────────────▶ │ server.js                │
│  beta  (front/back tilt)         │   receives {beta, gamma} │
│  gamma (left/right tilt)         │   → state.A, state.B     │
└──────────────────┘               │   → render() in terminal │
                                   └──────────────────────────┘
```

Steps:
1. A tiny Node HTTP server that serves `phone.html`.
2. Add WebSockets (the `ws` package is your first dependency, which also teaches you `npm install`).
3. On the phone: listen for `deviceorientation`, then send `{beta, gamma}` about 30 times a second.
4. In the terminal: convert degrees to radians and feed them into the donut's state.

**Gotchas (this is where you really learn):**
- **iOS requires HTTPS** for motion sensors, *and* `DeviceOrientationEvent.requestPermission()` has to be called from a button tap. Plain `http://192.168.x.x` won't work. Use `mkcert` for a local certificate, or a tunnel (`cloudflared`).
- The phone and laptop need to be on the same Wi-Fi network (or use the tunnel).
- Gimbal weirdness: `beta` jumps when the phone is upright. Find out why, then decide what to do about it.

**Done when:** you tilt your phone and the donut follows.

---

## Phase 4: Feel (the design-engineering part)

Raw sensor data feels jittery and robotic, and tuning it is a craft:

- **Smoothing:** `current += (target - current) * 0.15` every frame (lerp/exponential smoothing). Tune the 0.15 and notice how it changes the personality of the motion.
- **Springs:** add velocity and damping so the donut overshoots and settles. Compare stiffness and damping values, the same way you'd compare easing curves in Figma.
- **Inertia:** flick the phone and the donut keeps spinning, slowing down with friction.
- **Calibration:** tap "zero" so that however you're holding the phone counts as neutral.
- **Dead zone:** ignore tiny tilts so it doesn't drift.
- **Frame-rate independence:** make the smoothing correct at 30fps *and* 120fps (hint: `1 - Math.pow(1 - k, dt * 60)`).

**Done when:** someone else picks up your phone and smiles. That's the test that matters.

---

## Phase 5: Ship it

- Record a GIF or video (try `vhs` or `asciinema`, plus a screen recording of the phone next to it).
- Write a strong README, then push it to GitHub.
- **Port it to the web:** the same `render()` writing into a `<pre>` tag. The phone could then *be* the donut, and it could live on your portfolio site.
- Write it up as a short case study: problem, what you learned, what the tuning felt like.

---

## How this grows you as a design engineer

1. **Math is a design material.** `sin`, `cos`, vectors and the dot product sit behind every easing curve, parallax effect, 3D card tilt and shader. After this project they're tools you've actually used, not scary formulas.
2. **Rendering mental model.** Frame buffer → draw → present → repeat is how Canvas, WebGL, React's render cycle and game engines all work.
3. **Input → state → render.** Splitting these apart is the most reusable architecture in UI, and Phase 2 makes you feel why it matters.
4. **Performance budgets.** At 30fps you have 33ms per frame. You'll learn to notice when something is too slow and what to do about it.
5. **Feel is tunable.** Phase 4 is what separates engineers from design engineers: same data, completely different emotional result depending on the numbers you pick.
6. **Shipping and storytelling.** A small, polished, documented thing beats a big unfinished one, and the journal becomes your case study.
