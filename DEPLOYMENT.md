# Руководство по развёртыванию WMS Project

Данное руководство описывает пошаговый процесс развёртывания системы управления складской логистикой (WMS) с использованием Docker Compose или Kubernetes.

---

## Содержание

1. [Требования](#требования)
2. [Структура проекта](#структура-проекта)
3. [Вариант 1: Развёртывание с Docker Compose](#вариант-1-развёртывание-с-docker-compose)
4. [Вариант 2: Развёртывание в Kubernetes](#вариант-2-развёртывание-в-kubernetes)
5. [Проверка работоспособности](#проверка-работоспособности)
6. [Устранение неполадок](#устранение-неполадок)

---

## Требования

### Минимальные системные требования

| Компонент | Docker Compose | Kubernetes |
|-----------|----------------|------------|
| CPU | 4 ядра | 4 ядра |
| RAM | 8 GB | 12 GB |
| Диск | 20 GB | 50 GB |

### Необходимое ПО

#### Для Docker Compose:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (версия 24.0+)
- Docker Compose (встроен в Docker Desktop)

#### Для Kubernetes:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) с включённым Kubernetes
- или [Minikube](https://minikube.sigs.k8s.io/docs/start/) (версия 1.30+)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) (версия 1.28+)

### Проверка установки

```powershell
# Проверка Docker
docker --version
docker-compose --version

# Проверка Kubernetes (опционально)
kubectl version --client
minikube version
```

---

## Структура проекта

```
wmsProject/
├── backend/
│   ├── api-gateway/          # API Gateway (порт 8765)
│   ├── eureka-server/        # Service Discovery (порт 8761)
│   ├── SSOService/           # Аутентификация (порт 8000)
│   ├── organization-service/ # Организации (порт 8010)
│   ├── warehouse-service/    # Склады (порт 8020)
│   ├── product-service/      # Товары (порт 8030)
│   └── document-service/     # Документы (порт 8040)
├── client/                   # React Frontend (порт 3000)
├── k8s/                      # Kubernetes манифесты
├── sql-scripts/              # SQL скрипты инициализации БД
├── docker-compose.yml        # Docker Compose конфигурация
└── build-images.ps1          # Скрипт сборки образов
```

---

## Вариант 1: Развёртывание с Docker Compose

### Шаг 1: Клонирование репозитория

```powershell
git clone https://github.com/239fd/wmsProject.git
cd wmsProject
```

### Шаг 2: Запуск инфраструктуры

Сначала запустим базы данных и брокер сообщений:

```powershell
# Запуск PostgreSQL, Redis и RabbitMQ
docker-compose up -d postgres-sso postgres-org postgres-warehouse postgres-product redis rabbitmq
```

Дождитесь готовности (около 15-30 секунд):

```powershell
# Проверка статуса
docker-compose ps
```

Все контейнеры должны иметь статус `healthy` или `running`.

### Шаг 3: Запуск всех сервисов

```powershell
# Сборка и запуск всех сервисов
docker-compose up -d --build
```

Или используйте готовый скрипт:

```powershell
.\deploy-docker.ps1
```

### Шаг 4: Проверка статуса

```powershell
# Просмотр статуса всех контейнеров
docker-compose ps

# Просмотр логов конкретного сервиса
docker-compose logs -f api-gateway
docker-compose logs -f sso-service
```

### Шаг 5: Доступ к приложению

После успешного запуска (2-3 минуты) приложение будет доступно:

| Компонент | URL |
|-----------|-----|
| **Frontend** | http://localhost:3000 |
| **API Gateway** | http://localhost:8765 |
| **Eureka Dashboard** | http://localhost:8761 |
| **RabbitMQ Management** | http://localhost:15672 (guest/guest) |

### Остановка и очистка

```powershell
# Остановка всех сервисов
docker-compose down

# Остановка с удалением данных (volumes)
docker-compose down -v

# Полная очистка (включая образы)
docker-compose down -v --rmi local
```

---

## Вариант 2: Развёртывание в Kubernetes

### Шаг 1: Подготовка кластера

#### Вариант A: Minikube (рекомендуется для разработки)

```powershell
# Запуск Minikube с достаточными ресурсами
minikube start --cpus=4 --memory=8192 --disk-size=50g --driver=docker

# Включение Ingress контроллера
minikube addons enable ingress

# Настройка Docker для использования Minikube
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
```

#### Вариант B: Docker Desktop Kubernetes

```powershell
# Включите Kubernetes в настройках Docker Desktop:
# Settings -> Kubernetes -> Enable Kubernetes

# Проверка подключения
kubectl cluster-info
```

### Шаг 2: Сборка Docker образов

```powershell
# Сборка всех образов
.\build-images.ps1

# Или вручную для каждого сервиса
docker build -t wms/eureka-server:latest backend/eureka-server
docker build -t wms/api-gateway:latest backend/api-gateway
docker build -t wms/sso-service:latest backend/SSOService
docker build -t wms/organization-service:latest backend/organization-service
docker build -t wms/warehouse-service:latest backend/warehouse-service
docker build -t wms/product-service:latest backend/product-service
docker build -t wms/document-service:latest backend/document-service
docker build -t wms/frontend:latest client
```

### Шаг 3: Развёртывание в Kubernetes

Применяем манифесты в правильном порядке:

```powershell
# 1. Создание namespace
kubectl apply -f k8s/00-namespace.yaml

# 2. Создание хранилища
kubectl apply -f k8s/01-storage.yaml

# 3. Создание секретов
kubectl apply -f k8s/02-secrets.yaml

# 4. Развёртывание баз данных
kubectl apply -f k8s/03-databases.yaml

# Ожидание готовности баз данных (1-2 минуты)
kubectl wait --for=condition=ready pod -l tier=database -n wms --timeout=120s
```

```powershell
# 5. Развёртывание backend сервисов
kubectl apply -f k8s/04-backend.yaml

# 6. Развёртывание инфраструктуры (Prometheus, Grafana)
kubectl apply -f k8s/05-infrastructure.yaml

# 7. Настройка Ingress
kubectl apply -f k8s/06-ingress.yaml

# 8. Настройка автомасштабирования (опционально)
kubectl apply -f k8s/07-autoscaling.yaml

# 9. Развёртывание frontend
kubectl apply -f k8s/09-frontend.yaml
```

Или используйте готовый скрипт:

```powershell
.\deploy-k8s.ps1
```

### Шаг 4: Проверка развёртывания

```powershell
# Просмотр всех ресурсов в namespace wms
kubectl get all -n wms

# Просмотр статуса подов
kubectl get pods -n wms -w

# Просмотр логов конкретного пода
kubectl logs -f deployment/api-gateway -n wms
kubectl logs -f deployment/sso-service -n wms
```

### Шаг 5: Доступ к приложению

#### Через Minikube:

```powershell
# Получение URL для frontend
minikube service frontend -n wms --url

# Получение URL для API Gateway
minikube service api-gateway -n wms --url

# Или запуск туннеля для Ingress
minikube tunnel
```

#### Через NodePort:

| Компонент | URL |
|-----------|-----|
| **Frontend** | http://localhost:30080 |
| **API Gateway** | http://localhost:30765 |

#### Через Ingress (требуется настройка hosts):

Добавьте в файл `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 wms.local
```

Затем откройте http://wms.local в браузере.

### Остановка и очистка

```powershell
# Удаление всех ресурсов
kubectl delete -f k8s/ --all

# Или удаление namespace целиком
kubectl delete namespace wms

# Остановка Minikube
minikube stop

# Удаление Minikube кластера
minikube delete
```

---

## Проверка работоспособности

### 1. Проверка Eureka

Откройте http://localhost:8761 (Docker) или http://localhost:30761 (K8s).

Все сервисы должны быть зарегистрированы:
- API-GATEWAY
- SSO-SERVICE (или SSOSERVICE)
- ORGANIZATION-SERVICE
- WAREHOUSE-SERVICE
- PRODUCT-SERVICE
- DOCUMENT-SERVICE

### 2. Проверка API Gateway

```powershell
# Health check
curl http://localhost:8765/actuator/health

# Проверка роутинга к SSO Service
curl http://localhost:8765/api/auth/public-key
```

### 3. Проверка баз данных

```powershell
# Docker Compose
docker exec -it postgres-sso psql -U postgres -d user_db -c "\dt"
docker exec -it postgres-org psql -U postgres -d organization_db -c "\dt"

# Kubernetes
kubectl exec -it postgres-sso-0 -n wms -- psql -U postgres -d user_db -c "\dt"
```

### 4. Проверка RabbitMQ

Откройте http://localhost:15672 и войдите с логином `guest` / паролем `guest`.

---

## Устранение неполадок

### Проблема: Сервисы не регистрируются в Eureka

**Решение:**
```powershell
# Проверьте логи Eureka
docker-compose logs eureka-server

# Проверьте сетевое подключение
docker network inspect wmsproject_wms-network
```

### Проблема: Ошибки подключения к базе данных

**Решение:**
```powershell
# Проверьте, что БД запущена и готова
docker-compose ps postgres-sso

# Проверьте логи БД
docker-compose logs postgres-sso

# Проверьте подключение вручную
docker exec -it postgres-sso psql -U postgres -d user_db
```

### Проблема: Недостаточно памяти

**Решение для Docker Desktop:**
1. Откройте Settings -> Resources
2. Увеличьте Memory до 8 GB
3. Перезапустите Docker Desktop

**Решение для Minikube:**
```powershell
minikube stop
minikube delete
minikube start --cpus=4 --memory=10240
```

### Проблема: Порты уже заняты

**Решение:**
```powershell
# Найдите процесс, занимающий порт (например, 8765)
netstat -ano | findstr :8765

# Завершите процесс
taskkill /PID <PID> /F
```

### Проблема: Pods в статусе Pending (K8s)

**Решение:**
```powershell
# Проверьте описание пода
kubectl describe pod <pod-name> -n wms

# Проверьте доступные ресурсы
kubectl describe nodes

# Для Minikube - увеличьте ресурсы
minikube stop
minikube start --cpus=4 --memory=10240
```

### Проблема: ImagePullBackOff (K8s)

**Решение:**
```powershell
# Убедитесь, что образы собраны локально
docker images | grep wms

# Для Minikube - пересоберите в контексте Minikube
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
.\build-images.ps1
```

---

## Полезные команды

### Docker Compose

```powershell
# Просмотр логов всех сервисов
docker-compose logs -f

# Перезапуск конкретного сервиса
docker-compose restart api-gateway

# Пересборка и перезапуск сервиса
docker-compose up -d --build api-gateway

# Вход в контейнер
docker exec -it sso-service sh
```

### Kubernetes

```powershell
# Просмотр событий
kubectl get events -n wms --sort-by='.lastTimestamp'

# Перезапуск deployment
kubectl rollout restart deployment/api-gateway -n wms

# Масштабирование
kubectl scale deployment/api-gateway --replicas=3 -n wms

# Вход в под
kubectl exec -it deployment/sso-service -n wms -- sh

# Port forwarding
kubectl port-forward svc/api-gateway 8765:8765 -n wms
```

---

## Следующие шаги

После успешного развёртывания:

1. **Откройте Frontend** по адресу http://localhost:3000
2. **Зарегистрируйте нового пользователя** с ролью Director
3. **Создайте организацию** и добавьте склады
4. **Пригласите сотрудников** используя инвитационные коды
5. **Начните работу** с товарами и складскими операциями

---

## Контакты и поддержка

- **Репозиторий сервера:** https://github.com/239fd/wmsProject
- **Репозиторий клиента:** https://github.com/239fd/wmsProjectClient

