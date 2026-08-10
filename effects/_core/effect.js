/**
 * _core/effect.js
 * ─────────────────────────────────────────────────────────────────
 * 이 파일이 이 라이브러리의 심장입니다.
 *
 * 모든 효과는 정확히 같은 모양을 가집니다:
 *
 *     mount(target, options) → { destroy(), update(), items, active }
 *
 * 이 계약 하나 덕분에
 *   · 바닐라 index.html 에서도
 *   · React App.jsx 에서도
 *   · Vue/Svelte 에서도
 * "같은 index.js 파일"을 고쳐 쓰지 않고 그대로 씁니다.
 *
 * defineEffect()는 효과 작성자가 반복해서 짜야 할 것들을 대신 처리합니다:
 *   1. 대상 해석      : 선택자 문자열 / 요소 / NodeList / 배열 모두 허용
 *   2. 옵션 병합      : defaults ← data-fx-* 속성 ← 코드 인자
 *   3. 가드 판정      : 접근성/성능/기능 지원 확인, 실행 중 변화도 재평가
 *   4. 중복 마운트 방지
 *   5. 정리(cleanup)  : 리스너·루프·DOM을 빠짐없이 되돌리기
 *
 * 효과 작성자는 setup(ctx) 안에서 진짜 로직만 쓰면 됩니다.
 */

import { evaluateGuard, onReducedMotionChange, onViewportChange } from './guard.js';

/** el → Map<effectName, handle>. 같은 요소에 같은 효과를 두 번 붙이지 않도록. */
const REGISTRY = new WeakMap();

/* ------------------------------------------------------------------ *
 * 대상 해석
 * ------------------------------------------------------------------ */

/*
 * `instanceof Element`를 쓰지 않는 이유:
 * iframe 안의 요소는 그 iframe의 Element를 상속합니다. 바깥 창에서 만든
 * `Element`와는 다른 생성자라 instanceof가 false가 됩니다(cross-realm).
 * 그러면 mount()가 조용히 아무것도 안 하고 끝납니다 — 원인 찾기가 아주 어렵습니다.
 * nodeType으로 보면 어느 문서의 요소든 똑같이 통과합니다.
 */
const isElement = (n) => !!n && n.nodeType === 1;

function resolveTargets(target, root = document) {
  if (!target) return [];
  if (typeof target === 'string') return Array.from(root.querySelectorAll(target));
  if (isElement(target)) return [target];
  if (typeof target.length === 'number') return Array.from(target).filter(isElement);
  return [];
}

/* ------------------------------------------------------------------ *
 * data-fx-* 속성 파싱
 * ------------------------------------------------------------------ */

const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

