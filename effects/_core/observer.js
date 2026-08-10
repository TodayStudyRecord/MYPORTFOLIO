/**
 * _core/observer.js
 * 애니메이션 루프 + 가시성 자동 일시정지.
 *
 * 핵심 원칙: 화면 밖이거나 탭이 백그라운드면 rAF 루프를 완전히 끊습니다.
 * requestAnimationFrame은 탭이 숨겨지면 알아서 멈추지만,
 * "스크롤로 화면 밖으로 나간 캔버스"는 계속 60fps로 그려집니다.
 * 그게 노트북 배터리를 먹는 주범입니다.
 */

const hasIO = typeof IntersectionObserver !== 'undefined';

/**
 * 요소가 뷰포트에 들어오고 나가는 것을 구독합니다.
 * IntersectionObserver가 없는 환경에서는 "항상 보인다"로 간주합니다.
 *
 * @returns {() => void} 구독 해제 함수
 */
export function observeVisibility(el, { onEnter, onLeave, threshold = 0, rootMargin = '0px' } = {}) {
  // 요소가 속한 창의 생성자를 씁니다. iframe 안의 요소를 바깥 창의
  // IntersectionObserver로 감시하면 뷰포트 기준이 어긋납니다.
  const view = el?.ownerDocument?.defaultView ?? window;
  const IO = view.IntersectionObserver;
  if (!hasIO || !IO) {
    onEnter?.();
    return () => {};
  }
  let visible = null;
  const io = new IO(
    (entries) => {
      for (const entry of entries) {
        const next = entry.isIntersecting;
        if (next === visible) continue; // 중복 호출 방지
        visible = next;
        next ? onEnter?.(entry) : onLeave?.(entry);
      }
    },
    { threshold, rootMargin }
  );
  io.observe(el);
  return () => io.disconnect();
}

/**
 * 프레임 루프.
 *
 * - dt(초)를 넘겨주므로 주사율에 독립적인 애니메이션을 짤 수 있습니다.
 * - fps > 0 이면 그 프레임레이트로 제한합니다(저사양 기기 배터리 절약).
 *   건너뛴 프레임의 dt는 버리지 않고 누적해서 넘기므로 속도가 느려지지 않습니다.
 * - 탭 전환 후 복귀 시 dt가 몇 초로 튀는 것을 0.1초로 잘라냅니다.
 *
 * @param {(dt:number, elapsed:number) => void} tick
 */
export function createLoop(tick, { fps = 0 } = {}) {
  const interval = fps > 0 ? 1 / fps : 0;
  let raf = 0;
  let last = 0;
  let pending = 0;
  let elapsed = 0;
  let running = false;

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    if (!last) {
      last = now;
      return;
    }
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // 탭 복귀 시 점프 방지

    pending += dt;
    if (interval && pending < interval) return;

    elapsed += pending;
    tick(pending, elapsed);
    pending = 0;
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      pending = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      if (!running) return;
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    },
    get running() {
      return running;
    },
    get elapsed() {
      return elapsed;
    },
  };
}

/**
 * createLoop + observeVisibility + 탭 가시성을 하나로 묶은 것.
 * 캔버스/WebGL 효과는 전부 이걸 씁니다.
 *
 * rootMargin 기본값이 넉넉한 이유: 화면에 들어오기 직전에 미리 시작해야
 * 스크롤해서 도달했을 때 이미 애니메이션이 자연스럽게 돌고 있습니다.
 *
 * @param {Element} el 가시성을 감시할 요소
 * @param {(dt:number, elapsed:number) => void} tick
 */
export function createVisibleLoop(el, tick, { fps = 0, threshold = 0, rootMargin = '150px' } = {}) {
  const loop = createLoop(tick, { fps });
  let inView = false;
  let tabVisible = typeof document === 'undefined' || !document.hidden;
  let enabled = true;

  const sync = () => {
    if (enabled && inView && tabVisible) loop.start();
    else loop.stop();
  };

  const unobserve = observeVisibility(el, {
    threshold,
    rootMargin,
    onEnter: () => {
      inView = true;
      sync();
    },
    onLeave: () => {
      inView = false;
      sync();
    },
  });

  const onTab = () => {
    tabVisible = !document.hidden;
    sync();
  };
  document.addEventListener('visibilitychange', onTab);

  return {
    /** 수동 정지(가시성과 무관하게 꺼둡니다). */
    pause() {
      enabled = false;
      sync();
    },
    resume() {
      enabled = true;
      sync();
    },
    get running() {
      return loop.running;
    },
    get elapsed() {
      return loop.elapsed;
    },
    destroy() {
      unobserve();
      document.removeEventListener('visibilitychange', onTab);
      loop.stop();
    },
  };
}

/**
 * 요소 크기 변화 구독. ResizeObserver가 없으면 window resize로 폴백합니다.
 * @returns {() => void} 구독 해제 함수
 */
export function observeResize(el, handler) {
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver((entries) => handler(entries[0]?.contentRect));
    ro.observe(el);
    return () => ro.disconnect();
  }
  const fn = () => handler(el.getBoundingClientRect());
  window.addEventListener('resize', fn, { passive: true });
  return () => window.removeEventListener('resize', fn);
}
