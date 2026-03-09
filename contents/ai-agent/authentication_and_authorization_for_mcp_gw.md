# MCP 게이트웨이를 위한 고급 인증 및 권한 부여

1. [AI 에이전트와 모델 컨텍스트 프로토콜](build_ai_agent_via_rhoai.md#1-ai-에이전트와-모델-컨텍스트-프로토콜)<br>
2. [AI 에이전트 개발을 위한 유연한 RHOAI](build_ai_agent_via_rhoai.md#2-ai-에이전트-개발을-위한-유연한-rhoai)<br>
3. [RHOAI 개발 경로 및 지원 옵션](build_ai_agent_via_rhoai.md#3-rhoai-개발-경로-및-지원-옵션)<br>
4. [Llama 스택을 탑재한 RHOAI](build_ai_agent_via_rhoai.md#4-llama-스택을-탑재한-rhoai)<br>

<br>
<br>

## 1. MCP 게이트웨이와 보안 이슈

### 1.1 MCP 게이트웨이

* Envoy 기반 게이트웨이
* 여러 MCP(Model Context Protocol) 서버를 단일 엔드포인트로 통합
* AI 에이전트가 통합된 인터페이스를 통해 다양한 소스의 도구에 접근할 수 있도록 구성
* 이러한 통합은 클라이언트 경험을 단순화하지만, 중요한 보안 문제를 야기
  + 여러 MCP 서버에서 어떤 사용자가 어떤 도구에 접근할 수 있는지 어떻게 제어할까요?
  + 지나치게 관대한 액세스 토큰이 신뢰할 수 없는 서버로 유출되는 것을 어떻게 방지할까요?
  + 서로 다른 인증 메커니즘을 사용하는 MCP 서버는 어떻게 처리할까요?
<br>

### 1.2 보안 문제

MCP 게이트웨이가 여러 서버의 도구를 통합할 때 다음과 같은 몇 가지 보안 문제 발생

* 지나치게 관대한 토큰
  + AI 에이전트는 일반적으로 모든 MCP 서버의 모든 도구를 포괄하는 광범위한 범위의 OAuth2 액세스 토큰을 사용
  + 이러한 토큰이 백엔드 서버로 직접 전달될 경우, 손상되었거나 악의적인 MCP 서버가 이를 이용하여 에이전트를 사칭하고 승인되지 않은 리소스에 접근 가능

* 세분화되지 않은 접근 제어
  + 표준 MCP 프로토콜은 사용자 ID를 기반으로 표시되는 도구를 필터링하는 메커니즘을 제공하지 않음
  + 에이전트는 사용자가 일부 도구를 사용할 권한이 없더라도 사용 가능한 모든 도구를 볼 수 있음
  + 이 문제는 MCP 게이트웨이의 MCP 브로커 구성 요소가 사용자의 그룹 연결 및 역할과 관련이 없을 수 있는 서버를 포함하여 여러 MCP 서버의 도구를 통합할 때 더욱 악화됨

* 이질적인 인증 방식
  + 서로 다른 MCP 서버는 서로 다른 인증 방식을 요구
    - 일부는 OAuth2를 사용하고, 일부는 개인 액세스 토큰(PAT)을 사용하며, 일부는 API 키를 사용
  + 게이트웨이는 이러한 메커니즘 간의 변환을 투명하게 처리 필요
<br>

### 1.3 솔루션 개요

다음과 같은 세 가지 상호 보완적인 기능을 통해 이러한 문제 해결

* ID 기반 도구 필터링
  + 암호화 서명된 헤더를 사용하여 사용자 권한에 따라 tools/list 응답을 필터링
* OAuth2 토큰 교환
  + RFC 8693을 사용하여 광범위한 액세스 토큰을 각 MCP 서버에 특정한 범위가 좁은 토큰으로 교환
* Vault 통합
  + OAuth2를 지원하지 않는 서버의 경우 HashiCorp Vault에서 PAT 및 API 키를 가져옴

> [!NOTE]
> 이 세 가지 기능은 모두 MCP 게이트웨이의 Envoy 기반 아키텍처와 통합되는 Kuadrant의 AuthPolicy 리소스를 사용하여 구현됩니다. 하지만 게이트웨이 자체는 인증 메커니즘에 구애받지 않으므로 Istio/게이트웨이 API와 호환되는 정책 엔진을 사용하여 이러한 패턴을 구현할 수 있습니다.
<br>
<br>

## 2. 솔루션 방안

### 2.1 ID 기반 도구 필터링

#### 2.1.1 문제 및 해결책

* 문제
  + 에이전트가 tools/list를 호출하면 MCP 게이트웨이는 등록된 모든 MCP 서버의 모든 도구를 반환
  + 하지만 사용자가 이러한 도구 중 일부에만 접근 권한이 있는 경우에 권한이 없는 도구를 표시하면 혼란을 야기하고 잠재적인 보안 문제를 초래

* 해결책: 암호화 검증을 사용하는 신뢰 헤더 방식을 채택
  1. 외부 인증 구성 요소(본 사례에서는 Authorino)가 사용자의 OAuth2 토큰을 검증하고 ID 공급자로부터 사용자의 권한을 추출
  2. 이 구성 요소는 허용된 도구를 담고 있는 서명된 JWT "wristband"를 생성하여 x-authorized-tools 헤더로 삽입
  3. MCP 브로커는 신뢰 공개 키를 사용하여 이 JWT를 검증하고 그에 따라 도구 목록을 필터링

#### 2.1.2 **AuthPolicy** 구성

```yaml
apiVersion: kuadrant.io/v1
kind: AuthPolicy
metadata:
  name: mcp-auth-policy
  namespace: gateway-system
spec:
  targetRef:
    group: gateway.networking.k8s.io
    kind: Gateway
    name: mcp-gateway
    sectionName: mcp
  when:
    - predicate: "!request.path.contains('/.well-known')"
  rules:
    authentication:
      'keycloak':
        jwt:
          issuerUrl: https://keycloak.example.com/realms/mcp
    authorization:
      'allow-tool-list':
        patternMatching:
          patterns:
            - predicate: request.headers['x-mcp-method'] in ["tools/list","initialize","notifications/initialized"]
      'authorized-tools':
        opa:
          rego: |
            allow = true
            tools = { server: roles |
              server := object.keys(input.auth.identity.resource_access)[_];
              roles := object.get(input.auth.identity.resource_access, server, {}).roles
            }
          allValues: true
    response:
      success:
        headers:
          x-authorized-tools:
            wristband:
              issuer: 'authorino'
              customClaims:
                'allowed-tools':
                  selector: auth.authorization.authorized-tools.tools.@tostr
              tokenDuration: 300
              signingKeyRefs:
                - name: trusted-headers-private-key
                  algorithm: ES256
```
* 이 정책은 OPA(Open Policy Agent)를 사용하여 JWT의 resource_access 클레임에서 도구 권한을 추출
* Keycloak은 권한을 클라이언트 역할로 저장
  + 각 MCP 서버는 리소스 서버 클라이언트이
  + 각 도구는 역할(role)
* Wristband 기능은 허용된 도구 매핑이 포함된 서명된 JWT를 생성
  + 예
    ```json
    {"server1.mcp.local":["greet","time"],"server2.mcp.local":["headers"]}
    ```
* 브로커는 이 JWT를 검증하고 응답을 반환하기 전에 도구를 필터링

#### 2.1.3 브로커 측 구현

~/internal/broker/[filtered_tools_handler.go](https://github.com/kagenti/mcp-gateway/blob/main/internal/broker/filtered_tools_handler.go)
```go
func (broker *mcpBrokerImpl) FilteredTools(ctx context.Context, _ any,
    mcpReq *mcp.ListToolsRequest, mcpRes *mcp.ListToolsResult) {
    // Get the x-authorized-tools header
    allowedToolsValue := mcpReq.Header[authorizedToolsHeader][0]
    // Validate the JWT signature
    parsedToken, err := validateJWTHeader(allowedToolsValue, broker.trustedHeadersPublicKey)
    // Extract the allowed-tools claim
    authorizedTools := map[string][]string{}
    json.Unmarshal([]byte(allowedToolsValue), &authorizedTools)
    // Filter tools based on permissions
    mcpRes.Tools = broker.filterTools(authorizedTools)
}
```

#### 2.1.4 주요 이점

* 최소 권한 원칙
  + 사용자는 자신이 사용 권한을 가진 도구만 볼 수 있음
* 암호학적 보안
  + 브로커가 헤더 서명을 검증하여 변조를 방지
* 클라이언트에 투명성
  + MCP 클라이언트 구현을 변경할 필요 없음
* 유연한 권한 모델
  + JWT 클레임을 발급할 수 있는 모든 ID 공급자를 지원
<br>

### 2.2 OAuth2 토큰 교환

#### 2.2.1 문제 및 해결책

* 문제
  + AI 에이전트는 일반적으로 광범위한 범위와 여러 사용자를 대상으로 하는 단일 OAuth2 액세스 토큰으로 인증
  + 이 토큰을 모든 백엔드 MCP 서버에 전달하면 권한 상승 위험 발생
  + 악의적인 서버가 이 토큰을 사용하여 사용자가 접근 권한을 가진 다른 서비스에 접근할 수 있기 때문

* 해결책
  + [RFC 8693 OAuth2 토큰 교환](https://www.rfc-editor.org/rfc/rfc8693.html)을 구현하여 광범위한 액세스 토큰을 각 MCP 서버에 특화된 좁은 범위의 토큰으로 변환

#### 2.2.2 **AuthPolicy** 구성

```yaml
apiVersion: kuadrant.io/v1
kind: AuthPolicy
metadata:
  name: mcps-auth-policy
  namespace: gateway-system
spec:
  targetRef:
    group: gateway.networking.k8s.io
    kind: Gateway
    name: mcp-gateway
    sectionName: mcps
  rules:
    authentication:
      'keycloak':
        jwt:
          issuerUrl: https://keycloak.example.com/realms/mcp
    metadata:
      oauth-token-exchange:
        http:
          url: https://keycloak.example.com/realms/mcp/protocol/openid-connect/token
          method: POST
          credentials:
            authorizationHeader:
              prefix: Basic
          sharedSecretRef:
            name: token-exchange
            key: oauth-client-basic-auth
          bodyParameters:
            grant_type:
              value: urn:ietf:params:oauth:grant-type:token-exchange
            subject_token:
              expression: request.headers['authorization'].split('Bearer ')[1]
            subject_token_type:
              value: urn:ietf:params:oauth:token-type:access_token
            audience:
              expression: request.host  # Target MCP server hostname
            scope:
              value: openid
    authorization:
      'token':
        opa:
          rego: |
            scoped_jwt := object.get(object.get(object.get(input.auth, "metadata", {}),
                "oauth-token-exchange", {}), "access_token", "")
            jwt := j { scoped_jwt != ""; j := scoped_jwt }
            jwt := j { scoped_jwt == ""; j := split(input.request.headers["authorization"], "Bearer ")[1] }
            claims := c { [_, c, _] := io.jwt.decode(jwt) }
            allow = true
          allValues: true
      'scoped-audience-check':
        patternMatching:
          patterns:
            - predicate: has(auth.authorization.token.claims.aud) &&
                type(auth.authorization.token.claims.aud) == string &&
                auth.authorization.token.claims.aud == request.host
      'tool-access-check':
        patternMatching:
          patterns:
            - predicate: |
                request.headers['x-mcp-toolname'] in (has(auth.authorization.token.claims.resource_access) &&
                  auth.authorization.token.claims.resource_access.exists(p, p == request.host) ?
                  auth.authorization.token.claims.resource_access[request.host].roles : [])
    response:
      success:
        headers:
          authorization:
            plain:
              expression: "Bearer " + auth.authorization.token.jwt
```
1. MCP 라우터는 호출되는 도구에 따라 x-mcp-toolname 헤더를 설정
2. **AuthPolicy**는 원래 토큰과 대상 MCP 서버 호스트 이름을 *audience*로 전달하여 토큰 교환 엔드포인트를 호출
3. ID 공급자는 다음과 같은 새 토큰을 발급
   * *aud* 클레임이 대상 MCP 서버에만 설정
   * 범위는 해당 서버에 필요한 범위로 제한
   * 동일한 사용자 ID 클레임이 사용
4. 권한 검사는 다음을 확인
   * 교환된 토큰의 audience가 올바른지
   * 사용자가 요청된 도구에 접근할 권한이 있는지
5. 교환된 토큰이 *Authorization* 헤더의 원래 토큰을 대체

#### 2.2.3 주요 이점

* 최소 권한 토큰
  + 각 백엔드 서버는 필요한 접근 권한만 부여받음
* 측면 이동 방지
  + 서버가 손상되더라도 해당 토큰을 사용하여 다른 서비스에 접근할 수 없음
* 표준 기반
  + 주요 ID 제공업체에서 지원하는 RFC 8693 표준 사용
* 투명성
  + MCP 서버 구현에 변경 사항이 없음
<br>

### 2.3 HashiCorp Vault 통합

#### 2.3.1 문제 및 해결책

* 문제
  + 모든 MCP 서버가 OAuth2를 지원하는 것은 아님
  + GitHub의 MCP 서버와 같은 많은 외부 서비스는 PAT(개인 접근 제어 토큰) 또는 API 키를 요구
  + OAuth2를 사용하여 사용자 인증을 수행하면서 이러한 자격 증명을 안전하게 관리하는 것은 통합에 어려움을 초래

* 해결책
  + **AuthPolicy* 메타데이터 기능을 사용하여 사용자 ID와 대상 서버별로 색인화된 자격 증명을 HashiCorp Vault에서 가져옴

#### 2.3.2 **AuthPolicy**의 메타데이터 구성

```yaml
metadata:
  vault:
    http:
      urlExpression: |
        "http://vault.vault.svc.cluster.local:8200/v1/secret/data/" +
        auth.identity.preferred_username + "/" + request.host
      method: GET
      credentials:
        customHeader:
          name: X-Vault-Token
      sharedSecretRef:
        name: token-exchange
        key: vault-token
    priority: 0  # Try Vault first
  oauth-token-exchange:
    when:
      - predicate: "!has(auth.metadata.vault.data) ||
          !has(auth.metadata.vault.data.data) ||
          !has(auth.metadata.vault.data.data.token) ||
          type(auth.metadata.vault.data.data.token) != string"
    # ... token exchange config ...
    priority: 1  # Fallback to token exchange if Vault has no entry
The response injection logic checks for Vault credentials first:
response:
  success:
    headers:
      authorization:
        plain:
          expression: |
            "Bearer " + ((has(auth.metadata.vault.data) &&
              has(auth.metadata.vault.data.data) &&
              has(auth.metadata.vault.data.data.token) &&
              type(auth.metadata.vault.data.data.token) == string) ?
              auth.metadata.vault.data.data.token :
              auth.authorization.token.jwt)
```
1. **AuthPolicy**는 먼저 */v1/secret/data/alice/github.mcp.local*과 같은 경로를 사용하여 Vault에서 자격 증명을 가져오려고 시도
2. 자격 증명을 찾으면 해당 자격 증명(PAT 또는 API 키)을 Authorization 헤더에 사용
3. 찾지 못하면 OAuth2 토큰 교환으로 대체
4. 이를 통해 OAuth2를 지원하지 않는 외부 서비스와의 통합이 가능

#### 2.3.3 주요 이점

* 중앙 집중식 비밀 관리
  + 자격 증명은 코드나 설정 파일이 아닌 Vault에 안전하게 저장
* 사용자별, 서비스별 자격 증명
  + 각 사용자는 외부 서비스에 대한 고유한 PAT(개인 접근 권한)를 가질 수 있음
* 대체 전략
  + OAuth2 및 기존 인증 방식을 모두 원활하게 처리
* 감사 추적
  + Vault는 모든 자격 증명 접근 기록을 제공
<br>

### 2.4 아키텍처 및 설계 사항

#### 2.4.1 구현 아키텍처 

전체 흐름은 세 가지 기능을 모두 결합
```
                  ┌───────────────┐
                  │ MCP Client    │
                  │ (Agent)       │
                  └──────┬────────┘
                         │ OAuth2 Token (broad scopes)
                         ▼
          ┌───────────────────────────────────────────────┐
          │ Gateway (Envoy + Kuadrant AuthPolicies)       │
          │                                               │
          │ 1. Validate JWT                               │
          │ 2. Extract tool permissions                   │
          │ 3. Create x-authorized-tools wristband        │
          │ 4. Check Vault for credentials                │
          │ 5. Or exchange token (RFC 8693)               │
          │ 6. Verify tool access authorization           │
          └────────┬──────────────┬───────────────────────┘
                   │              │
                   ▼              ▼
           ┌────────────┐     ┌─────────────┐
           │ MCP Broker │     │ MCP Router  │
           │            │     │ (ext_proc)  │
           │ - Validates│     │             │
           │   x-author │     │ - Sets      │
           │  ized-tools│     │   x-mcp-    │
           │ - Filters  │     │   toolname  │
           │   tool list│     │ - Routes to │
           │            │     │   backend   │
           └────────────┘     └──────┬──────┘
                                     │ Scoped token or PAT
                                     ▼
                               ┌─────────────┐
                               │ Backend MCP │
                               │ Servers     │
                               └─────────────┘
```

#### 2.4.2 주요 설계 결정 사항

* 하드 종속성 없음
  + MCP 게이트웨이 구성 요소(브로커, 라우터, 컨트롤러)는 Kuadrant에 종속되지 않음
  + 모든 정책 엔진에서 사용할 수 있는 확장 지점(헤더, 메타데이터)을 제공

* 심층 방어(다중 보안 계층)
  + 게이트웨이 수준 인증 (*AuthPolicy*)
  + 도구 수준 권한 부여 (*x-mcp-toolname* 검사)
  + 암호화 검증 (*wristband* 서명)
  + 토큰 범위 지정 (대상 및 범위 축소)

* Envoy 우선 설계
  + 모든 보안 로직은 Envoy 필터에서 실행되므로 백엔드 구현에 관계없이 일관된 정책 적용을 보장

* 게이트웨이 API 통합
  + 라우팅에 표준 게이트웨이 API 리소스(HTTPRoute, 게이트웨이 리스너)를 사용하므로 모든 게이트웨이 API 제공업체와 호환
<br>
<br>

## 3. 사례 및 실행 방법

### 3.1 실제 사례

다음은 이러한 기능들이 실제 시나리오에서 어떻게 함께 작동하는지 보여주는 예입니다.

#### 3.1.1 시나리오 

개발자인 앨리스는 AI 에이전트를 사용하여 다음 세 개의 MCP 서버에서 제공하는 도구에 접근
* 내부 코드 검토 도구(OAuth2)
* GitHub 저장소 도구(GitHub PAT 필요)
* 날씨 예보 도구(API 키)

#### 3.1.2 실행 순서

1. 앨리스는 자신의 ID 공급자(*Keycloak*)를 통해 인증하고, 세 서버 모두에 대한 접근 권한이 포함된 OAuth2 액세스 토큰을 받음
2. 에이전트는 tools/list를 호출
   * **AuthPolicy**는 토큰을 검증
   * OPA는 앨리스의 권한을 추출
     ```json
     {"codereview.local":["analyze_pr","suggest_fix"], "github.mcp.local":["list_repos"], "weather.local":["get_forecast"]}
     ```
   * *Wristband*는 이러한 권한을 가진 서명된 JWT를 생성
   * 브로커는 앨리스가 접근할 수 있는 4개의 도구만 반환
3. 에이전트는 *codereview_analyze_pr*을 호출
   * 라우터는 *x-mcp-toolname*
     ```
     analyze_pr and :authority: codereview.local
     ```
   * **AuthPolicy**는 앨리스의 토큰을 `aud=codereview.local`이 포함된 토큰으로 교환
   * 앨리스가 해당 서버에 대한 *analyze_pr* 역할을 가지고 있는지 확인
   * 범위가 지정된 토큰으로 라우팅
4. 에이전트는 *github_list_repos*를 호출
   * 라우터는 x-mcp-toolname 설정
     ```
     list_repos and :authority: github.mcp.local
     ```
   * **AuthPolicy**는 */v1/secret/data/alice/github.mcp.local*의 Vault를 확인
   * Alice의 GitHub PAT를 찾음
   * 다음을 사용하여 라우팅
     ```
     Authorization: Bearer ghp_...
     ```
5. 에이전트는 *weather_get_forecast*를 호출
   * 유사한 흐름이지만 Vault에서 API 키를 가져옴

#### 3.1.3 전체 과정에서 적용된 사항

* 앨리스는 GitHub PAT 또는 날씨 API 키를 절대 볼 수 없음
* 각 백엔드 서버는 필요한 자격 증명만 수신
* 어떤 서버도 앨리스의 원래 OAuth2 토큰을 수신하지 않음
* 도구 접근 권한은 모든 단계에서 검증됨
<br>

### 3.2 테스트 방법

MCP 게이트웨이 저장소에는 완벽하게 작동하는 예제 포함
```bash
# Set up a local Kind cluster with everything
git clone git@github.com:kagenti/mcp-gateway.git && cd mcp-gateway
make local-env-setup

# Configure OAuth with token exchange and Vault
make oauth-token-exchange-example-setup

# Open the MCP Inspector to test
make inspect-gateway
```
* 예제 사용자, 그룹 및 도구 권한 포함하는 Keycloak
* 세 가지 인증 기능 모두 활성화하는 MCP 게이트웨이
* 예제 자격 증명 포함하는 HashiCorp Vault
* 다양한 인증 방법을 보여주는 테스트 MCP 서버

> [!NOTE]
> 자세한 구성 가이드는 [설명서](https://github.com/kagenti/mcp-gateway/blob/main/docs/guides/authorization.md)를 참조하십시오.
<br>
<br>

## 4. 요약 및 참조

### 4.1 요약

집합형 MCP 서버를 보호하려면 기본 인증 이상의 것이 필요합니다. 세분화된 권한 부여, 토큰 범위 지정, 그리고 이기종 인증 메커니즘 지원이 필수적입니다. Kuadrant의 AuthPolicy를 애드온으로 활용하면 MCP 게이트웨이는 유연성을 유지하면서 엔터프라이즈급 보안을 제공하고, 특정 기능에 대한 강력한 종속성을 방지할 수 있습니다.

이러한 기능은 최신 API 게이트웨이 패턴을 AI 에이전트 보안의 고유한 과제에 적용하여 자율 시스템에 강력한 도구를 안전하게 노출하는 데 필요한 제어 기능을 제공하는 방법을 보여줍니다.
<br>

### 4.2 참조

* [MCP 게이트웨이 문서](https://github.com/Kuadrant/mcp-gateway/tree/main/docs)
* Kuadrant의 [AuthPolicy](https://docs.kuadrant.io/latest/kuadrant-operator/doc/reference/authpolicy/)
* Kuadrant의 [OAuth 예제](https://github.com/Kuadrant/mcp-gateway#example-oauth-setup)
* GitHub
<br>
<br>

------
[차례](/README.md)