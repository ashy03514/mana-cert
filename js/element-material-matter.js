/* Shared by the material study and the eventual reveal renderer.
 * Sources are WebGL 1 fragment bodies; the host supplies noise and lighting space.
 */
(function () {
  'use strict';

  globalThis.ElementMaterialSources = {
    ...(globalThis.ElementMaterialSources || {}),
    wind: `
      mat2 windTurn(float a) {
        float c = cos(a), s = sin(a);
        return mat2(c, -s, s, c);
      }

      float windDensity(vec3 p, float t) {
        p.x -= p.y * 0.19 + 0.025 * sin(t * 0.48 + p.y * 4.0);
        p.yz = windTurn(-0.35) * p.yz;
        p.xz = windTurn(0.19) * p.xz;
        vec2 oval = p.xy / vec2(0.36, 0.60);
        float angle = atan(oval.y, oval.x);
        float radius = length(oval);
        float curl = 0.055 * sin(angle * 3.0 - t * 0.55)
                   + 0.04 * sin(angle * 5.0 + t * 0.31);
        float thickness = 0.12 + 0.055 * sin(angle * 2.0 - t * 0.4);
        float shell = exp(-sq((radius - 1.0 - curl) / thickness));
        // Unequal nested wisps reveal depth without filling the centre.
        float inner = exp(-sq((radius - 0.76 + curl * 0.6) / (thickness * 0.69)));
        float outer = exp(-sq((radius - 1.17 - curl * 1.2) / (thickness * 0.77)));
        inner *= 0.46 * smoothstep(-0.45, 0.50, sin(angle * 1.7 + t * 0.62));
        outer *= 0.38 * smoothstep(-0.25, 0.65, cos(angle * 2.3 - t * 0.41));
        shell += inner + outer;
        float depth = p.z - 0.10 * sin(angle * 2.0 + t * 0.22);
        shell *= exp(-sq(depth / 0.19));

        // An oblique, hollow volume leaves the sky visible through its centre.
        // Material advects around it in unequal patches, never a solid tube.
        vec2 flow = windTurn(-t * 0.51) * oval;
        float broad = fbm(flow * 2.7 + vec2(p.z * 3.0, p.z * 1.7));
        float fine = noise(vec2(radius * 31.0 + broad * 4.0,
                                sin(angle - t * 0.51) * 6.0 + p.z * 5.0));
        float torn = smoothstep(0.25, 0.65, broad);
        float filaments = 0.30 + 0.70 * smoothstep(0.30, 0.78, fine);
        float opening = 0.18 + 0.82 * smoothstep(-0.65, 0.15, sin(angle + t * 0.12 + 0.7));
        return shell * torn * filaments * opening;
      }

      vec4 windLeaf(vec2 p, float t, float id, out float depth) {
        float seed = hash(id * 19.7 + 2.8);
        float angle = 0.55 + id * 1.83 + seed * 1.5
                    + t * (0.45 + seed * 0.36)
                    + 0.16 * sin(t * 0.92 + id * 2.0);
        float radius = 0.90 + seed * 0.26 + 0.04 * sin(t * 1.1 + id);
        float y = sin(angle) * radius * 0.60
                + 0.045 * sin(t * (1.0 + seed) + id);
        float x = cos(angle) * radius * 0.36 + y * 0.19
                + 0.018 * sin(t * 1.7 + id * 3.1);
        depth = 0.24 * sin(angle * 1.3 + id * 0.6);
        vec2 position = vec2(x - depth * 0.18, y - depth * 0.12);
        vec2 tangent = normalize(vec2(-sin(angle) * 0.36 + cos(angle) * 0.11,
                                      cos(angle) * 0.60));
        float flutter = 0.35 * sin(t * (1.7 + seed) + id * 2.7)
                      + 0.12 * sin(t * 3.1 + id);
        vec2 axis = windTurn(flutter) * tangent;
        vec2 offset = p - position;
        vec2 q = vec2(dot(offset, axis), dot(offset, vec2(-axis.y, axis.x)));
        float halfLength = 0.029 + seed * 0.014;
        float flip = sin(t * (1.4 + seed * 0.8) + id * 2.1);
        float halfWidth = halfLength * (0.35 + seed * 0.08)
                        * (0.15 + 0.85 * abs(flip));
        float along = q.x / halfLength;
        float midrib = halfLength * 0.07 * sin(along * 2.5 + id * 0.4);
        float edge = halfWidth * max(0.0, 1.0 - sq(along))
                   * (0.85 + 0.15 * along);
        float aa = 1.35 / uResolution.x;
        float shape = max(abs(q.x) - halfLength, abs(q.y - midrib) - edge);
        float alpha = 1.0 - smoothstep(-aa, aa, shape);

        // Pigmented surfaces, a shaded fold and a fine midrib stay matte.
        // The narrow silhouette during a turn is an actual projected leaf.
        float side = clamp((q.y - midrib) / max(halfWidth, 0.001), -1.0, 1.0);
        float face = 0.5 + 0.5 * flip;
        vec3 color = mix(vec3(0.26, 0.31, 0.14), vec3(0.48, 0.49, 0.24), face);
        color *= 0.80 + 0.18 * abs(flip) + side * 0.16;
        float centralVein = 1.0 - smoothstep(aa * 0.28, aa * 0.85, abs(q.y - midrib));
        float branches = 1.0 - smoothstep(0.08, 0.24,
                                          abs(sin(along * 11.0 - abs(side) * 3.5)));
        color = mix(color, vec3(0.58, 0.57, 0.30), centralVein * 0.40);
        color += vec3(0.055, 0.050, 0.018) * branches * abs(flip);
        return vec4(color, alpha * 0.97);
      }

      vec4 material(vec2 p, float t) {
        if (abs(p.x) > 0.8 || abs(p.y) > 0.97) return vec4(0.0);
        vec3 accumulated = vec3(0.0);
        float opacity = 0.0;
        float veil = 0.0;

        // Back-to-front slices give the nearer cloud a different speed,
        // brightness and silhouette. No opaque core is used for the air.
        for (int i = 0; i < 13; i++) {
          float z = -0.48 + float(i) * 0.08;
          vec3 samplePoint = vec3(p, z);
          samplePoint.x += z * 0.18;
          samplePoint.y += z * 0.12;
          float density = windDensity(samplePoint, t);
          float rim = windDensity(samplePoint + vec3(-0.035, 0.045, 0.025), t);
          float light = clamp(0.56 + (density - rim) * 2.6 + z * 0.45, 0.2, 1.0);
          vec3 tint = mix(vec3(0.29, 0.46, 0.50), vec3(0.66, 0.80, 0.69), light);
          float a = 1.0 - exp(-density * 0.45);
          accumulated = mix(accumulated, tint, a);
          opacity = a + opacity * (1.0 - a);
          veil += density;
        }

        // A small amount of dust makes acceleration and depth readable. The
        // points are scattered in height and orbit size, with short soft tails.
        for (int i = 0; i < 27; i++) {
          float id = float(i);
          float seed = hash(id * 17.17 + 6.4);
          float speed = 0.10 + seed * 0.13;
          float travel = fract(seed + t * speed);
          float angle = id * 2.39996 + t * (0.64 + seed * 0.7);
          float radius = 0.88 + hash(id * 5.4 + 8.0) * 0.30;
          float y = sin(angle) * radius * 0.60;
          float z = sin(angle * 2.0) * 0.16;
          float x = cos(angle) * radius * 0.36 + y * 0.19;
          vec2 position = vec2(x - z * 0.18, y - z * 0.12);
          vec2 tangent = normalize(vec2(-sin(angle) * 0.36 + cos(angle) * 0.11, cos(angle) * 0.60));
          vec2 offset = p - position;
          float along = dot(offset, tangent);
          float across = dot(offset, vec2(-tangent.y, tangent.x));
          float size = mix(0.0017, 0.0035, smoothstep(-0.4, 0.4, z));
          float grain = exp(-sq(across / size)
                           -sq(along / (size * 2.6)));
          float life = smoothstep(0.0, 0.12, travel) * (1.0 - smoothstep(0.8, 1.0, travel));
          float a = grain * life * mix(0.16, 0.65, smoothstep(-0.35, 0.35, z));
          accumulated = mix(accumulated, vec3(0.75, 0.87, 0.75), a);
          opacity = a + opacity * (1.0 - a);
        }

        // Unequally spaced leaves tumble through the flow. Fog occludes the
        // rear ones; their front/back transition is continuous with depth.
        for (int i = 0; i < 4; i++) {
          float depth = 0.0;
          vec4 leaf = windLeaf(p, t, float(i), depth);
          vec3 behind = accumulated + leaf.rgb * leaf.a * (1.0 - opacity);
          vec3 inFront = mix(accumulated, leaf.rgb, leaf.a);
          accumulated = mix(behind, inFront, smoothstep(-0.08, 0.10, depth));
          opacity = leaf.a + opacity * (1.0 - leaf.a);
        }

        // Keep every edge genuinely translucent over the shared blue-violet sky.
        return vec4(accumulated / max(opacity, 0.0001), opacity);
      }
    `,

    earth: `
      mat2 earthTurn(float a) {
        float c = cos(a), s = sin(a);
        return mat2(c, -s, s, c);
      }

      float earthAssembly(float phase) {
        return smoothstep(0.03, 0.32, phase) * (1.0 - smoothstep(0.79, 1.0, phase));
      }

      float earthRock(vec3 p, vec3 bounds, float seed) {
        // A conservative ellipsoid distance, cut along unequal fracture planes.
        // The low-frequency displacement changes the actual stone silhouette.
        vec3 scaled = p / bounds;
        vec3 squared = scaled * scaled;
        float d = (pow(dot(squared, squared), 0.25) - 1.0)
                * min(bounds.x, min(bounds.y, bounds.z)) * 0.75;
        d = max(d, dot(p, normalize(vec3(0.7, 0.9, 0.35))) - bounds.y * 0.79);
        d = max(d, dot(p, normalize(vec3(-0.95, 0.28, 0.42))) - bounds.x * 0.81);
        d = max(d, dot(p, normalize(vec3(0.24, -0.86, -0.4))) - bounds.y * 0.86);
        d = max(d, dot(p, normalize(vec3(-0.23, 0.35, 1.0))) - bounds.z * 0.88);
        d = max(d, dot(p, normalize(vec3(0.74, 0.19, 0.83))) - bounds.z * 1.02);
        d = max(d, dot(p, normalize(vec3(-0.52, -0.58, 0.74))) - bounds.z * 1.06);
        float fault = sin(p.x * 31.0 + seed) * sin(p.y * 23.0 - seed * 1.7)
                    * sin(p.z * 29.0 + seed * 0.8);
        return d + fault * 0.008;
      }

      vec3 earthMap(vec3 p, float assembly) {
        p.yz = earthTurn(0.13) * p.yz;
        p.xz = earthTurn(-0.23) * p.xz;
        float spread = 1.0 - assembly;
        vec3 distances;
        vec3 q = p - vec3(-0.08, -0.39 - spread * 0.24, 0.06);
        q.xy = earthTurn(-0.16 - spread * 0.08) * q.xy;
        float d0 = earthRock(q, vec3(0.37, 0.235, 0.29), 1.7);

        q = p - vec3(-0.235 - spread * 0.10, -0.005 - spread * 0.34, -0.015);
        q.xy = earthTurn(-0.28 - spread * 0.16) * q.xy;
        q.xz = earthTurn(0.27) * q.xz;
        float d1 = earthRock(q, vec3(0.25, 0.37, 0.26), 4.2);

        q = p - vec3(0.195 + spread * 0.13, 0.10 - spread * 0.47, 0.035);
        q.xy = earthTurn(0.29 + spread * 0.17) * q.xy;
        q.yz = earthTurn(-0.28) * q.yz;
        float d2 = earthRock(q, vec3(0.285, 0.315, 0.235), 7.1);

        q = p - vec3(-0.018 - spread * 0.05, 0.445 - spread * 0.56, -0.035);
        q.xy = earthTurn(0.11 - spread * 0.21) * q.xy;
        q.xz = earthTurn(-0.4) * q.xz;
        float d3 = earthRock(q, vec3(0.255, 0.18, 0.205), 11.8);

        float nearest = d0, second = 10.0, id = 0.0;
        if (d1 < nearest) { second = nearest; nearest = d1; id = 1.0; }
        else { second = d1; }
        if (d2 < nearest) { second = nearest; nearest = d2; id = 2.0; }
        else { second = min(second, d2); }
        if (d3 < nearest) { second = nearest; nearest = d3; id = 3.0; }
        else { second = min(second, d3); }
        return vec3(nearest, id, second);
      }

      vec3 earthNormal(vec3 p, float assembly) {
        vec2 e = vec2(0.003, -0.003);
        return normalize(e.xyy * earthMap(p + e.xyy, assembly).x
                       + e.yyx * earthMap(p + e.yyx, assembly).x
                       + e.yxy * earthMap(p + e.yxy, assembly).x
                       + e.xxx * earthMap(p + e.xxx, assembly).x);
      }

      float earthShadow(vec3 p, vec3 light, float assembly) {
        float shade = 1.0;
        float distanceAlong = 0.018;
        for (int i = 0; i < 9; i++) {
          float distanceToRock = earthMap(p + light * distanceAlong, assembly).x;
          shade = min(shade, 9.0 * distanceToRock / distanceAlong);
          distanceAlong += clamp(distanceToRock, 0.024, 0.11);
        }
        return clamp(shade, 0.1, 1.0);
      }

      vec4 material(vec2 p, float t) {
        if (abs(p.x) > 0.79 || abs(p.y) > 0.96) return vec4(0.0);
        float assembly = earthAssembly(uPhase);
        vec3 color = vec3(0.0);
        float opacity = 0.0;
        float breath = fbm(vec2(p.x * 6.0 + t * 0.06, p.y * 5.0 - t * 0.08));
        float haze = exp(-dot((p - vec2(0.0, -0.42)) * vec2(2.3, 5.0),
                              (p - vec2(0.0, -0.42)) * vec2(2.3, 5.0)));
        haze *= breath * 0.13;
        color = vec3(0.35, 0.25, 0.15) * haze;
        opacity = haze;

        vec3 origin = vec3(p, 0.82);
        vec3 ray = vec3(0.0, 0.0, -1.0);
        float travel = 0.0;
        vec3 hit = vec3(1.0, 0.0, 1.0);
        for (int i = 0; i < 43; i++) {
          hit = earthMap(origin + ray * travel, assembly);
          if (hit.x < 0.0025 || travel > 1.6) break;
          travel += max(hit.x * 0.79, 0.002);
        }
        if (hit.x < 0.0025 && travel < 1.6) {
          vec3 position = origin + ray * travel;
          vec3 normal = earthNormal(position, assembly);
          vec3 light = normalize(vec3(-0.65, 0.9, 1.2));
          float shadow = earthShadow(position + normal * 0.009, light, assembly);
          float diffuse = max(dot(normal, light), 0.0);
          float occlusion = clamp(earthMap(position + normal * 0.045, assembly).x / 0.045, 0.2, 1.0);
          vec2 strataPosition = earthTurn(hit.y * 0.73 - 0.21) * position.xy;
          float mineral = fbm(strataPosition * 10.0 + position.z * 4.3 + hit.y * 7.0);
          float grain = noise(position.xy * 165.0 + position.z * 79.0);
          float strata = noise(vec2(strataPosition.y * 58.0,
                                     strataPosition.x * 8.0 + position.z * 4.0)
                              + fbm(strataPosition * 12.0 + position.z * 5.0) * 2.5);
          strata = smoothstep(0.55, 0.79, strata);
          vec3 rock = mix(vec3(0.17, 0.135, 0.11), vec3(0.48, 0.38, 0.255), mineral);
          rock *= 0.77 + grain * 0.39;
          rock *= 1.0 - strata * 0.17;
          vec3 ambient = vec3(0.29, 0.31, 0.43) * (0.45 + 0.55 * occlusion);
          vec3 surface = rock * (ambient + vec3(1.25, 1.06, 0.78) * diffuse * shadow);
          float rim = pow(1.0 - clamp(normal.z, 0.0, 1.0), 3.0);
          surface += vec3(0.10, 0.12, 0.20) * rim * (0.35 + 0.65 * occlusion);
          // The restrained warm bounce exists only near another rock's face.
          float contact = exp(-max(hit.z, 0.0) * 45.0) * assembly;
          surface += vec3(0.17, 0.068, 0.017) * contact * (0.3 + strata * 0.7);
          color = surface;
          opacity = 1.0;
        }

        // Sand falls from different fractures; the dust stays much finer than
        // the rocks, with varying speed and a few small, heavier chips.
        for (int i = 0; i < 23; i++) {
          float id = float(i);
          float seed = hash(id * 21.73 + 9.1);
          float life = fract(t * (0.14 + seed * 0.12) + seed);
          float fall = life * life;
          float x = (hash(id * 8.17 + 1.3) - 0.5) * 0.86;
          x += sin(life * 4.0 + id) * 0.045;
          float y = 0.28 - fall * 1.14 - (1.0 - assembly) * 0.25;
          float radius = 0.0022 + pow(seed, 4.0) * 0.0045;
          vec2 offset = p - vec2(x, y);
          float dust = exp(-dot(offset * vec2(1.0, 0.7), offset * vec2(1.0, 0.7)) / (radius * radius));
          float a = dust * smoothstep(0.0, 0.07, life) * (1.0 - smoothstep(0.74, 1.0, life)) * 0.62;
          // Front grains pass across the stone; rear grains disappear behind it.
          a *= opacity > 0.99 && seed < 0.63 ? 0.0 : 1.0;
          color = mix(color, vec3(0.58, 0.45, 0.28), a);
          opacity = a + opacity * (1.0 - a);
        }
        return vec4(color / max(opacity, 0.0001), opacity);
      }
    `
  };
})();
