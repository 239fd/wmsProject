# 2 Развертывание программного средства

## 2.1 Необходимое программное обеспечение

Для развертывания программного средства необходимо программное обеспечение представленное в таблице 1.

Таблица 1 – Необходимое программное обеспечение

| ПО | Версия | Назначение |
|---|---|---|
| Docker Desktop | 24.0+ | Контейнеризация и оркестрация |
| Minikube | 1.31+ | Локальный Kubernetes кластер |
| kubectl | 1.28+ | CLI для управления Kubernetes |
| PowerShell | 5.1+ | Запуск скриптов развертывания |
| Java JDK | 21+ | Компиляция backend сервисов |
| Node.js | 18+ | Сборка frontend приложения |
| Git | 2.40+ | Клонирование репозитория |

Таким образом было представлено необходимое для развертывания программное обеспечение.


## 2.2 Системные требования

Далее представлены минимальные требования для развертывания программного средства:
- CPU: 4 ядра;
- RAM: 8 GB;
- Диск: 50 GB свободного места;
- ОС: Windows 10/11, Linux, macOS.

Таким образом были представлены минимальные требования для развертывания программного средства.


## 2.3 Развертывание через Docker Compose

Docker Compose позволяет развернуть все сервисы на одной машине в изолированных контейнерах. Этот метод подходит для:
- локальной разработки;
- тестирования;
- демонстрации системы.

### 2.3.1 Шаг 1. Клонирование репозитория

Первоначально необходимо клонировать репозиторий вместе с подмодулями (`backend/` и `client/`). Код представлен далее:

```bash
git clone --recurse-submodules https://github.com/239fd/wmsProject.git
cd wmsProject
```

Таким образом был склонирован репозиторий проекта вместе с подмодулями.

### 2.3.2 Шаг 2. Проверка Docker

Далее необходимо проверить установку Docker:

```bash
docker --version
docker-compose --version
```

Таким образом была проверена установка Docker.

### 2.3.3 Шаг 3. Запуск развертывания

Далее необходимо запустить унифицированный скрипт развертывания с параметром `-Action up` (значение по умолчанию):

```powershell
cd {PATH}\wmsProject
.\deploy-docker.ps1
# или явно:
.\deploy-docker.ps1 -Action up
```

Скрипт `deploy-docker.ps1` представляет собой единый управляющий скрипт жизненного цикла Docker-стенда и поддерживает следующие действия:
- `up` (по умолчанию) — сборка образов + запуск всех сервисов + вывод информации о доступе;
- `down` — остановка всех контейнеров;
- `restart` — перезапуск стенда;
- `status` — статус контейнеров (`docker-compose ps`);
- `logs` — вывод логов (`docker-compose logs -f`);
- `build` — пересборка всех восьми Docker-образов без запуска;
- `clean` — полная очистка (контейнеры, volumes, dangling-образы, сети).

Фрагмент скрипта `deploy-docker.ps1` представлен далее:

```powershell
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("up", "down", "restart", "status", "logs", "build", "clean")]
    [string]$Action = "up"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

function Start-Services {
    Write-Header "Запуск WMS Project (Docker Compose)"
    Test-Docker
    Write-Info "Запуск всех сервисов..."
    docker-compose -f "$ProjectRoot\docker-compose.yml" up -d --build
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Все сервисы запущены!"
        Start-Sleep -Seconds 30
        Show-ServiceStatus
        Show-AccessInfo
    } else {
        Write-Err "Ошибка при запуске сервисов"
        exit 1
    }
}

function Build-Services {
    $services = @(
        @{ Name = "eureka-server";        Path = "backend\eureka-server" },
        @{ Name = "api-gateway";          Path = "backend\api-gateway" },
        @{ Name = "sso-service";          Path = "backend\SSOService" },
        @{ Name = "organization-service"; Path = "backend\organization-service" },
        @{ Name = "warehouse-service";    Path = "backend\warehouse-service" },
        @{ Name = "product-service";      Path = "backend\product-service" },
        @{ Name = "document-service";     Path = "backend\document-service" },
        @{ Name = "frontend";             Path = "client" }
    )
    foreach ($s in $services) {
        docker build -t "$($s.Name):latest" (Join-Path $ProjectRoot $s.Path)
    }
}

function Clean-All {
    docker-compose -f "$ProjectRoot\docker-compose.yml" down -v
    docker image prune -f
    docker network prune -f
}

switch ($Action) {
    "up"      { Start-Services }
    "down"    { Stop-Services }
    "restart" { Restart-Services }
    "status"  { Show-ServiceStatus }
    "logs"    { Show-ServiceLogs }
    "build"   { Build-Services }
    "clean"   { Clean-All }
}
```

