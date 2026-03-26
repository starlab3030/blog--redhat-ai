# vLLM 기반 추론 서비스 성능 진단 가이드 예제

**목차**
1. []()<br>
2. []()<br>
<br>
<br>

## 1. 추론 서비스 성능과 기준

이 글은 [vLLM 성능 문제 해결을 위한 5단계](five_steps_to_address_vllm_performance.md) 블로그를 기반으로 작성되었으며, 일반적인 LLM 추론 배포 환경에서 성능 병목 현상을 진단하는 예제 가이드 입니다.

특히 단일 복제본, 단일 노드 구성에 초점을 맞추고 있습니다. 이 글에서는 다중 노드 또는 다중 복제본 배포, 도구 호출 또는 구조화된 출력 워크플로, 그리고 연쇄 추론과 같은 추론 모델을 명시적으로 제외하고, 해당 환경에서 발생하는 일반적인 성능 문제를 다룹니다. 이러한 시나리오에서는 많은 원칙이 더 광범위한 환경에도 적용되지만, 추가적인 성능 고려 사항이 발생하므로 이 문서의 범위를 벗어납니다.
<br>
<br>

## 2. 진단 가이드 예제 - TTFT & ITL

TTFT와 ITL 중 어떤 것이 더 효과적인지 파악하고 다음 절차를 통해 성능 문제의 근본 원인을 식별합니다.

### 2.1 높은 TTFT (슬로우 스타트 및 슬로우 프리필)

#### 2.1.1 시나리오 1

**메트릭 확인**
* vLLM이 기본 8080 포트로 프로메테우스 메트릭을 노출
  ```bash
  # Check all metrics
  curl http://localhost:8000/metrics
  ```
* 특정 메트릭을 필터링
  ```
  $ watch -n 1 'curl -s http://localhost:8000/metrics | grep -E "vllm:(num_requests_waiting|num_requests_running|kv_cache_usage_perc)" | grep -v "^#"'
  vllm:num_requests_running{engine="0",model_name="RedHatAI/gemma-3-1b-it-quantized.w8a8"} 256.0
  vllm:num_requests_waiting{engine="0",model_name="RedHatAI/gemma-3-1b-it-quantized.w8a8"} 455.0
  vllm:kv_cache_usage_perc{engine="0",model_name="RedHatAI/gemma-3-1b-it-quantized.w8a8"} 0.2758125

  ...<snip>...

  ```
  + 455개의 요청이 큐에서 대기
  + KV 캐시는 27.58%(0.2758) 사용

**이슈 확인 및 해결**
* 확인 사항
  + `num_requests_waiting`이 `0`보다 큼 (요청이 실제로 대기열에 있음)
  + 동시에 `kv_cache_usage_perc`이 90% 초과 (KV 캐시가 거의 가득 찼음)
* 진단
  + 시스템 대기열이 가득 찼음
  + 새로운 요청은 대기열이 생길 때까지 기다려야 함
* 해결 방법
  + GPU를 추가하거나 용량이 더 큰 GPU를 사용 (스케일-업)
  + 추론 서비스 복제본을 추가 (스케일-아웃)
  + 더 작은 모델이나 양자화된 모델(AWQ/GPTQ/FP8)을 사용

#### 2.1.2 시나리오 2

**이슈 확인 및 해결**
* 확인 사항
  + `num_requests_waiting` 값이 0에 가까움
* 진단
  + 컴퓨팅 경계 사전 채우기 문제
  + 프롬프트(ISL)가 매우 길어서(예: 대규모 RAG 컨텍스트) 처리하는 데 시간이 오래 걸림
* 해결 방법
  + GPU/복제본 추가
  + llm-d를 통한 분리된 사전 채우기 & 디코딩
<br>

### 2.2 높은 ITL (슬로우 제너레이션)

#### 2.2.1 시나리오 1

* 확인 사항
  + 단일 사자 환경에서도 속도가 느려짐
  + 한 번에 한 명의 사용자만 처리해도 시스템 속도가 느림
* 진단
  + 컴퓨팅/대역폭 제한 (하드웨어 자체가 병목 현상이며, 동시성/배치 처리는 병목 현상이 아님)

* 확인 사항
  + 모델이 GPU에 분산되어 실행되고 있는가(Tensor Parallel)?
    ```
    $ podman inspect <rhaiis> --format='{{.Args}}'
    [-m vllm.entrypoints.openai.api_server --tensor-parallel-size 1 --max-model-len 8192 --enforce-eager --model RedHatAI/gemma-3-1b-it-quantized.w8a8]
    
    $
    ```
    - TP가 1로 설정되어 있음

