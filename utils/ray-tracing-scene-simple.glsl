#define PI 3.14159265359

#pragma glslify: raytrace = require('glsl-raytrace', map = doModel, steps = 90)
#pragma glslify: normal = require('glsl-sdf-normal', map = doModel)
#pragma glslify: camera   = require('glsl-camera-ray')
#pragma glslify: square   = require('glsl-square-frame')

vec3 renderScene(vec2 resolution, float playhead, float height, float dist) {
  vec3 color = vec3(0.0);

  float cameraAngle  = 2.0 * PI * playhead;
  vec3  rayOrigin    = vec3(1.5 * sin(cameraAngle), 1.0, 1.5 * cos(cameraAngle)) * dist;
  vec3  rayTarget    = vec3(0, 0, 0);
  vec2  screenPos    = square(resolution.xy);
  float lensLength   = 2.0;
  vec3  rayDirection = camera(rayOrigin, rayTarget, screenPos, lensLength);

  vec2 collision = raytrace(rayOrigin, rayDirection, 20.0, 0.001);

  if (collision.x > -0.5) {
    // Determine the point of collision
    vec3 pos = rayOrigin + rayDirection * collision.x;
    vec3 nor = normal(pos);
    color = nor * 0.5 + 0.5;
  }

  return color;
}

#pragma glslify: export(renderScene)