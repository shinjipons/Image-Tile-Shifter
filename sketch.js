/**
 * Tile Shifter — p5.js instance mode
 * composeTiles() composes for a future second layer.
 */
(function () {
  const MAX_GRID = 200;
  const MIN_GRID = 1;
  const PREVIEW_MAX_EDGE = 1400;
  const MIN_VIEW_ZOOM = 0.2;
  const MAX_VIEW_ZOOM = 6;
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
    /** Preview scale relative to “fit in host” (wheel zoom). */
    let viewZoom = 1;

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
      uploadZone: null,
      uploadZoneEmpty: null,
      uploadZoneLoaded: null,
      uploadZoneThumb: null,
      uploadZoneDimsImage: null,
      uploadZoneDimsTile: null,
      previewEmpty: null,
      layer2Enabled: null,
      layer2Panel: null,
      l2Rows: null,
      l2Cols: null,
      l2RowsSlider: null,
      l2ColsSlider: null,
      l2Seed: null,
      l2SeedRandom: null,
      l2GridLinkFree: null,
      l2ColsFollowerWrap: null,
      l2ShuffleBlend: null,
      l2ShuffleBlendReadout: null,
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
          els.uploadZone.insertBefore(els.uploadZoneEmpty, els.uploadZoneLoaded);
        }
        if (els.uploadZoneLoaded) els.uploadZoneLoaded.hidden = true;
        els.uploadZone.classList.remove("upload-zone--has-image");
        return;
      }
      if (els.uploadZoneThumb && objectUrl) els.uploadZoneThumb.src = objectUrl;
      if (els.uploadZoneEmpty && els.uploadZoneEmpty.isConnected) {
        els.uploadZoneEmpty.remove();
      }
      if (els.uploadZoneLoaded) els.uploadZoneLoaded.hidden = false;
      els.uploadZone.classList.add("upload-zone--has-image");
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
      els.uploadZone = document.getElementById("upload-zone");
      els.uploadZoneEmpty = document.getElementById("upload-zone-empty");
      els.uploadZoneLoaded = document.getElementById("upload-zone-loaded");
      els.uploadZoneThumb = document.getElementById("upload-zone-thumb");
      els.uploadZoneDimsImage = document.getElementById("upload-zone-dims-image");
      els.uploadZoneDimsTile = document.getElementById("upload-zone-dims-tile");
      els.previewEmpty = document.getElementById("preview-empty");
      els.layer2Enabled = document.getElementById("layer2-enabled");
      els.layer2Panel = document.getElementById("layer2-expanded");
      els.l2Rows = document.getElementById("l2-rows");
      els.l2Cols = document.getElementById("l2-cols");
      els.l2RowsSlider = document.getElementById("l2-rows-slider");
      els.l2ColsSlider = document.getElementById("l2-cols-slider");
      els.l2Seed = document.getElementById("l2-seed");
      els.l2SeedRandom = document.getElementById("l2-seed-random");
      els.l2GridLinkFree = document.getElementById("l2-grid-link-free");
      els.l2ColsFollowerWrap = document.getElementById("l2-cols-follower-wrap");
      els.l2ShuffleBlend = document.getElementById("l2-shuffle-blend");
      els.l2ShuffleBlendReadout = document.getElementById(
        "l2-shuffle-blend-readout"
      );

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
      document
        .querySelectorAll('input[name="grid-link-mode-l2"]')
        .forEach(function (radio) {
          radio.addEventListener("change", onGridLinkModeChangeL2);
        });
      els.l2Rows.addEventListener("input", onL2RowsNumberInput);
      els.l2Cols.addEventListener("input", onL2ColsNumberInput);
      els.l2RowsSlider.addEventListener("input", onL2RowsSliderInput);
      els.l2ColsSlider.addEventListener("input", onL2ColsSliderInput);
      els.l2SeedRandom.addEventListener("click", randomizeSeedL2);
      els.l2Seed.addEventListener("input", render);
      els.l2ShuffleBlend.addEventListener("input", onShuffleBlendInputL2);
      els.layer2Enabled.addEventListener("change", onLayer2EnabledChange);
      els.download.addEventListener("click", onDownload);

      updateAspectRadioAvailability();
      updateColsFollowerUi();
      updateColsFollowerUiL2();
      syncShuffleBlendReadout();
      syncShuffleBlendReadoutL2();
      setLayer2PanelVisible(els.layer2Enabled && els.layer2Enabled.checked);
      if (els.layer2Enabled)
        els.layer2Enabled.setAttribute(
          "aria-expanded",
          els.layer2Enabled.checked ? "true" : "false"
        );
      setupDropTarget();
      if (dropZone) {
        dropZone.addEventListener("wheel", onPreviewWheel, { passive: false });
      }
      window.addEventListener("paste", onWindowPaste, true);
    }

    /**
     * Wheel / pinch zoom on the preview column only (not the sidebar).
     * @param {WheelEvent} e
     */
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

    function layer2On() {
      return !!(els.layer2Enabled && els.layer2Enabled.checked);
    }

    function setLayer2PanelVisible(show) {
      if (els.layer2Panel) els.layer2Panel.hidden = !show;
    }

    function onLayer2EnabledChange() {
      const on = layer2On();
      setLayer2PanelVisible(on);
      if (els.layer2Enabled)
        els.layer2Enabled.setAttribute("aria-expanded", on ? "true" : "false");
      updateAspectRadioAvailability();
      updateColsFollowerUi();
      updateColsFollowerUiL2();
      render();
    }

    function readShuffleBlendTL2() {
      const v = Number(els.l2ShuffleBlend.value);
      if (!Number.isFinite(v)) return 1;
      return Math.min(1, Math.max(0, v / 100));
    }

    function syncShuffleBlendReadoutL2() {
      if (!els.l2ShuffleBlendReadout || !els.l2ShuffleBlend) return;
      const pct = Math.round(Number(els.l2ShuffleBlend.value));
      els.l2ShuffleBlendReadout.textContent = String(pct) + "%";
      els.l2ShuffleBlend.setAttribute("aria-valuenow", String(pct));
    }

    function onShuffleBlendInputL2() {
      syncShuffleBlendReadoutL2();
      render();
    }

    function getGridLinkModeL2() {
      const r = document.querySelector(
        'input[name="grid-link-mode-l2"]:checked'
      );
      return r ? r.value : "free";
    }

    function isColsFollowerModeL2() {
      const m = getGridLinkModeL2();
      return m === "square" || m === "aspect";
    }

    function syncColsFromImageAspectL2(rowsRaw) {
      if (!sourceImg || sourceImg.width <= 0 || sourceImg.height <= 0) return;
      const rowsVal = clampGrid(rowsRaw);
      const colsVal = Math.round(
        (rowsVal * sourceImg.width) / sourceImg.height
      );
      syncColsUIL2(colsVal);
    }

    function applyGridLinkFromRowsL2() {
      const mode = getGridLinkModeL2();
      if (mode === "square") syncColsUIL2(els.l2Rows.value);
      else if (mode === "aspect") syncColsFromImageAspectL2(els.l2Rows.value);
    }

    function syncRowsUIL2(raw) {
      const v = clampGrid(raw);
      els.l2Rows.value = String(v);
      els.l2RowsSlider.value = String(v);
      els.l2RowsSlider.setAttribute("aria-valuenow", String(v));
    }

    function syncColsUIL2(raw) {
      const v = clampGrid(raw);
      els.l2Cols.value = String(v);
      els.l2ColsSlider.value = String(v);
      els.l2ColsSlider.setAttribute("aria-valuenow", String(v));
    }

    function onL2RowsNumberInput() {
      syncRowsUIL2(els.l2Rows.value);
      if (isColsFollowerModeL2()) applyGridLinkFromRowsL2();
      render();
    }

    function onL2ColsNumberInput() {
      if (isColsFollowerModeL2()) return;
      syncColsUIL2(els.l2Cols.value);
      render();
    }

    function onL2RowsSliderInput() {
      syncRowsUIL2(els.l2RowsSlider.value);
      if (isColsFollowerModeL2()) applyGridLinkFromRowsL2();
      render();
    }

    function onL2ColsSliderInput() {
      if (isColsFollowerModeL2()) return;
      syncColsUIL2(els.l2ColsSlider.value);
      render();
    }

    function onGridLinkModeChangeL2() {
      const mode = getGridLinkModeL2();
      if (mode === "square") syncColsUIL2(els.l2Rows.value);
      else if (mode === "aspect") syncColsFromImageAspectL2(els.l2Rows.value);
      updateColsFollowerUiL2();
      render();
    }

    function randomizeSeedL2() {
      const n = Math.floor(Math.random() * 2147483647);
      els.l2Seed.value = String(n);
      render();
    }

    function updateColsFollowerUiL2() {
      const follower = isColsFollowerModeL2();
      if (els.l2ColsFollowerWrap) {
        els.l2ColsFollowerWrap.classList.toggle(
          "slider-field--appearance-disabled",
          follower
        );
        if (follower)
          els.l2ColsFollowerWrap.setAttribute("aria-disabled", "true");
        else els.l2ColsFollowerWrap.removeAttribute("aria-disabled");
      }
      if (follower) {
        els.l2ColsSlider.setAttribute("aria-disabled", "true");
        els.l2Cols.setAttribute("aria-disabled", "true");
      } else {
        els.l2ColsSlider.removeAttribute("aria-disabled");
        els.l2Cols.removeAttribute("aria-disabled");
      }
      if (follower) {
        els.l2Cols.tabIndex = -1;
        els.l2ColsSlider.tabIndex = -1;
      } else {
        els.l2Cols.removeAttribute("tabIndex");
        els.l2ColsSlider.removeAttribute("tabIndex");
      }
    }

    /**
     * @param {number} w
     * @param {number} h
     * @returns {p5.Graphics}
     */
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

    /**
     * @param {ClipboardEvent} e
     * @returns {File|null}
     */
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

    /**
     * Clipboard API fallback when PasteEvent.clipboardData has no usable image (common on Firefox).
     * @returns {Promise<File|null>}
     */
    function tryReadClipboardImageAsFile() {
      if (!navigator.clipboard || typeof navigator.clipboard.read !== "function") {
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

    /**
     * Load first image from the clipboard (capture phase so we see data before inputs consume paste).
     * Does not call preventDefault unless we load an image from the sync path, so text paste stays normal.
     */
    function onWindowPaste(e) {
      const file = getImageFileFromClipboardEvent(e);
      if (file) {
        e.preventDefault();
        loadFile(file);
        if (els.imageInput) els.imageInput.value = "";
        return;
      }

      tryReadClipboardImageAsFile().then(function (asyncFile) {
        if (asyncFile) {
          loadFile(asyncFile);
          if (els.imageInput) els.imageInput.value = "";
        }
      }).catch(function () {});
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

    function setAspectLinkEnabled(
      aspectRadioId,
      aspectLabelId,
      freeRadioId,
      enabled
    ) {
      const aspectRadio = document.getElementById(aspectRadioId);
      const aspectLabel = document.getElementById(aspectLabelId);
      const freeRadio = document.getElementById(freeRadioId);
      if (!aspectRadio || !aspectLabel) return;
      aspectRadio.disabled = !enabled;
      aspectLabel.classList.toggle("grid-link-option--disabled", !enabled);
      if (!enabled && aspectRadio.checked && freeRadio) freeRadio.checked = true;
    }

    function updateAspectRadioAvailability() {
      const ok =
        !!sourceImg && sourceImg.width > 0 && sourceImg.height > 0;
      setAspectLinkEnabled(
        "grid-link-aspect",
        "grid-link-aspect-label",
        "grid-link-free",
        ok
      );
      setAspectLinkEnabled(
        "l2-grid-link-aspect",
        "l2-grid-link-aspect-label",
        "l2-grid-link-free",
        ok
      );
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
      viewZoom = 1;
      els.download.disabled = true;
      revokeObjectUrl();
      if (els.uploadZoneThumb) els.uploadZoneThumb.removeAttribute("src");
      objectUrl = URL.createObjectURL(file);
      p.loadImage(
        objectUrl,
        function (img) {
          sourceImg = img;
          els.download.disabled = false;
          updateAspectRadioAvailability();
          const mode = getGridLinkMode();
          if (mode === "square") syncColsUI(els.rows.value);
          else if (mode === "aspect") syncColsFromImageAspect(els.rows.value);
          updateColsFollowerUi();
          updateColsFollowerUiL2();
          const mode2 = getGridLinkModeL2();
          if (mode2 === "square") syncColsUIL2(els.l2Rows.value);
          else if (mode2 === "aspect") syncColsFromImageAspectL2(els.l2Rows.value);
          updateMeta();
          resizeDisplayToPreview();
          render();
        },
        function () {
          sourceImg = null;
          els.download.disabled = true;
          updateAspectRadioAvailability();
          updateColsFollowerUi();
          updateColsFollowerUiL2();
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

    function readGridL2() {
      return {
        rows: clampGrid(els.l2Rows.value),
        cols: clampGrid(els.l2Cols.value),
        seed: els.l2Seed.value,
      };
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

    function onDownload() {
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
