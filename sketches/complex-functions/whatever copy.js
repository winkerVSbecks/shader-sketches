const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const glsl = require('glslify');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform float playhead;
  uniform float loopTime;
  varying vec2 vUv;

  // Define the corner and center colors of the gradient mesh
  const vec4 bottomLeftColor = vec4(1.0, 0.0, 0.0, 1.0); // Red
  const vec4 bottomRightColor = vec4(0.0, 1.0, 0.0, 1.0); // Green
  const vec4 topLeftColor = vec4(0.0, 0.0, 1.0, 1.0); // Blue
  const vec4 topRightColor = vec4(1.0, 1.0, 0.0, 1.0); // Yellow
  const vec4 centerLeftColor = vec4(1.0, 0.5, 0.0, 1.0); // Orange
  const vec4 centerRightColor = vec4(0.0, 1.0, 1.0, 1.0); // Cyan
  const vec4 centerTopColor = vec4(0.5, 0.0, 1.0, 1.0); // Purple

  // Barycentric interpolation
  vec4 barycentricInterpolation(vec2 p, vec2 a, vec2 b, vec2 c, vec4 colorA, vec4 colorB, vec4 colorC) {
    vec3 weights = vec3(
        length(cross(vec3(b - a, 0.0), vec3(p - a, 0.0))),
        length(cross(vec3(c - b, 0.0), vec3(p - b, 0.0))),
        length(cross(vec3(a - c, 0.0), vec3(p - c, 0.0)))
    );
    float totalArea = weights.x + weights.y + weights.z;
    vec3 barycentricCoords = weights / totalArea;

    if (barycentricCoords.x < 0.0 || barycentricCoords.y < 0.0 || barycentricCoords.z < 0.0) return vec4(-1.0);
    return colorA * barycentricCoords.x + colorB * barycentricCoords.y + colorC * barycentricCoords.z;
  }

  vec3 cartesian_to_barycentric (vec2 p, vec2 a, vec2 b, vec2 c) {
    float l0 = ((b.y-c.y)*(p.x-c.x) + (c.x-b.x)*(p.y-c.y))
      / ((b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y));
    float l1 = ((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))
      / ((b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y));
    return vec3(l0, l1, 1.0 - l0 - l1);
  }


  void main() {
     // Triangles formed by the corner and center points
    vec4 colorA = barycentricInterpolation(vUv, vec2(0.0, 0.0), vec2(0.5, 0.0), vec2(0.5, 0.5), bottomLeftColor, centerLeftColor, centerRightColor);
    vec4 colorB = barycentricInterpolation(vUv, vec2(1.0, 0.0), vec2(0.5, 0.0), vec2(0.5, 0.5), bottomRightColor, centerLeftColor, centerRightColor);
    vec4 colorC = barycentricInterpolation(vUv, vec2(0.0, 1.0), vec2(0.5, 1.0), vec2(0.5, 0.5), topLeftColor, centerTopColor, centerRightColor);
    vec4 colorD = barycentricInterpolation(vUv, vec2(1.0, 1.0), vec2(0.5, 1.0), vec2(0.5, 0.5), topRightColor, centerTopColor, centerRightColor);

    vec4 finalColor = colorA;
    if (finalColor.a == -1.0) finalColor = colorB;
    if (finalColor.a == -1.0) finalColor = colorC;
    if (finalColor.a == -1.0) finalColor = colorD;

    gl_FragColor = finalColor;
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      loopTime: ({ time }) => time % 1,
    },
  });
};

canvasSketch(sketch, settings);
