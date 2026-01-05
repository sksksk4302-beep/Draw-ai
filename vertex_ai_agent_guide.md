# Vertex AI Agent Builder 설정 가이드

이 가이드는 Google Cloud Vertex AI Agent Builder를 사용하여 Draw-ai 봇을 위한 에이전트를 생성하고 설정하는 방법을 설명합니다.

## 1. Vertex AI Agent Builder 접속
1. [Google Cloud Console](https://console.cloud.google.com/)에 접속합니다.
2. 상단 검색창에 **"Agent Builder"** 또는 **"Discovery Engine"**을 검색하고 선택합니다.
3. **"앱 및 데이터 저장소(Apps & Data Stores)"** 메뉴로 이동합니다.

## 2. 새 앱 생성 (Create App)
1. **"앱 만들기(Create App)"** 버튼을 클릭합니다.
2. 앱 유형으로 **"에이전트(Agent)"** 또는 **"채팅(Chat)"**을 선택합니다. (보통 "Agent"를 선택하여 대화형 AI를 구성합니다.)
3. **표시 이름(Display Name)**에 `Draw-ai-Agent` (또는 원하는 이름)를 입력합니다.
4. **위치(Location)**를 `global` 또는 `us-central1`으로 설정합니다. (프로젝트 설정과 일치시키는 것이 좋습니다.)
5. **"계속(Continue)"**를 클릭하여 앱을 생성합니다.

## 3. 에이전트 설정 (Configure Agent)
앱이 생성되면 에이전트 콘솔로 이동합니다.

### 3.1 목표 및 페르소나 설정 (Goal & Persona)
에이전트에게 역할을 부여합니다. `backend/rules.d/korean_persona.md` 파일의 내용을 참고하여 설정합니다.

**예시 지침:**
```text
당신은 아이들의 창의력을 키워주는 친절한 미술 선생님 '한울'입니다.
항상 한국어로 대답하세요.
사용자가 그림을 그려달라고 하면, 어떤 그림을 그릴지 구체적으로 물어보고 확정해주세요.
사용자의 말을 경청하고, 긍정적이고 격려하는 말투를 사용하세요.
```

### 3.2 도구(Tools) 설정 (선택 사항)
에이전트가 백엔드 API를 직접 호출하게 하려면 OpenAPI 스펙을 등록할 수 있습니다. 하지만 이번 구현에서는 백엔드가 중계 역할을 하므로, 이 단계는 건너뛰어도 됩니다. 에이전트는 사용자의 의도를 파악하여 텍스트로 응답하면 됩니다.

## 4. 에이전트 ID 확인
1. 생성된 앱의 설정 페이지 또는 목록에서 **Agent ID** (또는 App ID)를 확인합니다.
2. 이 ID를 복사하여 프로젝트의 `.env` 파일에 `AGENT_ID` 변수로 저장해야 합니다.

```env
AGENT_ID=your-agent-id-here
```

## 5. 테스트
우측의 **"에이전트 미리보기(Preview Agent)"** 패널에서 채팅을 입력하여 에이전트가 한국어로 잘 대답하는지 테스트해보세요.
