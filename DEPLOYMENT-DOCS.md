# Продолжение раздела 2 «Развертывание»

## 2.5.1 Манифесты frontend и infrastructure

Помимо манифестов storage и backend, в каталоге `k8s/` находятся манифесты frontend и infrastructure. Они отвечают за публикацию React-приложения и за инфраструктурные сервисы (RabbitMQ, MinIO, Prometheus, Grafana, Loki, Jaeger).

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
          requests: { memory: "256Mi", cpu: "100m" }
          limits:   { memory: "512Mi", cpu: "300m" }
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
        volumeMounts:
        - name: minio-data
          mountPath: /data
      volumes:
      - name: minio-data
        persistentVolumeClaim:
          claimName: minio-pvc
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

Таким образом, были представлены манифесты frontend и infrastructure, которые завершают полный стек системы.

## 2.5.2 Манифест Secrets

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

Таким образом, был представлен манифест Secrets — единое хранилище чувствительной конфигурации.

## 2.5.3 Манифест NetworkPolicies

Для изоляции трафика между уровнями (frontend, backend, storage) применяются `NetworkPolicy`. Фрагмент манифеста представлен далее:

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
  name: allow-backend-to-storage
  namespace: wms
spec:
  podSelector:
    matchLabels:
      tier: backend
  policyTypes:
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          tier: frontend
```

Таким образом, был представлен манифест NetworkPolicy, ограничивающий сетевые потоки.

## 2.6 Вспомогательные скрипты PowerShell

Помимо основного `deploy-k8s.ps1`, в репозитории располагаются вспомогательные скрипты, автоматизирующие рутинные операции.

### 2.6.1 Скрипт build-images.ps1

Скрипт собирает Docker-образы для всех восьми сервисов системы (семь backend-сервисов и один frontend) и кладёт их в локальный docker-daemon Minikube. Содержимое представлено далее:

```powershell
Write-Host "WMS Project - Build Docker Images" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

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

$total = $services.Count
$i = 0
foreach ($s in $services) {
    $i++
    Write-Host "[$i/$total] Building $($s.Name)..." -ForegroundColor Yellow
    docker build -t "$($s.Name):latest" $s.Path
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Build failed for $($s.Name)" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] $($s.Name):latest" -ForegroundColor Green
    Write-Host ""
}

Write-Host "=== All images built successfully ===" -ForegroundColor Green
```

Таким образом, был представлен скрипт сборки всех Docker-образов проекта.

### 2.6.2 Скрипт deploy-k8s.ps1

Основной скрипт развёртывания в Kubernetes. Выполняет последовательно: проверку Minikube, переключение docker-daemon, сборку образов, разметку нод, применение манифестов и ожидание готовности подов. Содержимое представлено далее:

```powershell
Write-Host "WMS Project - Kubernetes Deployment" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

Write-Host "[1/7] Checking Minikube status..." -ForegroundColor Yellow
$status = minikube status --format='{{.Host}}' 2>$null
if ($status -ne "Running") {
    Write-Host "  Minikube is not running. Start it manually:" -ForegroundColor Red
    Write-Host "  minikube start --cpus=4 --memory=8192 --disk-size=50g --driver=docker" -ForegroundColor Yellow
    exit 1
}

Write-Host "[2/7] Switching docker context to Minikube..." -ForegroundColor Yellow
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

Write-Host "[3/7] Building local images..." -ForegroundColor Yellow
.\build-images.ps1

