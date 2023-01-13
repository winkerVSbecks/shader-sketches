const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const Random = require('canvas-sketch-util/random');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 4,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  uniform float time;
  varying vec2 vUv;
  uniform vec3 background;
  uniform vec3 foreground;

  #define PI 3.14159265358979323846

  vec2 rotate2D(vec2 _st, float _angle){
    _st -= 0.5;
    _st =  mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle)) * _st;
    _st += 0.5;
    return _st;
  }

  float random (vec2 st) {
    return fract(
      sin(
        dot(st.xy, vec2(12.989,78.233) * 1.0) // time
      ) * 43758.543
    );
  }

  float stripe(vec2 p, float tiling, float direction) {
    vec2 pos;
    // Blend the direction between x and y
	  pos.x = mix(p.x, p.y, direction);
	  pos.y = mix(p.y, 1.0 - p.x, direction);
	  pos.x *= tiling;

	  // return floor(fract(pos.x) + 0.5);
    float v = floor(fract(pos.x) + 0.5);
	  return pos.x < tiling * 0.5 ?
        pos.x < tiling * 0.25 ?
          floor(fract(pos.x) + 0.5)
          : floor(fract(pos.x) + 0.5) - 0.2
        : pos.x < tiling * 0.75 ?
            1.2 - v
            : 1. - v;
  }

  float aastep(float threshold, float value) {
    #ifdef GL_OES_standard_derivatives
      float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
      return smoothstep(threshold-afwidth, threshold+afwidth, value);
    #else
      return step(threshold, value);
    #endif
  }

  vec4 sdTriangle(vec2 p, vec2 p0, vec2 p1, vec2 p2, vec3 color) {
    vec2 e0 = p1-p0, e1 = p2-p1, e2 = p0-p2;
    vec2 v0 = p -p0, v1 = p -p1, v2 = p -p2;
    vec2 pq0 = v0 - e0*clamp( dot(v0,e0)/dot(e0,e0), 0.0, 1.0 );
    vec2 pq1 = v1 - e1*clamp( dot(v1,e1)/dot(e1,e1), 0.0, 1.0 );
    vec2 pq2 = v2 - e2*clamp( dot(v2,e2)/dot(e2,e2), 0.0, 1.0 );
    float s = sign( e0.x*e2.y - e0.y*e2.x );
    vec2 d = min(min(vec2(dot(pq0,pq0), s*(v0.x*e0.y-v0.y*e0.x)),
                      vec2(dot(pq1,pq1), s*(v1.x*e1.y-v1.y*e1.x))),
                      vec2(dot(pq2,pq2), s*(v2.x*e2.y-v2.y*e2.x)));
    float dist = -sqrt(d.x)*sign(d.y);
    // dist = sign(dist) * aastep(0.00001, abs(dist));
    dist = sign(dist) * aastep(0.01, abs(dist));

    return vec4(dist < 0.0 ? color : background, dist);
  }

  vec4 sqQuad(vec2 p, vec2 p0, vec2 p1, vec2 p2, vec2 p3, vec3 color) {
    vec4 d = sdTriangle(p, p0, p1, p2, color);
    d = min(d, sdTriangle(p, p3, p1, p2, color));
    return d;
  }

  vec4 opUnion(vec4 s1, vec4 s2) {
    return s1.w < s2.w ? s1 : s2;
  }

  vec3 pattern1(vec2 p, float index) {
    // top right to bottom left
    vec4 d = sdTriangle(p, vec2(1., 1.), vec2(1., 2./3.), vec2(2./3., 1.), foreground);
    d = min(d, sqQuad(p, vec2(0., 1.), vec2(1./3., 1.), vec2(1., 0.), vec2(1., 1./3.), foreground));
    d = min(d, sqQuad(p, vec2(0., 2./3.), vec2(0., 1.), vec2(2./3., 0.), vec2(1., 0.), foreground));
    d = min(d, sdTriangle(p, vec2(0., 0.), vec2(0., 1./3.), vec2(1./3., 0.), foreground));
    return d.xyz;
  }

  vec3 pattern2(vec2 p, float index) {
    // top left to bottom right
    vec4 d = sdTriangle(p, vec2(0., 1.), vec2(1./3., 1.), vec2(0., 2./3.), foreground);
    d = min(d, sqQuad(p, vec2(2./3., 1.), vec2(1., 1.), vec2(0., 1./3.), vec2(0., 0.), foreground * .8));
    d = min(d, sqQuad(p, vec2(0., 0.), vec2(1., 1.), vec2(1./3., 0.), vec2(1., 2./3.), foreground));
    d = min(d, sdTriangle(p, vec2(2./3., 0.), vec2(1., 1./3.), vec2(1., 0.), foreground * .8));
    return d.xyz;
  }

  vec3 tilePattern(vec2 p, float index) {
    return index <= 0.5 ? pattern1(p, index) : pattern2(p, index);
  }

  void main() {
    vec2 p = (-1.0 + 2.0 * vUv);
    vec3 color = vec3(0.0);

    float resolution = 4.;
    p *= resolution;
    p.x = p.x + time;

    vec2 iPos = floor(p);  // integer
    vec2 fPos = fract(p);  // fraction

    color = tilePattern(fPos, random(iPos));

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl }) => {
  const { background, foreground } = colors();

  return createShader({
    gl,
    frag,
    uniforms: {
      time: ({ time }) => time, // Math.floor(time * 6) / 6,
      background,
      foreground,
    },
  });
};

function colors(minContrast = 1) {
  let palette = tome.get('hilda01'); // spatial03
  if (!palette.background) palette = tome.get();
  console.log(palette.name);

  const background = palette.background;

  const colors = palette.colors.filter(
    (color) =>
      Color.contrastRatio(background, color) >= minContrast &&
      color !== background
  );

  const foreground = Random.pick(colors);

  console.log({ background, foreground });

  return {
    background: new THREE.Color(background).toArray(),
    foreground: new THREE.Color(foreground).toArray(),
  };
}

canvasSketch(sketch, settings);
