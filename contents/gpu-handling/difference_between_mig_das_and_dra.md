# GPU 리소스 관리에서 MIG, DAS, 그리고 DRA 비교

**목차**
1. [개요](difference_between_mig_das_and_dra.md#1-개요)<br>
2. [기능별 요약](difference_between_mig_das_and_dra.md#2-기능별-요약)<br>
3. [차이점 설명](difference_between_mig_das_and_dra.md#3-차이점-설명)<br>
   3.1 [요약표](difference_between_mig_das_and_dra.md#31-요약표)<br>
   3.2 [결론](difference_between_mig_das_and_dra.md#32-결론)<br>
<br>
<br>

## 1. 개요

NVIDIA GPU 관리 환경에서 MIG(Multi-Instance GPU), DAS(Dynamic Accelerator Slicer), DRA(Dynamic Resource Allocation)는 GPU 자원 효율성을 높이기 위한 기술이지만, 그 접근 방식과 레이어(하드웨어 vs 소프트웨어)에서 큰 차이가 있습니다.

핵심적인 차이는 MIG는 하드웨어 수준의 정적/독립적 분할, DAS는 쿠버네티스에서 MIG를 동적으로 조절하는 도구, DRA는 차세대 표준화된 동적 자원 할당 프레임워크라는 점입니다. 
<br>
<br>

## 2. 기능별 요약

### 2.1 MIG (Multi-Instance GPU) - "하드웨어 물리적 격리" 

* 정의
  + NVIDIA A100, H100 등 고급 GPU를 하드웨어적으로 최대 7개까지 물리적으로 격리된 인스턴스로 나누는 기술
* 특징
  + 완전한 격리: 각 인스턴스(MIG #1, #2...)는 고유한 SM(Streaming Multiprocessors), 메모리(HBM), 캐시를 가짐
  + 예측 가능한 성능: 다른 MIG 인스턴스의 작업이 내 작업 성능에 영향을 주지 않아 추론(Inference) 시 일관된 속도를 보장
  + 제약: 인스턴스 변경 시 GPU를 재설정해야 하므로 동적인 변경이 어려움
<br>

### 2.2 DAS (Dynamic Accelerator Slicer) - "쿠버네티스 중심의 MIG 관리"

* 정의
  + 레드햇 오픈시프트 환경 등에서 MIG 기술을 사용하여 GPU 파티션을 동적으로 생성/제거하는 오퍼레이터
* 특징
  + 동적 전환: 고정되어 있던 MIG 파티션을 쿠버네티스 포드(Pod) 요구사항에 따라 런타임에 동적으로 만들거나 조절
  + 자동화: 사용자가 MIG 설정을 직접 바꾸지 않아도 포드(Pod) 제출 시점에 맞춰 최적의 MIG 구성을 만듦
  + 현재 상태: DRA 기술이 도입되면서, DAS(InstaSlice)는 중단되고 DRA로 전환
<br>

### 2.3 DRA (Dynamic Resource Allocation) - "쿠버네티스 표준/유연한 할당" 

* 정의
  + 쿠버네티스 v1.26 이상에서 도입된, 디바이스(GPU)를 추상화하여 더 유연하게 요청하고 관리하는 최신 표준 프레임워크
* 특징
  + 제한 없음: 단순히 "GPU 1개"를 요청하는 것이 아니라, "메모리 20GB 이상을 가진 MIG 슬라이스"와 같이 세부 속성(Attributes)으로 요청
  + 벤더가 주도: NVIDIA 등 하드웨어 제조사가 직접 DRA 드라이버를 제공하여, 쿠버네티스에게 기기 상태를 정밀하게 전달
  + 포괄성: DAS의 기능(MIG 동적 분할)뿐만 아니라, 향후 더 복잡한 GPU 공유 및 멀티노드 NVLink 등을 처리할 수 있는 차세대 기술
<br>
<br>

## 3. 차이점 설명

### 3.1 요약표

|비교 항목  |MIG                         |DAS                             |DRA|
|:---:    |:---:                       |:---:                           |:---:|
|핵심 역할  |하드웨어 물리적 분할             |MIG 기반 동적 슬라이싱               |버네티스 표준 동적 자원 할당|
|작동 레이어|하드웨어 레벨<br>(펌웨어/드라이버)  |쿠버네티스 사용자 스페이스<br>(오퍼레이터)|쿠버네티스 컨트롤-플레인<br>(K8S)|
|격리 수준  |매우 높음<br>(SM, 메모리 격리)   |높음<br>(MIG 기반)                 |높음<br>(MIG 기반 사용 가능)|
|유연성/동작 |정적<br>(변경 시 GPU 재설정 필요)|동적<br>(런타임 슬라이싱 자동화)        |매우 동적<br>(요구사항 기반 할당)|
|관리 주체  |NVIDIA 드라이버                |레드햇 오픈시프트 	                  |CNCF/쿠버네티스 (표준)|
|주요 활용  |추론(Inference), 안정성 중심    |포드별 가변적 MIG 활용                |AI 파이프라인/복잡한 클러스터|
|현재 상태  |성숙기<br>(H100/A100 지원)     |중단<br>(DRA로 전환)                |차세대 표준<br>(Alpha/Beta)|
<br>

### 3.2 결론

MIG가 GPU를 나누는 방법(Physical Slicing)이라면, DAS는 요청에 따른 동적으르 나누는 기술은, 그리고 DRA는 그 나누는 기술을 어떻게 쿠버네티스에서 **언제**, **얼마나** 유연하게 쓸 것인가에 대한 소프트웨어적 접근 방식 입니다.

* **MIG**: 안정적이고 격리된 성능
* **DAS**: 기존의 MIG를 요청에 따른 동적 자동화 도구
* **DRA**: 향후 표준이 될, 유연하고 정밀한 차세대 GPU 관리 방식
<br>
<br>

------
[차례](/README.md)