/** 문자열을 적절한 JS 타입으로 되돌립니다. */
function parseValue(raw) {
  const v = raw.trim();
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null') return null;
  if (v !== '' && !Number.isNaN(Number(v))) return Number(v);
  if (/^[[{]/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {
      /* JSON이 아니면 문자열로 */
    }
  }
  if (v.includes(',')) return v.split(',').map((s) => parseValue(s));
  return v;
}

/**
 * defaults에 있는 키만 data-fx-*에서 읽습니다.
 * (아무 속성이나 옵션으로 받아들이면 오타가 조용히 무시됩니다)
 *
 * 예: defaults = { maxTilt: 12 }  →  data-fx-max-tilt="20"
 *
 * **효과 이름이 붙은 속성이 우선입니다**: `data-fx-scramble-duration` 처럼요.
 * 한 요소에 효과가 둘이면(`data-fx="scramble reveal"`) 둘 다 duration을 갖는데,
 * 같은 `data-fx-duration`에 실으면 HTML 중복 속성 규칙상 **첫 값만 남아**
 * 다른 효과의 값을 덮었습니다. 이름 접두사가 그 충돌을 없앱니다.
 */
function readDataOptions(el, defaults, name) {
  const out = {};
  for (const key of Object.keys(defaults)) {
    const scoped = name ? `data-fx-${name}-${kebab(key)}` : null;
    const attr = `data-fx-${kebab(key)}`;
    if (scoped && el.hasAttribute(scoped)) out[key] = parseValue(el.getAttribute(scoped));
    else if (el.hasAttribute(attr)) out[key] = parseValue(el.getAttribute(attr));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * defineEffect
 * ------------------------------------------------------------------ */

/**
 * @typedef {object} EffectContext
 * @property {Element} el          효과가 붙은 요소
 * @property {object}  opts        최종 병합된 옵션
 * @property {string}  name        효과 이름
 * @property {Function} on         자동 해제되는 addEventListener
 * @property {Function} addCleanup 해제 시 실행할 함수 등록
 * @property {Function} setVar     el에 CSS 변수 설정
 * @property {Function} emit       fx:<name>:<type> 커스텀 이벤트 발행
 */

/**
 * @param {object} def
 * @param {string} def.name            효과 이름(=CSS 클래스 fx-<name>)
 * @param {object} [def.defaults]      기본 옵션
 * @param {import('./guard.js').GuardSpec} [def.guard] 가드 규칙
 * @param {(ctx: EffectContext) => ({destroy?: Function}|void)} def.setup
 * @returns {(target: any, options?: object) => object} mount 함수
 */
export function defineEffect(def) {
  const { name, defaults = {}, guard = {}, setup } = def;
  if (!name || typeof setup !== 'function') {
    throw new Error('[fx] defineEffect: name과 setup은 필수입니다.');
  }

  function mountOne(el, options) {
    let store = REGISTRY.get(el);
    if (!store) REGISTRY.set(el, (store = new Map()));
    // 이미 붙어 있으면 그대로 돌려줍니다(React StrictMode 이중 마운트 안전).
    if (store.has(name)) return store.get(name);

    const opts = Object.assign({}, defaults, readDataOptions(el, defaults, name), options);

    let cleanups = [];
    let api = null;
    let active = false;

    /*
     * 마커 클래스가 이미 HTML에 적혀 있었는지 기록합니다.
     *
     * 왜 필요한가: flip-card처럼 구조 자체를 CSS로 잡는 효과는 사용자가
     * HTML에 .fx-flip-card를 직접 씁니다. 그런데 defineEffect도 같은 이름의
     * 클래스를 붙입니다(fx-<name>). 이때 destroy()에서 무심코 지우면
     * 사용자가 쓴 구조 클래스까지 사라져 레이아웃이 무너집니다.
     * → 우리가 붙인 것만 우리가 지웁니다.
     */
    const ownedMarker = !el.classList.contains(`fx-${name}`);
    const ownedBase = !el.classList.contains('fx');

    const ctx = {
      el,
      opts,
      name,
      /** 해제 시 자동으로 removeEventListener 됩니다. */
      on(target, type, handler, listenerOpts) {
        target.addEventListener(type, handler, listenerOpts);
        cleanups.push(() => target.removeEventListener(type, handler, listenerOpts));
        return handler;
      },
      addCleanup(fn) {
        if (typeof fn === 'function') cleanups.push(fn);
      },
      setVar(key, value) {
        el.style.setProperty(key, value);
      },
      emit(type, detail) {
        el.dispatchEvent(new CustomEvent(`fx:${name}:${type}`, { detail, bubbles: true }));
      },
    };

    function activate() {
      if (active) return;
      active = true;
      el.classList.add(`fx-${name}`);
      try {
        api = setup(ctx) || {};
      } catch (err) {
        active = false;
        el.classList.remove(`fx-${name}`);
        console.error(`[fx:${name}] setup 실패`, err);
      }
    }

    function deactivate() {
      if (!active) return;
      active = false;
      // 등록 역순으로 정리하는 편이 안전합니다.
      for (const fn of cleanups.reverse()) {
        try {
          fn();
        } catch (err) {
          console.warn(`[fx:${name}] cleanup 오류`, err);
        }
      }
      cleanups = [];
      try {
        api?.destroy?.();
      } catch (err) {
        console.warn(`[fx:${name}] destroy 오류`, err);
      }
      api = null;
      if (ownedMarker) el.classList.remove(`fx-${name}`);
    }

    /**
     * 가드를 다시 평가합니다.
     * 사용자가 도중에 "동작 줄이기"를 켜거나 창을 좁히면 즉시 반영됩니다.
     */
    function evaluate() {
      const verdict = evaluateGuard(guard, opts);
      if (verdict.pass) {
        el.classList.remove('fx-inert');
        delete el.dataset.fxSkipped;
        activate();
      } else {
        deactivate();
        el.classList.add('fx-inert');
        el.dataset.fxSkipped = verdict.reason; // 디버깅용: 왜 꺼졌는지 DOM에 남습니다
      }
    }

    el.classList.add('fx');
    evaluate();

    const unwatchMotion = onReducedMotionChange(evaluate);
    // minWidth 가드가 있을 때만 resize를 구독합니다(불필요한 리스너 방지).
    const unwatchViewport = guard.minWidth ? onViewportChange(evaluate) : () => {};

    const handle = {
      name,
      el,
      get active() {
        return active;
      },
      /** setup()이 반환한 효과별 API (없으면 null). 예: flip-card의 flip() */
      get api() {
        return api;
      },
      /** 옵션을 바꾸고 효과를 재시작합니다. */
      update(next = {}) {
        Object.assign(opts, next);
        if (active) {
          deactivate();
          activate();
        }
        return handle;
      },
      destroy() {
        unwatchMotion();
        unwatchViewport();
        deactivate();
        if (ownedBase) el.classList.remove('fx');
        el.classList.remove('fx-inert');
        delete el.dataset.fxSkipped;
        store.delete(name);
      },
    };

    store.set(name, handle);
    return handle;
  }

  /**
   * mount(target, options)
   *
   * target: '.card' | element | NodeList | Element[]
   * 반환값은 항상 같은 모양이라 요소가 1개든 20개든 똑같이 다룹니다.
   */
  function mount(target, options = {}) {
    const els = resolveTargets(target, options.root || document);
    const items = els.map((el) => mountOne(el, options));

    if (!items.length && typeof target === 'string') {
      console.warn(`[fx:${name}] "${target}"에 해당하는 요소가 없습니다.`);
    }

    return {
      name,
      items,
      /** 편의: 첫 번째 요소 */
      el: items[0]?.el ?? null,
      /** 편의: 첫 번째 요소의 효과별 API */
      get api() {
        return items[0]?.api ?? null;
      },
      get active() {
        return items.some((h) => h.active);
      },
      update(next) {
        items.forEach((h) => h.update(next));
        return this;
      },
      // 화살표 함수로 두어 `const { destroy } = mount(...)` 해도 안전합니다.
      destroy: () => items.forEach((h) => h.destroy()),
    };
  }

  mount.effectName = name;
  mount.defaults = defaults;
  return mount;
}

/** 특정 요소에 붙은 효과 핸들을 찾습니다(디버깅/외부 제어용). */
export function getEffect(el, name) {
  return REGISTRY.get(el)?.get(name) ?? null;
}

/** 한 요소에 붙은 모든 효과를 해제합니다. */
export function destroyAll(el) {
  const store = REGISTRY.get(el);
  if (!store) return;
  for (const handle of Array.from(store.values())) handle.destroy();
}
