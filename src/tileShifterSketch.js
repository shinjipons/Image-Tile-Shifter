/**
 * Tile Shifter — p5.js instance mode; controls come from React/DialKit via getControls().
 */
import p5 from "p5";

const MAX_GRID = 200;
const MIN_GRID = 1;
const PREVIEW_MAX_EDGE = 1400;
const MIN_VIEW_ZOOM = 0.2;
const MAX_VIEW_ZOOM = 6;
const CANVAS_NEUTRAL_BG = "#333333";

/** @param {string|number} seed */
function seedToUint32(seed) {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** @param {number} seed - initial state (uint32) */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    let t = (a = (a + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {number} rows
 * @param {number} cols
 * @param {string|number} seed
 * @returns {number[]}
 */
function buildPermutation(rows, cols, seed) {
  const n = rows * cols;
  const arr = new Array(n);
  for (let i = 0; i < n; i++) arr[i] = i;
  const rng = mulberry32(seedToUint32(seed));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function identityPermutation(length) {
  const arr = new Array(length);
  for (let i = 0; i < length; i++) arr[i] = i;
  return arr;
}

function axisBoundaries(total, parts) {
  const b = new Array(parts + 1);
  b[0] = 0;
  for (let i = 1; i <= parts; i++) {
    b[i] = Math.round((i * total) / parts);
  }
  return b;
}

function setNearestNeighborSampling(ctx) {
  ctx.imageSmoothingEnabled = false;
  if ("mozImageSmoothingEnabled" in ctx) ctx.mozImageSmoothingEnabled = false;
  if ("webkitImageSmoothingEnabled" in ctx)
    ctx.webkitImageSmoothingEnabled = false;
}

/**
 * @param {*} p
 * @param {p5.Image|p5.Graphics} source
 * @param {number} rows
 * @param {number} cols
 * @param {number[]} permutation
 * @param {number} outW
 * @param {number} outH
 */
function composeTiles(p, source, rows, cols, permutation, outW, outH) {
  const srcW = source.width;
  const srcH = source.height;
  const w = Math.round(outW);
  const h = Math.round(outH);
  const out = p.createGraphics(w, h);
  out.pixelDensity(1);
  setNearestNeighborSampling(out.drawingContext);

  const xSrc = axisBoundaries(srcW, cols);
  const ySrc = axisBoundaries(srcH, rows);
  const xDst = axisBoundaries(w, cols);
  const yDst = axisBoundaries(h, rows);

  for (let i = 0; i < rows * cols; i++) {
    const k = permutation[i];
    const srcCol = k % cols;
    const srcRow = (k / cols) | 0;
    const dstCol = i % cols;
    const dstRow = (i / cols) | 0;

    const sx = xSrc[srcCol];
    const sw = xSrc[srcCol + 1] - sx;
    const sy = ySrc[srcRow];
    const sh = ySrc[srcRow + 1] - sy;

    const dx = xDst[dstCol];
    const dw = xDst[dstCol + 1] - dx;
    const dy = yDst[dstRow];
    const dh = yDst[dstRow + 1] - dy;

    out.image(source, dx, dy, dw, dh, sx, sy, sw, sh);
  }

  return out;
}

/**
 * @param {number} t - 0 = original image, 1 = fully shuffled content per cell
 */
function composeShuffleMorph(p, source, rows, cols, seed, outW, outH, t) {
  const w = Math.round(outW);
  const h = Math.round(outH);
  const tt = Math.min(1, Math.max(0, t));
  const n = rows * cols;

  if (tt <= 0) {
    return composeTiles(p, source, rows, cols, identityPermutation(n), w, h);
  }
  if (tt >= 1) {
    return composeTiles(p, source, rows, cols, buildPermutation(rows, cols, seed), w, h);
  }

  const perm = buildPermutation(rows, cols, seed);

  const srcW = source.width;
  const srcH = source.height;
  const xSrc = axisBoundaries(srcW, cols);
  const ySrc = axisBoundaries(srcH, rows);
  const xDst = axisBoundaries(w, cols);
  const yDst = axisBoundaries(h, rows);

  function srcRectForTile(tileIndex) {
    const srcCol = tileIndex % cols;
    const srcRow = (tileIndex / cols) | 0;
    const sx = xSrc[srcCol];
    const sw = xSrc[srcCol + 1] - sx;
    const sy = ySrc[srcRow];
    const sh = ySrc[srcRow + 1] - sy;
    return { sx, sy, sw, sh };
  }

  const out = p.createGraphics(w, h);
  out.pixelDensity(1);
  const ctx = out.drawingContext;
  ctx.imageSmoothingEnabled = true;
  if ("mozImageSmoothingEnabled" in ctx) ctx.mozImageSmoothingEnabled = true;
  if ("webkitImageSmoothingEnabled" in ctx)
    ctx.webkitImageSmoothingEnabled = true;

  out.background(CANVAS_NEUTRAL_BG);

  for (let i = 0; i < n; i++) {
    const dstCol = i % cols;
    const dstRow = (i / cols) | 0;
    const dx = xDst[dstCol];
    const dw = xDst[dstCol + 1] - dx;
    const dy = yDst[dstRow];
    const dh = yDst[dstRow + 1] - dy;

    const s0 = srcRectForTile(i);
    const s1 = srcRectForTile(perm[i]);
    const sx = s0.sx + (s1.sx - s0.sx) * tt;
    const sy = s0.sy + (s1.sy - s0.sy) * tt;
    const sw = s0.sw + (s1.sw - s0.sw) * tt;
    const sh = s0.sh + (s1.sh - s0.sh) * tt;

    out.image(source, dx, dy, dw, dh, sx, sy, sw, sh);
  }

  return out;
}

/**
 * @param {number} imgW
 * @param {number} imgH
 * @param {HTMLElement} hostEl
 */
function computePreviewSize(imgW, imgH, hostEl) {
  const rect = hostEl.getBoundingClientRect();
  const maxW = Math.max(160, rect.width - 8);
  const maxH = Math.max(160, Math.min(window.innerHeight * 0.65, 920));
  const cap = PREVIEW_MAX_EDGE / Math.max(imgW, imgH);
  const scale = Math.min(maxW / imgW, maxH / imgH, cap, 1);
  return {
    w: Math.max(1, Math.round(imgW * scale)),
    h: Math.max(1, Math.round(imgH * scale)),
  };
}

export function clampGrid(n) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return MIN_GRID;
  return Math.min(MAX_GRID, Math.max(MIN_GRID, x));
}

/**
 * @typedef {'free'|'square'|'aspect'} GridLinkMode
 * @typedef {Object} TileControls
 * @property {GridLinkMode} gridLinkL1
 * @property {GridLinkMode} gridLinkL2
 * @property {{ rows: number, cols: number, seed: number, shuffleAmount: number, enabled: boolean }} layer1
 * @property {{ rows: number, cols: number, seed: number, shuffleAmount: number, enabled: boolean }} layer2
 */

/**
 * @param {{ getControls: () => TileControls, onImageMetaChange?: (meta: { width: number, height: number } | null) => void }} options
 */
export function createTileShifter(options) {
  const getControls = options.getControls;
  const onImageMetaChange = options.onImageMetaChange || (() => {});

  /** @type {p5 | null} */
  let instance = null;
  let renderFn = /** @type {null | (() => void)} */ (null);
  let downloadFn = /** @type {null | (() => void)} */ (null);
  let teardownFn = /** @type {null | (() => void)} */ (null);

  return {
    /**
     * @param {{ host: HTMLElement, dropZone: HTMLElement, imageInput: HTMLInputElement, uploadZone: HTMLElement, uploadZoneEmpty: HTMLElement, uploadZoneLoaded: HTMLElement, uploadZoneThumb: HTMLImageElement, uploadZoneDimsImage: HTMLElement, uploadZoneDimsTile: HTMLElement, previewEmpty: HTMLElement }} dom
     */
    mount(dom) {
      if (instance) this.unmount();

      instance = new p5((p) => {
        /** @type {p5.Image | null} */
        let sourceImg = null;
        let objectUrl = null;
        let host = dom.host;
        let dropZone = dom.dropZone;
        /** @type {HTMLCanvasElement | null} */
        let canvasEl = null;
        let viewZoom = 1;

        const els = {
          imageInput: dom.imageInput,
          uploadZone: dom.uploadZone,
          uploadZoneEmpty: dom.uploadZoneEmpty,
          uploadZoneLoaded: dom.uploadZoneLoaded,
          uploadZoneThumb: dom.uploadZoneThumb,
          uploadZoneDimsImage: dom.uploadZoneDimsImage,
          uploadZoneDimsTile: dom.uploadZoneDimsTile,
          previewEmpty: dom.previewEmpty,
        };

        function setUploadDims(imageLine, tileLine) {
          if (els.uploadZoneDimsImage)
            els.uploadZoneDimsImage.textContent = imageLine;
          if (els.uploadZoneDimsTile)
            els.uploadZoneDimsTile.textContent = tileLine;
        }

        function syncUploadZone() {
          if (!els.uploadZone) return;
          if (!sourceImg) {
            if (els.uploadZoneThumb) els.uploadZoneThumb.removeAttribute("src");
            if (
              els.uploadZoneEmpty &&
              !els.uploadZoneEmpty.isConnected &&
              els.uploadZoneLoaded
            ) {
              els.uploadZone.insertBefore(
                els.uploadZoneEmpty,
                els.uploadZoneLoaded
              );
            }
            if (els.uploadZoneLoaded) els.uploadZoneLoaded.hidden = true;
            els.uploadZone.classList.remove("upload-zone--has-image");
            return;
          }
          if (els.uploadZoneThumb && objectUrl)
            els.uploadZoneThumb.src = objectUrl;
          if (els.uploadZoneEmpty && els.uploadZoneEmpty.isConnected) {
            els.uploadZoneEmpty.remove();
          }
          if (els.uploadZoneLoaded) els.uploadZoneLoaded.hidden = false;
          els.uploadZone.classList.add("upload-zone--has-image");
        }

        function readGrid() {
          const c = getControls();
          const rows = clampGrid(c.layer1.rows);
          let cols = clampGrid(c.layer1.cols);
          if (c.gridLinkL1 === "square") cols = rows;
          else if (
            c.gridLinkL1 === "aspect" &&
            sourceImg &&
            sourceImg.width > 0 &&
            sourceImg.height > 0
          ) {
            cols = clampGrid(
              Math.round((rows * sourceImg.width) / sourceImg.height)
            );
          }
          return {
            rows,
            cols,
            seed: Math.round(Number(c.layer1.seed)) || 0,
          };
        }

        function readShuffleBlendT() {
          const c = getControls();
          const v = Number(c.layer1.shuffleAmount);
          if (!Number.isFinite(v)) return 1;
          return Math.min(1, Math.max(0, v / 100));
        }

        function layer2On() {
          return !!getControls().layer2.enabled;
        }

        function readGridL2() {
          const c = getControls();
          const rows = clampGrid(c.layer2.rows);
          let cols = clampGrid(c.layer2.cols);
          if (c.gridLinkL2 === "square") cols = rows;
          else if (
            c.gridLinkL2 === "aspect" &&
            sourceImg &&
            sourceImg.width > 0 &&
            sourceImg.height > 0
          ) {
            cols = clampGrid(
              Math.round((rows * sourceImg.width) / sourceImg.height)
            );
          }
          return {
            rows,
            cols,
            seed: Math.round(Number(c.layer2.seed)) || 0,
          };
        }

        function readShuffleBlendTL2() {
          const c = getControls();
          const v = Number(c.layer2.shuffleAmount);
          if (!Number.isFinite(v)) return 1;
          return Math.min(1, Math.max(0, v / 100));
        }

        function composeStackedShuffle(w, h) {
          const { rows, cols, seed } = readGrid();
          const g1 = composeShuffleMorph(
            p,
            sourceImg,
            rows,
            cols,
            seed,
            w,
            h,
            readShuffleBlendT()
          );
          if (!layer2On()) return g1;
          const { rows: r2, cols: c2, seed: s2 } = readGridL2();
          const g2 = composeShuffleMorph(
            p,
            g1,
            r2,
            c2,
            s2,
            w,
            h,
            readShuffleBlendTL2()
          );
          g1.remove();
          return g2;
        }

        function onPreviewWheel(e) {
          if (!sourceImg || !dropZone) return;
          e.preventDefault();
          const dy = e.deltaY;
          const scale = e.ctrlKey ? 0.008 : 0.0022;
          const factor = Math.exp(-dy * scale);
          const next = Math.min(
            MAX_VIEW_ZOOM,
            Math.max(MIN_VIEW_ZOOM, viewZoom * factor)
          );
          if (Math.abs(next - viewZoom) < 1e-6) return;
          viewZoom = next;
          render();
        }

        function getImageFileFromClipboardEvent(e) {
          const cd =
            e.clipboardData ||
            (e.originalEvent && e.originalEvent.clipboardData);
          if (!cd) return null;

          if (cd.files && cd.files.length) {
            for (let i = 0; i < cd.files.length; i++) {
              const f = cd.files[i];
              if (f.type.startsWith("image/") && f.size > 0) return f;
            }
          }

          const items = cd.items;
          if (!items || !items.length) return null;

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.type || item.type.indexOf("image/") !== 0) continue;
            if (item.kind === "file") {
              const f = item.getAsFile();
              if (f && f.size > 0) return f;
            }
          }

          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.type || item.type.indexOf("image/") !== 0) continue;
            const f = item.getAsFile();
            if (f && f.size > 0) return f;
          }

          return null;
        }

        function tryReadClipboardImageAsFile() {
          if (
            !navigator.clipboard ||
            typeof navigator.clipboard.read !== "function"
          ) {
            return Promise.resolve(null);
          }
          return navigator.clipboard.read().then(function (clipboardItems) {
            for (let c = 0; c < clipboardItems.length; c++) {
              const ci = clipboardItems[c];
              const types = ci.types || [];
              for (let t = 0; t < types.length; t++) {
                const mime = types[t];
                if (mime.indexOf("image/") !== 0) continue;
                return ci.getType(mime).then(function (blob) {
                  if (!blob || blob.size === 0) return null;
                  const sub = mime.split("/")[1] || "png";
                  const safeSub = String(sub).replace(/[^a-z0-9]/gi, "") || "png";
                  return new File([blob], "pasted." + safeSub, { type: mime });
                });
              }
            }
            return Promise.resolve(null);
          });
        }

        function onWindowPaste(e) {
          const file = getImageFileFromClipboardEvent(e);
          if (file) {
            e.preventDefault();
            loadFile(file);
            if (els.imageInput) els.imageInput.value = "";
            return;
          }

          tryReadClipboardImageAsFile()
            .then(function (asyncFile) {
              if (asyncFile) {
                loadFile(asyncFile);
                if (els.imageInput) els.imageInput.value = "";
              }
            })
            .catch(function () {});
        }

        function setPreviewEmptyVisible(show) {
          if (els.previewEmpty) els.previewEmpty.hidden = !show;
        }

        function setCanvasIdle(idle) {
          if (!canvasEl) return;
          canvasEl.classList.toggle("preview__canvas--idle", idle);
        }

        function onFileInput(e) {
          const file = e.target.files && e.target.files[0];
          if (file) loadFile(file);
        }

        function clearDropHighlight() {
          if (dropZone) delete dropZone.dataset.dragActive;
        }

        function onDocumentDragOver(e) {
          if (!dropZone || !e.dataTransfer) return;
          if (!dropZone.contains(/** @type {Node} */ (e.target))) {
            clearDropHighlight();
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          dropZone.dataset.dragActive = "true";
        }

        function onDocumentDrop(e) {
          if (!dropZone || !dropZone.contains(/** @type {Node} */ (e.target)))
            return;
          e.preventDefault();
          clearDropHighlight();
          const file = e.dataTransfer.files && e.dataTransfer.files[0];
          if (file && file.type.startsWith("image/")) {
            loadFile(file);
            els.imageInput.value = "";
          }
        }

        function revokeObjectUrl() {
          if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
            objectUrl = null;
          }
        }

        function loadFile(file) {
          viewZoom = 1;
          revokeObjectUrl();
          if (els.uploadZoneThumb) els.uploadZoneThumb.removeAttribute("src");
          objectUrl = URL.createObjectURL(file);
          p.loadImage(
            objectUrl,
            function (img) {
              sourceImg = img;
              onImageMetaChange({
                width: sourceImg.width,
                height: sourceImg.height,
              });
              updateMeta();
              resizeDisplayToPreview();
              render();
            },
            function () {
              sourceImg = null;
              onImageMetaChange(null);
              updateMeta();
              render();
            }
          );
        }

        function updateMeta() {
          if (!sourceImg) {
            setUploadDims("", "");
            syncUploadZone();
            return;
          }
          const { rows, cols } = readGrid();
          const tw = sourceImg.width / cols;
          const th = sourceImg.height / rows;
          setUploadDims(
            `${sourceImg.width}×${sourceImg.height} px`,
            `tile ≈ ${tw.toFixed(1)}×${th.toFixed(1)} px (${cols}×${rows} grid)`
          );
          syncUploadZone();
        }

        function resizeDisplayToPreview() {
          if (!host || !sourceImg) return;
          const base = computePreviewSize(
            sourceImg.width,
            sourceImg.height,
            host
          );
          const w = Math.max(1, Math.round(base.w * viewZoom));
          const h = Math.max(1, Math.round(base.h * viewZoom));
          p.resizeCanvas(w, h);
        }

        function render() {
          if (!host) return;
          if (!sourceImg) {
            updateMeta();
            setPreviewEmptyVisible(true);
            setCanvasIdle(true);
            return;
          }

          setPreviewEmptyVisible(false);
          setCanvasIdle(false);

          updateMeta();
          resizeDisplayToPreview();

          const g = composeStackedShuffle(p.width, p.height);
          setNearestNeighborSampling(p.drawingContext);
          p.background(CANVAS_NEUTRAL_BG);
          p.image(g, 0, 0);
          g.remove();
        }

        function download() {
          if (!sourceImg) return;
          const { rows, cols, seed } = readGrid();
          const tMix = readShuffleBlendT();
          const g = composeStackedShuffle(sourceImg.width, sourceImg.height);
          const canvas = g.elt;
          const safeSeed = String(seed).replace(/[^\w.-]+/g, "_");
          const mixPct = Math.round(tMix * 100);
          const mixSuffix = mixPct < 100 ? `_mix${mixPct}` : "";
          let filename = `shifted_${safeSeed}_${cols}x${rows}${mixSuffix}`;
          if (layer2On()) {
            const { rows: r2, cols: c2, seed: s2 } = readGridL2();
            const t2 = readShuffleBlendTL2();
            const safeSeed2 = String(s2).replace(/[^\w.-]+/g, "_");
            const mix2 = Math.round(t2 * 100);
            const mix2s = mix2 < 100 ? `_mix${mix2}` : "";
            filename += `_L2_${safeSeed2}_${c2}x${r2}${mix2s}`;
          }
          filename += ".png";

          if (canvas.toBlob) {
            canvas.toBlob(
              function (blob) {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                g.remove();
              },
              "image/png"
            );
          } else {
            const url = canvas.toDataURL("image/png");
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            g.remove();
          }
        }

        p.setup = function () {
          els.imageInput.addEventListener("change", onFileInput);
          document.addEventListener("dragover", onDocumentDragOver);
          document.addEventListener("drop", onDocumentDrop);
          window.addEventListener("dragend", clearDropHighlight);
          window.addEventListener("paste", onWindowPaste, true);
          if (dropZone) {
            dropZone.addEventListener("wheel", onPreviewWheel, {
              passive: false,
            });
          }

          const c = p.createCanvas(1, 1);
          canvasEl = c.elt;
          canvasEl.classList.add("preview__canvas--idle");
          if (host) c.parent(host);
          p.pixelDensity(1);
          p.noLoop();
          render();
        };

        p.windowResized = function () {
          if (sourceImg) {
            resizeDisplayToPreview();
            render();
          }
        };

        teardownFn = function () {
          els.imageInput.removeEventListener("change", onFileInput);
          document.removeEventListener("dragover", onDocumentDragOver);
          document.removeEventListener("drop", onDocumentDrop);
          window.removeEventListener("dragend", clearDropHighlight);
          window.removeEventListener("paste", onWindowPaste, true);
          if (dropZone) {
            dropZone.removeEventListener("wheel", onPreviewWheel);
          }
          revokeObjectUrl();
          sourceImg = null;
          onImageMetaChange(null);
        };

        renderFn = render;
        downloadFn = download;
      }, dom.host);
    },

    unmount() {
      if (!instance) return;
      teardownFn?.();
      teardownFn = null;
      renderFn = null;
      downloadFn = null;
      instance.remove();
      instance = null;
    },

    render() {
      renderFn?.();
    },

    download() {
      downloadFn?.();
    },
  };
}
