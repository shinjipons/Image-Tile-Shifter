# Image Tile Shifter

A small static web app that slices an image into a grid, shuffles the tiles with a **seeded** random permutation, and lets you **download** the result as a PNG. Built with [p5.js](https://p5js.org/) (instance mode) so it’s easy to extend (e.g. a second independent shuffle layer later).

## Run locally

No build step. From this folder:

```bash
# Python 3
python3 -m http.server 8080
```

Then open `http://localhost:8080` in a browser (serving over `file://` can block image loading in some setups).

Or use any static file server (VS Code Live Server, `npx serve`, etc.).

## Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New Project** → import the repo.
3. Framework: **Other** (or “Other” with no build).
4. Root directory: repo root; **Build Command**: leave empty; **Output Directory**: `.` (or default static).

Vercel serves `index.html` at `/` automatically.

## Usage

1. Choose or drop an image.
2. Set **rows** and **columns** (1–400).
3. Set **seed** (same seed + dimensions = same shuffle). Use **Random** for a new seed.
4. **Download PNG** exports at the **original image resolution**.

## Project files

| File        | Role                                      |
| ----------- | ----------------------------------------- |
| `index.html` | UI shell + p5.js CDN                      |
| `styles.css` | Layout and styling                        |
| `sketch.js`  | Load image, shuffle, preview, export    |

Shuffle logic is centered on `shuffleTiles()` in `sketch.js`: it returns a `p5.Graphics` buffer so a future second pass can run `shuffleTiles(layer1Output, …)` with separate rows/cols/seed.
