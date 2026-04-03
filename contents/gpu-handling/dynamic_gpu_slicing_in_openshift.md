# 오픈시프트 AI 상에 동적 GPU 슬라이싱

**목차**
1. [MIG와 DSA](dynamic_gpu_slicing_in_openshift.md#1-mig와-das)<br>
2. [DAS 테스트](dynamic_gpu_slicing_in_openshift.md#2-das-테스트)<br>
   2.1 [사전 준비](dynamic_gpu_slicing_in_openshift.md#21-사전-준비)<br>
   2.2 [프로젝트 준비](dynamic_gpu_slicing_in_openshift.md#22-프로젝트-준비)<br>
   2.3 [추론 서비스 배포](dynamic_gpu_slicing_in_openshift.md#23-추론-서비스-배포)<br>
   2.4 [사용중인 DAS 확인](dynamic_gpu_slicing_in_openshift.md#24-사용중인-das-확인)<br>
3. [요약 및 참조](dynamic_gpu_slicing_in_openshift.md#3-요약-및-참조)<br>

<br>
<br>

## 1. MIG와 DAS

### 1.1 MIG의 한계

#### 1.1.1 MIG의 단점

인공지능(AI)과 머신러닝 시대에 효율적인 리소스 관리는 매우 중요합니다. 레드햇 오픈시프트 관리자는 GPU 비용이 상당한 플랫폼에서 집약적인 AI 워크로드를 배포해야 하는 과제에 직면해 있습니다. NVIDIA의 멀티 인스턴스 GPU(MIG)를 사용한 **사전** 슬라이싱과 같은 기존 방식은 특히 고정된 슬라이스가 동적 워크로드 요구 사항과 일치하지 않을 때 리소스 낭비를 초래할 수 있습니다.

이 글에서는 동적 가속기 슬라이서(DAS: Dynamic Accelerator Slicer) 오퍼레이터를 통해 구현되는 동적 GPU 슬라이싱이 워크로드 요구 사항에 따라 할당을 동적으로 조정함으로써 오픈시프트의 GPU 리소스 관리를 어떻게 향상 시키는 지 살펴봅니다.

#### 1.1.2 MIG 사용 시의 GPU 활용의 과제

오픈시프트는 NVIDIA GPU 오퍼레이터를 지원합니다. 그러나 MIG와 같은 방식에는 다음과 같은 몇 가지 한계가 있습니다.

* 경직된 슬라이싱
  + 미리 정의된 MIG 슬라이스가 Pod의 실제 리소스 요구 사항과 일치하지 않아 활용률 낮아짐
* 정적 할당
  + 노드 시작 시 GPU 슬라이스를 할당하고, 이후에 워크로드가 변경될 경우, 관리자는 노드를 재구성해야 하므로 종종 서비스 중단 발생
* 동적 프로비저닝 부족
  + 필요에 따라 GPU 리소스를 할당할 수 없으면 클러스터는 GPU를 과잉 할당하거나 활용률이 낮아져 운영 비용이 증가

이러한 문제들은 각 워크로드가 필요한 만큼만 리소스를 사용할 수 있도록 GPU를 부분적으로 공유할 수 있는 보다 유연한 접근 방식의 필요성을 강조합니다.
<br>

### 1.2 동적 가속기 슬라이서 (DAS)

#### 1.2.1 DAS 소개

* DAS 오퍼레이터는 개발 단계에서 또 다른 기능인 **동적 리소스 할당(DRA: Dynamic Resource Allocation)** 확장되어 대체되었음 
* 오픈시프트에서 GPU 슬라이스를 동적으로 할당하고 관리하도록 설계
* 주요 목표
  + 동적 할당: Pod의 리소스 요청 및 제한 사항에 따라 MIG 슬라이스를 정확하게 프로비저닝
  + 지능형 스케줄링: 쿠버네티스 스케줄링 게이트를 활용하여 필요한 GPU 슬라이스를 사용할 수 있을 때까지 Pod를 대기시킴
  + 원활한 통합: NVIDIA GPU 오퍼레이터와 함께 작동하여 Pod 사양을 변경하지 않고도 GPU 슬라이스를 관리
  + 자동화된 수명 주기 관리: 할당을 추적하고 워크로드가 완료되면 GPU 슬라이스를 자동으로 해제

#### 1.2.2 동적 GPU 슬라이싱 작동 방식

동적 GPU 슬라이싱은 오픈시프트의 스케줄링 기본 요소를 활용하여 다음 세 단계 프로세스를 통해 리소스 사용을 최적화

1. 동적 할당 및 배치
   + Pod가 GPU 리소스를 요청하면 쿠버네티스 스케줄링 게이트를 통해 사전 예약된 상태로 유지
   + 오퍼레이터는 워크로드가 실행 준비가 되었을 때만 필요한 GPU 슬라이스를 동적으로 할당하여 사전 슬라이싱과 관련된 비효율성을 방지

2. NVIDIA GPU 오퍼레이터와의 통합
   + NVIDIA GPU 오퍼레이터의 강력한 기능을 활용하는 동적 가속기 슬라이서는 슬라이스 할당을 관리하는 외부 컨트롤러를 도입
   + 이를 통해 GPU 관리가 안정적으로 유지되고 슬라이싱 메커니즘이 기존 에코시스템에 원활하게 통합

3. 자동화된 슬라이스 수명 주기 관리
   + 할당부터 할당 해제까지 오퍼레이터는 GPU 슬라이스의 전체 수명 주기를 관리
   + 이러한 자동화는 리소스 관리를 간소화할 뿐만 아니라 Pod 실행이 완료되면 리소스가 즉시 풀로 반환되도록 보장

> [!NOTE]
> DAS는 쿠버네티스 Quota 및 Kueue를 통해 GPU 메모리 할당량 관리를 확장하고, 다양한 워크로드 요구 사항을 충족하기 위해 효율적인 패킹을 통한 동적 정책 기반 슬라이싱을 도입합니다.
<br>
<br>

## 2. DAS 테스트

### 2.1 사전 준비

* 오픈시프트 클러스터
  + NVidia A100 * 4*ea*가 장착된 워커 노드
  + nvidia-driver-daemonset-417이상의 드라이버
* `oc` CLI 도구
* 오퍼레이터 SDK (오퍼레이터 번들 실행을 위해 필요)
<br>

### 2.2 프로젝트 준비

#### 2.2.1 프로젝트 생성

```bash
oc new-project instaslice-system 
```

#### 2.2.2 오퍼레이터 번들 실행

```bash
operator-sdk run bundle quay.io/ibm/instaslice-bundle:0.0.1 -n instaslice-system
```
* 오픈시프트 클러스터에 오퍼레이터를 배포
* 기존 NVIDIA GPU 설정과 함께 GPU 슬라이스를 동적으로 관리
<br>

### 2.3 추론 서비스 배포

#### 2.3.1 오픈시프트 워커 노드 상에 GPU 확인

실행 명령어
```bash
nvidia-smi -L
```

실행 결과
```
[root@worker01]# nvidia-smi -L 
GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-42db43a1-526e-626d-ff2d-456bf26d9df0)
GPU 1: NVIDIA A100-SXM4-40GB (UUID: GPU-143a66c4-bd69-7559-8898-26f9886a2a56)
GPU 2: NVIDIA A100-SXM4-40GB (UUID: GPU-7d9ad99b-3d06-cf12-bab8-e1f31672e01f)
GPU 3: NVIDIA A100-SXM4-40GB (UUID: GPU-7cf6fcb8-d173-0224-618c-4813e24a3383)

[root@worker01]#
```
* 이 GPU들을 분할하여 여러 개의 LLM 추론 모델을 실행

#### 2.3.2 vLLM 배포 예제 파일 확인

~/[vllm_deployment.yaml](./files/vllm_deployment.yaml)
```yaml
#...<snip>...

apiVersion: v1
kind: Secret
metadata:
  name: huggingface-secret
type: Opaque
data:
  HF_TOKEN: <YOUR_TOKEN> # Base64-encoded value of 'your_huggingface_secret_token'

#...<snip>...
```
* 오브젝트 *secret*의 **HF_TOKEN** 값을 자신의 허깅페이스의 토큰 값으로 설정

#### 2.3.3 vLLM 배포

```bash
oc apply -f vllm_deployment.yaml
```
* 샘플 모델은 용량이 상당히 크기 때문에 네트워크 속도에 따라 다운로드하는 데 시간이 다소 걸림

#### 2.3.4 vLLM 배포 확인

실행 명령어
```bash
oc get deployments vllm 
```

실행 결과
```
$ oc get deployments vllm 
NAME   READY   UP-TO-DATE   AVAILABLE   AGE
vllm   1/1     1            1           35s

$
```

### 2.4 사용중인 DAS 확인

#### 2.4.1 vLLM 포드 확인

```
$ oc get pods  vllm-7dbb49b8f8-znd4s -o json | jq .metadata.uid
"98c08795-2da3-4598-81b7-538c4e37093b"
$
```
* 포드의 UUID: 98c08795-2da3-4598-81b7-538c4e37093b

#### 2.4.2 GPU가 장착된 워커노드의 인스트 슬라이스 확인

실행 명령어
```bash
oc get instaslice work01 -o json | jq .status.podAllocationResults
```

실행 결과 - JSON 형식
```json
{
  "98c08795-2da3-4598-81b7-538c4e37093b": {
    "allocationStatus": {
      "allocationStatusController": "ungated",
      "allocationStatusDaemonset": "created"
    },
    "configMapResourceIdentifier": "a02ae459-0618-4804-83f9-e5ba36af756f",
    "gpuUUID": "GPU-143a66c4-bd69-7559-8898-26f9886a2a56",
    "migPlacement": {
      "size": 4,
      "start": 0
    },
    "nodename": "worker01"
  }
}
```
* 할당에 사용된 GPU의 UUID: GPU-143a66c4-bd69-7559-8898-26f9886a2a56

#### 2.4.3 해당 워커노드에서 GPU 확안

실행 명령어
```bash
nvidia-smi -L
```

실행 결과
```
[root@worker01]# # nvidia-smi -L 
GPU 0: NVIDIA A100-SXM4-40GB (UUID: GPU-42db43a1-526e-626d-ff2d-456bf26d9df0)
GPU 1: NVIDIA A100-SXM4-40GB (UUID: GPU-143a66c4-bd69-7559-8898-26f9886a2a56) <<< 
  MIG 3g.20gb     Device  0: (UUID: MIG-b065e8ea-01ff-598f-83fd-3eea1f2869b9)
GPU 2: NVIDIA A100-SXM4-40GB (UUID: GPU-7d9ad99b-3d06-cf12-bab8-e1f31672e01f)
GPU 3: NVIDIA A100-SXM4-40GB (UUID: GPU-7cf6fcb8-d173-0224-618c-4813e24a3383)

[root@worker01]#
```
* GPU UUID가 일치하는 GPU-1에 MIG가 생성된 것 확인

#### 2.4.4 모델의 엔드포인트 포트 포워딩

```bash
oc port-forward svc/vllm 8000:8000 -n instaslice-system
```

#### 2.4.5 모델 추론 서비스 테스트

실행 명령어
```bash
curl http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "facebook/opt-125m",
    "prompt": "San Francisco is a",
    "max_tokens": 7,
    "temperature": 0
  }' | jq '.'
```

실행 결과 - JSON 출력
```json
{
  "id": "cmpl-474b5727068745baa4718925bcfa8f91",
  "object": "text_completion",
  "created": 163554,
  "model": "facebook/opt-125m",
  "choices": [
    {
      "index": 0,
      "text": " great place to live.  I",
      "logprobs": null,
      "finish_reason": "length"
    }
  ],
  "usage": {
    "prompt_tokens": 5,
    "total_tokens": 12,
    "completion_tokens": 7
  }
}
```

> [!NOTE]
> 추론 서비스를 삭제하면, DAS는 해당 GPU에서 상응하는 슬라이스를 자동으로 동적 삭제합니다.

<br>
<br>

## 3. 요약 및 참조

### 3.1 요약

#### 3.1.1 동적 GPU 슬라이싱의 이점

동적 GPU 슬라이싱을 도입하면 다음과 같은 여러 가지 이점을 얻을 수 있습니다.

* 활용률 향상
  + 워크로드가 GPU 슬라이스를 효율적으로 활용
  + 필요한 부분이 일부일 때 전체 GPU를 예약할 필요가 줄어듬
* 비용 절감
  + 실제로 사용하는 리소스에 대해서만 비용을 지불
  + 기업은 GPU 관련 비용을 크게 절감
* 원활한 확장성
  + 동적 할당을 통해 클러스터는 변화하는 워크로드에 실시간으로 적응하여 최적의 성능과 리소스 분배 보장

#### 3.1.2 쿠버네티스 DRA와 통합

쿠버네티스 동적 리소스 할당(DRA) 프레임워크는 GPU 스케줄링에 대한 더욱 세밀한 제어를 제공하는 것을 목표로 합니다. DRA는 오픈시프트 4.21에서 GA 되었으며, 동적 가속기 슬라이서는 현재 실용적이고 프로덕션 환경에 바로 적용 가능한 솔루션을 제공합니다. 이는 향후 개선 사항을 위한 기반을 마련하여 오픈시프트 사용자가 리소스 효율성의 한계를 지속적으로 확장할 수 있도록 지원합니다.

효율적인 GPU 관리는 오픈시프트에서 AI 워크로드의 성능을 극대화하는 데 필수적입니다. 동적 가속기 슬라이서 오퍼레이터는 리소스 사용을 최적화하고 운영 비용을 절감하며 최신 AI 애플리케이션의 변동하는 요구 사항에 원활하게 적응하는 동적 GPU 슬라이싱을 제공합니다.

이 혁신적인 접근 방식은 NVIDIA GPU 오퍼레이터와 동적으로 통합되고 오픈시프트의 스케줄링 기능을 활용하여 GPU 할당을 정적이고 비효율적인 프로세스에서 동적이고 온디맨드 방식의 서비스로 전환합니다. 동적 GPU 슬라이싱을 도입하는 것은 오픈시프트 환경에서 AI 워크로드의 잠재력을 최대한 발휘하는 데 중요한 단계입니다.
<br>

### 3.2 참조

* DAS 프로젝트 [GitHub](https://github.com/openshift/instaslice-operator/tree/release-0.0.2)
  + vLLM 배포 예제 [YAML](https://github.com/openshift/instaslice-operator/blob/release-0.0.2/samples/vllm_deployment.yaml)
<br>
<br>

------
[차례](/README.md)