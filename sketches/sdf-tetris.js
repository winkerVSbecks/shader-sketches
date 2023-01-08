const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const Color = require('canvas-sketch-util/color');
const glsl = require('glslify');
const tome = require('chromotome');
const THREE = require('three');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 8,
};

const palettes = [
  'spatial02',
  'spatial03i',
  'ducci_f',
  'rohlfs_2',
  'ducci_d',
  'revolucion',
  'butterfly',
  'floratopia',
  'ducci_i',
  'spatial02i',
];

function colors(minContrast = 3) {
  let palette = tome.get(Random.pick(palettes));
  if (!palette.background) palette = tome.get();

  const background = palette.background;

  const colors = palette.colors.filter(
    (color) => Color.contrastRatio(background, color) >= minContrast
  );

  const stroke = palette.stroke === background ? null : palette.stroke;

  const foreground = stroke || Random.pick(colors);

  return {
    name: palette.name,
    background,
    foreground,
  };
}

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float time;
  uniform float duration;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec3 rotationAxis;
  uniform float offsetX;
  uniform float offsetY;
  uniform vec3 boxSize;
  varying vec2 vUv;

  float cycle = duration / 5.;

  struct Block {
    vec3 p1;
    vec3 p2;
    vec3 p3;
    vec3 p4;
  };

  Block oBlock = Block(
    vec3(0.25, 0.25, 0.),
    vec3(-0.25, 0.25, 0.),
    vec3(0.25, -0.25, 0.),
    vec3(-0.25, -0.25, 0.)
  );

  Block zBlock = Block(
    vec3(0., 0.25, 0.),
    vec3(-0.5, 0.25, 0.),
    vec3(0.5, -0.25, 0.),
    vec3(0., -0.25, 0.)
  );

  Block tBlock = Block(
    vec3(0., 0.25, 0.),
    vec3(-0.5, 0.25, 0.),
    vec3(0.5, 0.25, 0.),
    vec3(0., -0.25, 0.)
  );

  Block lBlock = Block(
    vec3(0., 0.25, 0.),
    vec3(-0.5, 0.25, 0.),
    vec3(0.5, 0.25, 0.),
    vec3(-0.5, -0.25, 0.)
  );

  Block iBlock = Block(
    vec3(0.25, 0., 0.),
    vec3(-0.25, 0., 0.),
    vec3(0.5, 0., 0.),
    vec3(-0.5, 0., 0.)
  );

  vec3 p1 = iBlock.p1;
  vec3 p2 = iBlock.p2;
  vec3 p3 = iBlock.p3;
  vec3 p4 = iBlock.p4;

  #define PI 3.14159265359

  float mapRange(float value, float min1, float max1, float min2, float max2) {
    return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  }

  float sdRoundBox( vec3 p, vec3 b, float r ) {
    vec3 q = abs(p) - b;
    return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0) - r;
  }

  mat4 rotation3d(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;

    return mat4(
      oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
      oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
      oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
      0.0,                                0.0,                                0.0,                                1.0
    );
  }

  float opUnion( float d1, float d2 ) { return min(d1, d2); }

  float block(in vec3 pos, in float r) {
    float d1 = sdRoundBox(pos + p1, boxSize, r);
    float d2 = sdRoundBox(pos + p2, boxSize, r);
    float d3 = sdRoundBox(pos + p3, boxSize, r);
    float d4 = sdRoundBox(pos + p4, boxSize, r);

    return opUnion(opUnion(d1, d2), opUnion(d3, d4));
  }

  float map(in vec3 pos) {
    float d = 1e10;
    float r = 0.0125;

    // float angle = (time / (cycle * 2.)) * PI;
    // pos.xyz = (rotation3d(vec3(0., 1., 0.), angle) * vec4(pos, 1.0)).xyz;
    d = block(pos, r);

    return d;
  }

  // https://iquilezles.org/articles/rmshadows
  float calcSoftshadow(in vec3 ro, in vec3 rd, float tmin, float tmax, const float k) {
    float res = 1.0;
    float t = tmin;
    for (int i = 0; i < 64; i++) {
      float h = map(ro + rd * t);
      res = min(res, k * h / t);
      t += clamp(h, 0.01, 0.10);
      if (res < 0.002 || t > tmax)
        break;
    }
    return clamp(res, 0.0, 1.0);
  }

  // https://iquilezles.org/articles/normalsSDF
  vec3 calcNormal(in vec3 pos) {
    vec2 e = vec2(1.0, -1.0) * 0.5773;
    const float eps = 0.0005;
    return normalize(
        e.xyy * map(pos + e.xyy * eps) + e.yyx * map(pos + e.yyx * eps) +
        e.yxy * map(pos + e.yxy * eps) + e.xxx * map(pos + e.xxx * eps));
  }

  float EaseOutQuad(float x) {
    return 1.0 - (1.0-x) * (1.0 -x );
  }

  float EaseOutQuart(float x) { return 1.0 - pow(1.0 -x, 4.0); }

  void main() {
    vec3 ro = vec3(1.5, 1.5, 1.5);
    vec3 ta = vec3(0.0, 0.0, 0.0);
    // camera matrix
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = normalize(cross(uu, ww));


    vec2 p = (-1.0 + 2.0 * vUv);

    // create view ray
    vec3 rd = normalize(p.x * uu + p.y * vv + 1.5 * ww);

    // float at = min(1., mapRange(fract(time / 2.), 0., 0.5, 0., 1.));
    float cycleTime = fract(time / cycle);
    float at = EaseOutQuart(min(1., mapRange(cycleTime, 0., 0.5, 0., 1.)));

    if (time < duration * 0.2) {
      p1 = mix(iBlock.p1, oBlock.p1, at);
      p2 = mix(iBlock.p2, oBlock.p2, at);
      p3 = mix(iBlock.p3, oBlock.p3, at);
      p4 = mix(iBlock.p4, oBlock.p4, at);
    } else if (time < duration * 0.4) {
      p1 = mix(oBlock.p1, zBlock.p1, at);
      p2 = mix(oBlock.p2, zBlock.p2, at);
      p3 = mix(oBlock.p3, zBlock.p3, at);
      p4 = mix(oBlock.p4, zBlock.p4, at);
    } else if (time < duration * 0.6) {
      p1 = mix(zBlock.p1, tBlock.p1, at);
      p2 = mix(zBlock.p2, tBlock.p2, at);
      p3 = mix(zBlock.p3, tBlock.p3, at);
      p4 = mix(zBlock.p4, tBlock.p4, at);
    } else if (time < duration * 0.8) {
      p1 = mix(tBlock.p1, lBlock.p1, at);
      p2 = mix(tBlock.p2, lBlock.p2, at);
      p3 = mix(tBlock.p3, lBlock.p3, at);
      p4 = mix(tBlock.p4, lBlock.p4, at);
    } else if (time < duration * 1.0) {
      p1 = mix(lBlock.p1, iBlock.p1, at);
      p2 = mix(lBlock.p2, iBlock.p2, at);
      p3 = mix(lBlock.p3, iBlock.p3, at);
      p4 = mix(lBlock.p4, iBlock.p4, at);
    }

    // raymarch
    const float tmax = 5.0;
    float t = 0.0;
    for (int i = 0; i < 256; i++) {
      vec3 pos = ro + t * rd;
      float h = map(pos);
      if (h < 0.0001 || t > tmax)
        break;
      t += h;
    }

    // shading/lighting
    vec3 col = vec3(0.0);
    if (t < tmax) {
      vec3 pos = ro + t * rd;
      vec3 nor = calcNormal(pos);
      vec3 light = vec3(.57703);
      float dif = clamp(dot(nor, light), 0.0, 1.0);

      if (dif > 0.001)
        dif *= calcSoftshadow(pos + nor * 0.001, light, 0.001, 1.0, 32.0);

      float amb = 0.5 + 0.5 * dot(nor, vec3(0.0, 1.0, 0.0));
      col = vec3(0.2, 0.3, 0.4) * amb + vec3(0.8, 0.7, 0.5) * dif;
    }

    // gamma
    col = sqrt(col);
    vec3 tot = mix(background, foreground, col);

    gl_FragColor = vec4(tot, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { name, background, foreground } = colors();
  console.log({ name, background, foreground });
  const rotationAxis = Random.quaternion();
  rotationAxis.pop();
  const offset = Random.range(-0.125, 0.125);

  return createShader({
    gl,
    frag,
    uniforms: {
      background: new THREE.Color(background).toArray(),
      foreground: new THREE.Color(foreground).toArray(),
      rotationAxis,
      time: ({ time }) => time,
      duration: ({ duration }) => duration,
      offsetX: offset,
      offsetY: offset,
      boxSize: [0.25, 0.25, 0.25],
    },
  });
};

canvasSketch(sketch, settings);
