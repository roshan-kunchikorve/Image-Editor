/* ===== 1. Config ===== */
const $ = (id) => document.getElementById(id);
const canvas = $("canvas"),
  ctx = canvas.getContext("2d");

// [key, label, min, max, unit]
const SLIDERS = [
  ["brightness", "Brightness", 0, 200, "%"],
  ["contrast", "Contrast", 0, 200, "%"],
  ["saturate", "Saturation", 0, 200, "%"],
  ["hue", "Hue", 0, 360, "°"],
  ["blur", "Blur", 0, 20, "px"],
  ["grayscale", "Grayscale", 0, 100, "%"],
  ["sepia", "Sepia", 0, 100, "%"],
  ["invert", "Invert", 0, 100, "%"],
];
const PRESETS = {
  Original: {},
  "B&W": { grayscale: 100, contrast: 110 },
  Vintage: { sepia: 60, contrast: 90, brightness: 110, saturate: 80 },
  Warm: { sepia: 30, saturate: 130 },
  Vivid: { saturate: 160, contrast: 115 },
  Fade: { contrast: 85, brightness: 115, saturate: 80 },
  Dramatic: { contrast: 140, brightness: 90 },
};
const RATIOS = {
  Free: 0,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "3:4": 3 / 4,
  "9:16": 9 / 16,
};
const DEFAULTS = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hue: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  rotate: 0,
  flipH: false,
  flipV: false,
  ratio: 0,
};
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/* ===== 2. State: every edit lives in one object ===== */
let img = null,
  name = "image",
  state = { ...DEFAULTS };
let undoStack = [],
  last = JSON.stringify(state),
  comparing = false,
  queued = false;

/* ===== 3. Build the controls ===== */
$("sliders").innerHTML = SLIDERS.map(
  ([k, label, min, max]) =>
    `<div class="slider"><label for="s-${k}">${label}<output id="o-${k}"></output></label>
   <input type="range" id="s-${k}" data-k="${k}" min="${min}" max="${max}" value="${DEFAULTS[k]}"></div>`,
).join("");

const chip = (parent, text, fn) => {
  const b = document.createElement("button");
  b.className = "btn";
  b.textContent = text;
  b.onclick = fn;
  parent.append(b);
  return b;
};
Object.entries(PRESETS).forEach(([n, p]) =>
  chip($("presets"), n, () => {
    const { rotate, flipH, flipV, ratio } = state; // presets only touch filters
    Object.assign(state, DEFAULTS, { rotate, flipH, flipV, ratio }, p);
    update(true);
  }),
);
Object.entries(RATIOS).forEach(([n, r]) => {
  chip($("ratios"), n, () => {
    state.ratio = r;
    update(true);
  }).dataset.r = r;
});
document.querySelectorAll("[data-act]").forEach(
  (b) =>
    (b.onclick = () => {
      const a = b.dataset.act;
      if (a === "rotL") state.rotate = (state.rotate + 270) % 360;
      if (a === "rotR") state.rotate = (state.rotate + 90) % 360;
      if (a === "flipH") state.flipH = !state.flipH;
      if (a === "flipV") state.flipV = !state.flipV;
      update(true);
    }),
);

/* ===== 4. Rendering ===== */
const filterCSS = () =>
  `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturate}%) hue-rotate(${state.hue}deg) blur(${state.blur}px) grayscale(${state.grayscale}%) sepia(${state.sepia}%) invert(${state.invert}%)`;

function outSize() {
  // output size after rotation, then centered crop
  const turned = state.rotate % 180,
    r = state.ratio;
  const W = turned ? img.naturalHeight : img.naturalWidth,
    H = turned ? img.naturalWidth : img.naturalHeight;
  if (!r) return [W, H];
  return W / H > r ? [Math.round(H * r), H] : [W, Math.round(W / r)];
}

