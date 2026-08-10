/**
 * _core/index.js
 * 배럴 파일. 효과를 직접 만들 때는 여기서 필요한 것만 가져다 쓰면 됩니다.
 *
 *   import { defineEffect, damp, createVisibleLoop } from '../_core/index.js';
 *
 * ⚠️ react.js는 여기서 re-export 하지 않습니다.
 *    바닐라 프로젝트가 이 배럴을 불러올 때 'react' 모듈을 찾다가 깨지기 때문입니다.
 *    React 어댑터는 '../_core/react.js'에서 직접 가져오세요.
 */

export { defineEffect, getEffect, destroyAll } from './effect.js';

export {
  prefersReducedMotion,
  onReducedMotionChange,
  onViewportChange,
  isCoarsePointer,
  canHover,
  isNarrowerThan,
  supportsWebGL,
  deviceTier,
  dprCap,
  fpsCap,
  evaluateGuard,
} from './guard.js';

export {
  observeVisibility,
  observeResize,
  createLoop,
  createVisibleLoop,
} from './observer.js';

export {
  CDN,
  setCDN,
  loadModule,
  loadScript,
  loadOGL,
  loadThree,
  loadModelViewer,
  prefetch,
} from './loader.js';

export {
  clamp,
  lerp,
  damp,
  map,
  progress,
  round,
  pointerToUnit,
  hexToRgb,
  rafThrottle,
} from './math.js';

export const VERSION = '1.0.0';
