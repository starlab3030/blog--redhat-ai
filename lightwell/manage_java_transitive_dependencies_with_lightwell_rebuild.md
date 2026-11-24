# Lightwell 재구축을 통해 Java 전이적 종속성 관리

**목차**
1. [Java 소프트웨어 공급망과 Lightwell](manage_java_transitive_dependencies_with_lightwell_rebuild.md#1-java-소프트웨어-공급망과-lightwell)<br>
   1.1 [종속성 관리 및 Lightwell](manage_java_transitive_dependencies_with_lightwell_rebuild.md#11-종속성-관리-및-lightwell)<br>
   1.2 [자바 소프트웨어 공급망의 숨겨진 과제](manage_java_transitive_dependencies_with_lightwell_rebuild.md#12-자바-소프트웨어-공급망의-숨겨진-과제)<br>
2. [Lightwell 재구축을 위한 3가지 통합 전략](manage_java_transitive_dependencies_with_lightwell_rebuild.md#2-lightwell-재구축을-위한-3가지-통합-전략)<br>
   2.1 [수동 검색 및 개별 선택](manage_java_transitive_dependencies_with_lightwell_rebuild.md#21-수동-검색-및-개별-선택)<br>
   2.2 [표적화된 의존성 분석](manage_java_transitive_dependencies_with_lightwell_rebuild.md#22-표적화된-의존성-분석)<br>
   2.3 [생성된 자제 명세서를 사용한 종속성 고정](manage_java_transitive_dependencies_with_lightwell_rebuild.md#23-생성된-자재-명세서를-사용한-종속성-고정)<br>
3. [전략 비교 및 고려 사항](manage_java_transitive_dependencies_with_lightwell_rebuild.md#3-전략-비교-및-고려-사항)<br>
   3.1 [전략 비교 매트릭스](manage_java_transitive_dependencies_with_lightwell_rebuild.md#31-전략-비교-매트릭스)<br>
   3.2 [고려 사항](manage_java_transitive_dependencies_with_lightwell_rebuild.md#32-고려-사항)<br>
99. [참조](manage_java_transitive_dependencies_with_lightwell_rebuild.md#99-참조)<br>
<br>
<br>

## 1. Java 소프트웨어 공급망과 Lightwell

### 1.1 종속성 관리 및 Lightwell

#### 1.1.1 Java에서 종속성 관리

* Java에서 직접 종속성을 업데이트하는 것은 간단
* 하지만, 그 아래에서 실행되는 수백 개의 전이적 라이브러리를 보호하는 것이 많은 개발 파이프라인에서 난관으로 작용

#### 1.1.2 자동화 도구를 통한 종속성 관리

* 자동화 도구는 프로젝트에서 명시적으로 선언하는 패키지인 직접 종속성을 업그레이드하는 과정을 간소화
* 하지만, Java 생태계는 고정된 버전과 깊게 중첩된 전이적 종속성 트리라는 어려움을 안겨줌
* 전이적 종속성은 직접 종속성이 내부적으로 의존하는 라이브러리로, 패키지 관리자가 자동으로 가져옴

#### 1.1.3 문제점과 Lightwell을 통한 해결

* Lightwell이 발견한 핵심 Java 프레임워크의 제로데이 취약점 처럼 라이브러리 종속성 깊숙한 곳에서 보안 취약점이 발생할 경우
  + 기존 업데이트 도구는 보안 팀과 개발자에게 번거로운 수동 재정의와 취약점 노출이라는 두 가지 선택지만 남겨두는 경우가 많음

* Lightwell은 보안에 초점을 맞춘 엔터프라이즈용 오픈 소스 Java 라이브러리 재구축 버전을 제공
  + 기업별 빌드 워크플로 및 규정 준수 정책은 다양하기 때문에 Lightwell을 사용하면 엔지니어링 팀이 이러한 신뢰할 수 있는 패키지를 파이프라인에 통합하는 방식을 선택 가능

> [!NOTE] 
> 블로그에서는 Java 전이적 종속성의 핵심 문제점, 사용자 정의 프리셋을 활용한 직접 업데이트 개선 방법, 그리고 Lightwell 라이브러리 재구축을 엔터프라이즈 파이프라인에 직접 통합하기 위한 세 가지 유연한 전략을 소개합니다.
<br>

### 1.2 자바 소프트웨어 공급망의 숨겨진 과제

#### 1.2.1 Java 빌드 도구와 생태계 비교

* npm이나 PyPI 같은 생태계에서는 버전 범위를 사용하여 빌드 도구가 호환성을 유지하면서 라이브러리 업데이트를 자동으로 가져올 수 있음
* 반면 Maven이나 Gradle 같은 Java 빌드 도구는 기본적으로 엄격하게 고정된 버전을 사용

#### 1.2.2 종속성 업데이트 도구

* *`Renovate`*나 *`Dependabot`* 같은 도구는 직접적인 종속성에 대한 업데이트를 자동화
* 그러나, 간접적인 종속성은 자동으로 해결할 수 없음

#### 1.2.3 Lightwell의 *renovate-config*

* *`lightwell-experience/renovate-config`*의 GitHub 저장소에서 제공되는 것과 같은 사용자 지정 **Renovate** 사전 설정은 자동화 도구가 직접적인 종속성에 대한 Lightwell 재구축을 인식하는 데 도움이 됨
* 하지만, 최신 자바 애플리케이션에서는 직접 종속성보다 전이 종속성이 훨씬 많음
  + 직접 종속성만 패치하면 애플리케이션의 공급망 대부분은 그대로 남게 됨
<br>

## 2. Lightwell 재구축을 위한 3가지 통합 전략

개발팀마다 업데이트 처리 방식은 다릅니다. 엄격한 감사를 받는 은행 서비스는 빠르게 변화하는 내부 도구와는 다른 안전장치가 필요합니다. 적절한 워크플로를 찾는다는 것은 개발자의 자율성과 보안 부담 사이의 균형을 맞추는 것을 의미합니다.

### 2.1 수동 검색 및 개별 선택

#### 2.1.1 접근 방식

1. 검증된 취약점에 대한 명확한 수정이 요구되는 엄격한 규제 환경에서 팀은 특정 CVE 식별자 또는 아티팩트 이름을 사용
2. Lightwell 카탈로그 또는 API 엔드포인트를 쿼리하고 업데이트된 빌드를 수동으로 선택

#### 2.1.2 장단점

* 개별 종속성을 검토하면 프로덕션 환경에 배포할 항목을 세부적으로 제어 가능
* 하지만, 수십 개의 마이크로서비스에 걸쳐 수백 개의 라이브러리를 수동으로 검증하는 것은 확장성이 떨어짐
<br>

### 2.2 표적화된 의존성 분석

#### 2.2.1 접근 방식

1. 전체 종속성 계층 구조를 Lightwell 인덱스와 비교하여 평가
2. 표준 구성 요소를 Lightwell 재구축에 직접 매핑하는 상세 보고서를 생성
3. 팀은 이러한 결과를 내부 거버넌스 정책과 비교하여 검토하고 필요에 따라 수정 사항을 적용

#### 2.2.2 장단점

* 빌드 파일을 수정하지 않고도 사용 가능한 수정 사항에 대한 명확한 보고서를 얻을 수 있음
* 단점은 실행 과정에서 개발자가 권장 좌표를 pom.xml수동으로 복사해야 함

#### 2.2.3 유틸리티를 사용하여 종속성 확인

유틸리티 [pin-transitives.mjs](./files/renovate-config/scripts/pin-transitives.mjs)
1. 전이적 종속성 트리를 분석
2. **Renovate**에 쿼리를 보내 일치하는 업데이트를 식별
3. 위 보고서를 생성

실행 예
```
$ node pin-transitives.mjs
Resolved 32 dependencies (1 direct)

Direct dependencies (1)
  org.springframework:spring-core  5.3.18 → 5.3.18.rhlw-00001

Transitive dependencies (8)
  com.jayway.jsonpath:json-path  2.8.0 → 2.8.0.rhlw-00001

...<SNIP>...
```
* 출력은 새로 출시된 각 빌드 버전을 강조 표시
* 고급 필터링 메커니즘과 CVE 추적 기능은 아직 이 유틸리티 스크립트에 포함되어 있지 않음
<br>

### 2.3 생성된 자재 명세서를 사용한 종속성 고정

#### 2.3.1 접근 방식

1. (표적 종속성 분석과 마찬가지로) 전체 종속성 트리를 Lightwell 카탈로그와 비교하여 평가
2. 표준 패키지를 보안이 강화된 Lightwell 재빌드(rebuild) 버전으로 직접 고정하는 *`dependencyManagement`* 선언이 포함된 자재 명세서(BOM)를 생성

#### 2.3.2 장단점

* 완벽한 감사 기능과 정확한 버전 관리를 제공하는 동시에 개별 제품 팀이 필요에 따라 상위 릴리스로 되돌아갈 수 있도록 함
* 다만, 빌드 파이프라인에서 지속적으로 실행해야 하고 BOM 업데이트 시 지속적인 유지 관리가 필요

#### 2.3.3 도구를 사용하여 구조화된 BOM 파일 생성

*`pin-transitives.mjs`* 도구를 통해 *lightwell-pins.xml* 파일 생성
```
$ node pin-transitives.mjs --write
...<SNIP>...

$ cat lightwell-pins.xml
<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.lightwell</groupId>
  <artifactId>rhlw-pins</artifactId>
  <version>0.0.1</version>
  <packaging>pom</packaging>
  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework</groupId>
        <artifactId>spring-core</artifactId>
        <version>5.3.18.rhlw-00001</version>
      </dependency>
      <dependency>
        <groupId>com.jayway.jsonpath</groupId>
        <artifactId>json-path</artifactId>
        <version>2.8.0.rhlw-00001</version>
      </dependency>
    </dependencies>
  </dependencyManagement>
</project>
```
* 생성된 *lightwell-pins.xml* 파일은 부모 POM으로 사용
* 또는, 메인 빌드 구성의 *`dependencyManagement`* 요소 내에서 임포트하는 방식으로 프로젝트에 직접 통합 가능

#### 2.3.4 생성된 파일을 임포트 방식으로 프로젝트에 통합

```xml
...<SNIP>...
<dependencyManagement>
  <dependencies>
    <dependency>
      <groupId>com.lightwell</groupId>
      <artifactId>rhlw-pins</artifactId>
      <version>0.0.1</version>
      <type>pom</type>
      <scope>import</scope>
    </dependency>
  </dependencies>
</dependencyManagement>
...<SNIP>...
```
* Maven이 나열된 라이브러리 전반에서 패치된 Lightwell 바이너리를 사용하도록 지시
* Maven은 가장 먼저 발견되는 선언을 선택하므로, 기존 BOM 파일을 수정하지 않고도 이 import문보다 앞서 특정 항목을 재정의(override) 가능
<br>
<br>

## 3. 전략 비교 및 고려 사항

### 3.1 전략 비교 매트릭스

|전략      |기본 메커니즘        |설정 작업            |거버넌스 및 통제            |가장 적합한 용도|
|:---     |:---              |:---              |:---                    |:---|
|수동 검색  |콘솔 UI 또는 API 검색|높음(수동)           |완료(개별 선택)            |엄격한 변경 관리가 적용되는 핵심 레거시 시스템|
|종속성 분석 |보고 및 분석 자동화   |중간                |보통 (정보 제공용)         |업그레이드 전 보안 상태를 평가하는 팀|
|스크립트 고정|생성된 BOM 파일     |중간(CI/CD 파이프라인)|높음(감사 가능 및 재정의 가능)|엄격한 감사 추적이 필요한 엔터프라이즈 애플리케이션|

<br>

### 3.2 고려 사항

#### 3.2.1 이 작업을 중앙에서 처리할 수 있는가

* 자동화되고 중앙 집중화된 업데이트를 구성하는 것이 기술적으로 가능
* 하지만, 업스트림 콘텐츠를 Lightwell 아티팩트로 조용히 교체하는 프록시 서비스와 같은 불투명한 리디렉션 메커니즘은 재현 불가능하고 검증 불가능한 빌드를 생성하여 보안 위험을 초래하는 경우가 있을 수 있음

> [!NOTE]
> 기존의 CI/CD 파이프라인에 대한 확인이 필요하며, 이를 통해 CI/CD 재구축 혹은 변경이 필요할 수 있습니다.

#### 3.2.2 다음 단계

활발한 CI/CD 파이프라인을 유지하는 많은 팀에게 자동화된 BOM 생성은 정확한 버전 잠금과 예측 가능한 풀 리퀘스트 검토 주기를 결합한 강력한 중간 해결책을 제공합니다.

제공된 참조 스크립트는 이러한 패턴을 보여주며 실제 구현을 위한 시작점으로 활용될 수 있습니다. 
<br>
<br>

## 99. 참조

### 99.1 참조 문서

* Lightwell의 **Renovate** 도구 [Git](http://github.com/lightwell-network/renovate-config)
  + *`pin-transitives.mjs`* 도구 [로컬](./files/renovate-config/scripts/pin-transitives.mjs) [Git](https://github.com/lightwell-network/renovate-config/blob/main/scripts/pin-transitives.mjs)
<br>
<br>

------
[차례](/README.md)