* 확인 사항
  + 모델이 단일 GPU에서 실행 중입니까?
  + 이 때문에 GPU의 메모리 대역폭에 제약을 받고 있습니까?
* 진단
  + NVLink를 사용 중이지 않으며, PCIe를 통해서 TP를 생힐 중
    ```bash
    nvidia-smi topo -m
    ```
* 해결 방법
  + 더 큰 용량의 GPU(더 넓은 메모리 대역폭)를 사용
  + NVLink로 연결된 여러 GPU에서 텐서 병렬 처리 활용

#### 2.2.2 시나리오 2

* 확인 사항
  + 사용자가 많을 때만 속도가 느져림
* 진단
  + 배치 크기 영향
* 설명
  + ITL(처리 시간 지연)은 배치 크기에 비례
  + vLLM은 처리량을 최대화하기 위해 요청을 배치로 처리하지만, 이로 인해 토큰당 지연 시간이 증가
  + 배치에 포함된 요청 수가 많을수록 각 토큰 생성 속도가 느려짐
* 해결 방법
  + ITL을 낮춰야 하는 경우, 부하를 분산하기 위해 더 많은 복제본을 실행하여 배치 크기를 줄일 수 있음
  + vLLM의 `–max-num-seqs`(vLLM이 동시에 처리할 최대 요청 수)를 설정하여 배치 크기를 제어하고 ITL을 줄일 수 있지만, 동시 요청 수가 최대 배치 크기를 초과하면 큐잉이 발생할 수 있음
<br>

### 2.3 처리량 확장성이 떨어짐 (동시 접속자 수가 증가할수록 성능이 저하됨)

#### 2.3.1 시나리오 1

* 확인 사항
  + `kv_cache_usage_perc`가 100%에 가깝고 `num_requests_waiting`이 0보다 큽니까?
    ```bash
    watch -n 1 'curl -s http://localhost:8000/metrics | grep -E "vllm:(num_requests_waiting|kv_cache_usage_perc)" | grep -v "^#"'
    ```
* 진단
  + 메모리 부족으로 GPU에 더 이상 동시 요청을 처리할 수 없으며, 추가 사용자는 대기열에 쌓이게 되어 TTFT(Time To Fly-out)가 증가

#### 2.3.2 시나리오 2

* 현상
  + 서버 과부하 상태에서 긴 사전 입력 작업이 실행될 경우, 다른 처리 중인 요청의 디코딩 단계가 일시적으로 지연되어 배치에 포함된 모든 요청의 ITL이 급증
* 해결 방법
  + vLLM은 청크 사전 입력(기본적으로 활성화됨)을 통해 이러한 문제를 완화
  + 청크 사전 입력은 긴 사전 입력 작업을 더 작은 청크로 나누어 디코딩 단계와 번갈아가며 처리
  
* 현상
  + 새로운 긴 프롬프트 요청이 도착할 때 주기적인 ITL 급증이 발생하는 경우
* 해결 방법
  + 청크 사전 입력이 의도대로 작동하고 있는 것
  + 이러한 급증은 `--max-num-batched-tokens` 설정을 조정해야 할 수도 있음
<br>
<br>

## 3. vLLM 프로메테우스 메트릭

### 3.1 지연 관련 지표

#### 3.1.1 지연 관련 세가지 지표

* 세 가지 지표(E2E 지연 시간, TTFT, ITL)를 살펴보면 병목 현상을 좁힐 수 있음
  + 예1) E2E 지연 시간과 TTFT는 높지만 ITL이 낮다면 서버에 과부하가 걸려 요청이 큐에 쌓이고 있을 가능성이 있음
  + 예2) 또한 입력 프롬프트가 너무 길어 사전 입력 시간이 길어지는 경우도 있을 수 있음

* 이러한 지표는 서버 측에서 측정되며 네트워크 또는 수신 지연 시간은 포함되지 않음
  + 클라이언트 측에서 측정한 지연 시간이 vLLM에서 보고하는 값보다 현저히 높다면, 그 차이는 네트워크 경로, 로드 밸런서 또는 프록시 계층에서 발생했을 가능성이 높음

#### 3.1.2 E2E 요청 지연 - vLLM에서 전체 요청을 처리하는 데 걸리는 총 시간

```sql
histogram_quantile(0.5, sum by(model_name, pod, le)(rate(vllm:e2e_request_latency_seconds_bucket{}[1m])))
```

