# 리오나이다 필드 가이드 v1.0

GTA VI 스토리 모드의 챕터, 수집, 차량, 장비와 장소를 찾아보는 한국어 웹앱입니다.

[공개판 열기](https://gengar200005.github.io/leonida-field-guide/#/) · [v1.0 검수 기록](audit/release-v1.0.json)

프롤로그와 5개 챕터의 스토리 공략 순서는 `campaign-order.json`에서 관리합니다. 독립 번호가 없는 연락·송금·훈련은 관련 공략에서 원명으로 검색할 수 있습니다. 이 판부터 오류 수정, 패치 대응, 주요 발견을 중심으로 유지보수합니다.

## 실행

Python 3.10 이상에서 `python build.py`를 실행한 뒤 `dist/index.html`을 브라우저에서 열 수 있습니다. 개발용 서버는 `python -m http.server 8138 --directory dist`로 실행합니다.

## 콘텐츠 편집

- `data/*.jsonl`의 한 줄이 공략 한 편입니다. 고정 ID, 제목, 요약, 단계, 표, 출처와 연관 항목을 관리합니다. 원문을 보존하면서 보강한 단계와 조건은 `editorial-guides.json`에 둡니다.
- `atlas.json`에는 지도에 표시할 수 있는 위치와 원본 핀 주소가 있습니다. 사진이 보여 주는 장소와 게임 내 ID를 대조합니다.
- `photos.json`에는 사진별 원본, 표시 문구, 제작자, 이용 조건이 있습니다. 편집자가 선택한 대표 이미지와 추가 장면은 `editorial-media.json`과 `media/editorial/`에 있습니다. `media/*.zip`의 WebP 파일은 배포 과정에서 개별 파일로 풀립니다.
- `entry-merges.json`에는 대표 항목별 통합 근거와 구 ID가 있습니다. 빌드 시 사진·출처·서로 다른 지점을 보존하고 기존 `redirects.json`과 합쳐 예전 링크와 저장 기록을 이전합니다.
- `revision-review.json`은 이전 판 검토 기록, `index-relations.json`은 책 색인과 도감의 연결 기록입니다. 둘 다 배포 사이트에 복사되지 않습니다.

GitHub Pages에서 GitHub Actions를 소스로 선택하면 main 브랜치를 빌드한 뒤 데스크톱과 모바일 브라우저 검사를 통과한 결과물이 배포됩니다. 사진 이용 조건은 각 항목과 앱의 출처 화면에서 확인할 수 있습니다.

