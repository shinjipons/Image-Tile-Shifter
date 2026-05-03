/**
 * Tile Shifter — p5.js instance mode
 * composeTiles() composes for a future second layer.
 */
(function () {
  const MAX_GRID = 400;
  const MIN_GRID = 1;
  const PREVIEW_MAX_EDGE = 1400;
  /** ~80% black neutral surround (#333), matches --canvas-neutral-bg */
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
   * Fisher–Yates shuffle of [0..n-1]
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

  /** Identity map: output slot i shows source tile i (original image layout). */
  function identityPermutation(length) {
    const arr = new Array(length);
    for (let i = 0; i < length; i++) arr[i] = i;
    return arr;
  }

  /** Integer axis splits so segments partition `total` exactly (no fractional seams). */
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
   * Draw tiles into a p5.Graphics buffer using an explicit slot permutation.
   *
   * @param {*} p - p5 instance
   * @param {p5.Image|p5.Graphics} source
   * @param {number} rows
   * @param {number} cols
   * @param {number[]} permutation - perm[i] = source tile index placed at output slot i
   * @param {number} outW
   * @param {number} outH
   * @returns {p5.Graphics}
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
   * Grid cells stay fixed on the canvas; the source rectangle sampled into each cell
   * interpolates from identity tile i to shuffled tile perm[i] as t goes 0 → 1.
   * @param {number} t - 0 = original image, 1 = fully shuffled content per cell
   */
  function composeShuffleMorph(p, source, rows, cols, seed, outW, outH, t) {
    const w = Math.round(outW);
    const h = Math.round(outH);
    const tt = Math.min(1, Math.max(0, t));
    const n = rows * cols;

    if (tt <= 0) {
      return composeTiles(
        p,
        source,
        rows,
        cols,
        identityPermutation(n),
        w,
        h
      );
    }
    if (tt >= 1) {
      return composeTiles(
        p,
        source,
        rows,
        cols,
        buildPermutation(rows, cols, seed),
        w,
        h
      );
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

  function clampGrid(n) {
    const x = Math.floor(Number(n));
    if (!Number.isFinite(x)) return MIN_GRID;
    return Math.min(MAX_GRID, Math.max(MIN_GRID, x));
  }

  new p5(function (p) {
    /** @type {p5.Image | null} */
    let sourceImg = null;
    let objectUrl = null;
    /** @type {HTMLElement | null} */
    let host = null;
    /** @type {HTMLElement | null} */
    let dropZone = null;
    /** @type {HTMLCanvasElement | null} */
    let canvasEl = null;

    const els = {
      imageInput: null,
      rows: null,
      cols: null,
      rowsSlider: null,
      colsSlider: null,
      seed: null,
      seedRandom: null,
      gridLinkFree: null,
      colsFollowerWrap: null,
      shuffleBlend: null,
      shuffleBlendReadout: null,
      download: null,
      metaStatus: null,
      metaDims: null,
      previewEmpty: null,
    };

    function setStatus(text) {
      if (els.metaStatus) els.metaStatus.textContent = text;
    }

    function setDims(text) {
      if (els.metaDims) els.metaDims.textContent = text;
    }

    function bindDom() {
      host = document.getElementById("sketch-host");
      dropZone = document.getElementById("preview-drop-zone");
      els.imageInput = document.getElementById("image-input");
      els.rows = document.getElementById("rows");
      els.cols = document.getElementById("cols");
      els.rowsSlider = document.getElementById("rows-slider");
      els.colsSlider = document.getElementById("cols-slider");
      els.seed = document.getElementById("seed");
      els.seedRandom = document.getElementById("seed-random");
      els.gridLinkFree = document.getElementById("grid-link-free");
      els.colsFollowerWrap = document.getElementById("cols-follower-wrap");
      els.shuffleBlend = document.getElementById("shuffle-blend");
      els.shuffleBlendReadout = document.getElementById("shuffle-blend-readout");
      els.download = document.getElementById("download");
      els.metaStatus = document.getElementById("meta-status");
      els.metaDims = document.getElementById("meta-dims");
      els.previewEmpty = document.getElementById("preview-empty");

      els.imageInput.addEventListener("change", onFileInput);
      els.rows.addEventListener("input", onRowsNumberInput);
      els.cols.addEventListener("input", onColsNumberInput);
      els.rowsSlider.addEventListener("input", onRowsSliderInput);
      els.colsSlider.addEventListener("input", onColsSliderInput);
      els.seedRandom.addEventListener("click", randomizeSeed);
      els.seed.addEventListener("input", render);
      els.shuffleBlend.addEventListener("input", onShuffleBlendInput);
      document
        .querySelectorAll('input[name="grid-link-mode"]')
        .forEach(function (radio) {
          radio.addEventListener("change", onGridLinkModeChange);
        });
      els.download.addEventListener("click", onDownload);

      updateAspectRadioAvailability();
      updateColsFollowerUi();
      syncShuffleBlendReadout();
      setupDropTarget();
      document.addEventListener("paste", onDocumentPaste);
    }

    function readShuffleBlendT() {
      const v = Number(els.shuffleBlend.value);
      if (!Number.isFinite(v)) return 1;
      return Math.min(1, Math.max(0, v / 100));
    }

    function syncShuffleBlendReadout() {
      if (!els.shuffleBlendReadout || !els.shuffleBlend) return;
      const pct = Math.round(Number(els.shuffleBlend.value));
      els.shuffleBlendReadout.textContent = String(pct) + "%";
      els.shuffleBlend.setAttribute("aria-valuenow", String(pct));
    }

    function onShuffleBlendInput() {
      syncShuffleBlendReadout();
      render();
    }

    /**
     * Load first image found on the clipboard (e.g. screenshot or copied image).
     * Does not call preventDefault when there is no image, so text fields keep normal paste.
     */
    function onDocumentPaste(e) {
      const cd = e.clipboardData;
      if (!cd) return;

      if (cd.files && cd.files.length) {
        for (let i = 0; i < cd.files.length; i++) {
          const f = cd.files[i];
          if (f.type.startsWith("image/")) {
            e.preventDefault();
            loadFile(f);
            if (els.imageInput) els.imageInput.value = "";
            return;
          }
        }
      }

      const items = cd.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            loadFile(file);
            if (els.imageInput) els.imageInput.value = "";
            return;
          }
        }
      }
    }

    function getGridLinkMode() {
      const r = document.querySelector(
        'input[name="grid-link-mode"]:checked'
      );
      return r ? r.value : "free";
    }

    function isColsFollowerMode() {
      const m = getGridLinkMode();
      return m === "square" || m === "aspect";
    }

    /** cols ≈ rows × (image width / height), clamped — keeps tile pixels roughly square. */
    function syncColsFromImageAspect(rowsRaw) {
      if (!sourceImg || sourceImg.width <= 0 || sourceImg.height <= 0) return;
      const rowsVal = clampGrid(rowsRaw);
      const colsVal = Math.round(
        (rowsVal * sourceImg.width) / sourceImg.height
      );
      syncColsUI(colsVal);
    }

    function applyGridLinkFromRows() {
      const mode = getGridLinkMode();
      if (mode === "square") syncColsUI(els.rows.value);
      else if (mode === "aspect") syncColsFromImageAspect(els.rows.value);
    }

    function updateAspectRadioAvailability() {
      const aspectRadio = document.getElementById("grid-link-aspect");
      const aspectLabel = document.getElementById("grid-link-aspect-label");
      if (!aspectRadio || !aspectLabel) return;
      const ok =
        !!sourceImg && sourceImg.width > 0 && sourceImg.height > 0;
      aspectRadio.disabled = !ok;
      aspectLabel.classList.toggle("grid-link-option--disabled", !ok);
      if (!ok && aspectRadio.checked && els.gridLinkFree) {
        els.gridLinkFree.checked = true;
      }
    }

    function updateColsFollowerUi() {
      const follower = isColsFollowerMode();
      if (els.colsFollowerWrap) {
        els.colsFollowerWrap.classList.toggle(
          "slider-field--appearance-disabled",
          follower
        );
        if (follower)
          els.colsFollowerWrap.setAttribute("aria-disabled", "true");
        else els.colsFollowerWrap.removeAttribute("aria-disabled");
      }
      if (follower) {
        els.colsSlider.setAttribute("aria-disabled", "true");
        els.cols.setAttribute("aria-disabled", "true");
      } else {
        els.colsSlider.removeAttribute("aria-disabled");
        els.cols.removeAttribute("aria-disabled");
      }
      if (follower) {
        els.cols.tabIndex = -1;
        els.colsSlider.tabIndex = -1;
      } else {
        els.cols.removeAttribute("tabIndex");
        els.colsSlider.removeAttribute("tabIndex");
      }
    }

    function onGridLinkModeChange() {
      const mode = getGridLinkMode();
      if (mode === "square") syncColsUI(els.rows.value);
      else if (mode === "aspect") syncColsFromImageAspect(els.rows.value);
      updateColsFollowerUi();
      render();
    }

    function setPreviewEmptyVisible(show) {
      if (els.previewEmpty) els.previewEmpty.hidden = !show;
    }

    function setCanvasIdle(idle) {
      if (!canvasEl) return;
      canvasEl.classList.toggle("preview__canvas--idle", idle);
    }

    function randomizeSeed() {
      const n = Math.floor(Math.random() * 2147483647);
      els.seed.value = String(n);
      render();
    }

    function syncRowsUI(raw) {
      const v = clampGrid(raw);
      els.rows.value = String(v);
      els.rowsSlider.value = String(v);
      els.rowsSlider.setAttribute("aria-valuenow", String(v));
    }

    function syncColsUI(raw) {
      const v = clampGrid(raw);
      els.cols.value = String(v);
      els.colsSlider.value = String(v);
      els.colsSlider.setAttribute("aria-valuenow", String(v));
    }

    function onRowsNumberInput() {
      syncRowsUI(els.rows.value);
      if (isColsFollowerMode()) applyGridLinkFromRows();
      render();
    }

    function onColsNumberInput() {
      if (isColsFollowerMode()) return;
      syncColsUI(els.cols.value);
      render();
    }

    function onRowsSliderInput() {
      syncRowsUI(els.rowsSlider.value);
      if (isColsFollowerMode()) applyGridLinkFromRows();
      render();
    }

    function onColsSliderInput() {
      if (isColsFollowerMode()) return;
      syncColsUI(els.colsSlider.value);
      render();
    }

    function onFileInput(e) {
      const file = e.target.files && e.target.files[0];
      if (file) loadFile(file);
    }

    function clearDropHighlight() {
      if (dropZone) delete dropZone.dataset.dragActive;
    }

    /**
     * Whole preview pane accepts drops: `dragenter` does not bubble from children,
     * so we use document `dragover` + `contains(dropZone)` for reliable hit-testing.
     */
    function setupDropTarget() {
      document.addEventListener("dragover", onDocumentDragOver);
      document.addEventListener("drop", onDocumentDrop);
      window.addEventListener("dragend", clearDropHighlight);
    }

    function onDocumentDragOver(e) {
      if (!dropZone || !e.dataTransfer) return;
      if (!dropZone.contains(e.target)) {
        clearDropHighlight();
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      dropZone.dataset.dragActive = "true";
    }

    function onDocumentDrop(e) {
      if (!dropZone || !dropZone.contains(e.target)) return;
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

    /**
     * @param {File} file
     */
    function loadFile(file) {
      setStatus("Loading image…");
      els.download.disabled = true;
      revokeObjectUrl();
      objectUrl = URL.createObjectURL(file);
      p.loadImage(
        objectUrl,
        function (img) {
          sourceImg = img;
          setStatus("Ready. Adjust grid or seed, then export.");
          els.download.disabled = false;
          updateAspectRadioAvailability();
          const mode = getGridLinkMode();
          if (mode === "square") syncColsUI(els.rows.value);
          else if (mode === "aspect") syncColsFromImageAspect(els.rows.value);
          updateColsFollowerUi();
          updateMeta();
          resizeDisplayToPreview();
          render();
        },
        function () {
          sourceImg = null;
          setStatus("Could not load that file. Try PNG or JPEG.");
          setDims("");
          els.download.disabled = true;
          updateAspectRadioAvailability();
          updateColsFollowerUi();
          render();
        }
      );
    }

    function readGrid() {
      return {
        rows: clampGrid(els.rows.value),
        cols: clampGrid(els.cols.value),
        seed: els.seed.value,
      };
    }

    function updateMeta() {
      if (!sourceImg) {
        setDims("");
        return;
      }
      const { rows, cols } = readGrid();
      const tw = sourceImg.width / cols;
      const th = sourceImg.height / rows;
      setDims(
        `${sourceImg.width}×${sourceImg.height} px · tile ≈ ${tw.toFixed(1)}×${th.toFixed(1)} px (${cols}×${rows} grid)`
      );
    }

    function resizeDisplayToPreview() {
      if (!host || !sourceImg) return;
      const { w, h } = computePreviewSize(
        sourceImg.width,
        sourceImg.height,
        host
      );
      p.resizeCanvas(w, h);
    }

    function render() {
      if (!host) return;
      if (!sourceImg) {
        setPreviewEmptyVisible(true);
        setCanvasIdle(true);
        return;
      }

      setPreviewEmptyVisible(false);
      setCanvasIdle(false);

      updateMeta();
      resizeDisplayToPreview();

      const { rows, cols, seed } = readGrid();
      const g = composeShuffleMorph(
        p,
        sourceImg,
        rows,
        cols,
        seed,
        p.width,
        p.height,
        readShuffleBlendT()
      );
      setNearestNeighborSampling(p.drawingContext);
      p.background(CANVAS_NEUTRAL_BG);
      p.image(g, 0, 0);
      g.remove();
    }

    function onDownload() {
      if (!sourceImg) return;
      const { rows, cols, seed } = readGrid();
      const tMix = readShuffleBlendT();
      const g = composeShuffleMorph(
        p,
        sourceImg,
        rows,
        cols,
        seed,
        sourceImg.width,
        sourceImg.height,
        tMix
      );
      const canvas = g.elt;
      const safeSeed = String(seed).replace(/[^\w.-]+/g, "_");
      const mixPct = Math.round(tMix * 100);
      const mixSuffix = mixPct < 100 ? `_mix${mixPct}` : "";
      const filename = `shifted_${safeSeed}_${cols}x${rows}${mixSuffix}.png`;

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
      bindDom();
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
  });
})();
