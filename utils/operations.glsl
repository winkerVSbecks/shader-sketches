float opSmoothUnion( float d1, float d2, float k ) {
  float h = max(k-abs(d1-d2),0.0);
  return min(d1, d2) - h*h*0.25/k;
}
