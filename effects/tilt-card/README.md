# `tilt-card` — 3D 틸트 카드

> **티어 T1** · 추가 용량 **0KB** · 의존성 없음 · 마우스 환경 전용

포인터를 따라 카드가 기울고, 빛 반사가 따라오고, 내부 요소가 서로 다른 높이로 떠오릅니다.
프로젝트 카드 하나당 체감 임팩트가 가장 큰 효과라 **여기부터 붙이는 걸 권장**합니다.

---

## 1. 붙이기 — 바닐라

```html
<link rel="stylesheet" href="./effects/_core/core.css" />
<link rel="stylesheet" href="./effects/tilt-card/style.css" />

<article class="project-card fx-card">
  <img class="fx-card__media" src="./thumb.jpg" alt="" data-fx-depth="16" />
  <h3 class="fx-card__title" data-fx-depth="34">쇼핑몰 리뉴얼</h3>
  <p  class="fx-card__desc"  data-fx-depth="26">React · TypeScript</p>
  <span class="fx-card__tag" data-fx-depth="52">2026</span>
</article>

<script type="module">
  import { mount } from './effects/tilt-card/index.js';
  mount('.project-card');
</script>
```

> `type="module"`은 필수입니다. 그리고 **로컬 파일을 더블클릭해서 열면 동작하지 않습니다** —
> ES 모듈은 `file://`에서 차단됩니다. VS Code의 Live Server나 `npx serve`로 여세요.

## 2. 붙이기 — React

```jsx
import { TiltCard, Depth } from './effects/tilt-card/react.jsx';

export default function Projects() {
  return (
    <TiltCard as="a" href="/work/1" className="fx-card" maxTilt={14}>
      <Depth as="img" z={16} className="fx-card__media" src="/thumb.jpg" alt="" />
      <Depth as="h3" z={34} className="fx-card__title">쇼핑몰 리뉴얼</Depth>
      <Depth as="p"  z={26} className="fx-card__desc">React · TypeScript</Depth>
    </TiltCard>
  );
}
```

기존 마크업을 유지하고 싶으면 훅만 씁니다.

```jsx
import { useTilt } from './effects/tilt-card/react.jsx';

const ref = useTilt({ maxTilt: 16 });
return <article ref={ref} className="my-own-card">…</article>;
```

---

## 3. 옵션

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `maxTilt` | `12` | 최대 기울기(도). **12~16이 자연스럽고 20을 넘으면 촌스러워집니다.** |
| `perspective` | `900` | 원근 거리(px). 작을수록 왜곡이 큽니다. **카드 폭의 1.5~2배**가 기준. |
| `scale` | `1.02` | hover 시 확대 배율 |
| `speed` | `12` | 따라오는 속도(감쇠 계수). 8=나른함, 12=기본, 20=즉각적 |
| `glare` | `true` | 빛 반사 표시 |
| `maxGlare` | `0.35` | 글레어 최대 불투명도 |
| `glareZ` | `0` | 글레어 높이(px). 깊이 레이어보다 위에 얹으려면 최대 depth보다 크게 |
| `reverse` | `false` | 기울기 방향 반전 |
| `axis` | `'both'` | `'x'` = 좌우 움직임만(rotateY) / `'y'` = 상하 움직임만(rotateX) |
| `focusScale` | `true` | 키보드 포커스 시 확대 |

HTML에서 직접 조절할 수도 있습니다.

```html
<article class="project-card" data-fx-max-tilt="18" data-fx-glare="false">
```

---

## 4. 깊이 레이어 — 이 효과의 핵심

`data-fx-depth="숫자"`를 자식에 붙이면 그 숫자만큼 카드 위로 떠오릅니다.
**단순히 위로 띄우는 게 아니라, 포인터 반대 방향으로 살짝 밀어서 시차를 만듭니다.**
이 두 가지가 겹쳐야 "떠 있다"는 느낌이 납니다.

### 값 가이드

| 요소 | 권장 depth |
|---|---|
| 배경 이미지 / 썸네일 | `10 ~ 20` |
| 본문 텍스트 | `25 ~ 40` |
| 제목 | `30 ~ 45` |
| 배지 · 아이콘 · CTA | `50 ~ 70` |

> **흔한 실수:** 전부 같은 depth를 주면 그냥 통째로 떠오를 뿐 입체감이 안 납니다.
> **값의 차이가 곧 깊이감**입니다. 최소 3단계로 나누세요.

> **또 흔한 실수:** depth를 100 이상 주면 원근 왜곡으로 요소가 카드 밖으로 튀어나옵니다.
> `perspective`의 1/10 이하로 유지하세요 (perspective 900 → depth 최대 90).

---

## 5. 자동으로 꺼지는 조건

| 상황 | 이유 |
|---|---|
| OS "동작 줄이기" ON | 접근성 — 전정기관 장애 사용자 |
| 터치 전용 기기 | hover가 없어서 의미가 없음 |

꺼져도 레이아웃은 그대로입니다. 요소에 `class="fx-inert"`와
`data-fx-skipped="reduced-motion"` 같은 표시가 남으니 devtools에서 원인을 바로 볼 수 있습니다.

강제로 켜려면 (데모/영상 촬영용):

```js
mount('.project-card', { guard: false });
```

---

## 6. 성능 노트

이 효과가 카드 20장에 붙어도 느려지지 않는 이유:

1. **`will-change`를 상호작용 중에만 겁니다.** 상시로 걸면 카드마다 GPU 레이어가 생겨 메모리를 먹습니다.
2. **`getBoundingClientRect`를 캐싱합니다.** `pointermove`마다 호출하면 매 프레임 강제 리플로우가 발생합니다. enter 시 1회 읽고 scroll/resize에서만 무효화합니다.
3. **정지하면 rAF를 끕니다.** 목표값에 수렴하면 루프를 `stop()` 합니다. 마우스가 없으면 CPU 사용량이 0입니다.
4. **동시에 도는 루프는 hover 중인 카드 1개뿐**입니다.

---

## 7. 자주 겪는 문제

**Q. 기울지 않습니다.**
→ devtools에서 요소의 `data-fx-skipped`를 보세요. `coarse-pointer`면 터치 기기로 인식된 것이고, `reduced-motion`이면 OS 설정입니다.

**Q. 자식이 안 떠오릅니다.**
→ 부모의 `transform-style: preserve-3d`가 다른 CSS에 덮였는지 확인하세요. 특히 부모에 `overflow: hidden`이 있으면 3D 컨텍스트가 평탄화됩니다.

**Q. 글레어가 콘텐츠 뒤에 있습니다.**
→ 의도된 기본값입니다(카드 표면의 빛). 위로 올리려면 `glareZ`를 가장 큰 depth보다 크게 주세요. 원근 보정은 자동입니다.

**Q. 텍스트가 흐릿합니다.**
→ 3D 변환의 알려진 특성입니다. `maxTilt`를 줄이거나 `perspective`를 키우면 완화됩니다.

**Q. 카드가 잘립니다.**
→ 부모 컨테이너의 `overflow: hidden` 때문입니다. `overflow: visible`로 바꾸거나 카드 주변에 여백을 주세요.
