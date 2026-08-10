/**
 * _core/react.js
 * React 프로젝트 전용 어댑터. 바닐라 프로젝트는 이 파일을 불러오지 않습니다.
 *
 * 각 효과 폴더의 react.jsx가 이 훅을 씁니다.
 * mount/destroy 계약이 이미 있으므로 어댑터는 이 파일 하나면 끝입니다.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';

// SSR(Next.js 등)에서 useLayoutEffect 경고를 피합니다.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * 효과를 ref 요소에 붙입니다.
 *
 *   const ref = useFx(mountTilt, { maxTilt: 14 });
 *   return <div ref={ref} className="card">…</div>;
 *
 * 주의점 두 가지가 이미 처리되어 있습니다:
 *  1. React 18 StrictMode는 개발 모드에서 effect를 두 번 실행합니다.
 *     defineEffect가 중복 마운트를 막고, cleanup에서 destroy를 부르므로 안전합니다.
 *  2. options 객체는 매 렌더마다 새로 만들어집니다. 그걸 deps에 넣으면
 *     매 렌더마다 재마운트됩니다. 그래서 ref에 담아두고 deps에서 뺍니다.
 *     값을 실제로 바꾸고 싶을 때는 deps에 원시값을 명시하세요.
 *
 * @param {Function} mount  효과의 mount 함수
 * @param {object}   options
 * @param {any[]}    deps   이 값들이 바뀌면 옵션을 반영해 갱신합니다
 * @returns {React.RefObject}
 */
export function useFx(mount, options, deps = []) {
  const ref = useRef(null);
  const handleRef = useRef(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useIsoLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const handle = mount(node, optionsRef.current);
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // deps가 바뀌면 재마운트 없이 옵션만 갱신합니다.
  useEffect(() => {
    handleRef.current?.update(optionsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * 외부에서 전달된 ref와 효과를 함께 쓰고 싶을 때.
 * (forwardRef 컴포넌트에서 사용)
 */
export function useFxOn(externalRef, mount, options, deps = []) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const handleRef = useRef(null);

  useIsoLayoutEffect(() => {
    const node = externalRef?.current;
    if (!node) return undefined;
    const handle = mount(node, optionsRef.current);
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.update(optionsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return handleRef;
}

/** 여러 ref를 하나의 DOM 노드에 연결합니다(forwardRef + 내부 ref 병합). */
export function mergeRefs(...refs) {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else ref.current = node;
    }
  };
}
