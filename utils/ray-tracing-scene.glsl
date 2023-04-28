#define PI 3.14159265359

#pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
#pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
#pragma glslify: camera = require('glsl-turntable-camera')

vec3 renderScene(vec2 resolution, float playhead, float height, float dist) {
  vec3 color = vec3(0.0);
  vec3 ro, rd;

  float rotation = 2. * PI * playhead;
  camera(rotation, height, dist, resolution.xy, ro, rd);

  vec2 t = raytrace(ro, rd, 20.0, 0.005);
  if (t.x > -0.5) {
    vec3 pos = ro + rd * t.x;
    vec3 nor = normal(pos);

    color = nor * 0.5 + 0.5;
  }

  return color;
}

#pragma glslify: export(renderScene)