/* Procedural fluid materials. Shared noise, backdrop and uniforms live in the host. */
globalThis.ElementMaterialSources = {
  ...(globalThis.ElementMaterialSources || {}),
  fire: `
// Twelve depth slices keep three interleaved flame fronts translucent.
vec4 material(vec2 p, float t) {
  if (abs(p.x) > 0.80 || p.y < -0.86 || p.y > 1.24) return vec4(0.0);
  float height = (p.y + 0.66) / 1.37;
  float fuelEdge = noise(vec2(p.x * 12.0, t * 0.42));
  // The source tapers into the lower half of an ellipse, never a flat shelf.
  float bowlX = (p.x - 0.015 * sin(t * 0.53)) / 0.44;
  float baseY = -0.29 - 0.40 * sqrt(max(0.0, 1.0 - sq(bowlX)));
  float bottom = smoothstep(baseY + (fuelEdge - 0.5) * 0.012, baseY + 0.065, p.y);
  float top = 1.0 - smoothstep(0.73, 0.89, p.y);
  vec3 sum = vec3(0.0);
  float alpha = 0.0;
  float h = clamp(height, 0.0, 1.0);
  float lean = (fbm(vec2(p.y * 2.6 - t * 0.37, t * 0.21)) - 0.5)
    * (0.07 + 0.33 * h);
  float leftHeight = clamp((p.y + 0.66) / (0.97 + noise(vec2(t * 0.91, 6.4)) * 0.57), 0.0, 1.0);
  float rightHeight = clamp((p.y + 0.66) / (0.91 + noise(vec2(t * 0.73, 19.2)) * 0.63), 0.0, 1.0);
  float centerHeight = clamp((p.y + 0.66) / (1.16 + noise(vec2(t * 0.84, 31.8)) * 0.48), 0.0, 1.0);
  float leftCenter = -0.17 + lean * 0.85
    + (noise(vec2(p.y * 5.4 - t * 0.96, 6.2)) - 0.5) * 0.39 * leftHeight;
  float rightCenter = 0.20 + lean * 0.65
    + (noise(vec2(p.y * 4.6 - t * 0.91, 19.4)) - 0.5) * 0.42 * rightHeight;
  float center = lean * 1.30 + 0.025
    + sin(p.y * 7.3 - t * 3.1) * h * 0.065;
  float rising = p.y * 3.0 - t * 1.14;
  if (bottom * top > 0.001 && abs(p.x) < 0.65) {
  for (int i = 0; i < 12; i++) {
    float z = -0.25 + (float(i) + 0.5) * 0.04167;
    vec2 flow = vec2((p.x - lean) * 5.8 + z * 2.7, rising - z * 1.8);
    float folds = fbm(flow + vec2(
      noise(flow * 0.61 + vec2(8.0, -t * 0.19)),
      noise(flow * 0.74 + vec2(-3.0, t * 0.16))) * 1.35);
    float fine = noise(flow * 3.6 + vec2(z * 7.0, -t * 0.62));
    float leftRadius = max(0.018, 0.267 * (1.0 - pow(leftHeight, 0.80)));
    float rightRadius = max(0.018, 0.258 * (1.0 - pow(rightHeight, 0.83)));
    float centerRadius = max(0.018, 0.276 * (1.0 - pow(centerHeight, 0.82)));
    float frontLeft = 1.40 - length(vec2(p.x - leftCenter, z * 1.18)) / leftRadius;
    float frontRight = 1.36 - length(vec2(p.x - rightCenter, z * 1.12)) / rightRadius;
    float frontCenter = 1.42 - length(vec2(p.x - center, z)) / centerRadius;
    float envelope = max(frontCenter, max(frontLeft, frontRight));
    float tongues = folds * (0.40 + h * 1.35) + fine * 0.25;
    float density = max(0.0, envelope - tongues);
    float holes = noise(flow * vec2(1.15, 1.8) + vec2(z * 13.0, -t * 0.4));
    density *= 1.0 - smoothstep(0.55, 0.82, holes) * smoothstep(0.13, 0.56, h) * 0.90;
    density *= bottom * top;
    float opacity = 1.0 - exp(-density * 1.31);
    float heat = clamp(density * 1.60 + (1.0 - h) * 0.19, 0.0, 1.0);
    vec3 flame = mix(vec3(0.70, 0.055, 0.008), vec3(1.0, 0.32, 0.025),
      smoothstep(0.12, 0.50, heat));
    flame = mix(flame, vec3(1.0, 0.69, 0.14), smoothstep(0.46, 0.85, heat));
    float hot = smoothstep(0.72, 1.0, heat) * (1.0 - smoothstep(0.21, 0.60, h));
    flame = mix(flame, vec3(1.0, 0.93, 0.68), hot * 0.78);
    // Uneven absorption keeps folds and dark channels within the burning body.
    flame *= 0.72 + 0.28 * smoothstep(0.06, 0.42, density);
    sum += (1.0 - alpha) * flame * opacity;
    alpha += (1.0 - alpha) * opacity;
  }
  }
  // Thin rising soot is a separate dim veil, never a replacement for the flame.
  float smokeNoise = fbm(vec2(p.x * 5.6 - lean * 3.0, p.y * 3.8 - t * 0.40));
  float smokeWidth = 0.08 + h * 0.14;
  float smoke = exp(-sq((p.x - lean * 1.15) / smokeWidth))
    * smoothstep(0.25, 0.62, p.y) * (1.0 - smoothstep(0.59, 0.88, p.y))
    * smoothstep(0.38, 0.68, smokeNoise) * 0.15;
  sum += (1.0 - alpha) * vec3(0.125, 0.104, 0.14) * smoke;
  alpha += (1.0 - alpha) * smoke;
  // Very restrained local bounce; the volume itself carries the silhouette.
  float bounce = exp(-dot(p - vec2(0.0, -0.42), p - vec2(0.0, -0.42)) * 16.0)
    * 0.055 * bottom;
  sum += (1.0 - alpha) * vec3(0.74, 0.19, 0.025) * bounce;
  alpha += (1.0 - alpha) * bounce;
  // Embers leave the hot body, drift upward at unequal speeds and cool.
  // They sit outside the flame mask so they can clear the tips.
  for (int i = 0; i < 11; i++) {
    float id = float(i) + 1.0;
    float seed = hash(id * 13.7);
    float age = fract(t * (0.22 + seed * 0.14) + hash(id * 8.9));
    float x = (hash(id * 5.3) - 0.5) * 0.51;
    x += sin(age * 5.4 + id * 2.1) * age * 0.105;
    x += sin(t * 0.67 + id) * age * 0.035;
    float y = -0.20 + age * 1.36;
    vec2 delta = p - vec2(x, y);
    float radius = 0.0036 + seed * 0.0037;
    float pin = exp(-sq(delta.x / radius) - sq(delta.y / (radius * 1.65)));
    float halo = exp(-dot(delta, delta) / (radius * radius * 13.0)) * 0.13;
    float life = smoothstep(0.0, 0.13, age) * (1.0 - smoothstep(0.67, 1.0, age));
    float ember = min(0.91, (pin + halo) * life * (0.69 + 0.20 * seed));
    vec3 emberColor = mix(vec3(1.0, 0.75, 0.27), vec3(0.92, 0.24, 0.025), age);
    sum = sum * (1.0 - ember) + emberColor * ember;
    alpha += (1.0 - alpha) * ember;
  }
  return vec4(sum / max(alpha, 0.0001), clamp(alpha, 0.0, 1.0));
}`,
  water: `
float waterRadius(float angle, float t) {
  return 0.49 + sin(angle * 3.0 - t * 0.60) * 0.008
    + sin(angle * 5.0 + t * 0.47) * 0.006;
}
vec2 waterCenter(float t) { return vec2(0.0, sin(t * 0.7) * 0.015); }
float waterSheet(vec2 p, float t) {
  vec2 q = p - waterCenter(t);
  // A complete circular body, with only a small liquid movement at its rim.
  return length(q) - waterRadius(atan(q.y, q.x + 0.00001), t);
}
float waterHeight(vec2 p, float t, float d) {
  vec2 flow = vec2(p.x * 8.0 + t * 0.20, p.y * 6.0 - t * 0.42);
  float wave = noise(flow) + 0.40 * noise(flow * 2.1 + 7.8);
  float taper = smoothstep(0.0, 0.045, -d);
  return sqrt(max(0.0, -d * (1.0 + d))) * 0.78 + (wave - 0.7) * 0.044 * taper;
}
vec4 material(vec2 p, float t) {
  float d = waterSheet(p, t);
  float thickness = sqrt(max(0.0, -d) * 0.38);
  float h = waterHeight(p, t, d);
  float eps = 0.003;
  vec2 px = p + vec2(eps, 0.0);
  vec2 py = p + vec2(0.0, eps);
  float hx = waterHeight(px, t, waterSheet(px, t));
  float hy = waterHeight(py, t, waterSheet(py, t));
  vec3 normal = normalize(vec3(-(hx - h) / eps, -(hy - h) / eps, 1.0));
  float dropFade = 1.0;
  // Beads grow on the lower rim before detaching and accelerating downward.
  for (int i = 0; i < 6; i++) {
    float id = float(i) + 1.0;
    float cycle = fract(t * (0.24 + hash(id * 17.3) * 0.08) + hash(id * 8.1));
    float angle = -1.57079633 + (hash(id * 5.9) - 0.5) * 1.32;
    vec2 origin = waterCenter(t) + vec2(cos(angle), sin(angle)) * waterRadius(angle, t);
    float fall = max(0.0, (cycle - 0.16) / 0.84);
    float fade = smoothstep(0.0, 0.10, cycle) * (1.0 - smoothstep(0.82, 1.0, cycle));
    float radius = (0.019 + hash(id * 2.7) * 0.013) * max(0.05, fade);
    vec2 center = origin + vec2(cos(angle) * fall * 0.055, -radius * 0.36 - fall * fall * 0.67);
    vec2 scale = vec2(radius * (0.93 - fall * 0.17), radius * (1.10 + fall * 0.80));
    vec2 local = (p - center) / scale;
    float droplet = (length(local) - 1.0) * min(scale.x, scale.y);
    if (droplet < d) {
      d = droplet;
      float depth = sqrt(max(0.0, 1.0 - dot(local, local)));
      normal = normalize(vec3(local.x, local.y * scale.x / scale.y, max(0.02, depth)));
      thickness = radius * depth * 3.0;
      dropFade = fade;
    }
  }
  float coverage = (1.0 - smoothstep(-0.0025, 0.0025, d)) * dropFade;
  if (coverage < 0.001) return vec4(0.0);
  vec2 aspect = vec2(uResolution.x) / uResolution;
  vec2 offset = normal.xy * (0.018 + thickness * 0.16) * aspect;
  vec3 transmitted = backdrop(clamp(vUv - offset, vec2(0.001), vec2(0.999)));
  float depthTint = clamp(thickness * 2.4, 0.0, 0.55);
  transmitted *= mix(vec3(0.94, 0.99, 1.0), vec3(0.42, 0.80, 0.86), depthTint);
  vec3 reflected = reflect(vec3(0.0, 0.0, -1.0), normal);
  float fresnel = 0.020 + 0.98 * pow(1.0 - clamp(normal.z, 0.0, 1.0), 5.0);
  vec3 env = backdrop(clamp(vUv + reflected.xy * 0.20, vec2(0.001), vec2(0.999)));
  env = env * 0.75 + vec3(0.26, 0.41, 0.46);
  // Broad reflected windows and small glints distinguish liquid from emissive fog.
  float window = exp(-sq((reflected.x + reflected.y * 0.38 + 0.21) / 0.20))
    * (0.40 + 0.60 * smoothstep(-0.40, 0.60, reflected.y));
  float backWindow = exp(-sq((reflected.y - reflected.x * 0.34 + 0.16) / 0.12));
  float broadLight = pow(max(0.0, dot(normal, normalize(vec3(-0.48, 0.65, 0.58)))), 2.0);
  float glint = pow(max(0.0, dot(reflected, normalize(vec3(-0.48, 0.70, 0.70)))), 65.0);
  float lowGlint = pow(max(0.0, dot(reflected, normalize(vec3(0.65, -0.25, 0.70)))), 35.0);
  vec3 color = mix(transmitted, env, min(0.88, fresnel));
  color += vec3(0.42, 0.67, 0.73) * window * (0.39 + 0.47 * fresnel);
  color += vec3(0.32, 0.57, 0.62) * backWindow * 0.32;
  color += vec3(0.075, 0.19, 0.21) * broadLight;
  color += vec3(0.90, 0.99, 1.0) * glint * 0.85;
  color += vec3(0.28, 0.48, 0.62) * lowGlint * 0.26;
  float edge = exp(-abs(d) * 170.0);
  float rimLight = max(0.0, dot(normal.xy, normalize(vec2(-0.65, 0.75))));
  color += vec3(0.66, 0.87, 0.90) * edge * pow(rimLight, 2.0) * 0.51;
  color += vec3(0.035, 0.088, 0.095) * smoothstep(0.0, 0.13, thickness);
  float opacity = coverage * clamp(0.72 + fresnel * 0.23 + thickness * 0.28, 0.0, 0.97);
  return vec4(clamp(color, 0.0, 1.0), opacity);
}`
};
