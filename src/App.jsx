import { useEffect, useRef, useState } from "react";
import { DialRoot, DialStore, SegmentedControl, useDialKit } from "dialkit";
import "dialkit/styles.css";
import { clampGrid, createTileShifter } from "./tileShifterSketch.js";

const LINK_OPTIONS_NO_ASPECT = [
  { value: "free", label: "Independent" },
  { value: "square", label: "Square" },
];

const LINK_OPTIONS_WITH_ASPECT = [
  ...LINK_OPTIONS_NO_ASPECT,
  { value: "aspect", label: "Aspect" },
];

function randomSeedInt() {
  return Math.floor(Math.random() * 2147483647);
}

export default function App() {
  const [gridLinkL1, setGridLinkL1] = useState(
    /** @type {"free" | "square" | "aspect"} */ ("free")
  );
  const [gridLinkL2, setGridLinkL2] = useState(
    /** @type {"free" | "square" | "aspect"} */ ("free")
  );
  const [hasImage, setHasImage] = useState(false);
  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);

  const sketchApiRef = useRef(null);
  const controlsRef = useRef(null);

  const sketchHostRef = useRef(null);
  const dropZoneRef = useRef(null);
  const imageInputRef = useRef(null);
  const uploadZoneRef = useRef(null);
  const uploadZoneEmptyRef = useRef(null);
  const uploadZoneLoadedRef = useRef(null);
  const uploadZoneThumbRef = useRef(null);
  const uploadZoneDimsImageRef = useRef(null);
  const uploadZoneDimsTileRef = useRef(null);
  const previewEmptyRef = useRef(null);

  const params = useDialKit(
    "Tile Shifter",
    {
      layer1: {
        rows: [8, 1, 200],
        cols: [8, 1, 200],
        seed: [1, 0, 2147483647],
        shuffleAmount: [100, 0, 100],
        randomSeedL1: { type: "action", label: "Random seed" },
      },
      layer2: {
        enabled: false,
        rows: [12, 1, 200],
        cols: [12, 1, 200],
        seed: [2, 0, 2147483647],
        shuffleAmount: [100, 0, 100],
        randomSeedL2: { type: "action", label: "Random L2 seed" },
      },
      downloadPng: { type: "action", label: "Download PNG" },
    },
    {
      onAction: (path) => {
        const panel = DialStore.getPanels().find((p) => p.name === "Tile Shifter");
        if (!panel) return;
        const { id } = panel;
        if (path === "layer1.randomSeedL1") {
          DialStore.updateValue(id, "layer1.seed", randomSeedInt());
        } else if (path === "layer2.randomSeedL2") {
          DialStore.updateValue(id, "layer2.seed", randomSeedInt());
        } else if (path === "downloadPng") {
          sketchApiRef.current?.download();
        }
      },
    }
  );

  controlsRef.current = {
    gridLinkL1,
    gridLinkL2,
    layer1: {
      rows: params.layer1.rows,
      cols: params.layer1.cols,
      seed: params.layer1.seed,
      shuffleAmount: params.layer1.shuffleAmount,
      enabled: true,
    },
    layer2: {
      rows: params.layer2.rows,
      cols: params.layer2.cols,
      seed: params.layer2.seed,
      shuffleAmount: params.layer2.shuffleAmount,
      enabled: params.layer2.enabled,
    },
  };

  useEffect(() => {
    if (!hasImage) {
      setGridLinkL1((m) => (m === "aspect" ? "free" : m));
      setGridLinkL2((m) => (m === "aspect" ? "free" : m));
    }
  }, [hasImage]);

  useEffect(() => {
    const panel = DialStore.getPanels().find((p) => p.name === "Tile Shifter");
    if (!panel) return;
    const { id } = panel;
    const r1 = clampGrid(params.layer1.rows);
    let c1 = clampGrid(params.layer1.cols);
    if (gridLinkL1 === "square") c1 = r1;
    else if (gridLinkL1 === "aspect" && hasImage && imgW > 0 && imgH > 0) {
      c1 = clampGrid(Math.round((r1 * imgW) / imgH));
    }
    if (c1 !== params.layer1.cols) {
      DialStore.updateValue(id, "layer1.cols", c1);
    }
  }, [
    gridLinkL1,
    params.layer1.rows,
    params.layer1.cols,
    hasImage,
    imgW,
    imgH,
  ]);

  useEffect(() => {
    const panel = DialStore.getPanels().find((p) => p.name === "Tile Shifter");
    if (!panel) return;
    const { id } = panel;
    const r2 = clampGrid(params.layer2.rows);
    let c2 = clampGrid(params.layer2.cols);
    if (gridLinkL2 === "square") c2 = r2;
    else if (gridLinkL2 === "aspect" && hasImage && imgW > 0 && imgH > 0) {
      c2 = clampGrid(Math.round((r2 * imgW) / imgH));
    }
    if (c2 !== params.layer2.cols) {
      DialStore.updateValue(id, "layer2.cols", c2);
    }
  }, [
    gridLinkL2,
    params.layer2.rows,
    params.layer2.cols,
    hasImage,
    imgW,
    imgH,
  ]);

  useEffect(() => {
    const host = sketchHostRef.current;
    const dropZone = dropZoneRef.current;
    const imageInput = imageInputRef.current;
    const uploadZone = uploadZoneRef.current;
    const uploadZoneEmpty = uploadZoneEmptyRef.current;
    const uploadZoneLoaded = uploadZoneLoadedRef.current;
    const uploadZoneThumb = uploadZoneThumbRef.current;
    const uploadZoneDimsImage = uploadZoneDimsImageRef.current;
    const uploadZoneDimsTile = uploadZoneDimsTileRef.current;
    const previewEmpty = previewEmptyRef.current;
    if (
      !host ||
      !dropZone ||
      !imageInput ||
      !uploadZone ||
      !uploadZoneEmpty ||
      !uploadZoneLoaded ||
      !uploadZoneThumb ||
      !uploadZoneDimsImage ||
      !uploadZoneDimsTile ||
      !previewEmpty
    ) {
      return undefined;
    }

    const api = createTileShifter({
      getControls: () => {
        const c = controlsRef.current;
        if (!c) {
          return {
            gridLinkL1: "free",
            gridLinkL2: "free",
            layer1: {
              rows: 8,
              cols: 8,
              seed: 1,
              shuffleAmount: 100,
              enabled: true,
            },
            layer2: {
              rows: 12,
              cols: 12,
              seed: 2,
              shuffleAmount: 100,
              enabled: false,
            },
          };
        }
        return c;
      },
      onImageMetaChange: (meta) => {
        if (meta) {
          setHasImage(true);
          setImgW(meta.width);
          setImgH(meta.height);
        } else {
          setHasImage(false);
          setImgW(0);
          setImgH(0);
        }
      },
    });

    api.mount({
      host,
      dropZone,
      imageInput,
      uploadZone,
      uploadZoneEmpty,
      uploadZoneLoaded,
      uploadZoneThumb,
      uploadZoneDimsImage,
      uploadZoneDimsTile,
      previewEmpty,
    });
    sketchApiRef.current = api;
    return () => {
      api.unmount();
      sketchApiRef.current = null;
    };
  }, []);

  useEffect(() => {
    sketchApiRef.current?.render();
  }, [
    params.layer1.rows,
    params.layer1.cols,
    params.layer1.seed,
    params.layer1.shuffleAmount,
    params.layer2.enabled,
    params.layer2.rows,
    params.layer2.cols,
    params.layer2.seed,
    params.layer2.shuffleAmount,
    gridLinkL1,
    gridLinkL2,
  ]);

  const linkOptsL1 = hasImage ? LINK_OPTIONS_WITH_ASPECT : LINK_OPTIONS_NO_ASPECT;
  const linkOptsL2 = hasImage ? LINK_OPTIONS_WITH_ASPECT : LINK_OPTIONS_NO_ASPECT;

  return (
    <>
      <div
        className="paste-bridge"
        contentEditable
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="app">
        <aside className="panel">
          <header className="panel__header">
            <div className="panel__brand">
              <span className="panel__badge">Editor</span>
              <h1>Tile Shifter</h1>
            </div>
            <p className="panel__lede">
              Slice a grid, shuffle with a seed, export PNG — same flow as a
              lightweight canvas tool.
            </p>
          </header>

          <section className="control-section">
            <h2 className="control-section__title">Source</h2>
            <label className="upload-zone" ref={uploadZoneRef} htmlFor="image-input">
              <input
                ref={imageInputRef}
                id="image-input"
                type="file"
                accept="image/*"
                className="upload-zone__input"
              />
              <span className="upload-zone__empty" ref={uploadZoneEmptyRef}>
                <span className="upload-zone__label">Add image</span>
                <span className="upload-zone__hint">
                  Browse, drop on the canvas, or paste
                </span>
              </span>
              <span className="upload-zone__loaded" ref={uploadZoneLoadedRef} hidden>
                <span className="upload-zone__thumb-shell" aria-hidden="true">
                  <img
                    ref={uploadZoneThumbRef}
                    className="upload-zone__thumb"
                    alt=""
                    width={48}
                    height={48}
                  />
                </span>
                <span className="upload-zone__text">
                  <span className="upload-zone__label">Replace image</span>
                  <span
                    className="upload-zone__dims"
                    ref={uploadZoneDimsImageRef}
                  />
                  <span
                    className="upload-zone__dims"
                    ref={uploadZoneDimsTileRef}
                  />
                </span>
              </span>
            </label>
          </section>

          <section className="control-section dialkit-sidebar-section">
            <h2 className="control-section__title">Layer 1 — Grid link</h2>
            <p className="dialkit-sidebar-hint hint">
              Independent, square (cols = rows), or match image aspect (needs
              source image).
            </p>
            <SegmentedControl
              options={linkOptsL1}
              value={gridLinkL1}
              onChange={(v) => setGridLinkL1(v)}
            />
          </section>

          <section className="control-section dialkit-sidebar-section">
            <h2 className="control-section__title">Layer 2 — Grid link</h2>
            <SegmentedControl
              options={linkOptsL2}
              value={gridLinkL2}
              onChange={(v) => setGridLinkL2(v)}
            />
          </section>

          <p className="dialkit-sidebar-hint hint dialkit-sidebar-hint--footer">
            Sliders, seeds, shuffle mix, layer 2, and export live in the DialKit
            panel (top-right). Use Random seed actions there for quick variation.
          </p>
        </aside>

        <main className="preview" ref={dropZoneRef} id="preview-drop-zone">
          <div className="preview__frame">
            <div ref={sketchHostRef} id="sketch-host" className="preview__sketch">
              <div ref={previewEmptyRef} id="preview-empty" className="preview-empty">
                <span className="preview-empty__title">No image yet</span>
                <span className="preview-empty__hint">
                  Drop a file here or use Source → Add image
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>

      <DialRoot position="top-right" />
    </>
  );
}
