# NVIDIA DGX Spark를 위한 리눅스 커널 구축

**목차**
1. [개요 및 빌드 환경 준비](build_linux_kernel_for_nvidia_dgx_spark.md#1-개요-및-빌드-환경-준비)<br>
2. [커널 및 드라이버 빌드](build_linux_kernel_for_nvidia_dgx_spark.md#2-커널-및-드라이버-빌드)<br>
   2.1 [커널 소스 준비](build_linux_kernel_for_nvidia_dgx_spark.md#21-커널-소스-준비)<br>
   2.2 [빌드 종속성 설치](build_linux_kernel_for_nvidia_dgx_spark.md#22-빌드-종속성-설치)<br>
   2.3 [커널 빌드](build_linux_kernel_for_nvidia_dgx_spark.md#23-커널-빌드)<br>
   2.4 [NVIDIA GPU 드라이버 빌드](build_linux_kernel_for_nvidia_dgx_spark.md#24-nvidia-gpu-드라이버-빌드)<br>
   2.5 [GPU 드라이버 및 RPM 빌드](build_linux_kernel_for_nvidia_dgx_spark.md#25-gpu-드라이버-rpm-빌드)<br>
3. [사용자 지정 컬널 및 드라이버 설치 & 업데이트](build_linux_kernel_for_nvidia_dgx_spark.md#3-사용자-지정-커널-및-드라이버-설치--업데이트)<br>
   3.1 [사용자 지정 커널 및 드라이버 설치](build_linux_kernel_for_nvidia_dgx_spark.md#31-사용자-지정-커널-및-드라이버-설치)<br>
   3.2 [NVIDIA CUDA 설치](build_linux_kernel_for_nvidia_dgx_spark.md#32-nvida-cuda-설치)<br>
   3.3 [커널 업데이트](build_linux_kernel_for_nvidia_dgx_spark.md#33-커널-업데이트)<br>
<br>
<br>

## 1. 개요 및 빌드 환경 준비

### 1.1 개요

NVIDIA GB10 Grace Blackwell Superchip 기반의 NVIDIA DGX Spark 플랫폼은 Red Hat Enterprise Linux (이후 RHEL) 10과의 호환성을 위해 맞춤형 커널 빌드가 필요합니다. 이를 위해 블로그에서는 다음을 설명합니다.

* 최신 RHEL 10 개발 커널과 해당 NVIDIA 그래픽 처리 장치(GPU) 드라이버를 소스 코드에서 빌드하는 과정을 안내
* 이를 통해, 맞춤형 RHEL 커널, NVIDIA 드라이버 및 CUDA 툴킷이 설치된 CentOS Stream 10 기반의 NVIDIA DGX Spark Founder's Edition을 사용
<br>

### 1.2 필수 조건

#### 1.2.1 빌드 환경

* RHEL 10을 실행하는 ARM64(aarch64 아키텍처) 시스템
* 또는 CentOS Stream 10이 설치된 NVIDIA DGX Spark Founder's Edition

#### 1.2.2 도구 및 종속성

빌드 시스템이 RHEL10인 경우, *codeready-builder* 리포지토리 활성화
```bash
sudo subscription-manager repos --enable codeready-builder-for-rhel-10-aarch64-rpms
```

커널 빌드에 필요한 기본 패키지 설치
```bash
sudo dnf -y install git make
```
<br>
<br>

## 2. 커널 및 드라이버 빌드

### 2.1 커널 소스 준비

#### 2.1.1 GB10 플랫폼용으로 사용자 지정된 RHEL 10 커널 저장소를 클론

```bash
git clone https://gitlab.com/redhat/edge/kernel/nvidia-gb10.git
cd nvidia-gb10
```

#### 2.1.2 빌드 시스템이 원치 않는 버전 접미사를 추가하는 것을 방지하기 위해 빈 파일 *localversion*을 생성

```bash
touch localversion
```

> [!NOTE]
> 커널 빌드 시스템이 일반적으로 커널 버전 문자열에 Git 커밋 정보를 추가하기 때문에 중요합니다. RHEL 커널 패키징 요구 사항을 충족하는 깔끔하고 재현 가능한 빌드를 위해서는 버전 문자열에 로컬 수정 사항 없이 공식 커널 버전만 반영되어야 합니다.
<br>

### 2.2 빌드 종속성 설치

```bash
sudo dnf -y install $(make dist-get-buildreqs | grep "Missing dependencies:" | cut -d":" -f2-)
```
* 커널 소스에는 필요한 모든 빌드 종속성을 식별하고 설치하는 대상이 포함되어 있음
* 커널 빌드 시스템에서 누락된 종속성을 검색하고, 패키지 이름을 추출하여 한 번에 설치
* 시스템의 현재 상태에 따라 커널 컴파일에 필요한 컴파일러, 빌드 도구, 헤더 및 기타 라이브러리가 설치될 수 있음
<br>

### 2.3 커널 빌드

#### 2.3.1 커널 빌드 실행

```bash
make dist-rpms
```
* 이 타겟은 커널의 내장 패키징 인프라를 사용하여 바이너리 RPM 패키지를 빌드
* 이 단계에서 커널, 모듈 및 지원 파일을 컴파일한 다음 배포 가능한 RPM 패키지로 만듦
*  하드웨어 사양에 따라 이 단계는 상당한 시간이 소요될 수 있으며, 30분에서 몇 시간까지 걸릴 수 있음

#### 2.3.2 빌드 완료된 커널 RPM 확인

```bash
ls -lh ~/nvidia-gb10/redhat/rpm/RPMS/aarch64/kernel-64k-*
```
* 최소한 다음 항목을 포함한 여러 RPM을 확인
  + *kernel-64k*
  + *kernel-64k-core*
  + *kernel-64k-modules*
  + *kernel-64k-devel*
* *kernel-64k* 변형은 ARM64 시스템에서 전반적인 성능 향상을 제공하지만 메모리 사용량이 증가
  + 따라서 이 구성에서 워크로드가 허용 가능한 수준으로 작동하는지 검증 필요
<br>

### 2.4 NVIDIA GPU 드라이버 빌드

> [!NOTE]
> GB10 플랫폼을 사용하려면 NVIDIA의 오픈 소스 GPU 커널 모듈이 필요합니다. 이러한 모듈은 방금 컴파일한 커널 버전과 동일한 버전으로 빌드되어야 합니다.

#### 2.4.1 커널 개발 헤드 설치

*kernel-64k-devel* 빌드 출력에서 ​​패키지 설치
```bash
sudo dnf install redhat/rpm/RPMS/aarch64/kernel-64k-devel-6*.rpm
```
* NVIDIA 드라이버와 같은 외부 모듈을 컴파일하는 데 필요한 커널 헤더 및 빌드 구성을 제공

#### 2.4.2 설치된 커널 헤더 파일 확인

```bash
ls /usr/src/kernels/*gb10*
```
* *.gb10* 이름의 디렉터리 확인

#### 2.4.3 GPU 드라이버 사양 파일 생성

~/kmod-nvidia-open.spec
```bash
%define driver_version 595.58.03
%define kversion %(ls /usr/src/kernels/ | grep '\.gb10' | sort -V | tail -n 1)
%define kversion_bare %(echo "%{kversion}" | sed -e 's/+64k$//' -e 's/\\.el[0-9]*[^.]*\\.[^.]*$//' -e 's/-/./g')
%global debug_package %{nil}

Name:           kmod-nvidia-open
Version:        %{kversion_bare}
Release:        1%{?dist}
Summary:        NVIDIA open source GPU kernel modules
License:        MIT and GPLv2
URL:            https://github.com/NVIDIA/open-gpu-kernel-modules
Source0:        https://github.com/NVIDIA/open-gpu-kernel-modules/archive/refs/tags/%{driver_version}.tar.gz#/open-gpu-kernel-modules-%{driver_version}.tar.gz

BuildRequires:  kernel-devel-uname-r = %{kversion}
BuildRequires:  make
BuildRequires:  gcc
Requires:       kernel-uname-r = %{kversion}

Provides:       kmod-nvidia-open = 3:%{driver_version}
Provides:       nvidia-kmod = 3:%{driver_version}
Conflicts:      kmod-nvidia-open-dkms
Conflicts:      kmod-nvidia-latest-dkms

%description
This package provides the NVIDIA open source GPU kernel modules built from
the official NVIDIA open-gpu-kernel-modules repository.

%prep
%setup -q -n open-gpu-kernel-modules-%{driver_version}

%build
unset LDFLAGS
make modules %{?_smp_mflags} SYSSRC=/usr/src/kernels/%{kversion}

%install
mkdir -p %{buildroot}/lib/modules/%{kversion}/extra/nvidia
install -m 644 kernel-open/nvidia-peermem.ko %{buildroot}/lib/modules/%{kversion}/extra/nvidia/
install -m 644 kernel-open/nvidia-modeset.ko %{buildroot}/lib/modules/%{kversion}/extra/nvidia/
install -m 644 kernel-open/nvidia-drm.ko %{buildroot}/lib/modules/%{kversion}/extra/nvidia/
install -m 644 kernel-open/nvidia-uvm.ko %{buildroot}/lib/modules/%{kversion}/extra/nvidia/
install -m 644 kernel-open/nvidia.ko %{buildroot}/lib/modules/%{kversion}/extra/nvidia/

%post
/sbin/depmod -a %{kversion} || :

%postun
/sbin/depmod -a %{kversion} || :

%files
/lib/modules/%{kversion}/extra/nvidia/nvidia-peermem.ko
/lib/modules/%{kversion}/extra/nvidia/nvidia-modeset.ko
/lib/modules/%{kversion}/extra/nvidia/nvidia-drm.ko
/lib/modules/%{kversion}/extra/nvidia/nvidia-uvm.ko
/lib/modules/%{kversion}/extra/nvidia/nvidia.ko

%changelog
```
* 중요한 단계를 자동화
  + 드라이버 버전 고정: *driver_version* 매크로
    - 빌드를 *GB10* 플랫폼에서 검증된 NVIDIA 드라이버 버전 `595.58.03`으로 고정
  + 커널 버전 감지: *kversion* 매크로
    - */usr/src/kernels/* 디렉터리에서 *`.gb10`*과 일치하는 디렉터리를 검색
    - 설치된 커널 버전을 동적으로 찾아 드라이버가 사용자 지정 커널을 기반으로 빌드되도록 구성
  + 버전 정규화
    - *kversion_bare* 매크로는 접미사를 제거하고 커널 버전을 깔끔한 패키지 버전 문자열로 재구성
  + 모듈 설치: 다음 5개의 커널 모듈을 커널 *extra* 디렉터리에 설치하고 *depmod* 모듈 종속성을 업데이트하기 위해 실행
    - nvidia.ko
    - nvidia-uvm.ko
    - nvidia-drm.ko
    - nvidia-modeset.ko
    - nvidia-peermem.ko
* %build 섹션
  + *LDFLAGS*를 설정하지 않으면 시스템 링커 플래그가 NVIDIA 드라이버의 빌드 프로세스에 영향을 미치는 것을 방지할 수 있음
<br>

### 2.5 GPU 드라이버 RPM 빌드

#### 2.5.1 RPM 빌드 디렉터리 구조를 생성하고 빌드를 실행

```bash
cd ~
mkdir -p ~/rpmbuild/SOURCES #1
rpmbuild -bb --define "_disable_source_fetch 0" kmod-nvidia-open.spec
```
1. 소스 파일을 다운로드할 디렉토리 *rpmbuild/SOURCES*를 생성
2. `_disable_source_fetch 0` 정의는 rpmbuild가 빌드 중에 NVIDIA 드라이버 소스 tarball을 GitHub에서 직접 다운로드하여 `~/rpmbuild/SOURCES/`에 저장하도록 지시

> [!NOTE]
> 빌드는 NVIDIA 커널 모듈을 사용자 지정 커널에 대해 컴파일하고 RPM 패키지로 만듭니다. 이 과정은 커널 빌드보다 빠르며, 일반적으로 하드웨어에 따라 5~15분 내에 완료됩니다.

#### 2.5.2 GPU 드라이버 RPM 패키지가 생성되었는지 확인

```bash
ls -lh ~/rpmbuild/RPMS/aarch64/kmod-nvidia-open-*.rpm
```
* 커널 빌드 버전과 일치하는 단일 RPM 파일이 표시되는 지 확인
<br>
<br>

## 3. 사용자 지정 커널 및 드라이버 설치 & 업데이트

### 3.1 사용자 지정 커널 및 드라이버 설치

#### 3.1.1 대상 GB10 시스템에 설치

```bash
cd ~/nvidia-gb10/redhat/rpm/RPMS/aarch64/
sudo dnf install \
    kernel-64k-6.12* \
    kernel-64k-core-6.12* \
    kernel-64k-modules-6.12* \
    kernel-64k-modules-core-6.12* \
    kernel-64k-modules-extra-6.12*
sudo dnf install ~/rpmbuild/RPMS/aarch64/kmod-nvidia-open-*.rpm
```

#### 3.1.2 설치 후 시스템을 재부팅하고 GRUB 메뉴에서 새 커널을 선택

#### 3.1.3 부팅이 완료되면 커널 버전 확인

```bash
uname -r
```

#### 3.1.4 NVIDIA 모듈이 성공적으로 로드되었는지 확인

```bash
lsmod | grep nvidia
```
* NVIDIA 모듈 목록이 표시되는 지 확인
  + *nvidia*
  + *nvidia_drm*
  + *nvidia_modeset*
<br>

### 3.2 NVIDA CUDA 설치

#### 3.2.1 *cuda* 패키지 설치

```bash
sudo dnf config-manager --add-repo https://developer.download.nvidia.com/compute/cuda/repos/rhel10/sbsa/cuda-rhel10.repo
sudo dnf clean all
sudo dnf -y install cuda
```
* NVIDIA CUDA 패키지는 EPEL(Extra Packages for Enterprise Linux) 저장소를 통해 제공되는 종속 패키지 필요
  + EPEL 저장소 활성화 필요

#### 3.2.2 *cuda* 설치 후, 재부팅하여 NVIDIA systemd 후크가 정상 동작하는 지 확인

<br>

### 3.3 커널 업데이트

#### 3.3.1 로컬 저장소를 업데이트하고 다시 빌드

```bash
cd nvidia-gb10
git fetch origin #1
git reset --hard origin/main #2
```
1. 커널 저장소가 정기적으로 리베이스되므로 일반적인 *git pull* 작업이 실패할 수 있음
2. 로컬 변경 사항이 모두 삭제되고 작업 디렉터리가 업스트림 *main* 브랜치와 일치하도록 재설정
   + 재설정 후 커널 빌드 및 GPU 드라이버 빌드 단계를 반복하여 업데이트된 RPM 패키지를 생성
   + 이 방법은 의도적으로 커밋되지 않은 변경 사항을 버림

#### 3.3.2 보존하고 싶은 로컬 수정 사항이 있는 경우

```bash
git reset --hard
```
* 위 명령어를 실행하기 전에 별도의 브랜치를 만들거나 실행하기 전에 변경 사항을 스태시(stash)
<br>
<br>

## 99. 요약 및 참조

### 99.1 요약

#### 99.1.1 이 후 진행 작업

* CUDA 또는 기타 NVIDIA 프레임워크를 사용하여 GPU 워크로드를 테스트
* 사용자 정의 커널을 자동화된 이미지 빌드 또는 배포 파이프라인에 통합
* 상위 저장소에서 커널 업데이트를 모니터링하고 필요에 따라 다시 빌드하여 수정 사항 및 새로운 기능을 반영

#### 99.1.2 실제 운영 환경에 배포할 경우

* 일관되고 재현 가능한 결과물을 전체 시스템에서 확보하기 위해 지속적 통합/지속적 배포(CI/CD) 파이프라인을 사용하여 커널 및 드라이버 빌드를 자동화하는 것을 고려

<br>
<br>

------
[차례](/README.md)