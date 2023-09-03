const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const glsl = require('glslify');
const tome = require('chromotome');
const THREE = require('three');
const Color = require('canvas-sketch-util/color');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 2,
};

const frag = glsl(/* glsl */ `
  precision highp float;

  #define PI 3.14159265359

  uniform float playhead;
  uniform vec3 background;
  uniform vec3 foreground;
  uniform vec3 stitch;
  varying vec2 vUv;

  float grid(vec2 st, float res){
    return 1.-(step(res, st.x) * step(res, st.y));
  }

  float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
  }

  // from https://www.shadertoy.com/view/Ntyczt
  float udSegment(vec2 p, vec2 a, vec2 b, float filled, float gap, float offset) {
    vec2 ba = b-a;
    vec2 pa = p-a;
    float h =clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );

    // Here's where the magic happens
    h -= offset;
    float s = floor(h / (filled + gap)) * (filled + gap);
    h = s + clamp(h - s, gap * 0.5, gap * 0.5 + filled);
    h += offset;

    return length(pa-h*ba);
  }

  void main () {
    vec2 p = 2. * vUv -1.;
    vec2 uv = p;
    // repeat the pattern
    uv *= vec2(5.5, 5.5);
    uv += vec2(0.5/6., 0.5/6.);
    // mirror along the x & y axis
    uv = abs(uv);
    // integer part of the value (we'll use this to identify each cell)
    vec2 id = floor(uv);
    // fractional part of the value (0-1 within each cell)
    vec2 st = fract(uv);

    vec3 color = background;
    // triangles
    if (length(id) > 1. && mod(id.x, 2.) == 0. && mod(id.y, 2.) == 0.) {
      color = 1.-st.x < st.y ? foreground : background;
    }
    // circle
    if (length(uv) < 1.) {
      color = foreground;
    }

    // debug grid
    // color = mix(color, vec3(1.,0.5,1.), grid(st, 0.05));

    // quilting
    vec2 quv = fract(uv * vec2(2.));

    float f = 0.05;
    float g = 0.05;
    float o = 0.;
    float d = udSegment(quv, vec2(1., 0.), vec2(0., 1.), f, g, o);
    color = mix(color, stitch, 1.0-smoothstep(0.0,0.02, abs(d)));

    // binding seam
    float bd = udSegment(abs(p), vec2(0., .99), vec2(.99, .99), f*.1, g*.1, o);
    bd = min(bd, udSegment(abs(p), vec2(.99, 0.), vec2(.99, .99), f*.1, g*.1, o));
    color = mix(color, stitch, 1.0-smoothstep(0.0,0.002, abs(bd)));

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl, canvas, context }) => {
  const { background, foreground, stitch } = colors();

  const [svgFilter, feTurbulence, feDisplacementMap] = createSVGFilter();

  document.body.appendChild(svgFilter);
  canvas.style.filter = 'url(#hand-drawn)';

  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      playhead: ({ playhead }) => playhead,
      background,
      foreground,
      stitch,
    },
  });
};

function colors() {
  let palette = tome.get('cc234');

  return {
    background: new THREE.Color(palette.colors[0]).toArray(),
    foreground: new THREE.Color(palette.background).toArray(),
    stitch: new THREE.Color(palette.colors[1]).toArray(),
  };
}

canvasSketch(sketch, settings);

function createSVGFilter() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.zIndex = '-1';

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  svg.appendChild(defs);

  const filter = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'filter'
  );
  filter.setAttribute('id', 'hand-drawn');
  filter.setAttribute('x', '0');
  filter.setAttribute('y', '0');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');
  defs.appendChild(filter);

  const feTurbulence = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'feTurbulence'
  );
  feTurbulence.setAttribute('type', 'fractalNoise');
  feTurbulence.setAttribute('baseFrequency', 0.03);
  feTurbulence.setAttribute('numOctaves', 1);
  feTurbulence.setAttribute('result', 'noise');
  feTurbulence.setAttribute('seed', Random.value());
  filter.appendChild(feTurbulence);

  const feDisplacementMap = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'feDisplacementMap'
  );
  feDisplacementMap.setAttribute('in', 'SourceGraphic');
  feDisplacementMap.setAttribute('in2', 'noise');
  feDisplacementMap.setAttribute('scale', '5');
  feDisplacementMap.setAttribute('xChannelSelector', 'R');
  feDisplacementMap.setAttribute('yChannelSelector', 'G');
  filter.appendChild(feDisplacementMap);

  return [svg, feTurbulence, feDisplacementMap];
}
