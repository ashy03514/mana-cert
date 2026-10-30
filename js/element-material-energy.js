/* Volumetric light and shadow material studies for the isolated element preview.
 * Shared shader helpers and uniforms are supplied by element-material-renderer.
 * Every material returns straight (not premultiplied) RGBA.
 */
globalThis.ElementMaterialSources = {
  ...(globalThis.ElementMaterialSources || {}),
  light: `
float lightDust(vec2 p, float t) {
  float dust = 0.0;
  for (int i = 0; i < 14; i++) {
    float id = float(i);
    float age = fract(t * (0.025 + hash(id + 17.0) * 0.035) + hash(id + 91.0));
    float y = mix(-0.53, 0.78, age);
    float x = (hash(id + 31.0) - 0.5) * 0.92;
    x += sin(age * 5.0 + id * 2.7) * 0.045;
    vec2 d = p - vec2(x, y);
    float size = mix(0.0028, 0.0062, hash(id + 12.0));
    float pin = exp(-dot(d, d) / (size * size));
    float aura = exp(-dot(d, d) / (size * size * 21.0)) * 0.11;
    float life = smoothstep(0.0, 0.13, age) * (1.0 - smoothstep(0.82, 1.0, age));
    float illumination = 0.24 + 0.76 * pow(max(0.0, sin(id * 3.4 + t * 0.53)), 3.0);
    dust += (pin + aura) * life * illumination;
  }
  return dust;
}

vec4 material(vec2 p, float t) {
  float opening = 0.88 + 0.12 * sin(uPhase * 3.14159265);
  vec2 origin = vec2(0.018 * sin(t * 0.22), -0.24);
  vec2 q = p - origin;
  vec3 energy = vec3(0.0);
  float opacity = 0.0;

  // Back-to-front slices give shafts different parallax and fog occlusion.
  // The gaps between the five shafts remain dark throughout the motion.
  for (int iz = 0; iz < 9; iz++) {
    float z = (float(iz) - 4.0) / 4.0;
    vec2 s = q;
    s.x += z * (0.041 + 0.018 * q.y);
    s.y += z * 0.052;
    float height = s.y;
    float upward = smoothstep(-0.025, 0.065, height)
      * (1.0 - smoothstep(0.62, 1.08, height));
    float beams = 0.0;
    for (int ir = 0; ir < 5; ir++) {
      float ray = float(ir) - 2.0;
      float slope = ray * 0.275 + sin(t * 0.18 + ray * 1.9) * 0.024;
      float center = slope * height * opening;
      float width = 0.012 + max(height, 0.0) * (0.034 + 0.009 * hash(ray + 8.0));
      float rayDistance = (s.x - center) / width;
      float shaft = exp(-rayDistance * rayDistance * 0.55);
      float strength = mix(0.48, 0.82, hash(ray + 10.0));
      beams += shaft * strength;
    }
    float fog = fbm(s * vec2(3.7, 4.5) + vec2(z * 2.31, -t * 0.085));
    float fine = noise(s * 17.0 + vec2(z * 5.8, -t * 0.12));
    float pockets = 0.26 + 0.74 * smoothstep(0.18, 0.72, fog + fine * 0.17);
    float depthFalloff = exp(-z * z * 1.65);
    float beamDensity = beams * upward * pockets * depthFalloff;

    // A small amount of reflected light catches separate, low fog shelves.
    float shelf = exp(-sq((s.y + 0.14 + z * 0.08
      + sin(s.x * 4.5 + t * 0.12) * 0.055) / 0.115));
    float fogHalo = exp(-dot(s * vec2(2.9, 2.1), s * vec2(2.9, 2.1)));
    float suspendedFog = fogHalo * upward * pockets
      * smoothstep(0.28, 0.72, fog + fine * 0.22);
    float density = beamDensity * 0.28 + shelf * fogHalo * pockets * 0.042
      + suspendedFog * 0.017;
    vec3 champagne = mix(vec3(0.57, 0.46, 0.30), vec3(0.92, 0.82, 0.63), pockets);
    vec3 silver = vec3(0.60, 0.72, 0.83);
    vec3 color = mix(champagne, silver, smoothstep(0.3, 1.0, z) * 0.42);
    energy = energy * (1.0 - density) + color * density;
    opacity = opacity + density * (1.0 - opacity);
  }

  // A slim suspended source: three separated filaments, with tiny bright tips.
  // It is intentionally much smaller than the illuminated volume around it.
  float sourceY = q.y + 0.018 * sin(t * 0.29);
  float sourceExtent = 1.0 - smoothstep(0.105, 0.164, abs(sourceY));
  float taper = max(0.0, 1.0 - abs(sourceY) / 0.172);
  float filamentX = q.x + 0.008 * sin(sourceY * 22.0 + t * 0.36);
  float core = exp(-sq(filamentX / (0.003 + taper * 0.006))) * sourceExtent;
  float sideA = exp(-sq((filamentX - 0.018 * taper) / 0.0033))
    * sourceExtent * 0.45;
  float sideB = exp(-sq((filamentX + 0.014 * taper) / 0.0027))
    * sourceExtent * 0.32;
  float source = min(0.96, core * 0.92 + sideA + sideB);
  vec3 sourceColor = mix(vec3(0.96, 0.73, 0.38), vec3(1.0, 0.97, 0.82), core * 0.82);
  energy = energy * (1.0 - source) + sourceColor * source;
  opacity = opacity + source * (1.0 - opacity);

  float dust = min(0.8, lightDust(p, t));
  energy = energy * (1.0 - dust) + vec3(0.93, 0.87, 0.66) * dust;
  opacity = opacity + dust * (1.0 - opacity);
  float bounds = (1.0 - smoothstep(0.49, 0.62, abs(p.x)))
    * (1.0 - smoothstep(0.74, 0.88, abs(p.y)));
  return vec4(energy / max(opacity, 0.00001), opacity * bounds);
}
`,
  dark: `
vec4 darkOver(vec4 back, vec3 color, float alpha) {
  float a = clamp(alpha, 0.0, 1.0);
  return vec4(back.rgb * (1.0 - a) + color * a, back.a + a * (1.0 - back.a));
}

vec4 material(vec2 p, float t) {
  vec4 volume = vec4(0.0);
  float breath = 1.0 - 0.045 * sin(uPhase * 3.14159265);
  vec2 q = p / vec2(breath * 1.14, breath);
  q.x += 0.018 * sin(q.y * 4.2 + t * 0.19);

  // The deep volume is a tapered, asymmetric cavity with no circular border.
  float taper = sqrt(max(0.0, 1.0 - sq(q.y / 0.73)));
  float edgeNoise = noise(q * vec2(7.0, 5.0) + vec2(0.0, t * 0.055));
  float silhouette = 1.0 - smoothstep(
    0.30 * taper - 0.028, 0.45 * taper + 0.025,
    abs(q.x + 0.035 * sin(q.y * 5.5)) + (edgeNoise - 0.5) * 0.045
  );
  silhouette *= 1.0 - smoothstep(0.59, 0.76, abs(q.y));
  float rearFlow = noise(q * 8.0 + vec2(t * 0.025, -t * 0.065));
  float rearFold = pow(max(0.0, sin(q.x * 31.0 + q.y * 4.0
    + rearFlow * 3.5 + t * 0.12)), 3.0);
  vec3 rear = mix(vec3(0.018, 0.019, 0.037), vec3(0.14, 0.13, 0.20),
    rearFlow * 0.50 + rearFold * 0.24);
  volume = darkOver(volume, rear, silhouette * 0.72);

  // Nested curtains alternate front/back and left/right. Their inner edges
  // do not close into rings, so folds read as overlapping sheets in space.
  for (int layer = 0; layer < 7; layer++) {
    float id = float(layer);
    float depth = id / 6.0;
    float side = mod(id, 2.0) * 2.0 - 1.0;
    float reach = mix(0.39, 0.69, depth);
    float localY = q.y + sin(t * 0.12 + id * 1.7) * 0.026;
    float vertical = 1.0 - smoothstep(reach * 0.73, reach, abs(localY));
    float curve = sqrt(max(0.0, 1.0 - sq(localY / reach)));
    float offset = mix(0.045, 0.28, depth);
    float foldWave = sin(localY * (4.2 + depth * 2.1) + id * 1.73 - t * 0.14);
    float fineWave = sin(localY * 11.0 - t * 0.19 + id * 2.4) * 0.008;
    float edge = side * (offset * curve + foldWave * 0.042 + fineWave);
    float distance = (q.x - edge) * side;
    float width = mix(0.13, 0.19, depth) * (0.36 + curve * 0.64);
    float sheet = smoothstep(-0.012, 0.018, distance)
      * (1.0 - smoothstep(width * 0.42, width, distance)) * vertical;
    float grain = noise(vec2(distance * 28.0 + id * 7.1, localY * 9.0 - t * 0.08));
    float crease = pow(max(0.0, sin(distance * 36.0 + foldWave * 1.6)), 5.0);
    float reflected = exp(-sq((distance - 0.017) / 0.012));
    reflected *= (0.24 + 0.76 * smoothstep(-0.65, 0.75, foldWave));
    float broadReflection = exp(-sq((distance - width * 0.26) / (width * 0.35)));
    vec3 sheetColor = mix(vec3(0.035, 0.035, 0.059), vec3(0.20, 0.18, 0.27),
      grain * 0.50 + crease * 0.22 + broadReflection * 0.22);
    sheetColor += vec3(0.16, 0.15, 0.22) * broadReflection
      * (0.23 + 0.30 * smoothstep(-0.65, 0.75, foldWave));
    sheetColor += vec3(0.24, 0.20, 0.34) * reflected * (0.38 + depth * 0.34);
    float opacity = sheet * mix(0.58, 0.86, depth);
    volume = darkOver(volume, sheetColor, opacity);

    // A glimmer approaches the center at each depth, then disappears behind
    // the next curtain. Staggered lifetimes make the swallowing sequential.
    float age = fract(t * (0.065 + hash(id + 72.0) * 0.018) + hash(id + 37.0));
    float approach = pow(1.0 - age, 1.45);
    float angle = id * 2.39996 + age * 0.72;
    vec2 glimmerAt = vec2(cos(angle) * 0.42, sin(angle) * 0.58) * approach;
    glimmerAt.x += 0.028 * sin(t * 0.14 + id);
    vec2 delta = q - glimmerAt;
    delta.y *= 1.7;
    float pin = exp(-dot(delta, delta) / mix(0.000018, 0.00005, depth));
    float tail = exp(-dot(delta * vec2(0.35, 1.0), delta * vec2(0.35, 1.0)) / 0.00012);
    float life = smoothstep(0.0, 0.18, age) * (1.0 - smoothstep(0.60, 0.82, age));
    float glimmer = (pin * 0.39 + tail * 0.035) * life;
    volume = darkOver(volume, vec3(0.47, 0.48, 0.62), glimmer);
  }

  // A low foreground fold crosses the cavity and hides the back layers.
  // This occlusion is deliberately off-center rather than a dark disc.
  float frontY = -0.17 + 0.36 * q.x + sin(q.x * 5.0 + t * 0.11) * 0.035;
  float frontD = q.y - frontY;
  float front = exp(-sq((frontD + 0.035) / 0.072));
  front *= (1.0 - smoothstep(0.23, 0.39, abs(q.x))) * 0.67;
  float rim = exp(-sq((frontD - 0.023) / 0.006));
  float frontWeave = noise(vec2(q.x * 12.0 + t * 0.05, frontD * 23.0));
  vec3 frontColor = mix(vec3(0.027, 0.030, 0.047), vec3(0.12, 0.11, 0.17), frontWeave * 0.68)
    + vec3(0.19, 0.16, 0.25) * rim * (0.5 + 0.5 * sin(q.x * 12.0 + 1.0));
  volume = darkOver(volume, frontColor, front);

  float bounds = (1.0 - smoothstep(0.48, 0.61, abs(p.x)))
    * (1.0 - smoothstep(0.72, 0.84, abs(p.y)));
  return vec4(volume.rgb / max(volume.a, 0.00001), volume.a * bounds);
}
`,
};
