# PIXEL KITCHEN — 이미지 가공실

[실행](https://hyungminyoon1.github.io/pixel-kitchen/) · [WEB LAB](https://hyungminyoon1.github.io/web-lab/)

브라우저 안에서 이미지를 불러와 필터를 적용하고, 한 픽셀이 계산되는 과정까지 확인하는 이미지 작업대입니다.

## 직접 해보기

- PNG·JPEG·WebP 파일 열기, 원본/결과 비교, PNG 저장
- 6개 기본 필터와 직접 편집하는 3×3 커널
- 주변 9개 픽셀·가중치·RGB 계산 검사, 방향키 이동
- 흑백 변환과 필터 계수·나누기·밝기 조절

개인 소개나 계정 없이 사용할 수 있습니다. 새로고침하면 실험 상태가 초기화됩니다.

참고 개념: [원문과 추가 학습](https://setosa.io/ev/image-kernels/). 구현은 이 저장소의 계산 모델과 UI로 작성했습니다.

## 실행 및 검증

Node.js 22 이상. 외부 패키지는 없습니다.

```sh
npm run dev -- 0
npm test
npm run check
```

main에 푸시하면 검증 후 dist만 GitHub Pages에 배포합니다. 계산 모델과 UI는 분리되어 있습니다. 현재 페이지를 닫으면 실험 상태가 사라지며 서버 업로드·계정·방문자 추적 기능은 없습니다. 호스팅 로그와 앱의 데이터 처리는 별개입니다.

[구조](architecture.md) · [결정 기록](docs/decisions.md) · [검증 기록](docs/verification.md)

AI 에이전트와 함께 제작했습니다. 참고 개념과 원작 링크는 앱 및 설명에 표시하며, 다른 사이트의 코드나 디자인을 복제하지 않습니다. 별도 라이선스는 아직 부여하지 않았습니다.
