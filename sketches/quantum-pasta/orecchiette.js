const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
const createMouse = require('../../utils/mouse');

const MODE = process.env.MODE || 'PRINT'; // 'VIDEO'

// Setup our sketch
const settings = {
  context: 'webgl',
  animate: true,
  duration: 6,
  fps: 60,
  playbackRate: 60,
  scaleToView: true,
  ...(MODE === 'PRINT'
    ? {
        dimensions: [12, 12],
        pixelsPerInch: 300,
        units: 'in',
      }
    : { dimensions: [1080, 1080] }),
  suffix: MODE === 'PRINT' ? '12.5x12.5' : '',
};

// Based on https://www.shadertoy.com/view/WdB3Dw
const frag = glsl(/* glsl */ `
  precision highp float;

  #pragma glslify: rotate = require('glsl-rotate/rotate')

  uniform float playhead;
  uniform vec2 mouse;
  varying vec2 vUv;

  #define PI 3.141592
  #define TAU 6.283185

  // Keep iteration count too low to pass through entire model,
  // giving the effect of fogged glass
  const float MAX_STEPS = 82.;
  const float FUDGE_FACTORR = .4; //.8;
  const float INTERSECTION_PRECISION = .001;
  const float MAX_DIST = 20.;

  // --------------------------------------------------------
  // Spectrum colour palette
  // IQ https://www.shadertoy.com/view/ll2GD3
  // --------------------------------------------------------

  vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
  }

  vec3 spectrum(float n) {
    return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
    // return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.10,0.20) );
    // return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.3,0.20,0.20) );
    // return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,0.5),vec3(0.8,0.90,0.30) );
    // return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,0.7,0.4),vec3(0.0,0.15,0.20) );
    // return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(2.0,1.0,0.0),vec3(0.5,0.20,0.25) );
    // return pal( n, vec3(0.8,0.5,0.4),vec3(0.2,0.4,0.2),vec3(2.0,1.0,1.0),vec3(0.0,0.25,0.25) );
  }

  // --------------------------------------------------------
  // Geometry
  // --------------------------------------------------------

  // ------------------------------------------
  // Clifford Torus Rotation SDF
  // https://www.shadertoy.com/view/wsfGDS
  // ------------------------------------------
  vec2 pMod2(inout vec2 p, vec2 size) {
    vec2 c = floor((p + size*0.5)/size);
    p = mod(p + size*0.5,size) - size*0.5;
    return c;
  }

  float smax(float a, float b, float r) {
    vec2 u = max(vec2(r + a,r + b), vec2(0));
    return min(-r, max (a, b)) + length(u);
  }

  // Inverse stereographic projection of p,
  // p4 lies onto the unit 3-sphere centered at 0.
  // - mla https://www.shadertoy.com/view/lsGyzm
  vec4 inverseStereographic(vec3 p, out float k) {
    k = 2.0/(1.0+dot(p,p));
    return vec4(k*p,k-1.0);
  }

  float fTorus(vec4 p4, out vec2 uv) {
    // Torus distance
    // We want the inside and outside to look the same, so use the
    // inverted outside for the inside.
    float d1 = length(p4.xy) / length(p4.zw) - 1.;
    float d2 = length(p4.zw) / length(p4.xy) - 1.;
    float d = d1 < 0. ? -d1 : d2;

    // Because of the projection, distances aren't lipschitz continuous,
    // so scale down the distance at the most warped point - the inside
    // edge of the torus such that it is 1:1 with the domain.
    d /= PI;

    // UV coordinates over the surface, from 0 - 1
    uv = (vec2(
        atan(p4.y, p4.x),
        atan(p4.z, p4.w)
    ) / PI) * .5 + .5;

    return d;
  }

  // Distances get warped by the stereographic projection, this applies
  // some hacky adjustments which makes them lipschitz continuous.

  // The numbers have been hand picked by comparing our 4D torus SDF to
  // a usual 3D torus of the same size, see DEBUG.

  // vec3 d
  //   SDF to fix, this should be applied after the last step of
  //   modelling on the torus.

  // vec3 k
  //   stereographic scale factor

  float fixDistance(float d, float k) {
    float sn = sign(d);
    d = abs(d);
    d = d / k * 1.82;
    d += 1.;
    d = pow(d, .5);
    d -= 1.;
    d *= 5./3.;
    d *= sn;
    return d; // * 4. for appear effect;
  }

  vec2 map(vec3 p) {

    p.xy = rotate(p.xy, -playhead * PI);
    p.yz = rotate(p.yz, playhead * PI);
    p.zx = rotate(p.zx, -playhead * PI);

    float k;
    vec4 p4 = inverseStereographic(p,k);

    // The inside-out rotation puts the torus at a different
    // orientation, so rotate to point it at back in the same
    // direction
    p4.zy = rotate(p4.zy, playhead * -PI);

    // Rotate in 4D, turning the torus inside-out
    p4.xw = rotate(p4.xw, playhead * -PI);

    vec2 uv;
    p4 *= 12.;
    float d = fTorus(p4, uv);

    // Recreate domain to be wrapped around the torus surface
    // xy = surface / face, z = depth / distance
    float uvScale = 2.25; // Magic number that makes xy distances the same scale as z distances
    p = vec3(uv * uvScale, d);

    float n = 10.;
    float repeat = uvScale / n;

    p.xy += repeat / 2.;
    pMod2(p.xy, vec2(repeat));

    p.xy = rotate(p.xy, -playhead * PI);
    p.yz = rotate(p.yz, playhead * PI);
    p.zx = rotate(p.zx, -playhead * PI);

    // distance
    float r = repeat * .4;
    d = length(p.xy) - r;
    d += sin(PI*2.*p.x)*sin(PI*2.*p.y)*sin(PI*2.*p.z);
    d = smax(d, abs(p.z) - .01, .01);

    d = fixDistance(d, k);

    return vec2(d, p.z);
  }

  vec3 GetRayDir(vec2 uv, vec3 p, vec3 l, float z) {
    vec3
        f = normalize(l-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f,r),
        c = f*z,
        i = c + uv.x*r + uv.y*u;
    return normalize(i);
  }

  void main () {
    vec2 p = (-1.0 + 2.0 * vUv);
    vec3 ro = vec3(2., 2., -2.);

    vec3 rd = GetRayDir(p, ro, vec3(0,0.,0), 1.);
    vec3 rayPosition = ro;

    float rayLength = 0.;
    float distance = 0.;
    vec3 c;
    vec3 color = vec3(0);

    for (float i = 0.; i < MAX_STEPS; i++) {
      // Step a little slower so we can accumilate glow
      rayLength += max(INTERSECTION_PRECISION, abs(distance) * FUDGE_FACTORR);
      rayPosition = ro + rd * rayLength;

      vec2 res = map(rayPosition);
      distance = res.x;

      // Add a lot of light when we're really close to the surface
      c = vec3(max(0., .01 - abs(distance)) * .5);
      c *= vec3(1.4,2.1,1.7); // blue green tint

      // Accumulate some purple glow for every step
      c += vec3(.6,.25,.7) * FUDGE_FACTORR / 160.;
      c *= smoothstep(20., 7., length(rayPosition));

      // Fade out further away from the camera
      float rl = smoothstep(MAX_DIST, .1, rayLength);
      c *= rl;

      // Vary colour as we move through space
      c *= spectrum(sin(playhead*PI) * (rl * 6. - .6));

      color += c;

      if (rayLength > MAX_DIST) {
        break;
      }
    }

    // color = pow(color, vec3(.4545));
    color = pow(color, vec3(1. / 1.8)) * 2.;
    color = pow(color, vec3(2.)) / 2.;
    color = pow(color, vec3(1. / 2.2));

    gl_FragColor = vec4(color, 1.0);
  }
`);

const sketch = ({ gl, canvas }) => {
  const mouse = createMouse(canvas);

  return createShader({
    gl,
    frag,
    uniforms: {
      playhead: ({ playhead }) => {
        if (MODE === 'PRINT') {
          console.log(mouse.position[0]);
          return mouse.position[0];
        }
        return playhead;
      },
      mouse: () => mouse.position,
    },
  });
};

canvasSketch(sketch, settings);