#### 3.1.3 TTFT 지연 - 대기 시간 + 사전 채우기 단계

```sql
histogram_quantile(0.5, sum by(model_name, pod, le)(rate(vllm:time_to_first_token_seconds_bucket{}[1m])))
```

#### 3.1.4 ITL 지연 - 생성된 토큰 사이의 시간 간격 (디코딩 단계)

```sql
histogram_quantile(0.5, sum by(model_name, pod, le)(rate(vllm:inter_token_latency_seconds_bucket{}[1m])))
```
<br>

### 3.2 서버 포화를 감지하기 위한 주요 시스템 상태 메트릭

```sql
vllm:num_requests_running
```
* 현재 처리 중인 요청의 수

```sql
vllm:num_requests_waiting
```
* 대기 중인 요청
* 시스템의 동시 처리 한도에 도달하여 대기열에 있는 요청
* 장시간 동안 0보다 큰 값이 유지되면 서버가 포화 상태임을 나타냄

```sql
vllm:request_queue_time_seconds_sum
```
* vLLM에서 요청이 대기열에 머무르는 총 시간
* 대기 시간은 스케줄링부터 토큰화 오버헤드까지 다양한 원인으로 발생할 수 있음
* 비정상적으로 높은 값은 서버 포화 상태를 나타낼 수 있음

```sql
vllm:kv_cache_usage_perc
```
* 현재 KV 캐시 사용률
* 이 값이 약 100%이면 메모리 포화 상태임을 나타냄

```sql
vllm:num_preemptions_total
```
* 메모리 확보를 위해 생성 도중 중단된 누적 요청 수
* 요청 수가 증가하면 심각한 메모리 과부하를 나타냄
<br>
<br>

## 4. 로그 분석을 통한 진단

### 4.1 시작 시의 용량 점검

vLLM은 시작 시 사용 가능한 메모리를 기반으로 KV 캐시의 정확한 용량을 계산하며, 이는 모델이 하드웨어에 맞게 "적절한 크기"로 설계되었는지 확인하는 데 매우 중요합니다.

#### 4.1.1 시나리오 1

각각 80GB의 VRAM을 가진 2개의 H100(텐서 병렬) GPU에 32B 파라미터의 FP16 모델을 로드하려고 시도
```
(APIServer pid=1) (EngineCore_DP0 pid=222) (Worker_TP0 pid=228) INFO 02-11 18:41:49 [v1/worker/gpu_worker.py:358] Available KV cache memory: 38.46 GiB
(APIServer pid=1) (EngineCore_DP0 pid=222) INFO 02-11 18:41:49 [v1/core/kv_cache_utils.py:1305] GPU KV cache size: 315,072 tokens
(APIServer pid=1) (EngineCore_DP0 pid=222) INFO 02-11 18:41:49 [v1/core/kv_cache_utils.py:1310] Maximum concurrency for 10,000 tokens per request: 31.5x
```
* 로그를 보면 요청당 10,000 토큰에 대한 최대 동시 처리 용량은 31.5배
* 이 설정은 각 요청이 10,000 토큰(프롬프트 + 출력)인 경우 최대 31명의 동시 사용자를 처리하기에 충분
* 처리해야 하는 시퀀스 크기가 더 작다면 배치 크기를 훨씬 더 크게 설정할 수 있음

#### 4.1.2 시나리오 2 

```
Available KV cache memory: 4.46 GiB
Maximum concurrency for 10,000 tokens per request: 1.83x
```
* 메모리 제약 모델(1xH100에서 실행되는 32비트 FP16 모델)은 가중치와 오버헤드 계산에 거의 모든 80GB GPU 메모리를 사용
  + 캐시에 남은 공간이 4.4GiB에 불과하기 때문에 서버는 한두 명 이상의 사용자가 동시에 접속할 경우 성능 저하를 겪을 수 있음
* 로그에 사용 가능한 KV 캐시 메모리가 매우 낮게 표시되는 경우, 다음 방법을 사용하여 활성 요청을 위한 공간을 확보
  + 모델의 양자화 버전을 사용
  + 더 작은 모델을 사용
  + 더 많은(또는 더 큰) GPU를 사용
<br>

### 4.2 vLLM 로그를 사용하여 시스템 상태 분석

#### 4.2.1 서버 활용도가 높지만 과부하가 걸리지 않은 경우 로그는 다음과 같이 표시