Таким образом был представлен скрипт, автоматизирующий развертывание Docker-контейнеров.

### 2.3.4 Шаг 4. Проверка развертывания

Для проверки статусов контейнеров необходимо выполнить следующие команды:

```powershell
.\deploy-docker.ps1 -Action status

# Просмотр логов всех сервисов
.\deploy-docker.ps1 -Action logs

# Просмотр логов конкретного сервиса (вручную)
docker-compose logs -f api-gateway
```

Таким образом были представлены команды необходимые для проверки развертывания.

### 2.3.5 Остановка и очистка

Для остановки и очистки есть два варианта, как ручной так и автоматический через тот же скрипт. Команды представлены далее:

```powershell
# Мягкая остановка (контейнеры остановлены, данные сохраняются)
.\deploy-docker.ps1 -Action down

# Полная очистка (контейнеры + volumes + dangling-образы + сети)
.\deploy-docker.ps1 -Action clean

# Глубокая очистка (вручную, опасно — удалит ВСЕ неиспользуемые образы)
docker system prune -a --volumes
```

Таким образом был представлен полный цикл развертывания через docker-compose.


## 2.4 Развертывание в Kubernetes (Minikube)

Kubernetes обеспечивает:
- автоматическое масштабирование;
- self-healing (автоматический перезапуск упавших подов);
- service discovery и load balancing;
- rolling updates и rollbacks;
- управление secrets и конфигурацией.

Система развертывается на 4 специализированных нодах:
- **Storage Node:** PostgreSQL (4 инстанса) + Redis;
- **Backend Node:** Все микросервисы бизнес-логики;
- **Frontend Node:** React приложение;
- **Infrastructure Node:** RabbitMQ, MinIO, Prometheus, Grafana.

В Minikube все ноды эмулируются на одном физическом узле с помощью меток (labels).

Команды необходимые для первоначальной проверки представлены далее:

```powershell
# Проверяем установку
minikube version
kubectl version --client

# Убеждаемся что Docker запущен
docker ps
```

Таким образом были представлены команды первоначальной проверки.

### 2.4.1 Шаг 1. Запуск Minikube

Команды запуска представлены далее:

```powershell
# Останавливаем предыдущий кластер (если есть)
minikube delete

# Запускаем новый кластер с нужными ресурсами
minikube start --cpus=4 --memory=8192 --disk-size=50g --driver=docker

# Проверяем статус
minikube status

# Проверяем ноды
kubectl get nodes
```

Ожидаемый вывод представлен далее:

```
minikube
type: Control Plane
host: Running
kubelet: Running
apiserver: Running
kubeconfig: Configured
```

Таким образом были представлены команды запуска.

### 2.4.2 Шаг 2. Настройка Docker окружения

Команды настройки Docker окружения представлены далее:

```powershell
# Переключаемся на Docker daemon внутри Minikube
# Это позволяет использовать локальные образы без push в registry
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Проверяем
docker ps
```

Примечание: данное переключение выполняется автоматически при запуске `.\deploy-k8s.ps1` (этап `Test-Prerequisites`).

Таким образом были представлены команды настройки Docker окружения.

### 2.4.3 Шаг 3. Запуск развертывания

Команды запуска развертывания представлены далее:

```powershell
# Переходим в директорию проекта
cd {PATH}\wmsProject

# Полное развертывание (setup + build + deploy + status)
.\deploy-k8s.ps1
# или явно:
.\deploy-k8s.ps1 -Action all
```