Write-Host "[4/7] Labeling node..." -ForegroundColor Yellow
$node = (kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
kubectl label node $node node-role.storage=true --overwrite | Out-Null
kubectl label node $node node-role.backend=true --overwrite | Out-Null
kubectl label node $node node-role.frontend=true --overwrite | Out-Null
kubectl label node $node node-role.infrastructure=true --overwrite | Out-Null

Write-Host "[5/7] Applying manifests in order..." -ForegroundColor Yellow
$manifests = @(
    "k8s\00-namespace.yaml",   "k8s\01-storage.yaml",
    "k8s\02-secrets.yaml",     "k8s\03-databases.yaml",
    "k8s\04-backend.yaml",     "k8s\05-infrastructure.yaml",
    "k8s\06-ingress.yaml",     "k8s\07-autoscaling.yaml",
    "k8s\08-network-policies.yaml", "k8s\09-frontend.yaml"
)
foreach ($m in $manifests) {
    if (Test-Path $m) { kubectl apply -f $m }
}

Write-Host "[6/7] Waiting for pods (timeout 300s)..." -ForegroundColor Yellow
kubectl wait --for=condition=ready pod --all -n wms --timeout=300s

Write-Host "[7/7] Cluster state:" -ForegroundColor Yellow
kubectl get pods -n wms
kubectl get services -n wms

Write-Host "=== Deployment Complete ===" -ForegroundColor Green
```

Таким образом, был представлен скрипт автоматического развёртывания в Kubernetes.

### 2.6.3 Скрипт cleanup-k8s.ps1

Скрипт очистки кластера: удаляет namespace `wms`, все PersistentVolumes и снимает разметку нод. Содержимое представлено далее:

```powershell
Write-Host "WMS Project - Kubernetes Cleanup" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"

Write-Host "[1/4] Deleting all resources in wms namespace..." -ForegroundColor Yellow
kubectl delete namespace wms --ignore-not-found=true --wait=false

Write-Host "[2/4] Waiting for namespace deletion..." -ForegroundColor Yellow
$timeout = 60
$elapsed = 0
while ((kubectl get namespace wms 2>$null) -and ($elapsed -lt $timeout)) {
    Start-Sleep -Seconds 5
    $elapsed += 5
}
if (kubectl get namespace wms 2>$null) {
    kubectl delete namespace wms --force --grace-period=0 2>$null
}

Write-Host "[3/4] Deleting PersistentVolumes..." -ForegroundColor Yellow
kubectl delete pv --all --ignore-not-found=true

Write-Host "[4/4] Removing node labels..." -ForegroundColor Yellow
kubectl label nodes --all node-role.storage- 2>$null
kubectl label nodes --all node-role.backend- 2>$null
kubectl label nodes --all node-role.frontend- 2>$null
kubectl label nodes --all node-role.infrastructure- 2>$null

Write-Host "=== Cleanup Complete ===" -ForegroundColor Green
```

Таким образом, был представлен скрипт очистки кластера Kubernetes.

## 2.7 Проброс портов (port-forwarding)

В Minikube сервисы недоступны напрямую с хост-машины. Для доступа из браузера используется механизм `kubectl port-forward`. Для удобства запуска и остановки сразу нескольких пробросов написаны два скрипта.

### 2.7.1 Скрипт start-port-forwards.ps1

Скрипт стартует фоновые задачи `kubectl port-forward` для всех веб-доступных сервисов. Содержимое представлено далее:

```powershell
Write-Host "WMS Project - Start Port Forwarding" -ForegroundColor Cyan

$ErrorActionPreference = "SilentlyContinue"

$forwards = @(
    @{ Service = "frontend";       Local = 3000;  Remote = 80   },
    @{ Service = "api-gateway";    Local = 8765;  Remote = 8765 },
    @{ Service = "eureka-server";  Local = 8761;  Remote = 8761 },
    @{ Service = "rabbitmq";       Local = 15672; Remote = 15672 },
    @{ Service = "grafana";        Local = 3001;  Remote = 3000 },
    @{ Service = "prometheus";     Local = 9090;  Remote = 9090 }
)

foreach ($f in $forwards) {
    Start-Job -Name "pf-$($f.Service)" -ScriptBlock {
        param($s, $l, $r)
        kubectl port-forward -n wms "svc/$s" "${l}:${r}"
    } -ArgumentList $f.Service, $f.Local, $f.Remote | Out-Null
}

Start-Sleep -Seconds 3

Write-Host "=== Port Forwarding Active ===" -ForegroundColor Green
foreach ($f in $forwards) {
    Write-Host "  $($f.Service) -> http://localhost:$($f.Local)" -ForegroundColor White
}
```

Таким образом, был представлен скрипт запуска проброса портов.

### 2.7.2 Скрипт stop-port-forwards.ps1

Скрипт останавливает все фоновые задачи проброса и закрывает оставшиеся процессы `kubectl`. Содержимое представлено далее:

```powershell
Write-Host "WMS Project - Stop Port Forwarding" -ForegroundColor Cyan

$jobs = Get-Job | Where-Object { $_.Name -like "pf-*" }
foreach ($j in $jobs) {
    Stop-Job -Job $j
    Remove-Job -Job $j -Force
}

Get-Process -Name "kubectl" -ErrorAction SilentlyContinue | ForEach-Object {
    try { $_ | Stop-Process -Force } catch { }
}

Write-Host "=== Port Forwarding Stopped ===" -ForegroundColor Green
```

Таким образом, был представлен скрипт остановки проброса портов.

### 2.7.3 Карта пробрасываемых портов

После запуска `start-port-forwards.ps1` веб-интерфейсы доступны по адресам, приведённым в таблице 2.

Таблица 2 — Карта пробрасываемых портов
| Сервис | Локальный адрес | Назначение |
|---|---|---|
| frontend | http://localhost:3000 | React-приложение |
| api-gateway | http://localhost:8765 | REST API |
| eureka-server | http://localhost:8761 | Реестр сервис-дискавери |
| rabbitmq | http://localhost:15672 | Management UI (guest/guest) |
| grafana | http://localhost:3001 | Дашборды наблюдаемости (admin/admin) |
| prometheus | http://localhost:9090 | Метрики |

Таким образом, была представлена карта пробрасываемых портов.

## 2.8 Решение типовых проблем

В процессе развёртывания могут возникать типовые проблемы. Способы их диагностики и устранения приведены ниже.

### 2.8.1 Поды находятся в статусе ImagePullBackOff

Причина — Kubernetes не может найти Docker-образ. Это происходит когда образ не собран внутри Minikube docker-daemon. Команды для решения представлены далее:

```powershell
# Переключиться на docker-daemon Minikube
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

# Пересобрать образы
.\build-images.ps1

# Удалить упавшие поды (deployments пересоздадут их)
kubectl delete pods -n wms --field-selector=status.phase!=Running
```

Таким образом, был представлен способ устранения ошибки ImagePullBackOff.

### 2.8.2 Поды находятся в статусе CrashLoopBackOff

Причина — приложение в контейнере падает при запуске. Для диагностики используются команды, представленные далее:

```powershell
# Получить логи упавшего пода
kubectl logs -n wms <pod-name> --previous

# Описание пода с событиями
kubectl describe pod -n wms <pod-name>

# Зайти внутрь живого пода для отладки
kubectl exec -n wms <pod-name> -it -- /bin/sh
```

Таким образом, был представлен способ диагностики ошибки CrashLoopBackOff.

### 2.8.3 PersistentVolume в статусе Pending

Причина — claimRef PV ссылается на удалённый PVC либо `hostPath` каталог не существует. Команды для решения представлены далее:

```powershell
# Удалить все PV и пересоздать
kubectl delete pv --all
kubectl apply -f k8s\01-storage.yaml

# Альтернатива - очистить claimRef в конкретном PV
kubectl patch pv <pv-name> -p '{"spec":{"claimRef": null}}'
```

Таким образом, был представлен способ устранения статуса Pending у PersistentVolume.

### 2.8.4 Сервисы не находят друг друга через Eureka

Причина — DNS внутри Kubernetes возвращает service-DNS-имя, но Eureka-клиент использует `eureka.instance.hostname=localhost`. Команды для проверки представлены далее:

```powershell
# Проверить регистрацию сервисов в Eureka
kubectl port-forward -n wms svc/eureka-server 8761:8761
# Открыть http://localhost:8761 в браузере

# Проверить логи конкретного сервиса
kubectl logs -n wms deployment/product-service | Select-String "EUREKA"
```

При расхождении адресов необходимо переопределить `eureka.instance.hostname` через переменную окружения в Deployment-манифесте.

Таким образом, был представлен способ диагностики проблем сервис-дискавери.

### 2.8.5 Превышение квоты ресурсов Minikube

Причина — суммарное `resources.requests` всех подов превышает ресурсы кластера. Команды для диагностики представлены далее:

```powershell
# Текущее потребление
kubectl top pods -n wms
kubectl top nodes

# Перезапустить Minikube с увеличенными ресурсами
minikube stop
minikube start --cpus=6 --memory=12288 --driver=docker
```

Таким образом, был представлен способ устранения нехватки ресурсов кластера.

## 2.9 Команды быстрого старта

Для удобства приведена сводная таблица команд быстрого старта (таблица 3).

Таблица 3 — Сводные команды развёртывания
| Сценарий | Команда |
|---|---|
| Docker Compose: запуск | `.\deploy-docker.ps1` |
| Docker Compose: остановка | `.\cleanup-docker.ps1` |
| Сборка всех образов | `.\build-images.ps1` |
| Kubernetes: запуск Minikube | `minikube start --cpus=4 --memory=8192 --disk-size=50g --driver=docker` |
| Kubernetes: развёртывание | `.\deploy-k8s.ps1` |
| Kubernetes: проброс портов | `.\start-port-forwards.ps1` |
| Kubernetes: остановка проброса | `.\stop-port-forwards.ps1` |
| Kubernetes: очистка | `.\cleanup-k8s.ps1` |
| Полная остановка кластера | `minikube stop` |
| Полное удаление кластера | `minikube delete` |

Таким образом, была представлена сводная таблица команд для быстрого развёртывания и сопровождения системы.

## 2.10 Заключение по разделу

В данном разделе было описано развёртывание программного средства двумя способами: через Docker Compose для локальной разработки и тестирования и через Kubernetes (Minikube) для эмуляции продуктивной среды с четырьмя ролями нод. Для каждого сценария представлены пошаговые инструкции, скрипты PowerShell, манифесты Kubernetes и способы диагностики типовых проблем. Полученный комплект артефактов позволяет развернуть систему на любой совместимой машине, удовлетворяющей системным требованиям из раздела 2.2, без необходимости ручной конфигурации.

Таким образом, в данном разделе был представлен полный цикл развёртывания программного средства от подготовки окружения до запуска и сопровождения системы.
