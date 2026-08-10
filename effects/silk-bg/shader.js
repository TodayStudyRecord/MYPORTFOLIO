/**
 * silk-bg / shader.js
 * GLSL을 별도 파일로 뺀 이유: index.js를 읽을 때 로직과 셰이더가 섞이지 않게 하려고.
 * 셰이더만 갈아끼우면 완전히 다른 배경이 됩니다.
 */

/**
 * 전체 화면 삼각형. OGL의 Triangle 지오메트리는
 * position(vec2, 클립 공간)과 uv(vec2)를 제공합니다.
 */
export const VERT = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

/**
 * 도메인 워핑(domain warping) fbm 그라디언트.
 *
 * 원리:
 *   1. 값 노이즈(value noise)를 여러 옥타브 쌓아 fbm을 만듭니다.
 *   2. 그 fbm 결과로 좌표 자체를 왜곡시킵니다(= 도메인 워핑).
 *   3. 왜곡된 좌표로 다시 fbm을 뽑습니다.
 *   → 단순한 구름 무늬가 비단이 흐르는 듯한 결로 바뀝니다.
 *
 * 왜 값 노이즈인가:
 *   심플렉스 노이즈가 더 예쁘지만 코드가 3배 길고, 5옥타브 × 도메인 워핑이면
 *   모바일 GPU에서 프레임이 떨어집니다. 배경으로 흐릿하게 깔리는 용도라
 *   값 노이즈로 충분하고, 성능 차이는 큽니다.
 */
export const FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec2  uResolution;
  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;
  uniform float uScale;
  uniform float uSwirl;
  uniform float uGrain;
  uniform vec2  uMouse;
  uniform float uAlpha;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // smoothstep 보간 — 격자 경계가 보이지 않게 합니다
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    // 2.02는 일부러 2.0이 아닙니다. 정확히 2배씩 키우면
    // 옥타브들의 격자가 정렬돼서 규칙적인 무늬가 보입니다.
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // 화면 비율 보정 — 이게 없으면 세로가 긴 화면에서 무늬가 늘어납니다
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0) * uScale;
    p += uMouse;

    float t = uTime;

    // 1단계 워핑
    vec2 q = vec2(
      fbm(p + vec2(0.0, t * 0.15)),
      fbm(p + vec2(5.2, 1.3) - t * 0.10)
    );

    // 2단계 워핑 — 여기서 "흐르는 결"이 생깁니다
    vec2 r = vec2(
      fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.12),
      fbm(p + 4.0 * q + vec2(8.3, 2.8) - t * 0.09)
    );

    float f = clamp(fbm(p + uSwirl * r) * 1.15, 0.0, 1.0);

    vec3 col = mix(uColor1, uColor2, smoothstep(0.15, 0.72, f));
    col = mix(col, uColor3, smoothstep(0.50, 1.05, length(r) * 0.75));

    // 미세 그레인 — 8비트 그라디언트에서 생기는 밴딩(줄무늬)을 없앱니다.
    // 이 한 줄이 있고 없고가 "무료 템플릿"과 "제대로 만든 것"의 차이를 만듭니다.
    col += (hash(vUv * uResolution) - 0.5) * uGrain;

    gl_FragColor = vec4(col, uAlpha);
  }
`;