Таким образом были представлены команды запуска развертывания.

Скрипт `deploy-k8s.ps1` представляет собой единый управляющий скрипт жизненного цикла Kubernetes-стенда и поддерживает следующие действия:
- `all` (по умолчанию) — проверка окружения + разметка нод + сборка образов + применение всех манифестов + статус;
- `setup` — только проверка окружения и разметка нод;
- `build` — только сборка восьми Docker-образов внутри docker-daemon Minikube;
- `deploy` — применение манифестов без повторной разметки нод (опция `-SkipBuild` пропускает сборку);
- `status` — статус подов, сервисов, deployments, PV;
- `port-forward` — запуск проброса портов для всех веб-интерфейсов;
- `stop-forward` — остановка всех port-forward задач;
- `clean` — полная очистка (namespace + PV + node labels + образы).

Фрагмент скрипта `deploy-k8s.ps1` представлен далее:

```powershell
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("all", "setup", "build", "deploy", "status",
                 "port-forward", "stop-forward", "clean")]
    [string]$Action = "all",
    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$K8sPath = Join-Path $ProjectRoot "k8s"

function Test-Prerequisites {
    docker --version | Out-Null
    kubectl version --client | Out-Null
    $status = minikube status --format='{{.Host}}' 2>$null
    if ($status -ne "Running") {
        Write-Err "Minikube не запущен!"
        exit 1
    }
    & minikube -p minikube docker-env --shell powershell | Invoke-Expression
}

function Setup-ClusterNodes {
    $nodes = kubectl get nodes -o json | ConvertFrom-Json
    foreach ($node in $nodes.items) {
        kubectl label node $node.metadata.name node-role.storage=true        --overwrite
        kubectl label node $node.metadata.name node-role.backend=true        --overwrite
        kubectl label node $node.metadata.name node-role.frontend=true       --overwrite
        kubectl label node $node.metadata.name node-role.infrastructure=true --overwrite
    }
}

function Deploy-ToKubernetes {
    $manifestFiles = @(
        "00-namespace.yaml", "01-storage.yaml",       "02-secrets.yaml",
        "03-databases.yaml", "04-backend.yaml",       "05-infrastructure.yaml",
        "06-ingress.yaml",   "07-autoscaling.yaml",   "08-network-policies.yaml",
        "09-frontend.yaml"
    )
    foreach ($manifest in $manifestFiles) {
        $path = Join-Path $K8sPath $manifest
        if (Test-Path $path) {
            kubectl apply -f $path
            Start-Sleep -Seconds 2
        }
    }
    kubectl wait --for=condition=ready pod --all -n wms --timeout=300s
}

function Start-PortForwards {
    $forwards = @(
        @{ Service = "frontend";      Local = 3000;  Remote = 80    },
        @{ Service = "api-gateway";   Local = 8765;  Remote = 8765  },
        @{ Service = "eureka-server"; Local = 8761;  Remote = 8761  },
        @{ Service = "rabbitmq";      Local = 15672; Remote = 15672 },
        @{ Service = "grafana";       Local = 3001;  Remote = 3000  },
        @{ Service = "prometheus";    Local = 9090;  Remote = 9090  }
    )
    foreach ($f in $forwards) {
        Start-Job -Name "pf-$($f.Service)" -ScriptBlock {
            param($s, $l, $r)
            kubectl port-forward -n wms "svc/$s" "${l}:${r}"
        } -ArgumentList $f.Service, $f.Local, $f.Remote | Out-Null
    }
}

function Clean-Resources {
    kubectl delete namespace wms --ignore-not-found=true --wait=false
    kubectl delete pv --all --ignore-not-found=true
    kubectl label nodes --all node-role.storage- node-role.backend- `
                              node-role.frontend- node-role.infrastructure-
}

