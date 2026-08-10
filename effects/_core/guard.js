/**
 * _core/guard.js
 * "이 효과를 지금 이 기기에서 켜도 되는가?"를 한 곳에서 판단합니다.
 *
 * 효과마다 따로 구현하면 반드시 하나는 빠뜨립니다.
 * 접근성(prefers-reduced-motion), 배터리(모바일/저사양), 기능 지원(WebGL)을
 * 여기서 한 번만 처리하고 모든 효과가 공유합니다.
 */

const hasWindow = typeof window !== 'undefined';

/** matchMedia를 SSR-safe하게 감쌉니다. */
function mq(query) {
  if (!hasWindow || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(query);
}

/* ------------------------------------------------------------------ *
 * 1. 모션 선호도
 * ------------------------------------------------------------------ */

/** OS에서 "동작 줄이기"를 켠 사용자인지. */
export function prefersReducedMotion() {
  return mq('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

/**
 * 모션 선호도가 "실행 중에" 바뀌는 것까지 감지합니다.
 * (macOS/Windows 접근성 토글은 페이지 새로고침 없이 바뀝니다)
 * @returns {() => void} 구독 해제 함수
 */
export function onReducedMotionChange(handler) {
  const m = mq('(prefers-reduced-motion: reduce)');
  if (!m) return () => {};
  const fn = () => handler(m.matches);
  // Safari 13 이하는 addEventListener가 없습니다.
  if (m.addEventListener) m.addEventListener('change', fn);
  else m.addListener(fn);
  return () => {
    if (m.removeEventListener) m.removeEventListener('change', fn);
    else m.removeListener(fn);
  };
}

/* ------------------------------------------------------------------ *
 * 2. 입력 장치 / 화면
 * ------------------------------------------------------------------ */

/** 손가락/펜처럼 정밀도가 낮은 포인터인지 (= 대부분 모바일). */
export function isCoarsePointer() {
  return mq('(pointer: coarse)')?.matches ?? false;
}

/** 마우스처럼 hover가 가능한 환경인지. */
export function canHover() {
  return mq('(hover: hover)')?.matches ?? true;
}

/** 뷰포트 너비가 기준 미만인지. */
export function isNarrowerThan(px) {
  if (!hasWindow) return false;
  return window.innerWidth < px;
}

/* ------------------------------------------------------------------ *
 * 3. 기능 지원
 * ------------------------------------------------------------------ */

let _webgl = null;

/**
 * WebGL 컨텍스트를 만들 수 있는지. 결과를 캐싱합니다.
 * (캔버스를 매번 만들면 그것 자체가 비쌉니다)
 */
export function supportsWebGL() {
  if (_webgl !== null) return _webgl;
  if (!hasWindow) return (_webgl = false);
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    _webgl = !!gl;
    // 컨텍스트는 개수 제한이 있으므로 즉시 반납합니다.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    _webgl = false;
  }
  return _webgl;
}

/* ------------------------------------------------------------------ *
 * 4. 기기 등급
 * ------------------------------------------------------------------ */

const TIER_RANK = { low: 0, mid: 1, high: 2 };
let _tier = null;

/**
 * 대략적인 성능 등급을 'low' | 'mid' | 'high'로 추정합니다.
 * 정확한 벤치마크가 아니라 "무거운 셰이더를 켤지 말지" 정도의 힌트입니다.
 */
export function deviceTier() {
  if (_tier) return _tier;
  if (!hasWindow) return (_tier = 'mid');

  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4; // Chromium 계열만 제공
  const coarse = isCoarsePointer();

  if (cores <= 4 || memory <= 4 || (coarse && isNarrowerThan(768))) _tier = 'low';
  else if (cores >= 8 && memory >= 8) _tier = 'high';
  else _tier = 'mid';

  return _tier;
}

/**
 * 기기 등급에 맞춰 devicePixelRatio 상한을 정합니다.
 * 레티나에서 dpr=3으로 셰이더를 그리면 픽셀 수가 9배가 됩니다.
 */
export function dprCap(max = 2) {
  if (!hasWindow) return 1;
  const tier = deviceTier();
  const ceiling = tier === 'low' ? 1.5 : tier === 'mid' ? 2 : max;
  return Math.min(window.devicePixelRatio || 1, ceiling, max);
}

/** 기기 등급에 맞춘 권장 fps 상한. 0이면 제한 없음(=주사율 그대로). */
export function fpsCap(preferred = 0) {
  const tier = deviceTier();
  if (tier === 'low') return Math.min(preferred || 30, 30);
  if (tier === 'mid') return preferred || 0;
  return preferred || 0;
}

/* ------------------------------------------------------------------ *
 * 5. 종합 판정
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} GuardSpec
 * @property {'skip'|'ignore'} [motion='skip']
 *   'skip'   → 동작 줄이기 사용자면 효과를 끕니다.
 *   'ignore' → 효과 내부(또는 CSS)에서 알아서 처리하므로 가드하지 않습니다.
 * @property {'any'|'fine'} [pointer='any']
 *   'fine' → 마우스가 있을 때만 켭니다(hover 기반 효과).
 * @property {number} [minWidth=0]  이 너비 미만이면 끕니다.
 * @property {boolean} [webgl=false] WebGL이 필요합니다.
 * @property {'low'|'mid'|'high'} [minTier='low'] 최소 기기 등급.
 */

/**
 * 가드를 평가합니다.
 * opts.guard === false 이면 모든 검사를 건너뜁니다(탈출구).
 *
 * @returns {{ pass: boolean, reason: string }}
 */
export function evaluateGuard(spec = {}, opts = {}) {
  if (opts.guard === false) return { pass: true, reason: '' };

  const {
    motion = 'skip',
    pointer = 'any',
    minWidth = 0,
    webgl = false,
    minTier = 'low',
  } = spec;

  if (motion === 'skip' && prefersReducedMotion()) {
    return { pass: false, reason: 'reduced-motion' };
  }
  if (pointer === 'fine' && !canHover()) {
    return { pass: false, reason: 'coarse-pointer' };
  }
  if (minWidth > 0 && isNarrowerThan(minWidth)) {
    return { pass: false, reason: 'viewport-too-narrow' };
  }
  if (webgl && !supportsWebGL()) {
    return { pass: false, reason: 'no-webgl' };
  }
  if (TIER_RANK[deviceTier()] < TIER_RANK[minTier]) {
    return { pass: false, reason: 'device-tier' };
  }
  return { pass: true, reason: '' };
}

/**
 * 뷰포트 폭 변화를 구독합니다(가드 재평가용).
 * resize는 초당 수십 번 오므로 디바운스합니다.
 */
export function onViewportChange(handler, delay = 200) {
  if (!hasWindow) return () => {};
  let timer = 0;
  const fn = () => {
    clearTimeout(timer);
    timer = setTimeout(handler, delay);
  };
  window.addEventListener('resize', fn, { passive: true });
  window.addEventListener('orientationchange', fn, { passive: true });
  return () => {
    clearTimeout(timer);
    window.removeEventListener('resize', fn);
    window.removeEventListener('orientationchange', fn);
  };
}
