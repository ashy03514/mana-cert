/* Procedural fluid materials. Shared noise, backdrop and uniforms live in the host. */
globalThis.ElementMaterialSources = {
  ...(globalThis.ElementMaterialSources || {}),
  fire: `
// Twelve depth slices keep three interleaved flame fronts translucent.
vec4 material(vec2 p, float t) {
  // The source stays at y=-.66. Never scale p: folds, rising flow and embers
  // keep their world-space size while more fuel starts burning around it.
  float ignition = clamp(uFormation, 0.0, 1.0);
  bool manaFed = uFirePower >= 0.0;
  float power = clamp(uFirePower, 0.0, 1.0);
  // A keeps the established full flame. S and SS open additional fuel beds
  // in world space, rather than magnifying an already finished silhouette.
  float rankFuel = clamp((uFirePower - 1.0) * 0.5, 0.0, 1.0);
  float fuelSpread = pow(power, 0.84);
  float overdrive = smoothstep(0.76, 1.0, power);
  float centerFuel = smoothstep(0.0, 0.72, ignition);
  float leftFuel = smoothstep(0.16, 0.86, ignition);
  float rightFuel = smoothstep(0.30, 1.0, ignition);
  if (manaFed) {
    // One connected wick first. Adjacent fuel starts burning at different
    // strengths, so the silhouette gains new tongues instead of zooming.
    centerFuel *= mix(0.28, 1.0, fuelSpread);
    leftFuel *= smoothstep(0.10, 0.64, power);
    rightFuel *= smoothstep(0.23, 0.82, power);
  }
  float growing = sin(ignition * 3.14159265);
  if (!manaFed && (abs(p.x) > 0.80 || p.y < -0.86 || p.y > 1.24)) return vec4(0.0);
  if (manaFed && (abs(p.x) > 1.50 || p.y < -0.86 || p.y > 2.25)) return vec4(0.0);
  float height = (p.y + 0.66) / 1.37;
  float top = 1.0 - smoothstep(0.73, 0.89, p.y);
  if (manaFed) top = 1.0 - smoothstep(1.02 + rankFuel * 0.83, 1.22 + rankFuel * 0.88, p.y);
  vec3 sum = vec3(0.0);
  float alpha = 0.0;
  float h = clamp(height, 0.0, 1.0);
  float lean = (fbm(vec2(p.y * 2.6 - t * 0.37, t * 0.21)) - 0.5)
    * (0.07 + 0.33 * h);
  float leftHeight = clamp((p.y + 0.66) / (0.97 + noise(vec2(t * 0.91, 6.4)) * 0.57), 0.0, 1.0);
  float rightHeight = clamp((p.y + 0.66) / (0.91 + noise(vec2(t * 0.73, 19.2)) * 0.63), 0.0, 1.0);
  float centerHeight = clamp((p.y + 0.66) / (1.16 + noise(vec2(t * 0.84, 31.8)) * 0.48), 0.0, 1.0);
  if (manaFed) {
    float born = smoothstep(0.0, 0.82, ignition);
    // Height is a gas travel distance above the fixed source, not a scaled
    // coordinate system. Fold wavelengths and ember sizes stay independent.
    float seedMotion = 1.0 - smoothstep(0.0, 0.36, power);
    float centerReach = (0.27 + fuelSpread * 1.32 + overdrive * 0.16 + rankFuel * 1.18)
      * (0.91 + noise(vec2(t * 0.84, 31.8)) * 0.20);
    // The small wick needs its own gas rhythm: using the full flame's height
    // fraction here made its tip almost immobile even while its texture rose.
    centerReach += seedMotion * (sin(t * 3.3 + 1.1) * 0.027 + sin(t * 5.2 - 0.8) * 0.016);
    float leftReach = (0.16 + fuelSpread * 1.24 + overdrive * 0.22 + rankFuel * 1.08)
      * (0.86 + noise(vec2(t * 0.91, 6.4)) * 0.27);
    float rightReach = (0.14 + fuelSpread * 1.16 + overdrive * 0.30 + rankFuel * 1.25)
      * (0.86 + noise(vec2(t * 0.73, 19.2)) * 0.29);
    centerHeight = clamp((p.y + 0.66) / (centerReach * mix(0.55, 1.0, born)), 0.0, 1.0);
    leftHeight = clamp((p.y + 0.66) / (leftReach * mix(0.45, 1.0, born)), 0.0, 1.0);
    rightHeight = clamp((p.y + 0.66) / (rightReach * mix(0.40, 1.0, born)), 0.0, 1.0);
    lean *= mix(0.10, 1.18, fuelSpread);
  } else if (ignition < 1.0) {
    // Hot gas reaches the upper flame after its source ignites. Each tongue
    // surges and relaxes separately rather than enlarging a shared silhouette.
    float travel = max(0.0, p.y + 0.66) * 0.15;
    float centerRise = smoothstep(0.0, 0.84, ignition - travel);
    float leftRise = smoothstep(0.16, 0.84, ignition - travel);
    float rightRise = smoothstep(0.30, 0.84, ignition - travel);
    float centerSurge = 1.0 + growing * 0.17 * sin(t * 13.0 - p.y * 5.0);
    float leftSurge = 1.0 + growing * 0.22 * sin(t * 11.4 - p.y * 4.0 + 1.8);
    float rightSurge = 1.0 + growing * 0.19 * sin(t * 14.1 - p.y * 5.6 + 3.7);
    float established = smoothstep(0.80, 1.0, ignition);
    centerHeight = mix(clamp((p.y + 0.66) / (mix(0.22, 1.16 + noise(vec2(t * 0.84, 31.8)) * 0.48, centerRise) * centerSurge), 0.0, 1.0), centerHeight, established);
    leftHeight = mix(clamp((p.y + 0.66) / (mix(0.16, 0.97 + noise(vec2(t * 0.91, 6.4)) * 0.57, leftRise) * leftSurge), 0.0, 1.0), leftHeight, established);
    rightHeight = mix(clamp((p.y + 0.66) / (mix(0.14, 0.91 + noise(vec2(t * 0.73, 19.2)) * 0.63, rightRise) * rightSurge), 0.0, 1.0), rightHeight, established);
  }
  float leftCenter = -0.17 + lean * 0.85
    + (noise(vec2(p.y * 5.4 - t * 0.96, 6.2)) - 0.5) * 0.39 * leftHeight;
  float rightCenter = 0.20 + lean * 0.65
    + (noise(vec2(p.y * 4.6 - t * 0.91, 19.4)) - 0.5) * 0.42 * rightHeight;
  float center = lean * 1.30 + 0.025
    + sin(p.y * 7.3 - t * 3.1) * h * 0.065;
  if (manaFed) {
    leftCenter = -mix(0.035, 0.235, fuelSpread) - rankFuel * 0.24 + lean * 0.85
      + (noise(vec2(p.y * 5.4 - t * 0.96, 6.2)) - 0.5) * mix(0.05, 0.46, power) * leftHeight;
    rightCenter = mix(0.030, 0.255, fuelSpread) + rankFuel * 0.25 + lean * 0.65
      + (noise(vec2(p.y * 4.6 - t * 0.91, 19.4)) - 0.5) * mix(0.05, 0.49, power) * rightHeight;
    center = lean * 1.30 + 0.006
      + sin(p.y * 7.3 - t * 3.1) * h * mix(0.018, 0.095, power);
    float seedMotion = 1.0 - smoothstep(0.0, 0.36, power);
    float tipFreedom = smoothstep(0.10, 0.94, centerHeight);
    center += seedMotion * tipFreedom * (sin(t * 2.7 - centerHeight * 1.4) * 0.047
      + sin(t * 4.3 + centerHeight * 2.1 + 0.6) * 0.019);
  }
  // Outer tongues grow from separate, unequal fuel plumes. They curl and
  // shed gas independently of the original three central fronts.
  float outerLeftReach = (1.15 + rankFuel * 1.37)
    * (0.88 + noise(vec2(t * 0.67, 43.7)) * 0.24);
  float outerRightReach = (1.10 + rankFuel * 1.43)
    * (0.86 + noise(vec2(t * 0.79, 57.2)) * 0.28);
  float outerLeftHeight = clamp((p.y + 0.66) / outerLeftReach, 0.0, 1.0);
  float outerRightHeight = clamp((p.y + 0.66) / outerRightReach, 0.0, 1.0);
  float outerLeftCenter = -0.42 - rankFuel * 0.36 + lean * 0.70
    + sin(p.y * 4.3 - t * 1.8 + 1.9) * outerLeftHeight * 0.12;
  float outerRightCenter = 0.44 + rankFuel * 0.35 + lean * 0.55
    + sin(p.y * 4.8 - t * 2.1 + 4.3) * outerRightHeight * 0.14;
  float rising = p.y * 3.0 - t * 1.14;
  if (top > 0.001 && abs(p.x) < (manaFed ? 0.78 + rankFuel * 0.65 : 0.65)) {
  for (int i = 0; i < 12; i++) {
    float z = -0.25 + (float(i) + 0.5) * 0.04167;
    // Sample the small wick's actual shallow volume too. Fixed wide spacing
    // would miss its core and leave only a dim two-slice fleck at zero mana.
    if (manaFed) z *= mix(0.28, 1.0, fuelSpread);
    vec2 flow = vec2((p.x - lean) * 5.8 + z * 2.7, rising - z * 1.8);
    float folds = fbm(flow + vec2(
      noise(flow * 0.61 + vec2(8.0, -t * 0.19)),
      noise(flow * 0.74 + vec2(-3.0, t * 0.16))) * 1.35);
    float fine = noise(flow * 3.6 + vec2(z * 7.0, -t * 0.62));
    float leftRadius = max(0.018, 0.267 * (1.0 - pow(leftHeight, 0.80)));
    float rightRadius = max(0.018, 0.258 * (1.0 - pow(rightHeight, 0.83)));
    float centerRadius = max(0.018, 0.276 * (1.0 - pow(centerHeight, 0.82)));
    if (manaFed) {
      float born = smoothstep(0.0, 0.82, ignition);
      leftRadius = max(0.010, (mix(0.030, 0.278, fuelSpread) + rankFuel * 0.18) * (1.0 - pow(leftHeight, 0.80))) * mix(0.18, 1.0, leftFuel);
      rightRadius = max(0.010, (mix(0.028, 0.270, fuelSpread) + rankFuel * 0.19) * (1.0 - pow(rightHeight, 0.83))) * mix(0.18, 1.0, rightFuel);
      centerRadius = max(0.010, (mix(0.070, 0.304, fuelSpread) + rankFuel * 0.15) * (1.0 - pow(centerHeight, 0.82))) * mix(0.52, 1.0, born);
    } else if (ignition < 1.0) {
      leftRadius *= mix(0.10, 1.0, leftFuel);
      rightRadius *= mix(0.10, 1.0, rightFuel);
      centerRadius *= mix(0.22, 1.0, centerFuel);
    }
    float frontLeft = 1.40 - length(vec2(p.x - leftCenter, z * 1.18)) / leftRadius;
    float frontRight = 1.36 - length(vec2(p.x - rightCenter, z * 1.12)) / rightRadius;
    float frontCenter = 1.42 - length(vec2(p.x - center, z)) / centerRadius;
    float outerLeftRadius = max(0.012, (0.12 + rankFuel * 0.22) * (1.0 - pow(outerLeftHeight, 0.78)));
    float outerRightRadius = max(0.012, (0.13 + rankFuel * 0.21) * (1.0 - pow(outerRightHeight, 0.81)));
    float frontOuterLeft = 1.39 - length(vec2(p.x - outerLeftCenter, z * 1.15)) / outerLeftRadius;
    float frontOuterRight = 1.37 - length(vec2(p.x - outerRightCenter, z * 1.10)) / outerRightRadius;
    float rootFuel = 0.0;
    float bed = smoothstep(0.18, 0.82, ignition);
    if (manaFed) bed *= smoothstep(0.13, 0.70, power);
    float rootFlow = 1.0 - smoothstep(-0.52, -0.22, p.y);
    if (p.y < -0.22) {
      // Close each burning column with its own 3D root, not a common 2D
      // silhouette. Front/back slices thin out at different heights. The same
      // advected folds that shape the tongues also roll through the underside.
      float curl = ((folds - 0.5) * 0.080 + (fine - 0.5) * 0.028)
        * rootFlow * mix(0.22, 1.0, centerFuel);
      float centerDepth = mix(0.045, 0.255, centerFuel);
      float leftDepth = mix(0.045, 0.270, leftFuel);
      float rightDepth = mix(0.045, 0.245, rightFuel);
      float centerRoot = max(0.0, (-0.66 + centerDepth * 1.06 - p.y + curl) / centerDepth);
      float leftRoot = max(0.0, (-0.61 + leftDepth * 0.95 - p.y + curl * 0.80) / leftDepth);
      float rightRoot = max(0.0, (-0.59 + rightDepth * 0.95 - p.y - curl * 0.65) / rightDepth);
      if (manaFed) {
        centerDepth = mix(0.046, 0.245, fuelSpread);
        leftDepth = mix(0.040, 0.255, fuelSpread);
        rightDepth = mix(0.040, 0.240, fuelSpread);
        // Fuel opens above the same root. Higher mana never pushes a larger
        // underside down into the numeric readout beneath the flame.
        centerRoot = max(0.0, (-0.66 + centerDepth * 1.35 - p.y + curl * 0.65) / centerDepth);
        leftRoot = max(0.0, (-0.66 + leftDepth * 1.34 - p.y + curl * 0.55) / leftDepth);
        rightRoot = max(0.0, (-0.66 + rightDepth * 1.32 - p.y - curl * 0.48) / rightDepth);
      }
      frontCenter = 1.42 - length(vec3((p.x - center) / centerRadius, z / centerRadius, centerRoot));
      frontLeft = 1.40 - length(vec3((p.x - leftCenter) / leftRadius, z * 1.18 / leftRadius, leftRoot));
      frontRight = 1.36 - length(vec3((p.x - rightCenter) / rightRadius, z * 1.12 / rightRadius, rightRoot));
      // The columns share a connected bed of burning gas. Its full depth and
      // rounded underside contribute light; it never clips the flame above it.
      rootFuel = 1.70 - length(vec3((p.x - lean * 0.35) / mix(0.09, 0.31, bed),
        z / mix(0.055, 0.25, bed), (p.y + 0.29 - curl) / 0.29));
      if (manaFed) {
        float rootDepth = mix(0.055, 0.145, fuelSpread);
        rootFuel = 1.70 - length(vec3((p.x - lean * 0.35) / (mix(0.055, 0.35, fuelSpread) + rankFuel * 0.45),
          z / mix(0.045, 0.25, fuelSpread), (p.y + 0.66 - rootDepth * 1.70 - curl * 0.45) / rootDepth));
        float outerRoot = max(0.0, (-0.66 + 0.235 * 1.34 - p.y + curl * 0.48) / 0.235);
        frontOuterLeft = 1.39 - length(vec3((p.x - outerLeftCenter) / outerLeftRadius, z * 1.15 / outerLeftRadius, outerRoot));
        frontOuterRight = 1.37 - length(vec3((p.x - outerRightCenter) / outerRightRadius, z * 1.10 / outerRightRadius, outerRoot));
      }
    }
    if (manaFed) {
      frontCenter -= smoothstep(0.86, 1.0, centerHeight) * 2.0;
      frontLeft -= smoothstep(0.86, 1.0, leftHeight) * 2.0;
      frontRight -= smoothstep(0.86, 1.0, rightHeight) * 2.0;
    }
    float envelope = max(frontCenter, max(frontLeft - (1.0 - leftFuel) * 2.0,
      frontRight - (1.0 - rightFuel) * 2.0));
    if (manaFed && rankFuel > 0.0) {
      frontOuterLeft -= smoothstep(0.85, 1.0, outerLeftHeight) * 2.0;
      frontOuterRight -= smoothstep(0.85, 1.0, outerRightHeight) * 2.0;
      float outerFuel = smoothstep(0.0, 0.52, rankFuel);
      envelope = max(envelope, max(frontOuterLeft, frontOuterRight) - (1.0 - outerFuel) * 2.0);
    }
    // As the fuel connects, the underside belongs to one continuous gas
    // volume; the individual columns emerge from it higher up.
    envelope = mix(envelope, rootFuel, rootFlow * bed);
    float tongues = folds * (0.40 + h * 1.35) + fine * 0.25;
    if (manaFed) tongues *= mix(0.65, 1.0, fuelSpread);
    // The connected source has a steady hot interior. Carry smaller rolling
    // variations through it, so large upper tongues cannot hollow out its arc.
    tongues = mix(tongues, 0.24 + (folds - 0.5) * 0.12 + fine * 0.08, rootFlow * bed);
    float density = max(0.0, envelope - tongues);
    float holes = noise(flow * vec2(1.15, 1.8) + vec2(z * 13.0, -t * 0.4));
    density *= 1.0 - smoothstep(0.55, 0.82, holes) * smoothstep(0.13, 0.56, h) * 0.90;
    if (manaFed) {
      // Extra hot fingers run between deeper turbulent channels at high mana.
      float veins = noise(flow * vec2(1.6, 0.85) + vec2(5.7, -t * 0.22));
      density *= 1.0 + overdrive * smoothstep(0.42, 0.80, veins) * 0.42;
    }
    // Cooler air curls into the fuel from below, leaving translucent orange
    // folds between hotter filaments rather than a solid glowing bowl.
    density *= 1.0 - rootFlow * smoothstep(0.35, 0.76, folds + fine * 0.18) * 0.22 * centerFuel;
    density *= top;
    // A concentrated ignition source stays luminous despite occupying fewer
    // depth slices; additional fuel broadens it rather than fading it in.
    float opacity = 1.0 - exp(-density * 1.31 * mix(1.85, 1.0, centerFuel));
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
    * smoothstep(0.38, 0.68, smokeNoise) * 0.15 * smoothstep(0.32, 1.0, uFormation);
  if (manaFed) smoke *= smoothstep(0.15, 0.75, power);
  sum += (1.0 - alpha) * vec3(0.125, 0.104, 0.14) * smoke;
  alpha += (1.0 - alpha) * smoke;
  // Very restrained local bounce; the volume itself carries the silhouette.
  float bounce = exp(-dot(p - vec2(0.0, -0.42), p - vec2(0.0, -0.42)) * 16.0)
    * 0.055 * mix(alpha, 1.0, smoothstep(-0.42, -0.22, p.y)) * mix(0.06, 1.0, centerFuel);
  if (manaFed) bounce *= mix(0.06, 1.22, power);
  sum += (1.0 - alpha) * vec3(0.74, 0.19, 0.025) * bounce;
  alpha += (1.0 - alpha) * bounce;
  // Embers leave the hot body, drift upward at unequal speeds and cool.
  // They sit outside the flame mask so they can clear the tips.
  for (int i = 0; i < 30; i++) {
    if (!manaFed && i >= 11) break;
    float id = float(i) + 1.0;
    float seed = hash(id * 13.7);
    float age = fract(t * (0.22 + seed * 0.14) + hash(id * 8.9));
    float x = (hash(id * 5.3) - 0.5) * 0.51;
    x += sin(age * 5.4 + id * 2.1) * age * 0.105;
    x += sin(t * 0.67 + id) * age * 0.035;
    float y = -0.20 + age * 1.36;
    if (manaFed) {
      x *= mix(0.26, 1.30, fuelSpread) + rankFuel * 1.55;
      y = mix(-0.43, -0.18, fuelSpread) + age * (mix(0.50, 1.40, fuelSpread) + rankFuel * 0.86);
    }
    vec2 delta = p - vec2(x, y);
    float radius = 0.0036 + seed * 0.0037;
    if (manaFed) radius *= mix(0.58, 1.18, power);
    float pin = exp(-sq(delta.x / radius) - sq(delta.y / (radius * 1.65)));
    float halo = exp(-dot(delta, delta) / (radius * radius * 13.0)) * 0.13;
    float life = smoothstep(0.0, 0.13, age) * (1.0 - smoothstep(0.67, 1.0, age));
    float ember = min(0.91, (pin + halo) * life * (0.69 + 0.20 * seed))
      * smoothstep(0.28 + seed * 0.20, 0.72 + seed * 0.20, uFormation);
    if (manaFed) ember *= clamp(mix(0.15, 20.0, pow(power, 1.18)) + rankFuel * 10.0 - float(i), 0.0, 1.0);
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