switch ($Action) {
    "setup"        { Test-Prerequisites; Setup-ClusterNodes }
    "build"        { Test-Prerequisites; Build-DockerImages }
    "deploy"       { Test-Prerequisites; if (-not $SkipBuild) { Build-DockerImages }
                     Deploy-ToKubernetes; Show-Status }
    "status"       { Show-Status }
    "port-forward" { Start-PortForwards }
    "stop-forward" { Stop-PortForwards }
    "clean"        { Clean-Resources }
    "all"          { Test-Prerequisites; Setup-ClusterNodes
                     if (-not $SkipBuild) { Build-DockerImages }
                     Deploy-ToKubernetes; Show-Status }
}
```

Таким образом были представлены команды, выполняемые скриптом `deploy-k8s.ps1`.

### 2.4.4 Шаг 4. Проверка развертывания

Проверка развертывания происходит при помощи следующих команд:

```powershell
# Сводный статус через скрипт
.\deploy-k8s.ps1 -Action status

# Или вручную через kubectl
kubectl get pods -n wms
kubectl get services -n wms
kubectl get deployments -n wms

# Постоянный мониторинг подов
kubectl get pods -n wms -w
```

Ожидаемый вывод (все поды в статусе Running) представлен на рисунке 1.

Рисунок 1 – Ожидаемый вывод

Таким образом была представлена проверка развертывания.

### 2.4.5 Шаг 5. Мониторинг и отладка

Для мониторинга и отладки можно использовать следующие команды:

```powershell
# Просмотр логов пода
kubectl logs -n wms <pod-name>

# Следить за логами в реальном времени
kubectl logs -n wms <pod-name> -f

# Логи предыдущего контейнера (если под перезапускался)
kubectl logs -n wms <pod-name> --previous

# Детальная информация о поде
kubectl describe pod -n wms <pod-name>

# Выполнение команды внутри пода
kubectl exec -n wms <pod-name> -it -- /bin/bash

# Проверка events
kubectl get events -n wms --sort-by='.lastTimestamp'

# Ресурсы подов
kubectl top pods -n wms

# Ресурсы узлов
kubectl top nodes
```

Таким образом были представлены команды для мониторинга и отладки.

### 2.4.6 Шаг 6. Остановка и очистка

Команды для остановки и очистки представлены далее:

```powershell
# Остановка port-forwarding
.\deploy-k8s.ps1 -Action stop-forward

# Удаление всех ресурсов проекта (namespace, PV, метки нод)
.\deploy-k8s.ps1 -Action clean

# Остановка Minikube
minikube stop

# Полное удаление кластера
minikube delete
```

Таким образом были представлены команды для остановки и очистки.


## 2.5 Kubernetes манифесты

Структура манифестов представлена на рисунке 2.

Рисунок 2 – Структура манифестов

Все манифесты используют `nodeSelector` для размещения компонентов на соответствующих нодах.

Далее представлен манифест storage и backend:

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-organization-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  hostPath:
    path: /mnt/data/postgres/organization
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: node-role.storage
          operator: In
          values:
          - "true"
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-product-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  hostPath:
    path: /mnt/data/postgres/product
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: node-role.storage
          operator: In
          values:
          - "true"
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-warehouse-pv
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  hostPath:
    path: /mnt/data/postgres/warehouse
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: node-role.storage
          operator: In
          values:
          - "true"
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: postgres-sso-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  hostPath:
    path: /mnt/data/postgres/sso
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: node-role.storage
          operator: In
          values:
          - "true"
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: redis-pv
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  hostPath:
    path: /mnt/data/redis
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: node-role.storage
          operator: In
          values:
          - "true"
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: eureka-server
  namespace: wms
spec:
  replicas: 1
  selector:
    matchLabels:
      app: eureka-server
  template:
    metadata:
      labels:
        app: eureka-server
        tier: backend
    spec:
      nodeSelector:
        node-role.backend: "true"
      containers:
      - name: eureka-server
        image: eureka-server:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 8761
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: eureka-server
  namespace: wms
spec:
  type: ClusterIP
  ports:
  - port: 8761
    targetPort: 8761
  selector:
    app: eureka-server
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: wms
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
        tier: backend
    spec:
      nodeSelector:
        node-role.backend: "true"
      containers:
      - name: api-gateway
        image: api-gateway:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 8765
        env:
        - name: EUREKA_CLIENT_SERVICEURL_DEFAULTZONE
          value: "http://eureka-server:8761/eureka"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: wms
spec:
  type: NodePort
  ports:
  - port: 8765
    targetPort: 8765
    nodePort: 30765
  selector:
    app: api-gateway
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: organization-service
  namespace: wms
spec:
  replicas: 2
  selector:
    matchLabels:
      app: organization-service
  template:
    metadata:
      labels:
        app: organization-service
        tier: backend
    spec:
      nodeSelector:
        node-role.backend: "true"
      containers:
      - name: organization-service
        image: organization-service:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 8010
        env:
        - name: SPRING_DATASOURCE_URL
          value: "jdbc:postgresql://postgres-organization:5432/organization_db"
        - name: SPRING_DATASOURCE_USERNAME
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: organization-db-user
        - name: SPRING_DATASOURCE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: organization-db-password
        - name: EUREKA_CLIENT_SERVICEURL_DEFAULTZONE
          value: "http://eureka-server:8761/eureka"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: organization-service
  namespace: wms
spec:
  type: ClusterIP
  ports:
  - port: 8010
    targetPort: 8010
  selector:
    app: organization-service
```