```
(APIServer pid=1) INFO 02-11 17:06:59 [v1/metrics/loggers.py:257] Engine 000: Avg prompt throughput: 6003.6 tokens/s, Avg generation throughput: 1524.3 tokens/s, Running: 39 reqs, Waiting: 0 reqs, GPU KV cache usage: 68.9%, Prefix cache hit rate: 29.7%
```
* `Waiting: 0 reqs`: 큐에 대기 중인 요청이 0
* `GPU KV cache usage: 68.9%`: KV 캐시 사용률이 90% 미만

#### 4.2.2 서버가 포화 상태인 경우

대기 중인 요청이 많고 GPU KV 캐시 사용률이 거의 100%에 달함
```
(APIServer pid=1) INFO 02-11 17:11:59 [v1/metrics/loggers.py:257] Engine 000: Avg prompt throughput: 4033.8 tokens/s, Avg generation throughput: 948.2 tokens/s, Running: 60 reqs, Waiting: 21 reqs, GPU KV cache usage: 99.8%, Prefix cache hit rate: 32.2%
```
* `Waiting: 21 reqs`: 큐에 대기 중인 요청이 21개
* `GPU KV cache usage: 99.8%`: KV 캐시 사용률이 100%에 가까움
<br>
<br>

## 5. 시스템 리소스 및 시퀀스 길이

### 5.1 리소스 크기 및 하드웨어 제약 조건

하드웨어 한계를 이해하는 것이 성능 문제를 진단하는 첫 번째 단계입니다.

#### 5.1.1 VRAM 할당

* GPU 메모리의 주요 사용 영역
  + 모델 가중치(정적, 모델 크기와 정밀도에 따라 결정됨)
  + 키-값 캐시(동시 실행 수와 시퀀스 길이에 따라 확장됨)

* 추가적으로 메모리가 사용되는 영역
  + 활성화 메모리
    - 순방향 패스 중에 중간 레이어 출력을 저장하는 데 사용되는 임시 메모리
    - 배치 크기와 시퀀스 길이에 따라 확장되며, 추론 시 모델 가중치 메모리의 10~30%를 차지함
  + 시스템 오버헤드
    - CUDA, PyTorch에서 사용하는 메모리
  + Torch 이외의 메모리
    - CUDA 그래프, 사용자 정의 커널

#### 5.1.2 KV 캐시 메모리

```
kv_cache_memory ≈ batch_size × seq_len × hidden_size × num_layers × 2 × dtype_size
```
* KV 캐시 크기는 다음 요소에 따라 달라짐
  + 배치에 포함된 시퀀스 수
  + 시퀀스 길이 (프롬프트 + 생성)
  + 모델 은닉층 크기
  + 어텐션 헤드 수
  + 레이어 수

#### 5.1.3 모델 가중치

* GPU에 로드되는 모델 매개변수의 크기
* 모델이 GPU에 적합한지 확인하는 공식
  ```
  model_memory ≈ num_parameters × dtype_size
  ```
* 예제 - FP16/BF16 (2 Bytes)
  + Llama-3-70B: 70 × 2 = 140 GB
  + 결과
    - 단일 H100 (80GB) 초과
    - 2개 이상의 GPU에서 텐서 병렬 처리(TP)가 필요
* 예제 - FP8 (1 Byte)
  + Llama-3-70B: 70 × 1 = 70 GB
  + 결과
    - 단일 H100에 맞음
    - KV 캐시를 위해 ~10GB 남음
* 예제 - INT4/MXFP4 (0.5 Bytes)
  + gpt-oss-120b: 120 × 0.5 = 60 GB
  + 결과
    - 단일 H100에 맞음
    - 파라미터 수가 많음에도 불구하고 KV 캐시에 약 20GB의 여유 공간이 남음

#### 5.1.4 용량 병목 현상

* 가중치가 VRAM의 75% 이상을 사용하는 경우, 키-값 캐시에 사용할 수 있는 공간이 부족해짐
* 이로 인해 부하가 낮은 상황에서도 요청이 큐에 쌓여 TTFT가 높아질 수 있음
* 해결 방안
  + 멀티 GPU 배포: 모델에 여러 개의 GPU(TP/EP/PP)가 필요한 경우, 상호 연결 속도가 매우 중요
  + NVLink: 텐서 병렬 처리(TP)에서 낮은 지연 시간을 유지하는 데 필수적
  + PCIe 전용 또는 공유 메모리 대신 NVLink 사용
    - 표준 PCIe 레인을 통해 TP를 실행하면 동기화 속도가 느려져 ITL(Inter-Token Latency)이 크게 저하됨
