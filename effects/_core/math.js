/**
 * _core/math.js
 * 효과들이 공통으로 쓰는 아주 작은 수학 유틸.
 * 의존성 0. 모든 함수는 순수 함수입니다.
 */

/** v를 [min, max] 범위로 자릅니다. */
export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

/** a에서 b로 t(0~1)만큼 선형 보간. */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 프레임레이트에 독립적인 감쇠 보간.
 *
 * lerp(a, b, 0.1)을 매 프레임 쓰면 120Hz 모니터에서는 2배 빨리 따라갑니다.
 * damp는 dt(초)를 받아 어떤 주사율에서도 같은 속도로 수렴합니다.
 *
 * @param {number} a  현재값
 * @param {number} b  목표값
 * @param {number} lambda 반응 속도(클수록 빠름, 보통 6~14)
 * @param {number} dt 이전 프레임과의 시간차(초)
 */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** [a,b] 구간의 v를 [c,d] 구간으로 옮깁니다. */
export const map = (v, a, b, c, d) => c + ((v - a) / (b - a || 1)) * (d - c);

/** [a,b] 구간에서 v의 진행도(0~1). 범위 밖은 잘립니다. */
export const progress = (v, a, b) => clamp((v - a) / (b - a || 1), 0, 1);

/** CSS 변수에 넣기 좋게 소수점을 줄입니다(리페인트 노이즈 감소). */
export const round = (v, p = 3) => {
  const m = 10 ** p;
  return Math.round(v * m) / m;
};

/** 요소 기준 포인터 위치를 -1~1 좌표계로 변환합니다. (중앙 = 0,0) */
export function pointerToUnit(event, rect) {
  return {
    x: clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
    y: clamp(((event.clientY - rect.top) / rect.height) * 2 - 1, -1, 1),
  };
}

/**
 * '#4f46e5' | '4f46e5' | '#f0a' → [r, g, b] (각 0~1)
 * WebGL 셰이더 uniform으로 바로 넘길 수 있는 형식입니다.
 */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return [0, 0, 0];
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** 함수 호출을 다음 프레임 1회로 합칩니다(resize 핸들러 등). */
export function rafThrottle(fn) {
  let queued = 0;
  let lastArgs = null;
  const wrapped = (...args) => {
    lastArgs = args;
    if (queued) return;
    queued = requestAnimationFrame(() => {
      queued = 0;
      fn(...lastArgs);
    });
  };
  wrapped.cancel = () => {
    if (queued) cancelAnimationFrame(queued);
    queued = 0;
  };
  return wrapped;
}