Таким образом были представлены два основных манифеста — storage и backend.


## 2.6 Манифест frontend и infrastructure

Помимо манифестов storage и backend, для полноты стека требуются манифесты frontend и infrastructure. Манифест frontend описывает Deployment React-приложения и Service типа NodePort для внешнего доступа. Манифест infrastructure описывает RabbitMQ (брокер сообщений) и MinIO (S3-совместимое хранилище документов).

Манифест frontend представлен далее:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: wms
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
        tier: frontend
    spec:
      nodeSelector:
        node-role.frontend: "true"
      containers:
      - name: frontend
        image: frontend:latest
        imagePullPolicy: Never
        ports:
        - containerPort: 80
        env:
        - name: REACT_APP_API_URL
          value: "http://api-gateway:8765"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "300m"
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: wms
spec:
  type: NodePort
  ports:
  - port: 80
    targetPort: 80
    nodePort: 30080
  selector:
    app: frontend
```

Манифест infrastructure (фрагмент с RabbitMQ и MinIO) представлен далее:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rabbitmq
  namespace: wms
spec:
  replicas: 1
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
        tier: infrastructure
    spec:
      nodeSelector:
        node-role.infrastructure: "true"
      containers:
      - name: rabbitmq
        image: rabbitmq:3.13-management
        ports:
        - containerPort: 5672
        - containerPort: 15672
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "300m"
---
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq
  namespace: wms
spec:
  type: ClusterIP
  ports:
  - name: amqp
    port: 5672
    targetPort: 5672
  - name: management
    port: 15672
    targetPort: 15672
  selector:
    app: rabbitmq
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: wms
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
        tier: infrastructure
    spec:
      nodeSelector:
        node-role.infrastructure: "true"
      containers:
      - name: minio
        image: minio/minio:latest
        args: ["server", "/data", "--console-address", ":9001"]
        ports:
        - containerPort: 9000
        - containerPort: 9001
        env:
        - name: MINIO_ROOT_USER
          valueFrom:
            secretKeyRef:
              name: minio-secrets
              key: access-key
        - name: MINIO_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: minio-secrets
              key: secret-key
---
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: wms
spec:
  type: ClusterIP
  ports:
  - name: api
    port: 9000
    targetPort: 9000
  - name: console
    port: 9001
    targetPort: 9001
  selector:
    app: minio
```

Таким образом были представлены манифесты frontend и infrastructure.


## 2.7 Манифест Secrets

Все пароли (базы данных, MinIO, OAuth client-secret) вынесены в отдельный манифест `02-secrets.yaml` и не хранятся в открытом виде в Deployment-манифестах. Манифест представлен далее:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: wms
---
apiVersion: v1
kind: Secret
metadata:
  name: db-secrets
  namespace: wms
