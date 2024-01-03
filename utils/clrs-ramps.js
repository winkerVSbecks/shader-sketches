const Random = require('canvas-sketch-util/random');
const Color = require('canvas-sketch-util/color');
const { generateColorRamp } = require('rampensau/dist/index.cjs');

export function lowContrast() {
  const hStart = Random.rangeFloor(0, 360);
  const s = 0.6; // 0.2, 0.4, 0.6, 0.8
  const l = 0.6; // 0.2, 0.4, 0.6, 0.8

  const colors = generateColorRamp({
    total: 5,
    hStart,
    hEasing: (x) => x,
    hCycles: 1 / 3,
    sRange: [s, s],
    lRange: [l, l], // [0.2, 0.6],
  })
    .reverse()
    .map((c) =>
      Color.parse({
        hsl: [c[0], c[1] * 100, c[2] * 100],
      }).rgb.map((v) => v / 255)
    );

  return colors;
}

module.exports = { lowContrast };
