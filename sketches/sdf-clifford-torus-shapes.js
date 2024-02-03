const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const glsl = require('glslify');
import { lerpFrames } from 'canvas-sketch-util/math';

// Setup our sketch
const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  duration: 5,
};

const frag = glsl(/*glsl*/ `
  precision highp float;

  uniform float playhead;
  uniform vec2 resolution;

  vec2 doModel(vec3 p);

  #define PI 3.14159265359
  #define PHI 1.618033988749895

  #pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
  #pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
  #pragma glslify: camera = require('glsl-camera-ray')
  #pragma glslify: square = require('glsl-square-frame')
  #pragma glslify: blinnPhongSpec = require('glsl-specular-blinn-phong')
  #pragma glslify: rotate = require('glsl-rotate/rotate')

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
    return d;
  }

  float sdEquilateralTriangle( in vec2 p, in float r ) {
    const float k = sqrt(3.0);
    p.x = abs(p.x) - r;
    p.y = p.y + r/k;
    if( p.x+k*p.y>0.0 ) p = vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
    p.x -= clamp( p.x, -2.0*r, 0.0 );
    return -length(p)*sign(p.y);
  }

  float sdHexagon( in vec2 p, in float r ) {
    const vec3 k = vec3(-0.866025404,0.5,0.577350269);
    p = abs(p);
    p -= 2.0*min(dot(k.xy,p),0.0)*k.xy;
    p -= vec2(clamp(p.x, -k.z*r, k.z*r), r);
    return length(p)*sign(p.y);
  }

  vec2 doModel(vec3 p) {
    float k;
    vec4 p4 = inverseStereographic(p,k);

    // The inside-out rotation puts the torus at a different
    // orientation, so rotate to point it at back in the same
    // direction
    p4.zy = rotate(p4.zy, playhead * -PI / 2.);

    // Rotate in 4D, turning the torus inside-out
    p4.xw = rotate(p4.xw, playhead * -PI / 2.);

    vec2 uv;
    float d = fTorus(p4, uv);

    // Recreate domain to be wrapped around the torus surface
    // xy = surface / face, z = depth / distance
    float uvScale = 2.25; // Magic number that makes xy distances the same scale as z distances
    p = vec3(uv * uvScale, d);

    float n = 10.;
    float repeat = uvScale / n;

    p.xy += repeat / 2.;
    pMod2(p.xy, vec2(repeat));
    p.xy = rotate(p.xy, playhead * -PI * 0.845);

    d = sdHexagon(p.xy, .09) * .5;
    d = smax(d, abs(p.z) - .013, .01);

    d = fixDistance(d, k);

    return vec2(d, 0.0);
  }

  // ------------------------------------------
  // Lighting
  // ------------------------------------------
  vec3 pal( in float t, in vec3 a, in vec3 b, in vec3 c, in vec3 d ) {
    return a + b*cos( 6.28318*(c*t+d) );
  }

  vec3 spectrum(float n) {
    return pal( n, vec3(0.5,0.5,0.5),vec3(0.5,0.5,0.5),vec3(1.0,1.0,1.0),vec3(0.0,0.33,0.67) );
  }

  const float GAMMA = 2.2;

  vec3 gamma(vec3 color, float g) {
    return pow(color, vec3(g));
  }

  vec3 linearToScreen(vec3 linearRGB) {
    return gamma(linearRGB, 1.0 / GAMMA);
  }

  void main() {
    vec3 bg = vec3(0.075,0.071,0.09);
    vec3 color = vec3(0.075,0.071,0.09);

    vec3  rayOrigin    = vec3(3.);
    vec3  rayTarget    = vec3(0);
    vec2  screenPos    = square(resolution.xy);
    vec3  rayDirection = camera(rayOrigin, rayTarget, screenPos, 1.25);

    vec2 collision = raytrace(rayOrigin, rayDirection);

    // If the ray collides, draw the surface
    if (collision.x > -0.5) {
      // Determine the point of collision
      vec3 pos = rayOrigin + rayDirection * collision.x;
      vec3 nor = normal(pos);

      vec3 lightPos = vec3(1, 1, 1);
      vec3 eyeDirection = normalize(rayOrigin - pos);
      vec3 lightDirection = normalize(lightPos - pos);

      float power = blinnPhongSpec(lightDirection, eyeDirection, nor, 0.5);
      vec3 baseColor = vec3(power, power, power);

      // iridescent lighting
      vec3 reflection = reflect(rayDirection, nor);
      vec3 dome = vec3(0, 1, 0);

      vec3 perturb = sin(pos * 10.);
      color = spectrum(dot(nor + perturb * .05, eyeDirection) * 2.);

      float specular = clamp(dot(reflection, lightDirection), 0., 1.);
      specular = pow((sin(specular * 20. - 3.) * .5 + .5) + .1, 32.) * specular;
      specular *= .1;
      specular += pow(clamp(dot(reflection, lightDirection), 0., 1.) + .3, 8.) * .1;

      float shadow = pow(clamp(dot(nor, dome) * .5 + 1.2, 0., 1.), 3.);
      color = color * shadow;

      // mix blinn phong lighting and iridescent lighting
      color = mix(baseColor, color, 0.5);

      float near = 2.8;
      float far = 8.;
      float fog = (collision.x - near) / (far - near);
      fog = clamp(fog, 0., 1.);
      color = mix(color, bg, fog);
      color = linearToScreen(color);
    }

    gl_FragColor = vec4(color, 1);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      playhead: ({ playhead }) => playhead,
    },
  });
};

canvasSketch(sketch, settings);