type: Opaque
stringData:
  organization-db-user: postgres
  organization-db-password: postgres
  product-db-user: postgres
  product-db-password: postgres
  warehouse-db-user: postgres
  warehouse-db-password: postgres
  sso-db-user: postgres
  sso-db-password: postgres
---
apiVersion: v1
kind: Secret
metadata:
  name: minio-secrets
  namespace: wms
type: Opaque
stringData:
  access-key: wmsadmin
  secret-key: wmsadmin12345
```

Таким образом был представлен манифест Secrets, выносящий чувствительную конфигурацию из Deployment-манифестов.


## 2.8 Манифест NetworkPolicies

Для изоляции трафика между уровнями (frontend, backend, storage) применяются `NetworkPolicy`. Они запрещают прямые обращения от frontend к базам данных и разрешают доступ только через backend-сервисы. Фрагмент манифеста представлен далее:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-frontend-to-storage
  namespace: wms
spec:
  podSelector:
    matchLabels:
      tier: storage
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: backend
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: wms
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: frontend
```

Таким образом был представлен манифест NetworkPolicy, ограничивающий сетевые потоки между уровнями.


## 2.9 Единый PowerShell-скрипт развертывания

В отличие от ранних версий, где для каждой операции существовал отдельный скрипт (`build-images.ps1`, `cleanup-docker.ps1`, `cleanup-k8s.ps1`, `start-port-forwards.ps1`, `stop-port-forwards.ps1`), в текущей версии репозитория жизненный цикл стенда полностью покрывается двумя унифицированными скриптами с параметром `-Action`:

- `deploy-docker.ps1` — управление Docker Compose стендом;
- `deploy-k8s.ps1` — управление Kubernetes стендом.

Каждое действие, ранее реализованное отдельным файлом, теперь является одной из веток внутри `switch ($Action)`. Сводная таблица соответствия представлена в таблице 2.

Таблица 2 – Соответствие старых скриптов действиям унифицированных

| Старый скрипт | Новая команда |
|---|---|
| `build-images.ps1` | `.\deploy-docker.ps1 -Action build` или `.\deploy-k8s.ps1 -Action build` |
| `cleanup-docker.ps1` | `.\deploy-docker.ps1 -Action clean` |
| `cleanup-k8s.ps1` | `.\deploy-k8s.ps1 -Action clean` |
| `start-port-forwards.ps1` | `.\deploy-k8s.ps1 -Action port-forward` |
| `stop-port-forwards.ps1` | `.\deploy-k8s.ps1 -Action stop-forward` |

Таким образом было сокращено количество файлов в репозитории с семи PowerShell-скриптов до двух за счёт параметризации `-Action`.


## 2.10 Карта пробрасываемых портов

После запуска `.\deploy-k8s.ps1 -Action port-forward` веб-интерфейсы доступны по адресам, представленным в таблице 3.

Таблица 3 – Карта пробрасываемых портов

| Сервис | Локальный адрес | Назначение |
|---|---|---|
| frontend | http://localhost:3000 | React-приложение |
| api-gateway | http://localhost:8765 | REST API |
| eureka-server | http://localhost:8761 | Реестр сервис-дискавери |
| rabbitmq | http://localhost:15672 | Management UI (guest/guest) |
| grafana | http://localhost:3001 | Дашборды наблюдаемости (admin/admin) |
| prometheus | http://localhost:9090 | Метрики |

Таким образом была представлена карта пробрасываемых портов.


## 2.11 Решение типовых проблем

В процессе развёртывания могут возникать типовые проблемы. Способы их диагностики и устранения представлены далее.

### 2.11.1 Поды находятся в статусе ImagePullBackOff

Причина – Kubernetes не может найти Docker-образ. Это происходит когда образ не собран внутри Minikube docker-daemon. Команды для решения представлены далее:

```powershell
# Переключиться на docker-daemon Minikube и пересобрать образы
.\deploy-k8s.ps1 -Action build

# Удалить упавшие поды
kubectl delete pods -n wms --field-selector=status.phase!=Running
```

