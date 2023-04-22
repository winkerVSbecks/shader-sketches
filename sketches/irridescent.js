const canvasSketch = require('canvas-sketch');
const createShader = require('canvas-sketch-util/shader');
const Random = require('canvas-sketch-util/random');
const glsl = require('glslify');

const settings = {
  dimensions: [1080, 1080],
  context: 'webgl',
  animate: true,
  // duration: 2,
};

const frag = glsl(/*glsl*/ `
  precision mediump float;

  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

  #define pi 3.14

  mat3 create_camera( in vec3 ro, in vec3 ta, float cr ) {
    vec3 cw = normalize(ta-ro);
    vec3 cp = vec3(sin(cr), cos(cr),0.0);
    vec3 cu = normalize( cross(cw,cp) );
    vec3 cv = cross(cu,cw);

    return mat3( cu, cv, cw );
  }

  float sd_sphere( vec3 p, float s ) {
    return length(p)-s;
  }

  float sd_box( vec3 p, vec3 b ) {
    vec3 d = abs(p) - b;
    return length(max(d,0.0)) + min(max(d.x,max(d.y,d.z)),0.0);
  }

  float bsin(float v) {
    return sin(v) * 0.5 + 1.0;
  }

  float bcos(float v) {
    return cos(v) * 0.5 + 1.0;
  }

  float op_union( float d1, float d2 ) {
    return min(d1,d2);
  }

  float map(vec3 p) {
    return sd_box(p, vec3(2.5));
  }

  vec3 sky(vec3 v) {
    vec3 grad_a = vec3(0.9, 0.85, 0.7);
    vec3 grad_b = vec3(0.5, 0.0, 1.0) * 0.5;

    float grad_t = v.y * 0.5 + 0.5;

    return mix(grad_b, grad_a, grad_t);
  }

  vec3 calc_normal(in vec3 pos) {
    vec3 eps = vec3(0.001, 0.0, 0.0);
    vec3 nor;

    nor.x = map(pos+eps.xyy) - map(pos-eps.xyy);
    nor.y = map(pos+eps.yxy) - map(pos-eps.yxy);
    nor.z = map(pos+eps.yyx) - map(pos-eps.yyx);

    return normalize(nor);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy/resolution.xy; // vUv; //fragCoord/resolution.xy;
    float eps = 0.05;

    float time = 15.0 + time;

    vec3 ro = vec3(cos(time) * 10.0, 0.0, sin(time) * 10.0);

    vec3 ta = vec3(-0.5, -0.4, 0.5);
    mat3 cam = create_camera(ro, ta, 0.0);

    vec3 col = vec3(0.0, 0.0, 0.0);

    vec2 p = (-resolution.xy + 2.0 * gl_FragCoord.xy)/resolution.y;

    vec3 rd = cam * normalize(vec3(p.xy, 1.0));

    float d = 10.0;
    float xt = 0.0;
    vec3 pp = ro;

    vec3 l = normalize(vec3(0.0, 1.0, 1.0));

    for(float t = 0.0; t < 20.0; ++t) {
      pp = ro + rd * xt;
      d = map(pp);

      if(d < eps)
          break;

      xt += d;
    }

    vec3 n = calc_normal(pp);

    float nv = dot(n, -rd);

    col += sin(nv * vec3(0.0, 1.0, 0.0) * 10.0 * 1.5) * 0.5 + 0.5;
    col += sin(nv * vec3(1.0, 0.0, 0.0) * 20.0 * 1.5) * 0.5 + 0.5;
    col += sin(nv * vec3(0.0, 0.0, 1.0) * 5.0 * 1.5) * 0.5 + 0.5;
    col = clamp(normalize(col), 0.0, 1.0);

    float mask = step(d, eps);
    float inv_mask = 1.0 - mask;

    vec3 csky = sky(rd);

    gl_FragColor = vec4(csky * inv_mask + col * mask, 1.0);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      loopTime: ({ time }) => time % 1,
    },
  });
};

canvasSketch(sketch, settings);
