# Image Tile Shifter

A small web app that slices an image into a grid, shuffles the tiles with a **seeded** random permutation, and lets you **download** the result as a PNG. Built with [p5.js](https://p5js.org/) (instance mode) and [DialKit](https://joshpuckett.me/dialkit) for live parameter controls.

## Run locally

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm run build
npm run preview
```

serves the production build.

## Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel: **Add New Project** → import the repo.
3. Framework preset: **Vite** (or **Other** with build `npm run build`, output `dist`).

## Usage

1. Choose or drop an image (or paste).
2. In the DialKit panel: set **rows**, **columns**, **seed**, and **shuffle amount** for layer 1; optionally enable **layer 2** with its own grid and shuffle.
3. Use **Link rows / columns** in the sidebar (DialKit `SegmentedControl`) for independent, square, or aspect-matched grids when an image is loaded.
4. **Download PNG** in DialKit exports at the **original image resolution**.

## Project files

| Path | Role |
| --- | --- |
| `index.html` | Vite entry (mounts `#root`) |
| `src/main.jsx` | React bootstrap |
| `src/App.jsx` | Layout, DialKit + grid link controls, sketch wiring |
| `src/tileShifterSketch.js` | p5 sketch: load image, shuffle, preview, export |
| `styles.css` | App shell and preview styling |
