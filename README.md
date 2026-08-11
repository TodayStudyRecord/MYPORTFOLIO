# 교육·기획하는 개발자 - WonByeongSeon Portfolio

Portfolio Maker로 만든 정적 사이트입니다. **빌드 도구가 필요 없습니다.**

## 열기

ES 모듈은 `file://`에서 브라우저가 차단합니다. 반드시 서버로 열어야 합니다.

```bash
python -m http.server 5500
```

→ <http://localhost:5500/index.html>


## 페이지

- `index.html` — Home

## 구조

```
index.html 등        페이지마다 한 장
assets/site.css      레이아웃 · 테마 · 파트 스타일
assets/init.js       3D 효과 마운트
effects/             효과 팩 (_core · tilt-card · spotlight · parallax-layers · hover-preview · smooth-scroll)
```

## 고치는 법

- **글·구조** — HTML을 직접 고치세요. 의미 태그(`header`/`nav`/`main`/`section`/`footer`)로 나가 있습니다.
- **색·폰트** — 각 페이지 `.wf-page`의 인라인 CSS 변수(`--wf-accent` 등)를 바꾸면 전체에 적용됩니다.
- **3D 효과** — HTML의 `data-fx` / `data-fx-*` 속성이 곧 옵션입니다. 지우면 효과가 사라집니다.

## GitHub Pages 배포

리포지터리에 그대로 올리고 Settings → Pages에서 브랜치를 지정하면 됩니다.
경로 설정이 따로 필요 없습니다(상대 경로만 씁니다).