function render() {
  if (!img) return;
  const [w, h] = outSize();
  canvas.width = w;
  canvas.height = h; // resizing also resets the context
  ctx.filter = comparing ? "none" : filterCSS();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((state.rotate * Math.PI) / 180);
  ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
}
const schedule = () => {
  // at most one render per animation frame
  if (!queued) {
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      render();
    });
  }
};

/* ===== 5. Updating state + undo ===== */
function commit() {
  // save the previous state as an undo step
  const now = JSON.stringify(state);
  if (now !== last) {
    undoStack.push(last);
    last = now;
  }
  $("undo").disabled = !img || !undoStack.length;
}
function update(commitNow) {
  SLIDERS.forEach(([k, , , , u]) => {
    $("s-" + k).value = state[k];
    $("o-" + k).textContent = state[k] + u;
  });
  document
    .querySelectorAll("#ratios .btn")
    .forEach((b) => b.classList.toggle("on", +b.dataset.r === state.ratio));
  if (commitNow) commit();
  schedule();
}
function undo() {
  if (!undoStack.length) return;
  last = undoStack.pop();
  state = JSON.parse(last);
  update(false);
  $("undo").disabled = !undoStack.length;
}
$("sliders").addEventListener("input", (e) => {
  state[e.target.dataset.k] = +e.target.value;
  update(false);
});
$("sliders").addEventListener("change", commit); // fires on release: one undo step per drag
$("undo").onclick = undo;
$("reset").onclick = () => {
  state = { ...DEFAULTS };
  update(true);
};
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    undo();
  }
});

const cmp = $("compare"); // hold to see the unfiltered image
cmp.onpointerdown = () => {
  comparing = true;
  render();
};
["pointerup", "pointerleave", "pointercancel"].forEach((t) =>
  cmp.addEventListener(t, () => {
    if (comparing) {
      comparing = false;
      render();
    }
  }),
);

/* ===== 6. Loading images: picker, drag and drop, paste ===== */
function load(file) {
  if (!file || !file.type.startsWith("image/"))
    return alert("Please choose an image file (JPG, PNG, WEBP, GIF).");
  const url = URL.createObjectURL(file),
    im = new Image();
  im.onload = () => {
    img = im;
    name = file.name.replace(/\.[^.]+$/, "") || "image";
    state = { ...DEFAULTS };
    undoStack = [];
    last = JSON.stringify(state);
    document.body.classList.add("loaded");
    $("drop").hidden = true;
    canvas.hidden = false;
    ["reset", "compare", "download"].forEach((id) => ($(id).disabled = false));
    $("undo").disabled = true;
    update(false);
    URL.revokeObjectURL(url);
  };
  im.onerror = () => alert("That file could not be read as an image.");
  im.src = url;
}
$("upload").onclick = () => $("file").click();
$("file").onchange = (e) => {
  load(e.target.files[0]);
  e.target.value = "";
};
const stage = $("stage");
["dragenter", "dragover"].forEach((t) =>
  stage.addEventListener(t, (e) => {
    e.preventDefault();
    $("drop").classList.add("over");
  }),
);
["dragleave", "drop"].forEach((t) =>
  stage.addEventListener(t, (e) => {
    e.preventDefault();
    $("drop").classList.remove("over");
  }),
);
stage.addEventListener("drop", (e) => load(e.dataTransfer.files[0]));
document.addEventListener("paste", (e) => {
  const f = e.clipboardData.files[0];
  if (f) load(f);
});

/* ===== 7. Download at full resolution ===== */
$("download").onclick = () => {
  const fmt = $("fmt").value,
    quality = $("q").value / 100;
  let out = canvas;
  if (fmt === "image/jpeg") {
    // JPEG has no transparency: paint white behind
    out = document.createElement("canvas");
    out.width = canvas.width;
    out.height = canvas.height;
    const c = out.getContext("2d");
    c.fillStyle = "#fff";
    c.fillRect(0, 0, out.width, out.height);
    c.drawImage(canvas, 0, 0);
  }
  out.toBlob(
    (blob) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}-edited.${EXT[blob.type] || "png"}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    fmt,
    quality,
  );
};

update(false); // show initial slider values
