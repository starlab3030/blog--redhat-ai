# AutoRAG를 통해 상담원에게 맞춤형 지식을 제공

1. [랩 환경 준비](bring_custom_kb_to_agents_with_autorag.md#1-랩-환경-준비)<br>
2. [오픈시프트 AI 설정 및 스토리지 구성](bring_custom_kb_to_agents_with_autorag.md#2-오픈시프트-ai-설정-및-스토리지-구성)<br>
   2.1 [리포지토리 복제](bring_custom_kb_to_agents_with_autorag.md#21-리포지토리-복제)<br>
   2.2 [OGX 오퍼레이터 활성화](bring_custom_kb_to_agents_with_autorag.md#22-ogx-오퍼레이터-활성화)<br>
   2.3 [MCP 카탈로그와 AutoRAG 인터페이스를 활성화](bring_custom_kb_to_agents_with_autorag.md#23-mcp-카탈로그와-autorag-인터페이스를-활성화)<br>
   2.4 [스토리지 스택을 설정](bring_custom_kb_to_agents_with_autorag.md#24-스토리지-스택을-설정)<br>
   2.5 [생성된 MinIO 스토리지 확인](bring_custom_kb_to_agents_with_autorag.md#25-생성된-minio-스토리지-확인)<br>
3. [AI 모델 및 OGX 서버 배포](bring_custom_kb_to_agents_with_autorag.md#3-ai-모델-및-ogx-서버-배포)<br>
   3.1 [LLM 모델 배포](bring_custom_kb_to_agents_with_autorag.md#31-llm-모델-배포)<br>
   3.2 [AutoRAG에서 사용할 임베딩 모델 배포](bring_custom_kb_to_agents_with_autorag.md#32-autorag에서-사용할-임베딩-모델-배포)<br>
   3.3 [OGX 서버 배포](bring_custom_kb_to_agents_with_autorag.md#33-ogx-서버-배포)<br>
4. [AutoRAG를 통한 평가](bring_custom_kb_to_agents_with_autorag.md#4-autorag를-통한-평가)<br>
   4.1 [시크릿 생성 및 스토리지 연결](bring_custom_kb_to_agents_with_autorag.md#41-시크릿-생성-및-스토리지-연결)<br>
   4.2 [AutoRAG 구성](bring_custom_kb_to_agents_with_autorag.md#42-autorag-구성)<br>
   4.3 [파이프라인 실행 및 RAG 평가 확인](bring_custom_kb_to_agents_with_autorag.md#43-파이프라인-실행-및-rag-평가-확인)<br>
5. [MCP/앱 배포 및 연결 테스트](bring_custom_kb_to_agents_with_autorag.md#5-mcp앱-배포-및-연결-테스트)<br>
   5.1 [MCP 카탈로그에서 MCP 서버 배포](bring_custom_kb_to_agents_with_autorag.md#51-mcp-카탈로그에서-mcp-서버-배포)<br>
   5.2 [앱 배포](bring_custom_kb_to_agents_with_autorag.md#52-앱-배포)<br>
   5.3 [앱 테스트](bring_custom_kb_to_agents_with_autorag.md#53-앱-테스트)<br>
99. [참조](bring_custom_kb_to_agents_with_autorag.md#99-참조)
<br>
<br>

## 1. 랩 환경 준비

### 1.1 학습 데이터와 AutoRAG

#### 1.1.1 학습 데이터의 패턴과 정보

생성형 AI를 구동하는 대규모 언어 모델(LLM)은 학습 데이터에 존재하는 패턴과 정보를 활용하여 작동합니다.
* 적절한 데이터에 접근할 수 없으면 LLM은 문맥(예를 들어 회사 내부 용어 등)을 이해하는 데 어려움을 겪고 결과적으로 잘못된 추론을 하기 시작
* 이는 기업 차원에서 특정 도메인에 특화된 사용 사례에 심각한 문제가 될 수 있음

#### 1.1.2 검색 증강 생성 (RAG)

신뢰할 수 있는 결과를 얻으려면 이러한 모델을 회사 문서에 기반을 두는 것이 필수적입니다.
* 이는 검색 증강 생성(RAG) 이라고 알려진 프로세스
* 일반적으로 기능적인 RAG 파이프라인을 구축하려면 문서 분할, 임베딩 모델 선택, 검색 전략 구성 등 많은 수작업이 필요

#### 1.1.3 AutoRAG

**AutoRAG**는 RAG 파이프라인 최적화를 자동화하여 이 프로세스의 속도를 높이는 데 도움을 줄 수 있습니다.
* Red Hat OpenShift AI 3.5에서 기술 프리뷰로 도입된 AutoRAG는 조직의 도메인별 데이터를 기반으로 LLM 응답의 정확도를 향상
* 시행착오에 의존하는 대신, AutoRAG는 다음과 같은 작업을 수행
  + 문서를 체계적으로 처리
  + 평가 데이터 세트를 사용하여 다양한 파이프라인 구성을 테스트
  + 특정 비즈니스 환경에 가장 적합한 최적의 RAG 설정을 식별
<br>

### 1.2 랩 환경

#### 1.2.1 시나리오

* 가상의 은행 사용 사례에 맞춰 AutoRAG를 설정하고 통합하는 방법을 보여줌
* 또한 모델 컨텍스트 프로토콜(MCP) 서버를 사용하여 데이터베이스에서 고객 데이터를 가져오는 방식으로 시스템의 이해도를 확장

#### 1.2.2 목표

* 최적의 RAG 구성과 MCP 서버를 활용하여 회사 컨텍스트를 이해하는 에이전트를 구축
* AutoRAG 외에도 Red Hat OpenShift AI의 MCP 카탈로그를 사용하여 내부 데이터베이스와 상호 작용하는 MCP 서버를 배포

#### 1.2.3 필수 조건

* 레드햇 오픈시프트 클러스터 4.20 이상
* 레드햇 오픈시프트 AI 3.5 오퍼레이터 설치
* 모델 배포를 위한 GPU 혹은 GPU가 없다면 모델 프로바이더 엔드포인트를 사용
<br>
<br>

## 2. 오픈시프트 AI 설정 및 스토리지 구성

### 2.1 리포지토리 복제

#### 2.1.1 테스트 환경을 위한 리포지토리 복제

실행 명령어
```bash
git clone https://github.com/dialvare/autorag-demo.git
tree -Fsh autorag-demo
```

실행 결과
```
% git clone https://github.com/dialvare/autorag-demo.git
Cloning into 'autorag-demo'...
remote: Enumerating objects: 209, done.
remote: Counting objects: 100% (46/46), done.
remote: Compressing objects: 100% (45/45), done.
remote: Total 209 (delta 2), reused 15 (delta 0), pack-reused 163 (from 1)
Receiving objects: 100% (209/209), 237.08 KiB | 831.00 KiB/s, done.
Resolving deltas: 100% (71/71), done.

% tree -Fsh autorag-demo
[ 320]  autorag-demo/
├── [ 256]  2-storage/
│   ├── [1.1K]  benchmark_data.json
│   ├── [ 128]  input_data/
│   │   ├── [ 526]  accounts.txt
│   │   └── [ 329]  cards.txt
│   ├── [3.2K]  milvus-setup.yaml
│   ├── [2.4K]  minio-job.yaml
│   ├── [2.7K]  minio-setup.yaml
│   └── [1.6K]  postgresql-setup.yaml
├── [  96]  4-ogx/
│   └── [2.3K]  deployment.yaml
├── [ 128]  5-autorag/
│   ├── [ 494]  knowledge-connection.yaml
│   └── [1.2K]  pipeline-server.yaml
├── [ 192]  6-mcp/
│   ├── [ 677]  mariadb-mcp-logs-patch.yaml
│   ├── [ 968]  mariadb-mcp.yaml
│   ├── [7.2K]  mariadb.yaml
│   └── [106K]  mcp-lifecycle-operator.yaml
├── [ 128]  7-app/
│   ├── [3.4K]  deployment-mariadb.yaml
│   └── [ 400]  ogx-mariadb-connection.yaml
├── [2.6K]  README.md
└── [ 160]  source-code-chatbot/
    ├── [ 29K]  app.py
    ├── [ 596]  Dockerfile
    └── [  52]  requirements.txt

8 directories, 20 files

% 
```
<br>

### 2.2 OGX 오퍼레이터 활성화

#### 2.2.1 오픈시프트 웹 콘솔에 로그인

#### 2.2.2 **홈** → **검색**에서 레드햇 오픈시프트 AI를 배포하는 *DataScienceCluster* 오브젝트를 찿음

#### 2.2.3 매니페스트를 편집하여 *spec.components.ogx.managementState*를 `Managed`를 설정

```yaml
apiVersion: datasciencecluster.opendatahub.io/v2
kind: DataScienceCluster
metadata:
 name: default-dsc
 labels:
   app.kubernetes.io/name: datasciencecluster
spec:
 components:
   /* rest of the components */
   trainer:
     managementState: Removed
   ogx:
     managementState: Managed
   /* rest of the YAML */
```
* 구성이 저장되면, 레드햇 오픈시프트 AI는 AutoRAG에 필요한 OGX 오퍼레이터를 자동으로 활성화

> [!NOTE]
> OGX는 "Open GenAI Stack"으로 이전의 "Llama Stack" 입니다.
<br>

### 2.3 MCP 카탈로그와 AutoRAG 인터페이스를 활성화

#### 2.3.1 오픈시프트의 **홈** → **검색**에서 네임스페이스를 *redhat-ods-applications*로 설정 후, 레드햇 오픈시프트 AI 대시보드를 정의하는 *OdhDashboardConfig*를 찾음

#### 2.3.2 매니페스트를 편집하여, Gen AI Studio, MCP servers, 및 AutoRAG 인터페이스를 활성화하기 위해, 다음을 `true`로 설정

```yaml
apiVersion: opendatahub.io/v1alpha
kind: OdhDashboardConfig
metadata:
 name: odh-dashboard-config
 namespace: redhat-ods-applications
 labels:
   app: rhods-dashboard
   app.kubernetes.io/part-of: rhods-dashboard
   app.opendatahub.io/rhods-dashboard: 'true'
   platform.opendatahub.io/part-of: dashboard
spec:
 dashboardConfig:
   genAiStudio: true
   autorag: true
   mcpCatalog: true
   disableTracking: false
   /* rest of the YAML */
```
* *spec.dashboardConfig* 하위의 *genAiStudio*, *autorag*, 및 *mcpCatalog*

#### 2.3.3 오픈시프트 모범 사례에 따라 모든 OGX 관련 리소스를 단일 전용 *ogx* 네임스페이스 내에 그룹화

```bash
oc new-project ogx && oc label namespace ogx opendatahub.io/dashboard=true
```
<br>

### 2.4 스토리지 스택을 설정

RAG를 위한 안정적인 데이터 수집 파이프라인을 구축하기 위해 구조화된 데이터, 벡터 임베딩 및 아티팩트를 분리하는 3개의 스토리지 구성 요소를 배포
* PostgreSQL : OGX가 운영 구성 관리에 사용하는 데이터베이스
* Milvus : 효율적인 유사성 검색을 지원하기 위해 RAG 임베딩을 저장하고 인덱싱하는 고성능 벡터 데이터베이스
* MinIO : 아마존 S3와 호환되는 객체 스토리지 솔루션으로, 문서 및 산출물을 위한 중앙 저장소 역할 수행

#### 2.4.1 OGX의 메타데이터를 저장할 PostgreSQL 데이터베이스를 배포

[2-storage/postgresql-setup.yaml](./files/autorag-demo/2-storage/postgresql-setup.yaml)
```yaml
apiVersion: v1
kind: Secret
metadata:
 name: postgres-secret
 namespace: ogx
type: Opaque
stringData:
 password: "redhat123"
---
apiVersion: apps/v1
kind: Deployment
metadata:
 name: postgres-ogx
 namespace: ogx
 labels:
   app: postgres-ogx
spec:
 replicas: 1
 selector:
   matchLabels:
     app: postgres-ogx
 template:
   metadata:
     labels:
       app: postgres-ogx
   spec:
     containers:
       - name: postgresql
         image: registry.redhat.io/rhel9/postgresql-15:latest
         ports:
           - containerPort: 5432
             name: postgres
         env:
           - name: POSTGRESQL_USER
             value: ogx
           - name: POSTGRESQL_DATABASE
             value: ogx
           - name: POSTGRESQL_PASSWORD
             valueFrom:
               secretKeyRef:
                 name: postgres-secret
                 key: password
         volumeMounts:
           - name: postgres-data
             mountPath: /var/lib/pgsql/data
         securityContext:
           allowPrivilegeEscalation: false
           capabilities:
             drop:
               - ALL
           runAsNonRoot: true
           seccompProfile:
             type: RuntimeDefault
     volumes:
       - name: postgres-data
         persistentVolumeClaim:
           claimName: postgres-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
 name: postgres-pvc
 namespace: ogx
spec:
 accessModes:
   - ReadWriteOnce
 resources:
   requests:
     storage: 15Gi
---
apiVersion: v1
kind: Service
metadata:
 name: postgres-service
 namespace: ogx
spec:
 selector:
   app: postgres-ogx
 ports:
   - protocol: TCP
     port: 5432
     targetPort: 5432                                    
```

실행 명령어
```bash
oc apply -f 2-storage/postgresql-setup.yaml -n ogx
```

#### 2.4.2 OGX용 원격 벡터 데이터베이스 공급자로 Milvus를 배포

[2-storage/milvus-setup.yaml](./files/autorag-demo/2-storage/milvus-setup.yaml)
```yaml
apiVersion: v1
kind: Secret
metadata:
 name: milvus-secret
 namespace: ogx
type: Opaque
stringData:
 root-password: "redhat123"
 MILVUS_TOKEN: "root-password:redhat123"
 MILVUS_ENDPOINT: "tcp://milvus-service:19530"
 MILVUS_CONSISTENCY_LEVEL: "Bounded"
---
kind: PersistentVolumeClaim
apiVersion: v1
metadata:
 name: milvus-pvc
 namespace: ogx
spec:
 accessModes:
   - ReadWriteOnce
 resources:
   requests:
     storage: 20Gi
 volumeMode: Filesystem
---
apiVersion: apps/v1
kind: Deployment
metadata:
 name: etcd-deployment
 namespace: ogx
 labels:
   app: etcd
spec:
 replicas: 1
 selector:
   matchLabels:
     app: etcd
 strategy:
   type: Recreate
 template:
   metadata:
     labels:
       app: etcd
   spec:
     containers:
       - name: etcd
         image: quay.io/coreos/etcd:v3.5.5
         command:
           - etcd
           - --advertise-client-urls=http://127.0.0.1:2379
           - --listen-client-urls=http://0.0.0.0:2379
           - --data-dir=/etcd
         ports:
           - containerPort: 2379
         volumeMounts:
           - name: etcd-data
             mountPath: /etcd
         env:
           - name: ETCD_AUTO_COMPACTION_MODE
             value: revision
           - name: ETCD_AUTO_COMPACTION_RETENTION
             value: "1000"
           - name: ETCD_QUOTA_BACKEND_BYTES
             value: "4294967296"
           - name: ETCD_SNAPSHOT_COUNT
             value: "50000"
     volumes:
       - name: etcd-data
         emptyDir: {}
     restartPolicy: Always
---
apiVersion: v1
kind: Service
metadata:
 name: etcd-service
 namespace: ogx
spec:
 ports:
   - port: 2379
     targetPort: 2379
 selector:
   app: etcd
---
apiVersion: apps/v1
kind: Deployment
metadata:
 labels:
   app: milvus-standalone
 name: milvus-standalone
 namespace: ogx
spec:
 replicas: 1
 selector:
   matchLabels:
     app: milvus-standalone
 strategy:
   type: Recreate
 template:
   metadata:
     labels:
       app: milvus-standalone
   spec:
     containers:
       - name: milvus-standalone
         image: milvusdb/milvus:v2.6.0
         args: ["milvus", "run", "standalone"]
         env:
           - name: DEPLOY_MODE
             value: standalone
           - name: ETCD_ENDPOINTS
             value: etcd-service:2379
           - name: COMMON_STORAGETYPE
             value: local
           - name: MILVUS_ROOT_PASSWORD
             valueFrom:
               secretKeyRef:
                 name: milvus-secret
                 key: root-password
         livenessProbe:
           exec:
             command: ["curl", "-f", "http://localhost:9091/healthz"]
           initialDelaySeconds: 90
           periodSeconds: 30
           timeoutSeconds: 20
           failureThreshold: 5
         ports:
           - containerPort: 19530
             protocol: TCP
           - containerPort: 9091
             protocol: TCP
         volumeMounts:
           - name: milvus-data
             mountPath: /var/lib/milvus
     restartPolicy: Always
     volumes:
       - name: milvus-data
         persistentVolumeClaim:
           claimName: milvus-pvc
---
apiVersion: v1
kind: Service
metadata:
 name: milvus-service
 namespace: ogx
spec:
 selector:
   app: milvus-standalone
 ports:
   - name: grpc
     port: 19530
     targetPort: 19530
   - name: http
     port: 9091
     targetPort: 9091                                                  
```

실행 명령어
```bash
oc apply -f 2-storage/milvus-setup.yaml -n ogx
```

#### 2.4.3 클러스터에 MinIO 객체 스토리지를 배포

[2-storage/minio-setup.yaml](./files/autorag-demo/2-storage/minio-setup.yaml)
```yaml
---
apiVersion: v1
kind: Namespace
metadata:
 name: minio
 labels:
   kubernetes.io/metadata.name: minio
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
 name: minio-pvc
 namespace: minio
spec:
 accessModes:
   - ReadWriteOnce
 resources:
   requests:
     storage: 50Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
 name: minio
 namespace: minio
 labels:
   app: minio
spec:
 replicas: 1
 selector:
   matchLabels:
     app: minio
 strategy:
   type: Recreate
 template:
   metadata:
     labels:
       app: minio
   spec:
     containers:
       - name: minio
         image: quay.io/minio/minio:latest
         command:
           - /bin/bash
           - -c
         args:
           - minio server /data --console-address :9001
         env:
           - name: MINIO_ROOT_USER
             value: "minioadmin"
           - name: MINIO_ROOT_PASSWORD
             value: "minioadmin123"
         ports:
           - containerPort: 9000
             name: api
             protocol: TCP
           - containerPort: 9001
             name: console
             protocol: TCP
         volumeMounts:
           - name: data
             mountPath: /data
         livenessProbe:
           httpGet:
             path: /minio/health/live
             port: 9000
           initialDelaySeconds: 30
           periodSeconds: 20
         readinessProbe:
           httpGet:
             path: /minio/health/ready
             port: 9000
           initialDelaySeconds: 15
           periodSeconds: 10
         resources:
           requests:
             memory: "512Mi"
             cpu: "250m"
           limits:
             memory: "2Gi"
             cpu: "1000m"
     volumes:
       - name: data
         persistentVolumeClaim:
           claimName: minio-pvc
---
apiVersion: v1
kind: Service
metadata:
 name: minio-api
 namespace: minio
 labels:
   app: minio
spec:
 type: ClusterIP
 ports:
   - port: 9000
     targetPort: 9000
     protocol: TCP
     name: api
 selector:
   app: minio
---
apiVersion: v1
kind: Service
metadata:
 name: minio-console
 namespace: minio
 labels:
   app: minio
spec:
 type: ClusterIP
 ports:
   - port: 9001
     targetPort: 9001
     protocol: TCP
     name: console
 selector:
   app: minio
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
 name: minio-console
 namespace: minio
 labels:
   app: minio
spec:
 to:
   kind: Service
   name: minio-console
 port:
   targetPort: console
 tls:
   termination: edge
   insecureEdgeTerminationPolicy: Redirect
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
 name: minio-api
 namespace: minio
 labels:
   app: minio
spec:
 to:
   kind: Service
   name: minio-api
 port:
   targetPort: api
 tls:
   termination: edge
   insecureEdgeTerminationPolicy: Redirect
```

실행 명령어
```bash
oc apply -f 2-storage/minio-setup.yaml
```
* MinIO의 사용자 Id: `minioadmin`
* MinIO의 비밀번호: `minioadmin123`

#### 2.4.4 MinIO 버킷 생성 및 내부 KB 데이터 업로드

[2-storage/minio-job.yaml](./files/autorag-demo/2-storage/minio-job.yaml)
```yaml
apiVersion: batch/v1
kind: Job
metadata:
 name: minio-create-buckets
 namespace: minio
spec:
 template:
   metadata:
     labels:
       app: minio-setup
   spec:
     restartPolicy: OnFailure
     initContainers:
       - name: download-data
         image: registry.access.redhat.com/ubi9/ubi-minimal:latest
         command:
           - /bin/bash
           - -c
           - |
            REPO_URL="https://raw.githubusercontent.com/dialvare/autorag-demo/main/2-storage"
            curl -sL ${REPO_URL}/input_data/accounts.txt -o /data/accounts.txt
            curl -sL ${REPO_URL}/input_data/cards.txt -o /data/cards.txt
            curl -sL ${REPO_URL}/benchmark_data.json -o /data/benchmark_data.json
            echo "Downloaded files:"
            ls -la /data/
         volumeMounts:
           - name: shared-data
             mountPath: /data
     containers:
       - name: mc
         image: quay.io/minio/mc:latest
         env:
           - name: MC_CONFIG_DIR
             value: /tmp/.mc
         command:
           - /bin/bash
           - -c
           - |
            # Create config directory in /tmp (has write permissions)
            mkdir -p /tmp/.mc

            # Wait for MinIO to be ready
            until mc alias set myminio http://minio-api:9000 minioadmin minioadmin123; do
              echo "Waiting for MinIO to be ready..."
              sleep 5
            done

            echo "MinIO is ready, creating buckets..."

            # Create buckets
            mc mb myminio/pipeline-artifacts --ignore-existing
            mc mb myminio/autorag-data --ignore-existing

            # Set public policy for easier access (for demo purposes)
            # For production, use proper IAM policies
            mc anonymous set download myminio/pipeline-artifacts
            mc anonymous set download myminio/autorag-data

            echo "Buckets created successfully:"
            mc ls myminio

            echo "Uploading data to autorag-data bucket..."
            mc cp /data/accounts.txt myminio/autorag-data/input_data/accounts.txt
            mc cp /data/cards.txt myminio/autorag-data/input_data/cards.txt
            mc cp /data/benchmark_data.json myminio/autorag-data/benchmark_data.json

            echo "Uploaded files:"
            mc ls --recursive myminio/autorag-data
            echo "Setup complete!"
         volumeMounts:
           - name: shared-data
             mountPath: /data
     volumes:
       - name: shared-data
         emptyDir: {}
```
* MinIO 버킷 생성
  + *pipeline-artifacts*
  + *autorag-data*
* 데이터 업로드
  + */data/accounts.txt*
  + */data/cards.txt*
  + */data/benchmark_data.json*

실행 명령어
```bash
oc apply -f 2-storage/minio-job.yaml
```
<br>

### 2.5 생성된 MinIO 스토리지 확인

#### 2.5.1 오픈시프트 웹 콘솔에서 프로젝트를 *minio*로 변경

#### 2.5.2 왼쪽의 네비게이션 바에서 **네트워킹** → **라우트**로 이동 후 라우트 *minio-console*의 URL을 클릭

#### 2.5.3 MinIO에 *minioadmin*/*minioadmin123*으로 로그인

#### 2.5.4 버킷 *autorag-data*로 이동

#### 2.5.5 버킷 *autorag-data*에 다음과 같이 데이터가 있는 지 확인

```
~/autorag-data
   + benchmark_data.json
   |
   + input_data
       + accounts.txt
       |
       + cards.txt  
```         
* *input_data* 폴더 안에 2개의 파일이 있음
<br>
<br>

## 3. AI 모델 및 OGX 서버 배포

### 3.1 LLM 모델 배포

**시나리오 설명**
* 은행 담당자는 고객의 개인 정보 및 계좌 잔액과 같은 민감한 정보가 포함된 데이터를 사용
  + 규정 준수 요건에 따라 이러한 데이터를 클라우드 제공업체에 전송하는 것이 불가능할 수도 있음
* 레드햇 오픈시프트 AI는 엄선된 모델 카탈로그를 제공
  + 필요에 가장 적합한 모델을 선택 가능
  + 모델 선택에 여전히 어려움을 겪는 경우 AutoRAG가 모델 후보를 평가하고 최적의 옵션을 제안 가능
* AutoRAG에서 평가할 AI 모델 몇 개를 배포하여 이를 테스트

#### 3.1.1 레드햇 오픈시프트 AI 콘솔에서 **AI 허브** → **모델** → **카탈로그**로 이동하여 평가할 모델 검색

#### 3.1.2 LLM 모델 *Qwen3-8B*을 선택하고, 응답 시간 최소화를 위해 GPU를 사용하여 실행

#### 3.1.3 다음 구성 매개 변수를 사용하여 모델 배포

* 프로젝트: *ogx*
* 하드웨어 프로필: *gpu-profile*
* 배포 리소스: *vLLM NVIDIA GPU ServingRuntime for KServe*
* 사용자 지정 런타임 인수 추가: 활성화 후, 다음 항목 입력
  + *`--enable-auto-tool-choice`*
  + *`--tool-call-parser`*
  + *`hermes`*

> [!NOTE]
> 모델을 처음 배포하는 경우, 서빙 런타임(vLLM)과 모델 이미지를 다운로드합니다. 이 과정은 다소 시간이 걸릴 수 있습니다. 모델 준비가 완료 되면 다음 단계로 진행할 수 있습니다.
<br>

### 3.2 AutoRAG에서 사용할 임베딩 모델 배포

#### 3.2.1 레드햇 오픈시프트 AI 콘솔에서 **AI 허브** → **모델** → **카탈로그**에서 모델 *embeddinggemma-300m* 선택

#### 3.2.2 다음 구성 매개 변수를 사용하여 모델 배포

* 프로젝트: *ogx*
* 하드웨어 프로필: *default-profile*
* 배포 리소스: *vLLM CPU (x86) ServingRuntime for KServe*

> [!NOTE]
> 테스트 환경에서는 간단하게 설명하기 위해 임베딩 모델을 하나만 배포합니다. 하지만 AutoRAG를 사용한 더욱 다양한 성능 비교를 위해 여러 개의 임베딩 모델을 배포할 수도 있습니다.
<br>

### 3.3 OGX 서버 배포

**시나리오 설명**
* AutoRAG는 OGX 인스턴스를 사용하여 다양한 RAG 구성을 평가

#### 3.3.1 LLM 모델 *qwen3*와 임베딩 모델 *embeddinggemma*을 위한 구성을 포함한 시크릿 생성

실행 명령어
```bash
oc create secret generic llm-secret -n ogx \
  --from-literal=INFERENCE_MODEL='redhataiqwen3-8b-fp8-dynamic' \
  --from-literal=VLLM_URL='http://redhataiqwen3-8b-fp8-dynamic-predictor.ogx.svc.cluster.local:8080/v1' \
  --from-literal=VLLM_TLS_VERIFY='false' \
  --from-literal=EMBEDDING_MODEL='redhataiembeddinggemma-300m' \
  --from-literal=EMBEDDING_PROVIDER_MODEL_ID='redhataiembeddinggemma-300m' \
  --from-literal=VLLM_EMBEDDING_URL='http://redhataiembeddinggemma-300m-predictor.ogx.svc.cluster.local:8080/v1' \
  --from-literal=VLLM_EMBEDDING_TLS_VERIFY='false'
```

#### 3.3.2 OGX 구성을 포함한 *OGXServer* 리소스 생성

[4-ogx/deployment.yaml](./files/autorag-demo/4-ogx/deployment.yaml)
```yaml
apiVersion: ogx.io/v1beta1
kind: OGXServer
metadata:
  name: ogx-custom-server
  namespace: ogx
spec:
  distribution:
    name: rh
  workload:
    replicas: 1
    overrides:
      env:
        - name: POSTGRES_HOST
          value: postgres-service.ogx.svc.cluster.local
        - name: POSTGRES_PORT
          value: "5432"
        - name: POSTGRES_DB
          value: ogx
        - name: POSTGRES_USER
          value: ogx
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: ENABLE_SENTENCE_TRANSFORMERS
          value: "false"
        - name: INFERENCE_MODEL
          valueFrom:
            secretKeyRef:
              name: llm-secret
              key: INFERENCE_MODEL
        - name: VLLM_URL
          valueFrom:
            secretKeyRef:
              name: llm-secret
              key: VLLM_URL
        - name: VLLM_TLS_VERIFY
          valueFrom:
            secretKeyRef:
              name: llm-secret
              key: VLLM_TLS_VERIFY
        # Remote embedding model (vLLM / OpenShift AI predictor)
        - name: EMBEDDING_MODEL
          valueFrom:
            secretKeyRef:
              name: llm-secret
              key: EMBEDDING_MODEL
        - name: EMBEDDING_PROVIDER_MODEL_ID
          valueFrom:
            secretKeyRef:
              name: llm-secret
              key: EMBEDDING_PROVIDER_MODEL_ID
        - name: VLLM_EMBEDDING_URL
          valueFrom:
            secretKeyRef:
              name: llm-secret
              key: VLLM_EMBEDDING_URL
        - name: VLLM_EMBEDDING_TLS_VERIFY
          valueFrom:
            secretKeyRef:
              name: llm-secret
              key: VLLM_EMBEDDING_TLS_VERIFY
        - name: MILVUS_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: milvus-secret
              key: MILVUS_ENDPOINT
        - name: MILVUS_TOKEN
          valueFrom:
            secretKeyRef:
              name: milvus-secret
              key: MILVUS_TOKEN
        - name: MILVUS_CONSISTENCY_LEVEL
          valueFrom:
            secretKeyRef:
              name: milvus-secret
              key: MILVUS_CONSISTENCY_LEVEL
      name: ogx
      port: 8321
    distribution:
      name: 'rh-dev'
    storage:
      size: 20Gi
      mountPath: /opt/app-root/src/.ogx/distributions/rh/
```
* 시크릿에서 변수를 로드
* OGX에서 제공하는 내장 임베딩 모델 *nomic-embedding-text*을 활성화

실행 명령어
```bash
oc apply -f 4-ogx/deployment.yaml -n ogx
```
<br>
<br>

## 4. AutoRAG를 통한 평가

**시나리오 설명**
* AutoRAG를 사용하기 위해, 평가 파이프라인 시ㅣ행을 위한 파이프라인 서버 생성
* AutoRAG 최적화 실행을 시작

### 4.1 시크릿 생성 및 스토리지 연결

#### 4.1.1 오픈시프트 AI를 MinIO에 연결하고, 파이프라인 출력을 버킷 *pipeline-artifacts*로 저장하도록 *PipelineServer* 생성

[5-autorag/pipeline-server.yaml](./files/autorag-demo/5-autorag/pipeline-server.yaml)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: dashboard-dspa-secret
  namespace: ogx
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: minioadmin
  AWS_SECRET_ACCESS_KEY: minioadmin123
---
apiVersion: datasciencepipelinesapplications.opendatahub.io/v1
kind: DataSciencePipelinesApplication
metadata:
  name: dspa
  namespace: ogx
spec:
  dspVersion: v2
  objectStorage:
    disableHealthCheck: false
    enableExternalRoute: false
    externalStorage:
      basePath: ''
      bucket: pipeline-artifacts
      host: minio-api.minio.svc.cluster.local:9000
      port: ''
      region: us-east-1
      s3CredentialsSecret:
        accessKey: AWS_ACCESS_KEY_ID
        secretKey: AWS_SECRET_ACCESS_KEY
        secretName: dashboard-dspa-secret
      scheme: http
  database:
    disableHealthCheck: false
    mariaDB:
      deploy: true
      pipelineDBName: mlpipeline
      pvcSize: 10Gi
      username: mlpipeline
  apiServer:
    deploy: true
    enableSamplePipeline: false
    enableOauth: true
    cacheEnabled: true
    pipelineStore: kubernetes
    managedPipelines: {}
  persistenceAgent:
    deploy: true
    numWorkers: 2
  scheduledWorkflow:
    cronScheduleTimezone: UTC
    deploy: true
  podToPodTLS: true
```

실행 명령어
```bash
oc apply -f 5-autorag/pipeline-server.yaml -n ogx
```

#### 4.1.2 버킷 *autorag-data*를 가리키는 데이터 연결 *KnowledgeConnection*을 생성

[5-autorag/knowledge-connection.yaml](./files/autorag-demo/5-autorag/knowledge-connection.yaml)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: knowledge-connection
  namespace: ogx
  labels:
    opendatahub.io/dashboard: 'true'
    opendatahub.io/managed: 'true'
  annotations:
    opendatahub.io/connection-type: s3
    openshift.io/display-name: KnowledgeConnection
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: minioadmin
  AWS_SECRET_ACCESS_KEY: minioadmin123
  AWS_S3_ENDPOINT: http://minio-api.minio.svc.cluster.local:9000
  AWS_DEFAULT_REGION: us-east-1
  AWS_S3_BUCKET: autorag-data
```

실행 명령어
```bash
oc apply -f 5-autorag/knowledge-connection.yaml -n ogx
```
<br>

### 4.2 AutoRAG 구성

#### 4.2.1 오픈시프트 AI 콘솔에서 **Gen AI Studio** → **AutoRAG**로 이동

#### 4.2.2 프로젝트를 *ogx* 변경 후, **Create run**을 클릭

#### 4.2.3 다음 항목을 설정

* 이름: *AutoRAG*
* **GenAI Stack Connection** → **Add new connection** 클릭
  + 연결 이름: *OGXConnection*
  + 기본 URL: *http://ogx-custom-server-service.ogx.svc.cluster.local:8321*
  + API 키: *fake*

#### 4.2.4 최종 양식에서 다음과 같이 AutoRAG 구성

* S3 연결: *KnowledgeConnection*
* 파일 또는 폴더 선택: *input_data*
* 벡터 I/O 제공자: *milvus-remote (remote Milvus)*
* 평가 데이터 세트: *benchmark_data.json*
<br>

### 4.3 파이프라인 실행 및 RAG 평가 확인

#### 4.3.1 파이프라인을 트리거하기 위해 **Create run**을 클릭

* 오픈시프트 AI는 기본 모델과 두 개의 임베딩 모델을 RAG 문서에 대해 테스트하기 위해 파이프라인을 자동으로 배포
* AutoRAG 파이프라인 실행이 완료되고 모델 성능 순위가 리더보드에 표시

#### 4.3.2 AutoRAG에서 생성된 결과 중 가장 상위 결과를 선택

* 벡터 저장소 및 청크 수와 같이 애플리케이션에 사용할 세부 정보를 제안하는지 확인
* 최상위 AutoRAG 결과는 벡터 저장소 컬렉션 이름을 표시

#### 4.3.3 RAG 실행의 추출 전략을 확인하려면 추출(**Retrieval**)을 선택

* 최상위 AutoRAG 결과를 선택하면 최적의 *retrieval* 구성을 알 수 있음
<br>
<br>

## 5. MCP/앱 배포 및 연결 테스트

### 5.1 MCP 카탈로그에서 MCP 서버 배포

**시나리오 설명**
* LLM은 에이전트에 추론 기능을 제공하지만, 특정 운영 환경에 대한 본질적인 지식이 부족
* 에이전트가 OpenShift 클러스터와 상호 작용하려면(예: 파드 목록 보기, 로그 보기, 워크로드 문제 진단) MCP 서버를 사용

#### 5.1.1 MCP 라이프-사이클 오퍼레이터 설치

[6-mcp/mcp-lifecycle-operator.yaml](./files/autorag-demo/6-mcp/mcp-lifecycle-operator.yaml)
* 해당 오퍼레이터는 오픈시프트에 MCP 서버를 배포, 관리 및 안전하게 롤아웃하기 위한 선언적 API를 제공

실행 명령어
```bash
oc apply -f 6-mcp/mcp-lifecycle-operator.yaml
```

#### 5.1.2 MariaDB를 배포하고 고객 정보를 입력

[6-mcp/mariadb.yaml](./files/autorag-demo/6-mcp/mariadb.yaml)
* 은행 고객의 민감한 정보가 담긴 데이터베이스를 가리키는 MariaDB MCP에 에이전트를 연결

실행 명령어
```bash
oc apply -f 6-mcp/mariadb.yaml -n ogx
```

#### 5.1.3 오픈시프트 AI 대시보드에서 **AI Hub** → **MCP Servers**에서 *mariadb/mcp*를 선택

```yaml
config:
 # ... (keep defaults)
  env:
    - name: DB_HOST
      value: mariadb.ogx.svc.cluster.local
    - name: DB_NAME
      value: mcp_db
    - name: ALLOWED_HOSTS
      value: "*"
    - name: DB_USER
      valueFrom:
        secretKeyRef:
          name: mariadb-credentials
          key: db-user
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: mariadb-credentials
          key: db-password
```
* 배포 이름: *mariadbmcp*
* 프로젝트: *ogx*

> [!NIOTE]
> `ALLOWED_HOSTS: "*"` 설정은 MCP 서버가 모든 호스트 헤더의 요청을 수락하도록 허용합니다. 데모/개발 환경에서만 사용해야 하며, 프로덕션 환경에서는 호스트 헤더 삽입 및 DNS 리바인딩 공격을 방지하기 위해 특정 도메인 또는 서비스 이름으로 제한해야 합니다.

#### 5.1.4 로깅 핸들러가 로그 파일에 대한 쓰기 가능한 마운트가 필요하므로 초기 구성을 패치

[6-mcp/mariadb-mcp-logs-patch.yaml](./files/autorag-demo/6-mcp/mariadb-mcp-logs-patch.yaml)
```yaml
# Patch: adds a writable /app/logs volume to the MariaDB MCP server.
# The MCP Lifecycle Operator sets readOnlyRootFilesystem, so the Python
# logging handler needs a writable mount for its log file.
# Patch the MCPServer CR (not the Deployment) so the operator reconciles
# the volume into the generated Deployment instead of reverting it.
# Apply after mariadb-mcp.yaml once the operator creates the MCPServer:
#   oc patch mcpserver mariadbmcp -n llamastack --type=merge \
#     --patch-file=6-mcp/mariadb-mcp-logs-patch.yaml
spec:
  config:
    storage:
      - path: /app/logs
        permissions: ReadWrite
        source:
          type: EmptyDir
          emptyDir: {}
```

실행 명령어
```bash
oc patch mcpserver mariadbmcp -n ogx --type=merge \
    --patch-file=6-mcp/mariadb-mcp-logs-patch.yaml
```

#### 5.1.5 오픈시프트 AI 콘솔에서 MariaDB MCP 서버를 사용할 수 있는지 확인

<br>

### 5.2 앱 배포

**시나리오 설명**
* AutoRAG를 테스트해 보고 카탈로그를 통해 MCP 서버를 활성화했음
* 이제 Streamlit 기반의 대화형 애플리케이션을 사용하여 에이전트의 동작을 테스트

#### 5.2.1 로 배포된 MCP 서버를 사용하도록 *OGXServer* 구성을 업데이트

실행 명령어
```bash
oc patch ogxserver ogx-custom-server \
    -n ogx --type=merge --patch-file=7-app/ogx-mariadb-connection.yaml
```
* AutoRAG에 사용했던 것과 동일한 OGX 배포 환경을 사용

#### 5.2.2 애플리케이션을 배포

[7-app/deployment-mariadb.yaml](./files/autorag-demo/7-app/deployment-mariadb.yaml)
```yaml
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: ogx-demo-config
  namespace: ogx
  labels:
    app: chatbot
    app.kubernetes.io/name: chatbot
    app.kubernetes.io/part-of: ogx
data:
  INFERENCE_MODEL: redhataiqwen3-8b-fp8-dynamic
  OGX_CLIENT_BASE_URL: http://ogx-custom-server-service:8321/v1
  VECTOR_STORE_ID: pizza-bank-best-pattern
  OGX_RAG_MAX_RESULTS: "5"
  OGX_RAG_RANKER: weighted
  OGX_RAG_RANKER_ALPHA: "0.5"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chatbot
  namespace: ogx
  annotations:
    app.openshift.io/connects-to: '[{"apiVersion":"v1","kind":"Service","name":"ogx-custom-server-service"}]'
  labels:
    app: chatbot
    app.kubernetes.io/name: chatbot
    app.kubernetes.io/component: chatbot
    app.kubernetes.io/part-of: ogx
    app.openshift.io/runtime: python
spec:
  replicas: 1
  selector:
    matchLabels:
      app: chatbot
  template:
    metadata:
      labels:
        app: chatbot
        app.kubernetes.io/name: chatbot
        app.kubernetes.io/part-of: ogx
    spec:
      containers:
        - name: chatbot
          image: quay.io/dialvare/chatbot:latest
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 8501
              protocol: TCP
          resources:
            limits:
              cpu: "1"
              memory: 4Gi
            requests:
              cpu: 250m
              memory: 500Mi
          env:
            - name: STREAMLIT_SERVER_FILE_WATCHER_TYPE
              value: none
            - name: STREAMLIT_SERVER_HEADLESS
              value: "true"
            - name: STREAMLIT_SERVER_ENABLE_CORS
              value: "false"
            - name: MCP_SERVER_URL
              value: http://mariadbmcp.ogx.svc.cluster.local:9001/mcp
            - name: MCP_SERVER_LABEL
              value: mariadb-mcp
            - name: OGX_MAX_OUTPUT_TOKENS
              value: "1024"
            - name: OGX_MCP_MAX_OUTPUT_TOKENS
              value: "1024"
            - name: MCP_ALLOWED_TOOLS
              value: list_databases,list_tables,get_table_schema,get_table_schema_with_relations,execute_sql,create_database
          envFrom:
            - configMapRef:
                name: ogx-demo-config
          livenessProbe:
            httpGet:
              path: /_stcore/health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /_stcore/health
              port: http
            initialDelaySeconds: 15
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
---
apiVersion: v1
kind: Service
metadata:
  name: chatbot
  namespace: ogx
  labels:
    app: chatbot
    app.kubernetes.io/name: chatbot
    app.kubernetes.io/part-of: ogx
spec:
  type: ClusterIP
  selector:
    app: chatbot
  ports:
    - name: http
      port: 8501
      targetPort: http
      protocol: TCP
---
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: chatbot
  namespace: ogx
  labels:
    app: chatbot
    app.kubernetes.io/name: chatbot
    app.kubernetes.io/part-of: ogx
  annotations:
    haproxy.router.openshift.io/timeout: 300s
spec:
  to:
    kind: Service
    name: chatbot
    weight: 100
  port:
    targetPort: http
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
  wildcardPolicy: None
```

실행 명령어
```bash
oc apply -f 7-app/deployment-mariadb.yaml -n ogx
```

#### 5.2.3 오픈시프트 웹 콘솔에서 **워크로드** → **토폴로지**에서 프로젝트 *ogx*가 있는 것을 확인

#### 5.2.4 *Deployment*의 **리소스** 탭을 선택 후, 라우트를 클릭하여 오픈

<br>

### 5.3 앱 테스트

#### 5.3.1 앱 UI 확인

* 왼쪽의 패널에서 에이전트의 구성을 바꿀 수 있음
* 오른쪽에서 에이전트와 상호 작용할 수 있는 챗 인터페이스가 있음

#### 5.3.2 추가 설정 확인

* 최적의 RAG 결과를 얻기 위해, 매개변수 수정
  + 벡터 저장소: *vs_342e657d-e706-45f2-a17b-011a0cc53822*
  + 청크 개수: *3*
  + 검색 모드: *vector*
  + 랭커 K: *0*
  + 랭커 알파: *1*

* MariaDB MCP 서버 옵션 활성화 확인

* **변경 사항 적용** 클릭

#### 5.2.5 챗 창에서 다음 질문 수행

질문-1
```
Show me the information for the client with email elena.martinez@email.com
```

질문-2
```
What's the limit of its Gold card?
```
<br>
<br>

## 99. 참조

### 99.1 테스트 환경

* AutoRAG 데모
  + [GitHub](https://github.com/dialvare/autorag-demo)
<br>

### 99.2 참조 문서

* [오픈시프트 AI AutoRAG 문서](https://developers.redhat.com/articles/2026/09/11/bringing-custom-knowledge-agents-autorag?sc_cid=RHCTG0260000496584&mkt_tok=NDI3LVRCQy00NzQAAAGkZFOSBvO5_lr7pMs65QLmwAt6M8xjikvaGKUjCcGAlHPYO0ZyOnijwVfHZW_tUjZ-DL700TC11WeX5oJPh2bwWJnxrod-HdRdmc8TKMEO0V015g#7__try_out_the_final_agent_:~:text=OpenShift%20AI%20AutoRAG%20%EB%AC%B8%EC%84%9C%EB%A5%BC%20%EC%82%B4%ED%8E%B4%EB%B3%B4%EA%B1%B0%EB%82%98)
<br>
<br>

------
[차례](/README.md)