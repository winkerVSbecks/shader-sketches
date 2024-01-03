const {
  trilerp,
  converter,
  formatCss,
  easingSmoothstep,
} = require('culori/bundled/culori.cjs');
const { generateColorRamp } = require('rampensau/dist/index.cjs');

const newOptions = () => ({
  total: 6,
  hStart: Math.random() * 360,
  hCycles: Math.random() < 0.5 ? -1.25 + Math.random() : 1.25 + Math.random(),
  sRange:
    Math.random() < 0.7
      ? [0.2 + Math.random() * 0.2, 0.25 + Math.random() * 0.3]
      : [1, Math.random()],
  sEasing: (x) => Math.pow(x, 2),
  lRange: [
    Math.random() < 0.5 // half of the palettes will become pretty bright
      ? 0.55 + Math.random() * 0.3
      : 0.88 + Math.random() * 0.12,
    Math.random() * 0.4,
  ],
  lEasing: (x) => Math.pow(x, 1.1), // x => -(Math.cos(Math.PI * x)),
});

const rgb = converter('rgb');

const RYB_CUBE = [
  { mode: 'rgb', r: 248 / 255, g: 237 / 255, b: 220 / 255 }, // white
  {
    mode: 'rgb',
    r: 0.8901960784313725,
    g: 0.1411764705882353,
    b: 0.12941176470588237,
  }, // red
  {
    mode: 'rgb',
    r: 0.9529411764705882,
    g: 0.9019607843137255,
    b: 0,
  }, // yellow
  {
    mode: 'rgb',
    r: 0.9411764705882353,
    g: 0.5568627450980392,
    b: 0.10980392156862745,
  }, // orange
  {
    mode: 'rgb',
    r: 0.08627450980392157,
    g: 0.6,
    b: 0.8549019607843137,
  }, // blue
  {
    mode: 'rgb',
    r: 0.47058823529411764,
    g: 0.13333333333333333,
    b: 0.6666666666666666,
  }, // violet
  {
    mode: 'rgb',
    r: 0,
    g: 0.5568627450980392,
    b: 0.3568627450980392,
  }, // green
  { mode: 'rgb', r: 29 / 255, g: 28 / 255, b: 28 / 255 }, // black
];

function ryb2rgb(coords) {
  const r = easingSmoothstep(coords[0]);
  const y = easingSmoothstep(coords[1]);
  const b = easingSmoothstep(coords[2]);
  return {
    mode: 'rgb',
    r: trilerp(...RYB_CUBE.map((it) => it.r), r, y, b),
    g: trilerp(...RYB_CUBE.map((it) => it.g), r, y, b),
    b: trilerp(...RYB_CUBE.map((it) => it.b), r, y, b),
  };
}

function hsl2farbrad(h, s, l) {
  const rgbColor = rgb({
    mode: 'hsl',
    h: (h + 360) % 360,
    s,
    l: 1 - l,
  });
  return ryb2rgb([rgbColor.r, rgbColor.g, rgbColor.b]);
}

export function generateSubtractiveColors() {
  const options = newOptions();
  const colorHSL = generateColorRamp(options);
  const colors = colorHSL
    .map((hsl) => hsl2farbrad(...hsl))
    .map((c) => [c.r, c.g, c.b]);

  return colors;
}

module.exports = generateSubtractiveColors;