Таким образом был представлен способ устранения ошибки ImagePullBackOff.

### 2.11.2 Поды находятся в статусе CrashLoopBackOff

Причина – приложение в контейнере падает при запуске. Для диагностики используются команды, представленные далее:

```powershell
# Получить логи упавшего пода
kubectl logs -n wms <pod-name> --previous

# Описание пода с событиями
kubectl describe pod -n wms <pod-name>

# Зайти внутрь пода для отладки
kubectl exec -n wms <pod-name> -it -- /bin/sh
```

Таким образом был представлен способ диагностики ошибки CrashLoopBackOff.

### 2.11.3 PersistentVolume в статусе Pending

Причина – `claimRef` PV ссылается на удалённый PVC либо hostPath каталог не существует. Команды для решения представлены далее:

```powershell
# Удалить все PV и пересоздать
kubectl delete pv --all
kubectl apply -f k8s\01-storage.yaml

# Альтернатива - очистить claimRef в конкретном PV
kubectl patch pv <pv-name> -p '{"spec":{"claimRef": null}}'
```

Таким образом был представлен способ устранения статуса Pending у PersistentVolume.

### 2.11.4 Превышение квоты ресурсов Minikube

Причина – суммарное `requests` всех подов превышает ресурсы кластера. Команды для диагностики представлены далее:

```powershell
# Текущее потребление
kubectl top pods -n wms
kubectl top nodes

# Перезапустить Minikube с увеличенными ресурсами
minikube stop
minikube start --cpus=6 --memory=12288 --driver=docker
```

Таким образом был представлен способ устранения нехватки ресурсов кластера.


## 2.12 Команды быстрого старта

Для удобства приведена сводная таблица команд быстрого старта (таблица 4).

Таблица 4 – Сводные команды развёртывания

| Сценарий | Команда |
|---|---|
| Docker Compose: запуск | `.\deploy-docker.ps1 -Action up` |
| Docker Compose: остановка | `.\deploy-docker.ps1 -Action down` |
| Docker Compose: статус | `.\deploy-docker.ps1 -Action status` |
| Docker Compose: логи | `.\deploy-docker.ps1 -Action logs` |
| Docker Compose: очистка | `.\deploy-docker.ps1 -Action clean` |
| Сборка всех образов (Docker) | `.\deploy-docker.ps1 -Action build` |
| Kubernetes: запуск Minikube | `minikube start --cpus=4 --memory=8192 --disk-size=50g --driver=docker` |
| Kubernetes: полное развёртывание | `.\deploy-k8s.ps1 -Action all` |
| Kubernetes: только сборка образов | `.\deploy-k8s.ps1 -Action build` |
| Kubernetes: только применение манифестов | `.\deploy-k8s.ps1 -Action deploy -SkipBuild` |
| Kubernetes: статус | `.\deploy-k8s.ps1 -Action status` |
| Kubernetes: проброс портов | `.\deploy-k8s.ps1 -Action port-forward` |
| Kubernetes: остановка проброса | `.\deploy-k8s.ps1 -Action stop-forward` |
| Kubernetes: очистка | `.\deploy-k8s.ps1 -Action clean` |
| Полная остановка кластера | `minikube stop` |
| Полное удаление кластера | `minikube delete` |

Таким образом была представлена сводная таблица команд для быстрого развёртывания и сопровождения системы.


## 2.13 Заключение по разделу

В данном разделе было описано развёртывание программного средства двумя способами: через Docker Compose для локальной разработки и тестирования и через Kubernetes (Minikube) для эмуляции продуктивной среды с четырьмя ролями нод. Для каждого сценария представлены пошаговые инструкции, унифицированные PowerShell-скрипты с параметром `-Action`, манифесты Kubernetes и способы диагностики типовых проблем. Полученный комплект артефактов позволяет развернуть систему на любой совместимой машине, удовлетворяющей системным требованиям из раздела 2.2, без необходимости ручной конфигурации.

Таким образом, в данном разделе был представлен полный цикл развёртывания программного средства от подготовки окружения до запуска и сопровождения системы.
