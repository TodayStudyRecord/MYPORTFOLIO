/**
 * _core/loader.js
 * 무거운 3D 라이브러리를 "실제로 필요한 순간에" 딱 한 번만 불러옵니다.
 *
 * 왜 중요한가:
 *   silk-bg 하나 때문에 OGL 8KB를 초기 번들에 넣으면,
 *   그 효과를 안 쓰는 페이지도 8KB를 냅니다.
 *   여기서 동적 import를 쓰면 효과가 마운트될 때만 네트워크 요청이 나갑니다.
 *
 * 바닐라(빌드 없음)와 번들러(Vite/webpack) 양쪽에서 동작하도록
 * 전체 URL을 동적 import 하고, 번들러에는 건드리지 말라고 표시합니다.
 */

/**
 * CDN 주소. 버전은 메이저만 고정해 두었습니다(자동으로 최신 패치 사용).
 * 실무 배포에서는 setCDN()으로 정확한 버전을 못 박는 것을 권장합니다.
 */
export const CDN = {
  ogl: 'https://cdn.jsdelivr.net/npm/ogl@1/+esm',
  three: 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
  modelViewer: 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4/dist/model-viewer.min.js',
};

/**
 * CDN 주소를 갈아끼웁니다.
 * 예) 사내망/오프라인 데모: setCDN({ ogl: '/vendor/ogl.js' })
 * 예) 버전 고정: setCDN({ ogl: 'https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm' })
 */
export function setCDN(overrides = {}) {
  Object.assign(CDN, overrides);
}

const moduleCache = new Map();
const scriptCache = new Map();

/**
 * ES 모듈을 URL에서 한 번만 불러옵니다(동시 호출도 요청 1회).
 * 실패하면 캐시에서 지워서 다음 시도가 재요청하도록 합니다.
 */
export function loadModule(url) {
  if (moduleCache.has(url)) return moduleCache.get(url);
  // @vite-ignore: Vite가 이 URL을 사전 번들링하려다 실패하는 것을 막습니다.
  const p = import(/* @vite-ignore */ /* webpackIgnore: true */ url).catch((err) => {
    moduleCache.delete(url);
    throw new Error(`[fx] 모듈 로드 실패: ${url}\n${err.message}`);
  });
  moduleCache.set(url, p);
  return p;
}

/**
 * 커스텀 엘리먼트처럼 "전역에 등록되는" 스크립트를 불러옵니다.
 * (model-viewer가 여기 해당)
 */
export function loadScript(url, { module = true } = {}) {
  if (scriptCache.has(url)) return scriptCache.get(url);

  const p = new Promise((resolve, reject) => {
    // 이미 같은 스크립트가 문서에 있으면 재사용합니다.
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      if (existing.dataset.fxLoaded === '1') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = url;
    if (module) s.type = 'module';
    s.async = true;
    s.addEventListener('load', () => {
      s.dataset.fxLoaded = '1';
      resolve();
    }, { once: true });
    s.addEventListener('error', () => {
      scriptCache.delete(url);
      reject(new Error(`[fx] 스크립트 로드 실패: ${url}`));
    }, { once: true });
    document.head.appendChild(s);
  });

  scriptCache.set(url, p);
  return p;
}

/** OGL(경량 WebGL, gzip 약 8KB) */
export const loadOGL = () => loadModule(CDN.ogl);

/** three.js — GLB 커스텀 씬이 필요할 때만. gzip 약 150KB. */
export const loadThree = () => loadModule(CDN.three);

/** <model-viewer> 커스텀 엘리먼트 등록. */
export function loadModelViewer() {
  if (typeof customElements !== 'undefined' && customElements.get('model-viewer')) {
    return Promise.resolve();
  }
  return loadScript(CDN.modelViewer, { module: true }).then(() =>
    customElements?.whenDefined?.('model-viewer')
  );
}

/**
 * 사용자가 곧 필요로 할 것 같은 모듈을 미리 예열합니다.
 * 예) 히어로 아래에 3D 섹션이 있으면 스크롤 시작 시 prefetch(loadOGL)
 */
export function prefetch(loaderFn) {
  const run = () => loaderFn().catch(() => {});
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 1000);
}
