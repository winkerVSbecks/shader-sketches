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
  precision highp float;

  uniform float time;
  uniform vec2 resolution;
  varying vec2 vUv;

  float pi = 4.*atan(1.);

  mat2 rotate(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  vec2 rand(vec2 n) {
    float a = fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    float b = fract(cos(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
    return vec2(a,b);
  }

  vec2 mult(in vec2 a, in vec2 b) {
      return vec2(a.x * b.x - a.y * b.y, a.y * b.x + a.x * b.y);
  }

  vec2 func(in vec2 z) {
    return mult(
      z - vec2(2.0*(1.0 + 0.5*sin(time/3.)), 0.0)*rotate(time/4.),
      z + vec2(2.0*(1.0 + 0.5*sin(time/3.)), 0.0)*rotate(time/4.)
    );
  }

  int mod_u32(int bas, int div){
    float flt_res =  mod(float(bas), float(div));
    int u32_res = int(flt_res);
    return u32_res;
  }

/* Here is the explanation for the code above:
1. The first line of code gets the UV coordinates from the vertex shader.
2. The next line converts the UV coordinates to polar coordinates (r, theta).
3. The next line divides r by 4 to get a value between 0 and 1.
4. The next line checks whether the integer part of the r value is odd or even.
5. If the value is even, then the next line sets the frequency of rotation to 1.5 times the y value of the random function, which is defined in the vertex shader, and multiplies the UV coordinates by the rotation matrix.
6. If the value is odd, then the next line sets the frequency of rotation to 2 times the y value of the random function, which is defined in the vertex shader, and multiplies the UV coordinates by the rotation matrix.
7. The next line sets the theta value to the arctangent of the y and x components of the UV coordinates, plus pi.
8. The next line sets the number of divisions to 7.
9. The next line sets the value of epsilon to 5 divided by the x component of the resolution vector.
10. The next line sets the value of gEps to 0.01.
11. The next line sets the value of stretch to the length of the difference between the function applied to the position plus the vector (gEps, 0) minus the function applied to the position divided by gEps.
12. The next line sets the value of dt to the absolute value of the remainder of the theta value plus pi divided by n minus pi divided by n divided by stretch.
13. The next line checks whether the value of r is less than 1.
14. If the value of r is less than 1, then the next line divides dt by r.
15. The next line sets the value of dr to the absolute value of the fractional part of r plus 0.5 minus 0.5 divided by stretch.
16. The next line sets the value of ct to the smoothstep function applied to 2 times epsilon minus epsilon and dt times r.
17. The next line sets the value of cr to the smoothstep function applied to 2 times epsilon minus epsilon and dr.
18. The next line sets the value of cc to the maximum of ct and cr.
19. The next line sets the value of dc to the random function applied to the vector of the floor of n times theta divided by 2 times pi and the floor of r.
20. The next line sets the value of val to the dot product of dc and the vector (1, 1).
21. The next line sets the value of col to 0.5 plus 0.47 times the cosine function applied to 6.2831 times val plus the vector (0, 1, 2).
22. The next line sets the value of col to the mix function applied to col, the vector (0, 0, 0) and cc.
23. The next line sets the value of the fragment color to the vector of the square root of the maximum of col and 0 and 1. */
  void main() {
    vec2 fg = mix(vec2(0.5), resolution.xy - 0.5, vUv);
    vec2 uv = 5.* (2.* fg - resolution.xy) / resolution.y;
    vec2 pos = uv;
    uv = func(uv);

    float r = length(uv)/4.;

    if (mod_u32(int(floor(r)), 2) == 0) {
      float freq = 1.5*rand(vec2(floor(r),1)).y;
      uv *= rotate(freq*time);
    }
    else {
      float freq = 2.*rand(vec2(floor(r),-1)).y;
      uv *= rotate(-freq*time);
    }

    float theta = atan(uv.y,uv.x)+pi;

    float n = 7.;
    float eps = 5./resolution.x;
    float gEps = 0.01;
    float stretch = length(func(pos+vec2(gEps,0.))-func(pos))/gEps;
    float dt = abs(mod(theta+pi/n, 2.*pi/n) -pi/n)/stretch;
    // dividers
    float ct = smoothstep(2.*eps,eps,dt*r);
    if (r < 1.)  { dt = dt/r; }

    float dr = abs(fract(r+.5)-.5)/stretch;
    // rings + outlines
    float cr = smoothstep(2.*eps,eps,dr);
    float cc = max(ct, cr);

    // ring divisions
    vec2 dc = rand(vec2(floor(n*theta/(2.0*pi)),floor(r)));

    float val = dot(dc, vec2(1));
    // IQ's versatile cosine palette.
    vec3 col = .5 + .47*cos(6.2831*val + vec3(0, 1, 2));
    col = mix(col, vec3(0), cc);

    // Rough gamma correction.
    gl_FragColor = vec4(sqrt(max(col, 0.)), 1);
  }
`);

const sketch = ({ gl }) => {
  return createShader({
    gl,
    frag,
    vert: glsl(/*glsl*/ `
    precision highp float;
    attribute vec3 position;
    varying vec2 vUv;

    void main () {
      gl_Position = vec4(position.xyz, 1.0);
      vUv = gl_Position.xy * 0.5 + 0.5;
    }
    `),
    uniforms: {
      resolution: ({ width, height }) => [width, height],
      time: ({ time }) => time,
      playhead: ({ playhead }) => playhead,
      loopTime: ({ time }) => time % 1,
    },
  });
};

canvasSketch(sketch, settings);
