# AI 워크로드를 위한 스마트한 GPU 스케줄링

**목차**
1. [DRA (Dynamic Resource Allocation)](smarter_gpu_scheduling_for_ai_workload.md#1-dra-dynamic-resource-allocation)<br>
2. [리소스 할당 테스트](smarter_gpu_scheduling_for_ai_workload.md#2-리소스-할당-테스트)<br>
   2.1 [테스트 환경 및 GPU 구성](smarter_gpu_scheduling_for_ai_workload.md#21-테스트-환경-및-gpu-구성)<br>
   2.2 [속성 기반 GPU 할당](smarter_gpu_scheduling_for_ai_workload.md#22-속성-기반-gpu-할당)<br>
   2.3 [전체 GPU 할당 요청](smarter_gpu_scheduling_for_ai_workload.md#23-전체-gpu-할당-요청)<br>
   2.4 [컨테이너 간 디바이스 공유](smarter_gpu_scheduling_for_ai_workload.md#24-컨테이너-간-디바이스-공유)<br>
   2.5 [디바이스 요청 시 우선순위가 지정된 대안](smarter_gpu_scheduling_for_ai_workload.md#25-디바이스-요청-시-우선순위가-지정된-대안)<br>
   2.6 [네임스페이스 기반 관리자 액세스](smarter_gpu_scheduling_for_ai_workload.md#26-네임스페이스-기반-관리자-액세스)<br>
3. [요약 및 참조](smarter_gpu_scheduling_for_ai_workload.md#3-요약-및-참조)<br>

<br>
<br>

## 1. DRA (Dynamic Resource Allocation)

### 1.1 디바이스 플러그인 한계 및 DRA 소개

#### 1.1.1 디바이스 플러그인의 한계

쿠버네티스는 버전 1.8부터 디바이스 플러그인 프레임워크를 통해 GPU와 같은 하드웨어 가속기를 지원해 왔습니다. 디바이스 플러그인은 기능적으로는 작동하지만, 특히 AI/ML 워크로드의 경우 규모가 커질수록 문제가 되는 근본적인 한계를 가지고 있습니다.

* 개수 기반 할당만 지원
  + Pod는 `nvidia.com/gpu: 1`과 같이 요청하지만, 어떤 GPU가 필요한지 지정할 방법이 없음
  + 모델, 메모리 용량, 컴퓨팅 성능 또는 드라이버 버전별로 필터링할 수 있는 메커니즘이 없음
* 디바이스 공유 불가
  + 한 컨테이너에 할당된 GPU는 다른 컨테이너와 공유할 수 없음
  + 디바이스 용량의 일부만 사용하는 경량 추론 워크로드의 경우에도 마찬가지
* 토폴로지 인식 불가
  + 스케줄러는 PCIe 토폴로지, NVLink 연결 및 NUMA 배치를 인식하지 못함
  + 멀티 GPU 워크로드는 최적화되지 않은 디바이스 조합에 할당될 수 있음
* 파라미터화 불가
  + 워크로드는 스케줄링 시점에 MIG 프로파일이나 전력 제한과 같은 특정 디바이스 구성을 요청할 수 없음
* 클러스터 자동 확장 기능 통합 불가
  + 자동 확장 기능은 노드를 추가하거나 제거할지 결정할 때 불투명한 장치 리소스를 고려할 수 없음

팀에서는 노드 레이블, 테인트, 허용 오차 및 사용자 지정 승인 웹훅을 사용하여 이러한 제한 사항을 해결하지만, 이러한 방법은 취약하고 오류 발생 가능성이 높으며 확장성이 떨어집니다.
<br>

#### 1.1.2 DRA 소개

오픈시프트 4.21에서는 동적 리소스 할당(DRA)이 정식 출시되어 클러스터 전체에서 GPU 및 가속기 리소스를 요청, 할당 및 공유하는 방식이 근본적으로 바뀝니다. 업스트림 쿠버네티스 1.34 DRA 구현을 기반으로 하는 이번 릴리스는 기존 장치 플러그인 모델의 한계를 극복하고 장치 개수뿐 아니라 장치 속성까지 이해하는 더욱 풍부한 표현식 기반 프레임워크를 제공합니다.

이 글에서는 DRA가 무엇인지, 왜 중요한지, 오픈시프트 4.21의 새로운 기능은 무엇인지, 그리고 NVIDIA A100 GPU가 탑재된 오픈시프트 4.21 클러스터에서 실제 예제를 통해 DRA를 사용하는 방법을 설명합니다.
<br>

### 1.2 동적 리소스 할당(DRA)이란

#### 1.2.1 쿠버네티스 API 프레임워크

* `resource.k8s.io` API 그룹에 속함
* 워크로드가 단순한 개수가 아닌 장치 속성을 기반으로 특정 하드웨어를 요청할 수 있도록 함
* PersistentVolume/PersistentVolumeClaim 모델과 유사하지만 GPU, FPGA, NIC 및 기타 가속기에 적용됨

#### 1.2.2 DRA의 네 가지 핵심 API 객체

* ResourceSlice
  + 각 노드의 DRA 드라이버에서 발행
  + 모델, 메모리, 드라이버 버전, UUID 등과 같은 유형화된 속성을 사용하여 사용 가능한 장치를 설명

* DeviceClass
  + CEL 선택기 표현식을 사용하여 장치 범주를 정의
  + 관리자 또는 드라이버가 생성

* ResourceClaim
  + 특정 장치에 대한 워크로드의 요청
  + CEL 기반 필터링을 지원하고, 파드 간에 공유할 수 있으며, 파드 수명 주기와 관계없이 유지

* ResourceClaimTemplate
  + 쿠버네티스가 파드별 ResourceClaim을 자동으로 생성하는 데 사용하는 템플릿
  + 생성된 클레임은 해당 파드가 종료될 때 삭제

#### 1.2.3 핵심 아키텍처

1. DRA 드라이버가 구조화
2. 투명한 장치 정보(ResourceSlices)를 API 서버에 게시
3. kube-scheduler 자체가 장치 속성에 대한 CEL 표현식을 평가하여 할당 결정을 처리

> [!NOTE]
> 스케줄링 중에 외부 컨트롤러와의 협상이 필요하지 않으므로 DRA는 훨씬 빠르고 클러스터 자동 스케일러와 완벽하게 호환됩니다.
<br>

### 1.3 DRA의 GA 과정

|릴리스        |쿠버네티스|DRA 상태   |마일스톤|
|:---        |:---   |:---      |:---|
|오픈시프트 4.19|1.32   |사용 불가   |구조화된 매개변수를 사용하는 업스트림 DRA 베타 버전 제공; 기존 DRA 버전 철회|
|오픈시프트 4.20|1.33   |기술 미리보기|오픈시프트에서 Nvidia 드라이버 검증을 통해 기술 미리보기 기능 게이트를 통해 DRA 활성화|
|오픈시프트 4.21|1.34   |일반 출시   |DRA 기본 활성화, `resource.k8s.io/v1` API 제공; 베타 API 제거|

> [!NOTE]
> DynamicResourceAllocation 기능 게이트가 기본 기능 세트 `[OCPNODE-3779](https://developers.redhat.com/articles/2026/03/25/dynamic-resource-allocation-goes-ga-red-hat-openshift-421-smarter-gpu#what_is_dynamic_resource_allocation_:~:text=The%20road%20to,served%20by%20default.)`로 승격되었으며, v1 API가 기본적으로 제공되므로 이전의 알파/베타 API 활성화 기능이 제거되었습니다.
<br>
<br>

## 2. 리소스 할당 테스트

### 2.1 테스트 환경 및 GPU 구성

#### 2.1.1 사전 준비

* 오픈시프트 4.21.3 클러스터
* 각 노드는 서로 다른 GPU 레이아웃으로 구성된 세 개의 A100-SXM4-40GB 워커 노드
  + worker01
    - 전체 1g.5gb
    - 7개의 MIG 1g.5gb 슬라이스(각 4.8GB)
  + worker02
    - 전체 3g.20gb
    - 2개의 MIG 3g.20gb 슬라이스(각 19.6GB)
  + worker03
    - MIG 비활성화
    - 1개의 전체 A100 40GB

#### 2.1.2 드라이버를 통한 GPU 확인

```json
{
    "attributes": {
        "architecture":          { "string":  "Ampere" },
        "brand":                 { "string":  "Nvidia" },
        "cudaComputeCapability": { "version": "8.0.0" },
        "cudaDriverVersion":     { "version": "13.0.0" },
        "driverVersion":         { "version": "580.105.8" },
        "productName":           { "string":  "NVIDIA A100-SXM4-40GB" },
        "type":                  { "string":  "gpu" },
        "uuid":                  { "string":  "GPU-ec819aa6-26b9-d90a-00c8-3fcf0a34a0c9" }
    },
    "capacity": {
        "memory": { "value": "40Gi" }
    },
    "name": "gpu-0"
}
```
* GPU 속성 확인
  + 메모리: 40GiB
* 드라이버 확인

#### 2.1.3 GPU 모델에 MIG 슬라이스 설정

```json
{
    "attributes": {
        "architecture":          { "string":  "Ampere" },
        "productName":           { "string":  "NVIDIA A100-SXM4-40GB" },
        "profile":               { "string":  "1g.5gb" },
        "type":                  { "string":  "mig" },
        "uuid":                  { "string":  "MIG-e42ee090-5c43-53b2-a164-c6a0b7ac1a57" },
        "parentUUID":            { "string":  "GPU-e40930a0-c463-2611-3473-bc72ac15679a" }
    },
    "capacity": {
        "memory":           { "value": "4864Mi" },
        "multiprocessors":  { "value": "14" }
    },
    "name": "gpu-0-mig-1g5gb-19-5"
}
```
* MIG 프로파일 확인

> [!NOTE]
> 스케줄러는 이제 제품 이름, 아키텍처, MIG 프로필, 메모리 용량 등을 확인할 수 있습니다. 이는 기존 장치 플러그인 모델에서는 전혀 볼 수 없었던 정보입니다.

#### 2.1.4 디바이스 클래스 확인

```
$ oc get deviceclasses
NAME                                        AGE
gpu.nvidia.com                              12m
mig.nvidia.com                              12m

$
```
* NVIDIA DRA 드라이버는 `DeviceClasses`를 자동으로 생성
  + `gpu.nvidia.com`: 전체 GPU에 해당 
  + `mig.nvidia.com`: MIG 슬라이스에 해당
* 둘 다 ResourceSlice에 게시된 `type` 속성에 대해 CEL 셀렉터를 사용
<br>

### 2.2 속성 기반 GPU 할당

* 핵심 기능
* Pod는 DRA 드라이버에서 제공하는 다음 특정 장치 속성을 기반으로 GPU를 요청
  + 제품 이름
  + 메모리 용량
  + 컴퓨팅 기능
  + 드라이버 버전
  + MIG 프로필
  + 기타 등등 

#### 2.2.1 특정 MIG 프로필 요청

```yaml
apiVersion: resource.k8s.io/v1
kind: ResourceClaimTemplate
metadata:
  name: mig-1g5gb-claim
  namespace: dra-demo
spec:
  spec:
    devices:
      requests:
      - name: mig
        exactly:
          deviceClassName: mig.nvidia.com
          selectors:
          - cel:
              expression: "device.attributes['gpu.nvidia.com'].profile == '1g.5gb'"
```
* 해당 `ResourceClaimTemplate`은 프로필 속성에 대한 CEL 선택기를 사용하여 `1g.5gb` MIG 슬라이스를 요청

#### 2.2.2 포드의 GPU 리소스 참조 확인

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: vectoradd-1g5gb
  namespace: dra-demo
spec:
  restartPolicy: Never
  containers:
  - name: vectoradd
    image: nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0
    resources:
      claims:
      - name: gpu
  resourceClaims:
  - name: gpu
    resourceClaimTemplateName: mig-1g5gb-claim
```
* Pod는 이 템플릿을 참조하고 CUDA `vectorAdd` 샘플을 실행하여 GPU를 실제로 사용할 수 있는지 확인

#### 2.2.3 포드의 로그 확인

```
$ oc logs vectoradd-1g5gb -n dra-demo
[Vector addition of 50000 elements]
Copy input data from the host memory to the CUDA device
CUDA kernel launch with 196 blocks of 256 threads
Copy output data from the CUDA device to the host memory
Test PASSED
Done

$
```
* 포드는 worker01(1GB/5GB 슬라이스가 있는 노드)에서 실행
* 스케줄러는 해당 클레임을 특정 MIG 장치와 연결
<br>

### 2.3 전체 GPU 할당 요청

#### 2.3.1 리소스 클레임

```yaml
apiVersion: resource.k8s.io/v1
kind: ResourceClaim
metadata:
  name: full-gpu-claim
  namespace: dra-demo
spec:
  devices:
    requests:
    - name: gpu
      exactly:
        deviceClassName: gpu.nvidia.com
```
* 디바이스 클래스인 `mig.nvidia.com` 대신 `gpu.nvidia.com`를 사용하여 전체 GPU를 할당받음

#### 2.3.2 할당 내역 확인

```json
{
    "device": "gpu-0",
    "driver": "gpu.nvidia.com",
    "pool": "worker-3",
    "request": "gpu"
}
```
* 포드는 worker03(전체 GPU를 사용할 수 있는 유일한 노드)에 배치
* 할당 내역에는 어떤 장치가 할당되었는지 표시됨

> [!NOTE]
> 노드 선택기, 테인트, 허용 오차는 없습니다. 클레임은 워크로드에 필요한 것을 설명하고 있으며, 스케줄러는 이에 맞는 장치를 찾았습니다.

<br>

### 2.4 컨테이너 간 디바이스 공유

#### 2.4.1 리소스 클레임 및 포드 생성

```yaml
apiVersion: resource.k8s.io/v1
kind: ResourceClaim
metadata:
  name: shared-mig-claim
  namespace: dra-demo
spec:
  devices:
    requests:
    - name: mig
      exactly:
        deviceClassName: mig.nvidia.com
        selectors:
        - cel:
            expression: "device.attributes['gpu.nvidia.com'].profile == '3g.20gb'"
---
apiVersion: v1
kind: Pod
metadata:
  name: shared-gpu-pod
  namespace: dra-demo
spec:
  restartPolicy: Never
  containers:
  - name: vectoradd-1
    image: nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0
    command: ["sh", "-c", "/cuda-samples/vectorAdd && nvidia-smi -L"]
    resources:
      claims:
      - name: gpu
  - name: vectoradd-2
    image: nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0
    command: ["sh", "-c", "/cuda-samples/vectorAdd && nvidia-smi -L"]
    resources:
      claims:
      - name: gpu
  resourceClaims:
  - name: gpu
    resourceClaimName: shared-mig-claim
```
* 동일한 포드 내의 두 컨테이너는 동일한 ResourceClaim을 참조하여 동일한 물리적 디바이스에 접근
* 이는 디바이스 플러그인 프레임워크에서는 불가능한 기능

#### 2.4.2 두 컨테이너가 동일한 MIG 디바이스를 인식하는 것을 확인

```
$ nvidia-smi -L
...<snip>...

=== Container 1 ===
[Vector addition of 50000 elements]
...
Test PASSED
Done
GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-ce5b3123-f4f2-6250-8428-40617e5f9b9d)
  MIG 3g.20gb     Device  0: (UUID: MIG-90155500-9a09-5016-9746-95ef09bd78a6)
=== Container 2 ===
[Vector addition of 50000 elements]
...
Test PASSED
Done
GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-ce5b3123-f4f2-6250-8428-40617e5f9b9d)
  MIG 3g.20gb     Device  0: (UUID: MIG-90155500-9a09-5016-9746-95ef09bd78a6)

...<snip>...

$
```
* 두 컨테이너 모두 `vectorAdd`를 성공적으로 실행
* 동일한 MIG 디바이스를 인식하고 있음
  + 두 컨테이너 모두 동일한 UUID를 사용
  + 이를 통해 경량 추론 사이드카, 모니터링 에이전트 또는 멀티 프로세스 학습 환경에서 리소스 낭비 없이 단일 GPU 할당을 공유
<br>

### 2.5 디바이스 요청 시 우선순위가 지정된 대안

* 업스트림 [KEP-4816](https://github.com/kubernetes/enhancements/issues/4816)을 기반
* 포드가 단일 ResourceClaim 내에서 허용 가능한 디바이스 유형의 우선순위 목록을 지정
* 스케줄러는 우선순위 순서대로 요청을 처리하려고 시도하며, 선호하는 디바이스를 사용할 수 없는 경우 우선순위가 낮은 대안으로 대체

#### 2.5.1 리소스 클레임 템플릿 예제

```yaml
apiVersion: resource.k8s.io/v1
kind: ResourceClaimTemplate
metadata:
  name: prefer-small-mig
  namespace: dra-demo-priority
spec:
  spec:
    devices:
      requests:
      - name: gpu
        firstAvailable:
        - name: prefer-1g5gb
          deviceClassName: mig.nvidia.com
          selectors:
          - cel:
              expression: "device.attributes['gpu.nvidia.com'].profile == '1g.5gb'"
        - name: fallback-3g20gb
          deviceClassName: mig.nvidia.com
          selectors:
          - cel:
              expression: "device.attributes['gpu.nvidia.com'].profile == '3g.20gb'"
```
* 다음은 1g.5gb MIG 슬라이스를 선호하지만, 사용 가능한 슬라이스가 없는 경우 3g.20gb로 대체

#### 2.5.2 선호하는 장치를 사용할 수 있을 때 배포

```yaml
{
    "device": "gpu-0-mig-1g5gb-19-5",
    "driver": "gpu.nvidia.com",
    "pool": "worker01",
    "request": "gpu/prefer-1g5gb"
}
```
* 첫 번째 포드는 1g.5gb 슬라이스를 할당받음
* 할당 요청(`request`) 필드는 첫 번째 대안이 선택되었음을 확인

#### 2.5.3 선호하는 장치의 리소스를 모두 소진 시킴

* 동일한 템플릿을 사용하여 포드 7개를 추가로 배포
* worker01의 1g.5gb 슬라이스 7개를 모두 소진

#### 2.5.4 대체 할당 시작

```
$ oc logs priority-fallback -n dra-demo-priority
[Vector addition of 50000 elements]
...<snip>...
Test PASSED
Done
GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-ce5b3123-f4f2-6250-8428-40617e5f9b9d)
  MIG 3g.20gb     Device  0: (UUID: MIG-90155500-9a09-5016-9746-95ef09bd78a6)
...<snip>...

$
```
* 7개가 모두 사용 중이기 때문에 다음 포드는 1g.5gb 슬라이스를 할당받을 수 없음
* 스케줄러는 자동으로 worker02에서 3g.20bg로 대체 할당을 실행

#### 2.5.5 할당 내역을 통해 대체 할당이 선택되었음을 확인

```json
{
    "device": "gpu-0-mig-3g20gb-9-0",
    "driver": "gpu.nvidia.com",
    "pool": "worker-2",
    "request": "gpu/fallback-3g20gb"
}
```

#### 2.5.6 완전 소진

```
$ oc get pod priority-exhausted -n dra-demo-priority
NAME                 READY   STATUS    RESTARTS   AGE
priority-exhausted   0/1     Pending   0          10s

$ oc get pod priority-exhausted -n dra-demo-priority -o jsonpath='{.status.conditions[0].message}'
0/6 nodes are available: 3 cannot allocate all claims, 3 node(s) had untolerated
taint(s). still not schedulable, preemption: 0/6 nodes are available:
6 Preemption is not helpful for scheduling.

$
```
* 1g.5gb 및 3g.20gb 슬라이스가 모두 소진되면 다음 Pod는 대기(`Pending`) 상태로 유지됨

> [!NOTE]
> 이종 클러스터에서 팀은 더 이상 각 GPU 유형별로 별도의 배포를 수행할 필요가 없습니다. 하나의 ResourceClaimTemplate이 우선순위 로직을 처리하고 스케줄러가 나머지를 처리합니다.
<br>

### 2.6 네임스페이스 기반 관리자 액세스

* 클러스터 관리자는 다른 워크로드에서 이미 사용 중인 장치에 대한 관리자 권한을 얻을 수 있음
* 이는 모니터링, 상태 점검 및 디버깅에 유용하며, 해당 워크로드에는 영향을 주지 않음
* 관리자 액세스를 사용하려면 네임스페이스에 특정 레이블이 지정되어 있어야 하고, ResourceClaim에 `adminAccess: true`를 설정 필요

#### 2.6.1 네임스페이스와 리소스 클레임 생성

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: dra-demo-admin
  labels:
    resource.kubernetes.io/admin-access: "true"
---
apiVersion: resource.k8s.io/v1
kind: ResourceClaim
metadata:
  name: admin-gpu-claim
  namespace: dra-demo-admin
spec:
  devices:
    requests:
    - name: gpu
      exactly:
        adminAccess: true
        deviceClassName: mig.nvidia.com
        selectors:
        - cel:
            expression: "device.attributes['gpu.nvidia.com'].profile == '3g.20gb'"
```
* 

#### 2.6.2 관리자 모니터링 포드 생성

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: admin-monitor
  namespace: dra-demo-admin
spec:
  restartPolicy: Never
  containers:
  - name: monitor
    image: nvcr.io/nvidia/k8s/cuda-sample:vectoradd-cuda12.5.0
    command: ["sh", "-c", "nvidia-smi -L && nvidia-smi && sleep 3600"]
    resources:
      claims:
      - name: gpu
  resourceClaims:
  - name: gpu
    resourceClaimName: admin-gpu-claim
```
* 데모에서는 worker02의 `3g.20gb` 슬라이스가 위의 우선순위 지정 대안 데모에서 사용된 워크로드 포드에 이미 할당되어 있음
* 관리자 모니터링 포드는 관리자 액세스가 활성화된 별도의 네임스페이스에 배포

#### 2.6.3 관리자 모니터링 포드의 실행 결과

포드 내 `nvidia-smi -L` 실행 결과
```
GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-ce5b3123-f4f2-6250-8428-40617e5f9b9d)
  MIG 3g.20gb     Device  0: (UUID: MIG-90155500-9a09-5016-9746-95ef09bd78a6)
+-------------------------------------------------------------------------+
|NVIDIA-SMI 580.105.08       Driver Ver:580.105.08     CUDA Ver: 13.0     |
+-------------------------+------------------------+----------------------+
| GPU  Name     Persistence-M | Bus-Id      Disp.A | Volatile Uncorr. ECC |
| Fan  Temp Perf Pwr:Usage/Cap| Memory-Usage       | GPU-Util Compute M.  |
|=========================+========================+======================|
| 0 NVIDIA A100-SXM4-40GB  On |00000000:00:04.0 Off|                   On |
| N/A   36C    P0 93W /  400W |              N/A   |     N/A      Default |
|                             |                    |              Enabled |
+---------------------------+------------------------+----------------------+
| MIG devices:                                                                            |
+------------------+--------------------+-----------+-----------------------+
| GPU  GI  CI  MIG |Shared Memory-Usage |        Vol|        Shared         |
|      ID  ID  Dev |  Shared BAR1-Usage | SM     Unc| CE ENC  DEC  OFA  JPG |
|==================+================================+===========+===========|
|  0    1   0   0  |107MiB / 20096MiB   | 42      0 |  3   0    2    0    0 |
|                  |               0MiB / 12210MiB  |           |           |
+------------------+--------------------------------+-----------+-----------+
```

#### 2.6.4 할당 내역을 통해 관리자 액세스 권한 확인

```json
{
    "adminAccess": true,
    "device": "gpu-0-mig-3g20gb-9-0",
    "driver": "gpu.nvidia.com",
    "pool": "worker-2",
    "request": "gpu"
}
```

> [!NOTE]
> 한편, 기존 워크로드 Pod는 동일한 장치에서 중단 없이 계속 실행됩니다. 이를 통해 SRE 및 플랫폼 팀은 실행 중인 워크로드를 제거하지 않고도 프로덕션 환경에서 GPU 상태를 모니터링하고 할당 문제를 디버깅할 수 있습니다.
<br>
<br>

## 3. 요약 및 참조

### 3.1 요약

DRA는 업스트림에서 지속적으로 발전하고 있습니다. 쿠버네티스 1.34에서 현재 알파 또는 베타 버전으로 제공되고 향후 오픈시프트 릴리스에 포함될 수 있는 기능은 다음과 같습니다.

* 파티션 가능한 장치
  + 드라이버는 중복되는 논리적 장치 파티션을 알림
  + 실제 할당에 따라 물리적 하드웨어를 동적으로 재구성
* 장치 테인트 및 허용
  + 노드 테인트와 유사하게 장치를 성능 저하 또는 사용 불가능 상태로 표시
  + 워크로드는 테인트가 지정된 장치를 명시적으로 허용
* 네트워크 연결 및 패브릭 연결 가속기에 대한 장치 바인딩 조건 지원은 Pod 스케줄링 전에 노드에 사전 바인딩이 필요
<br>

### 3.2 참조

* 오픈시프트 4.21 문서 - 포드에 GPU 할당 [HTML](https://docs.redhat.com/en/documentation/openshift_container_platform/4.21)
* 쿠버네티스 문서 - DRA [HTML](https://kubernetes.io/docs/concepts/scheduling-eviction/dynamic-resource-allocation/) 
* NVidia DRA 드라이버 - [GitHub](https://github.com/NVIDIA/k8s-dra-driver-gpu)
* GPU를 위한 NVidia DRA 드라이터 - [GitHub](https://github.com/kubernetes-sigs/nvidia-dra-driver-gpu)
* KEP-3063: DRA (Dynamic Resource Allocation) - [GitHub](https://github.com/kubernetes/enhancements/tree/master/keps/sig-node/3063-dynamic-resource-allocation)
* KEP-4816: 디바이스 요청 시, 우선 순위가 높은 대안 설정 - [GitHub](https://github.com/kubernetes/enhancements/issues/4816)
<br>
<br>

------
[차례](/README.md)