<br>

### 5.2 시퀀스 길이의 중요성

#### 5.2.1 시퀀스 길이(ISL/OSL)

* 입력 시퀀스 길이(ISL: Input Sequence Length)
  + 프롬프트에 포함된 토큰 수
  + ISL이 높을수록 프리필에 필요한 연산량이 증가하여 TTFT가 직접적으로 증가
* 출력 시퀀스 길이(OSL: Output Sequence Length)
  + 생성된 토큰 수
  + OSL이 높을수록 E2E 지연 시간이 선형적으로 증가하고 GPU 슬롯 점유 시간이 길어짐
* 총 시퀀스 길이
  + KV 캐시 사용량은 모든 활성 요청의 ISL과 OSL 합계로 결정

#### 5.2.2 예제 - vLLM 배포 환경에서 ISL이 각각 다른 토큰 수를 가질 때

* 1,000 토큰 ISL을 가진 400개의 요청을 병렬로 처리
  + 허용 가능한 지연 시간을 달성 가능
* 요청의 ISL이 각각 10,000 토큰인 경우
  + KV 캐시 공간 부족으로 인해 vLLM이 병렬로 처리하지 못할 수 있음

#### 5.2.3 시퀀스 길이를 확인하는 PromQL 쿼리

```bash
# 95th percentile prompt length
histogram_quantile(0.95, rate(vllm:request_prompt_tokens_bucket[5m]))

# 95th percentile output length
histogram_quantile(0.95, rate(vllm:request_generation_tokens_bucket[5m]))

# Median output length
histogram_quantile(0.5, rate(vllm:request_generation_tokens_bucket[5m]))
```

#### 5.2.4 검색 증강 생성(RAG)에 대한 참고 사항

* RAG 파이프라인의 일부인 vLLM 배포 환경
* 간단한 사용자 쿼리가 벡터 데이터베이스에서 검색된 컨텍스트를 포함하는 대규모 프롬프트로 확장되는 경우가 많음
* 이 경우에 발생할 수 있는 이슈
  + 이러한 대규모 프롬프트를 처리하는 데 필요한 컴퓨팅 작업으로 인해 TTFT(처리 시간)가 높아질 수 있음
  + 또한 벡터 데이터베이스 조회로 인해 요청에 추가적인 지연 시간이 발생할 수 있으며, 이는 vLLM TTFT 지표에 반영되지 않음

> [!NOTE]
> ```
> num_requests_running + num_requests_waiting = vLLM이 알고 있는 총 요청 수
> ```
> 이 숫자가 일치하지 않으면 요청이 vLLM에 도달하기 전에 무언가가 요청을 차단하고 있는 것입니다.
<br>
<br>

## 6. 개선 조치

vLLM은 다양한 고급 설정을 제공하지만, 성능 문제는 CLI 매개변수 조정만으로는 해결하기 어려운 경우가 많습니다. 병목 현상을 파악했다면 다음과 같은 효과적인 최적화 방안을 고려해 볼 수 있습니다.

### 6.1 하드웨어 확장

* 시스템이 지속적으로 포화 상태(높은 `num_requests_waiting`)라면 리소스가 더 필요할 가능성이 높음
* 더 강력한 GPU와 더 높은 메모리 대역폭을 활용하거나, 로드 분산을 위해 복제본을 추가하는 등의 방법을 고려

### 6.2 양자화

* 키-값(KV) 캐시 공간이 부족하거나 ITL 속도가 느리다면 FP16 모델에서 양자화된 FP8 모델로 전환하는 것이 매우 효과적
* Llama-3-70B와 같은 모델의 경우, 이를 통해 메모리 사용량을 140GB에서 70GB로 절반으로 줄일 수 있음
* 이는 더 많은 동시 사용자를 위해 VRAM을 확보할 뿐만 아니라, 각 순방향 패스에서 GPU 메모리에서 읽는 데이터 양을 절반으로 줄여 ITL 속도를 향상시킴

### 6.3 분산 최적화

* 멀티 GPU 환경에서 인터커넥트 오버헤드가 발생하는 경우, Tensor Parallel(TP) 수준을 낮추는 것을 고려
* 하드웨어에 NVLink가 없는 경우, 4개의 GPU에 걸쳐 하나의 큰 인스턴스를 실행하는 것보다 각각 2개의 GPU에서 두 개의 독립적인 복제본을 실행하는 것이 더 나은 성능을 제공
<br>
<br>

------
[차례](/README.md)