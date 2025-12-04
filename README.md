# Программное средство автоматизации складской логистики на основе технологии RPA.

## Краткое описание проекта.
Разрабатываемое программное средство представляет собой микросервисную систему управления складской логистикой, в которой ключевые бизнес-процессы предметной области автоматизируются с использованием технологии Robotic Process Automation (RPA). Система обеспечивает интеграцию функциональных модулей учёта товаров, управления складскими ячейками и стеллажами, оформления и хранения документов, а также взаимодействия с организациями и пользователями. В архитектуре применены принципы Clean Architecture, предметно-ориентированного проектирования (DDD), а также паттерны CQRS, Saga и другие, что позволяет достичь модульности, гибкости и масштабируемости решения.
## Цели проекта. 
Основной целью проекта является повышение эффективности управления складской логистикой за счёт автоматизации рутинных операций и документооборота.
## Основные возможности проекта.
- Управление товарами и отслеживание их статусов в системе  
- Ведение учёта складской инфраструктуры (склады, стеллажи, ячейки) и распределение товаров по местам хранения  
- Автоматизированное формирование актов переоценки, инвентаризационных списков и прочей документации на основе технологии RPA  
- Управление информацией об организациях 
- Поддержка ролевой модели доступа пользователей и интеграция с внешними системами аутентификации  
- Мониторинг и трассировка бизнес-операций с целью повышения надёжности и управляемости системы  

Ссылка на репозиторий сервера: https://github.com/239fd/wmsProject.
Ссылка на репозиторий клиента: https://github.com/239fd/wmsProjectClient.

---

## **Содержание**

1. [Архитектура](#Архитектура)
	1. [C4-модель](#C4-модель)
	2. [Схема данных](#Схема_данных)
	3. [UML-диаграммы](#UML-диаграммы)
2. [Функциональные возможности](#Функциональные_возможности)
	1. [Диаграмма вариантов использования](#Диаграмма_вариантов_использования)
	2. [User-flow диаграммы](#User-flow_диаграммы)
3. [Пользовательский интерфейс](#Пользовательский_интерфейс)
	1. [Примеры экранов UI](#Примеры_экранов_UI)
4. [Детали реализации](#Детали_реализации)
	1. [UML-диаграммы](#UML-диаграммы)
	2. [Спецификация API](#Спецификация_API)
	3. [Безопасность](#Безопасность)
	4. [Оценка качества кода](#Оценка_качества_кода)
5. [Тестирование](#Тестирование)
	1. [Unit-тесты](#Unit-тесты)
	2. [Интеграционные тесты](#Интеграционные_тесты)
6. [Установка и  запуск](#installation)
	1. [Манифесты для сборки docker образов](#Манифесты_для_сборки_docker_образов)
	2. [Манифесты для развертывания k8s кластера](#Манифесты_для_развертывания_k8s_кластера)
7. [Лицензия](#Лицензия)
8. [Контакты](#Контакты)

---
## **Архитектура**

### C4-модель

- [c4-container-level.pdf](./c4-container-level.pdf)
  Диаграмма уровня контейнеров (C4). Отражает основные программные контейнеры системы: веб-интерфейс (SPA на React), API Gateway, микросервисы (WarehouseService, ProductService, DocumentsService, OrganizationService, SSOService), базы данных (PostgreSQL для пользователей, склада, товаров и организаций), а также интеграцию с брокером сообщений RabbitMQ, Redis и системой мониторинга (Jaeger, Prometheus/Grafana). Показывает распределение обязанностей между сервисами и взаимодействие пользователей (складской работник, бухгалтер, директор) с системой.
  <img width="1826" height="1356" alt="с4 2 drawio" src="https://github.com/user-attachments/assets/7f439b38-0552-49b9-9f05-aa9ab91d4560" />

- [c4-component-level.pdf](./c4-component-level.pdf)  
  Диаграмма уровня компонентов (C4). Детализирует внутреннее устройство каждого контейнера на уровене компонентов: контроллеры (например, `AccountController`, `ProductController`, `DocumentsController`), сервисы (например, `AccountService`, `WarehouseService`, `OrganizationService`), модели домена (`User`, `Product`, `Organization`, `Warehouse`, `Document`) и репозитории для работы с БД.  Включает также инфраструктурные компоненты — `EventPublisher`, `EventsListener`, `TracingAdapter`, конфигурацию безопасности и интеграцию с Redis.
	<img width="4385" height="2055" alt="с4 3 drawio" src="https://github.com/user-attachments/assets/cd41f187-49c5-45e7-a0bc-c1e6e60eed08" />

- [c4-code-level.pdf](./c4-code-level.pdf)  
  Диаграмма уровня кода (C4). Представляет детализированную структуру реализации на уровне классов и интерфейсов. Включает контроллеры (`AccountController`, `UserInfoController`, `OAuthClientController` и др.), реализации сервисов (`AccountServiceImpl`, `ProductServiceImpl`, `DocumentServiceImpl`, `OrganizationServiceImpl`, `WarehouseServiceImpl`), доменные сущности (`User`, `Product`, `Document`, `Organization`, `Warehouse`, `Rack`, `Cell`), а также вспомогательные классы (`RPAExecutor`, перечисления `Role`, `Status`, `Type`).
  <img width="3095" height="1315" alt="с4 4 drawio" src="https://github.com/user-attachments/assets/e75212e9-83ac-4b7c-934d-2e6e3c15bd04" />


Архитектура проектируемого программного средства реализована с опорой на принципы Clean Architecture и учитывает положения предметно-ориентированного проектирования (DDD), а также паттерны CQRS, Saga и Database-per-Service. Основной замысел заключается в разделении системы на изолированные микросервисы, каждый из которых отвечает за свой ограниченный контекст и взаимодействует с другими исключительно посредством обмена событиями.
Внутренняя структура сервисов унифицирована и соответствует слоям Clean Architecture. На уровне домена (Entities) определяются сущности, обеспечивающие строгую модель предметной области. Так, в сервисе учётных записей ключевым элементом является пользователь, связанный с набором ролей и прав доступа; в сервисе продуктов доменную основу составляют товар и его жизненный цикл, отражённый в статусах; в сервисе документов реализованы сущности акта переоценки, инвентаризационного списка и прочие документы, а также RPA для автоматизированного формирования документов; в сервисе организаций центральным элементом выступает организация как субъект; в сервисе склада определены склад, стеллажи и ячейки, формирующие основу складской модели.
Над доменной моделью располагается уровень прикладных сценариев (Use Cases), реализующий обработку команд и запросов. Здесь проявляется паттерн CQRS: команды изменяют состояние агрегатов и инициируют публикацию доменных событий, тогда как запросы обеспечивают доступ к материализованным представлениям данных. Например, в сервисе документов команда запускает генерацию акта переоценки, а запрос позволяет получить готовый документ; в сервисе склада команды формируют структуру склада, а запросы возвращают сведения о стеллажах и ячейках.
Интеграция с внешним миром и взаимодействие сервисов организованы через уровень адаптеров. Контроллеры обеспечивают доступ к сервисам, репозитории инкапсулируют операции с данными, а специальные инфраструктурные компоненты отвечают за публикацию и приём событий, а также за трассировку и мониторинг. Все реализации инфраструктуры изолированы в отдельном слое, что также соответствует требованию Clean Architecture.
Большинство сервисов обладает собственной базой данных в соответствии с принципом Database-per-Service. Это исключает межсервисные зависимости на уровне хранилищ и позволяет масштабировать систему фрагментарно, сохраняя согласованность данных посредством обмена событиями. Для координации долгоживущих бизнес-процессов применяется паттерн Saga. Например, при оформлении отгрузки инициируются события, которые затрагивают сервис товара, сервис склада, сервис документов и сервис организаций. Последовательность действий управляется сагой, что обеспечивает как прямое выполнение транзакции, так и компенсацию при возникновении ошибок. 

### Схема данных

- База данных сервиса аутентификации
  
  <img width="539" height="697" alt="user_db drawio" src="https://github.com/user-attachments/assets/9b8c0049-b8eb-43e7-aee9-dfae9297494c" />
- База данных сервиса организаций
  
  <img width="869" height="394" alt="изображение" src="https://github.com/user-attachments/assets/b245f234-487b-47b6-a0ff-128e1213d124" />
- База данных сервиса склада
  
  <img width="977" height="1093" alt="изображение" src="https://github.com/user-attachments/assets/3d845f03-b96e-41c6-8d1c-8a48b89eae6c" />
- База данных сервиса управления товарами и запасами
  
  <img width="663" height="1353" alt="изображение" src="https://github.com/user-attachments/assets/426a5d21-b3dc-4878-bcd5-c43c5eb10c33" />

### UML-диаграммы

- Диаграмма пакетов
  
  <img width="598" height="523" alt="изображение" src="https://github.com/user-attachments/assets/f0437d20-44c1-494d-9413-be199c88fa93" />
- Диаграмма развертывания
  
  <img width="976" height="669" alt="изображение" src="https://github.com/user-attachments/assets/c83030d6-5827-47fd-bb6c-1421d2022e2c" />
- Диаграмма вариантов использования
  
  <img width="900" height="926" alt="изображение" src="https://github.com/user-attachments/assets/f0f773df-da2d-4e53-892c-b5cb990c7b94" />
- Диаграмма состояний
  
  <img width="595" height="906" alt="изображение" src="https://github.com/user-attachments/assets/5fb533d9-5e53-4c11-89bb-f2ecce2535ed" />
- Диаграмма последовательности

  <img width="793" height="1236" alt="Диаграмма последовательности (3) drawio" src="https://github.com/user-attachments/assets/e81509f0-82c4-469e-9bfd-387ea481d90d" />
- Диаграмма активности
  
  <img width="582" height="935" alt="изображение" src="https://github.com/user-attachments/assets/705933aa-d105-488a-8a9b-a9d7e70d0b16" />


---

## **Функциональные возможности**

### Диаграмма вариантов использования

Диаграмма вариантов использования и ее описание

### User-flow диаграммы

В данном подразделе представлены user-flow диаграммы для всех ролей пользователей программного средства.

- [user-flow работника](./User-flow%20%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BD%D0%B8%D0%BA.pdf)
<img width="1399" height="1238" alt="{379DDE94-0600-43CC-ABE3-200FC022AC78}" src="https://github.com/user-attachments/assets/d7418ed5-dbaa-41e2-89bc-aefb6f4bf813" />
Диаграмма иллюстрирует последовательный путь взаимодействия пользователя с ролью «Работник склада» в рамках программного средства автоматизации складской логистики.
Схема охватывает основные этапы деятельности сотрудника – от входа в систему до выполнения операций по приёмке и отгрузке товаров, а также управление персональными настройками и завершение работы.
Взаимодействие начинается с главной страницы приложения, где пользователь проходит авторизацию или регистрацию. После успешного входа система перенаправляет его на домашнюю страницу, служащую отправной точкой для навигации по функциональным разделам. В случае ошибок отображается уведомление, обеспечивающее корректность ввода и безопасность доступа.
После аутентификации пользователю становится доступен личный раздел для просмотра и редактирования профиля, а также управления активными сессиями. Эти функции поддерживают актуальность данных и прозрачность действий внутри системы.
Основное внимание уделено операциям приёмки и отгрузки. Приёмка осуществляется на специализированной странице, где работник добавляет товарные позиции, проверяет корректность данных и размещение на складе. Завершающим этапом является генерация документов, включая приходной ордер. 
Процесс отгрузки представлен двумя сценариями: создание новой заявки с резервированием товаров и генерацией листа подбора либо оформление уже собранного заказа с формированием сопроводительных документов. По завершении система уведомляет о результате операции и предоставляет возможность перейти к следующей задаче. 
Диаграмма отражает целостную логику работы сотрудника склада, объединяя приёмку, отгрузку и администрирование профиля в единую структуру, обеспечивающую интуитивную навигацию и согласованность действий.

- [user-flow директора](./User-flow%20%D0%B4%D0%B8%D1%80%D0%B5%D0%BA%D1%82%D0%BE%D1%80.pdf)
<img width="1670" height="1228" alt="{AF1E6925-B20C-4AE4-9B16-92C2DDFFBFDE}" src="https://github.com/user-attachments/assets/7c3e44bc-c488-4c13-8999-7a837e011f36" />
Данная диаграмма отображает последовательность взаимодействия пользователя с ролью «Директор» с программным средством автоматизации складской логистики.
Основное назначение сценария – контроль, анализ и управление структурой предприятия, а также работа с аналитическими данными.
После авторизации пользователь попадает на домашнюю страницу, с которой осуществляется переход к основным разделам системы. В случае ошибки система уведомляет о некорректных данных, предотвращая несанкционированный доступ.
Директор имеет возможность управлять профилем и активными сессиями, редактировать персональные данные и контролировать доступ.
Ключевой функциональный блок связан с управлением организацией: в соответствующем разделе можно просматривать, изменять и добавлять сведения об организации, складах и сотрудниках, а также удалять устаревшие записи. Все изменения фиксируются системой и сопровождаются подтверждающими уведомлениями.
Отдельный раздел предназначен для анализа деятельности предприятия. Здесь представлены показатели состояния запасов, структуры товарных остатков и загруженности складов. Система позволяет формировать отчёты и экспортировать их для дальнейшего анализа.
Диаграмма демонстрирует целостный сценарий работы руководителя, объединяя административные, аналитические и контрольные функции, что способствует эффективному управлению организацией и повышает прозрачность бизнес-процессов.

- [user-flow бухгалтера](./User-flow%20%D0%B1%D1%83%D1%85%D0%B3%D0%B0%D0%BB%D1%82%D0%B5%D1%80.pdf)
<img width="1309" height="1230" alt="{BAE2CFE5-7A88-4F1E-BD24-516D966966C3}" src="https://github.com/user-attachments/assets/8d0172ae-afbc-46b6-aa34-a9feafbdae69" />
Диаграмма отражает взаимодействие пользователя с ролью «Бухгалтер» в процессе автоматизации учётных и складских операций.
Она охватывает все ключевые этапы – от авторизации до выполнения бухгалтерских функций: инвентаризации, списания и переоценки товаров.
После входа в систему пользователь получает доступ к личному разделу, где может изменять профиль и управлять активными сессиями. Далее бухгалтер переходит к основным операциям учёта.
Процесс инвентаризации начинается с формирования списка проверяемых товаров и фиксации фактического наличия. Система анализирует результаты, выявляет расхождения и формирует отчётные документы для корректировки данных учёта.
При обнаружении недостач или порчи товаров пользователь инициирует процесс списания. В нём указываются склад, позиции, причины и основания для удаления товаров из учёта. После подтверждения система формирует акт списания и уведомляет о завершении операции.
Для актуализации стоимости товаров предусмотрена процедура переоценки. Бухгалтер выбирает основания изменения цены, вводит данные по товарам, после чего система автоматически пересчитывает показатели и создаёт соответствующий документ.
Диаграмма демонстрирует комплексный подход к автоматизации учётных операций. Она объединяет в единую структуру процессы инвентаризации, списания и переоценки, обеспечивая последовательность действий, прозрачность данных и снижение объёма ручной работы.


---

## **Пользовательский интерфейс**

### Примеры экранов UI
Ссылка на репозиторий клиента: https://github.com/239fd/wmsProjectClient.
- Главная страница программного средства
<img width="977" height="571" alt="изображение" src="https://github.com/user-attachments/assets/297a7b3f-82ba-45e0-8323-7bf51c2e16c2" />
- Форма входа в программное средство
<img width="977" height="537" alt="изображение" src="https://github.com/user-attachments/assets/14883256-28b4-4ba6-8971-dfaa43cc8ff8" />
- Форма регистрации в программном средстве
<img width="977" height="563" alt="изображение" src="https://github.com/user-attachments/assets/b2042b64-cbd1-42ce-b7b5-0ee56b7f58bd" />
- Форма выбора роли при регистрации в программном средстве
<img width="977" height="566" alt="изображение" src="https://github.com/user-attachments/assets/d1e0c0aa-936a-4733-9e4a-c6793d2f6e7c" />
- Домашняя страница программного средства
<img width="977" height="583" alt="изображение" src="https://github.com/user-attachments/assets/3b92e8b3-be1a-4373-9044-c4fa029703f1" />
- Вкладка профиля пользователя
<img width="977" height="517" alt="изображение" src="https://github.com/user-attachments/assets/d2b522ff-4105-4886-b3ac-32f558f74006" />
- Вкладка активности профиля
<img width="977" height="582" alt="изображение" src="https://github.com/user-attachments/assets/dfa380f4-ea55-4e80-8d00-d57f55bfc43e" />
- Страница приёма товара
<img width="977" height="342" alt="изображение" src="https://github.com/user-attachments/assets/5ee2d74b-bc38-4c72-be1c-67866f4a44c2" />
- Форма создания поставки
<img width="977" height="468" alt="изображение" src="https://github.com/user-attachments/assets/07dfcfc8-9250-41e2-bdb6-b4308cd3f938" />
- Форма ввода товаров
<img width="977" height="577" alt="изображение" src="https://github.com/user-attachments/assets/8692ef7d-4520-4478-990a-10d360fe768c" />
- Форма добавления партии товара
<img width="977" height="586" alt="изображение" src="https://github.com/user-attachments/assets/9267453e-6cfa-4c97-90f7-7eccd5ff6bda" />
- Форма размещения товара
<img width="977" height="540" alt="изображение" src="https://github.com/user-attachments/assets/13ae319b-fdc3-4660-8590-2f0a2d978f80" />
- Страница отгрузки товара
<img width="977" height="393" alt="изображение" src="https://github.com/user-attachments/assets/574d34f9-cca9-4e7c-953f-1ada70e00aaf" />
- Форма создания новой заявки на отгрузку товара
<img width="977" height="559" alt="изображение" src="https://github.com/user-attachments/assets/848dea56-d165-48bf-8d8b-25d88976bdd3" />
- Форма выбора товара
<img width="977" height="568" alt="изображение" src="https://github.com/user-attachments/assets/597f17e9-3b67-4571-be6c-389939cdaf34" />
- Форма резервирования товара при отгрузке
<img width="977" height="573" alt="изображение" src="https://github.com/user-attachments/assets/ee1e6762-274a-481b-9206-0accf7dd055d" />
- Форма добавления товара согласно заявке
<img width="977" height="588" alt="изображение" src="https://github.com/user-attachments/assets/11e4df42-3e0e-43df-b127-76199dcbfa48" />
- Страница инвентаризации
<img width="977" height="524" alt="изображение" src="https://github.com/user-attachments/assets/c715530d-b16f-456e-952c-07bb0498bc68" />
- Форма начала сессии инвентаризации
<img width="977" height="541" alt="изображение" src="https://github.com/user-attachments/assets/7f4dfb12-fa16-4ff6-abb9-2860f4de2e1d" />
- Страница ввода артикулов товаров
<img width="977" height="580" alt="изображение" src="https://github.com/user-attachments/assets/babad113-d762-4368-9691-4fd566fe9af5" />
- Страница списания товаров
<img width="977" height="576" alt="изображение" src="https://github.com/user-attachments/assets/bbe2d217-aa36-4ed1-ac64-74469bd818e7" />
- Страница списания товаров с возможностью ввода данных о товаре
<img width="929" height="558" alt="изображение" src="https://github.com/user-attachments/assets/a5abcaec-cac3-42d3-be72-c41857ec7d41" />
- Страница аналитики по запасам и их структуре, заполненности складов, операциям по типам
<img width="977" height="463" alt="изображение" src="https://github.com/user-attachments/assets/08e52410-850e-40c9-b8df-fc575eb72120" />
- Страница аналитики по динамике операций по складам
<img width="977" height="302" alt="изображение" src="https://github.com/user-attachments/assets/e8143f0f-91d2-4859-aab6-85d7e8a4d8a4" />
- Страница аналитики по сотрудникам и их производительности
<img width="905" height="303" alt="изображение" src="https://github.com/user-attachments/assets/f1909c37-8db4-49ab-8361-55ccee31926e" />
- Вкладка сотрудников организации
<img width="977" height="323" alt="изображение" src="https://github.com/user-attachments/assets/64c8ff2f-09bf-4ad2-93dc-61fbba4868af" />
- Вкладка организации
<img width="977" height="326" alt="изображение" src="https://github.com/user-attachments/assets/e018234c-f598-475a-b50e-ac59352f190d" />
- Форма ввода данных о организации
<img width="977" height="521" alt="изображение" src="https://github.com/user-attachments/assets/7e093f61-559d-4bdb-8d94-18290ae7f40d" />
- Вкладка складов
<img width="977" height="584" alt="изображение" src="https://github.com/user-attachments/assets/5d222427-cb17-4e06-b296-7554e92e8821" />
- Форма ввода данных о стеллажах и ячейках
<img width="977" height="555" alt="изображение" src="https://github.com/user-attachments/assets/966b779c-7e09-4899-898c-1e00bf5286a3" />

---

---

## **Детали реализации**

### UML-диаграммы

- Диаграмма пакетов
  
  <img width="598" height="523" alt="изображение" src="https://github.com/user-attachments/assets/f0437d20-44c1-494d-9413-be199c88fa93" />
- Диаграмма развертывания
  
  <img width="976" height="669" alt="изображение" src="https://github.com/user-attachments/assets/c83030d6-5827-47fd-bb6c-1421d2022e2c" />
- Диаграмма вариантов использования
  
  <img width="900" height="926" alt="изображение" src="https://github.com/user-attachments/assets/f0f773df-da2d-4e53-892c-b5cb990c7b94" />
- Диаграмма состояний
  
  <img width="595" height="906" alt="изображение" src="https://github.com/user-attachments/assets/5fb533d9-5e53-4c11-89bb-f2ecce2535ed" />
- Диаграмма последовательности

  <img width="793" height="1236" alt="Диаграмма последовательности (3) drawio" src="https://github.com/user-attachments/assets/e81509f0-82c4-469e-9bfd-387ea481d90d" />
- Диаграмма активности
  
  <img width="582" height="935" alt="изображение" src="https://github.com/user-attachments/assets/705933aa-d105-488a-8a9b-a9d7e70d0b16" />


### Спецификация API

#### Документация OpenAPI (Swagger)

Все микросервисы предоставляют интерактивную документацию API через **Swagger UI** и спецификацию **OpenAPI 3.0**.

| Сервис | Swagger UI URL | OpenAPI JSON |
|--------|----------------|--------------|
| SSO Service | `http://localhost:8000/swagger-ui.html` | `/v3/api-docs` |
| Organization Service | `http://localhost:8010/swagger-ui.html` | `/v3/api-docs` |
| Product Service | `http://localhost:8030/swagger-ui.html` | `/v3/api-docs` |
| Warehouse Service | `http://localhost:8020/swagger-ui.html` | `/v3/api-docs` |
| Document Service | `http://localhost:8040/swagger-ui.html` | `/v3/api-docs` |
| API Gateway | `http://localhost:8765/swagger-ui.html` | `/v3/api-docs` |

#### Postman коллекция

Для удобства тестирования API подготовлена коллекция Postman с примерами всех запросов:

**[Скачать Postman коллекцию](./docs/postman/WMS-API-Collection.json)**

### Безопасность

Обеспечение безопасности данных и процессов являлось ключевым приоритетом при проектировании.
Для этого был внедрён многоуровневый комплекс мер, охватывающий хранение учётных данных, разграничение доступа и управление сессиями.

#### Хеширование паролей
Для защиты паролей пользователей от компрометации (даже в случае утечки базы данных) был выбран необратимый алгоритм хеширования BCrypt.
Это адаптивная криптографическая функция, которая автоматически генерирует уникальную «соль» (salt) для каждого пароля и позволяет настраивать «стоимость» вычислений.
Такой подход делает атаки методом перебора (brute-force) и с использованием rainbow-таблиц вычислительно неэффективными.

Пример кода:
```
@Bean
public PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
}

String passwordHash = passwordEncoder.encode(request.password());
user.setPasswordHash(passwordHash);

if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
    throw new IllegalArgumentException("Неверные учетные данные");
}
```
Как видно из примера, BCryptPasswordEncoder регистрируется в Spring-контексте как основной PasswordEncoder,
что позволяет фреймворку Spring Security автоматически использовать его для верификации паролей.

#### Система разграничения прав доступа
Авторизация в системе, то есть определение того, какие действия пользователь может выполнять, построена на ролевой модели (RBAC).
Каждому пользователю при регистрации присваивается одна из предопределённых ролей — например, WORKER, ACCOUNTANT, DIRECTOR.

Конфигурация SecurityFilterChain в Spring Security декларативно описывает, к каким эндпоинтам и с какими ролями разрешён доступ,
что позволяет централизованно управлять правами доступа и обеспечивает надёжное разграничение полномочий.

#### Использование JWT (JSON Web Tokens)
Для аутентификации в stateless-архитектуре (когда сервер не хранит состояние сессии) используются JSON Web Tokens (JWT).

Access Token представляет собой self-contained JWT, содержащий всю необходимую информацию о пользователе.
Он подписывается с использованием асимметричного алгоритма RS256 (RSA + SHA-256).
Для подписи токена используется приватный ключ (хранится в секрете на SSO-сервисе),
а для проверки — публичный ключ (может быть безопасно распространён между микросервисами).
Срок жизни токена — 15 минут.

Refresh Token не является JWT, а представляет собой UUID. Он хранится в Redis с привязкой к userId и сроком жизни 7 дней.
Этот подход позволяет мгновенно отзывать токены (например, при выходе пользователя из системы).

Пример кода генерации JWT:
```
public String generateAccessToken(UUID userId, String email, UserRole role) {
    try {
        Instant now = Instant.now();
        JWSSigner signer = new RSASSASigner((RSAPrivateKey) keyPair.getPrivate());

        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("role", role.name())
                .issuer("http://localhost:7777")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plusSeconds(ACCESS_TOKEN_VALIDITY)))
                .build();

        SignedJWT signedJWT = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256)
                        .keyID("sso-key-id")
                        .build(),
                claimsSet
        );
        signedJWT.sign(signer);
        return signedJWT.serialize();
    } catch (JOSEException e) {
        throw new RuntimeException("Failed to generate access token", e);
    }
}
```
Таким образом реализовано безопасное использование JWT в stateless-среде.

#### Аудит и логирование
Дополнительным контуром безопасности выступает механизм аудита входов в систему.
Каждая попытка аутентификации — как успешная, так и неуспешная — фиксируется в таблице login_audit базы данных PostgreSQL.

Эта сущность хранит информацию о:

пользователе (userId),
времени входа (loginTime),
IP-адресе и User-Agent’е,
результате попытки (успешной или неуспешной).
Наличие таких данных позволяет проводить анализ активности и своевременно выявлять подозрительные действия,
что значительно повышает уровень безопасности всей системы.

### Оценка качества кода

Для обеспечения высокого качества программного кода в проекте реализован комплексный подход, включающий автоматизированные инструменты статического анализа, проверки стиля и измерения покрытия тестами.

#### 1. Code Style: Соответствие стандартам оформления кода

В проекте реализована автоматическая проверка и форматирование кода с использованием следующих инструментов:

**Checkstyle** — инструмент статического анализа для проверки соответствия кода стандартам оформления Java.

Конфигурация: `config/checkstyle/checkstyle.xml`

Основные проверяемые правила:
- Максимальная длина строки — 200 символов
- Именование пакетов, классов, методов и переменных согласно Java Code Conventions
- Корректное использование пробелов и отступов
- Порядок модификаторов доступа
- Проверка Unicode-символов и escape-последовательностей

```xml
<module name="LineLength">
    <property name="max" value="200"/>
</module>
<module name="PackageName">
    <property name="format" value="^[a-z]+(\.[a-z][a-z0-9]*)*$"/>
</module>
<module name="TypeName"/>
<module name="MemberName">
    <property name="format" value="^[a-z][a-zA-Z0-9]*$"/>
</module>
```

**Spotless** — плагин для автоматического форматирования кода.

```groovy
spotless {
    java {
        googleJavaFormat('1.17.0').aosp().reflowLongStrings()
        removeUnusedImports()
        trimTrailingWhitespace()
        endWithNewline()
        indentWithSpaces(4)
        formatAnnotations()
    }
}
```

#### 2. Сложность кода: Статический анализ и поиск потенциальных проблем

**PMD** — инструмент для анализа исходного кода на наличие потенциальных ошибок, неоптимального кода и нарушений лучших практик.

Конфигурация: `config/pmd/pmd-ruleset.xml`

Проверяемые категории:
- **Best Practices** — соответствие лучшим практикам разработки
- **Code Style** — стилистические рекомендации
- **Design** — проверка архитектурных решений
- **Error Prone** — поиск потенциальных ошибок
- **Multithreading** — анализ многопоточного кода
- **Performance** — оптимизация производительности
- **Security** — проверка безопасности

```xml
<rule ref="category/java/bestpractices.xml"/>
<rule ref="category/java/design.xml"/>
<rule ref="category/java/errorprone.xml"/>
<rule ref="category/java/security.xml"/>
<rule ref="category/java/performance.xml"/>
```

**SpotBugs** — инструмент для поиска потенциальных багов в Java-коде методом статического анализа байт-кода.

```groovy
spotbugs {
    toolVersion = '4.8.3'
    ignoreFailures = true
}
```

Генерируемые отчёты:
- HTML-отчёт: `build/reports/spotbugs/main/spotbugs.html`
- XML-отчёт: `build/reports/spotbugs/main/spotbugs.xml`

**CPD (Copy-Paste Detector)** — инструмент для обнаружения дублирования кода, интегрированный в PMD 7.0.

#### 3. Безопасность: Проверка уязвимостей

Безопасность кода обеспечивается на нескольких уровнях:

**PMD Security Rules** — набор правил для выявления уязвимостей:
```xml
<rule ref="category/java/security.xml"/>
```

Проверяемые уязвимости:
- Hardcoded credentials (жёстко заданные пароли)
- SQL Injection
- Command Injection
- Insecure Random

**SpotBugs Security** — дополнительные проверки безопасности на уровне байт-кода.

**Защита от SQL Injection:**
В проекте используется Spring Data JPA с параметризованными запросами, что исключает возможность SQL-инъекций:

```java
@Query("SELECT u FROM UserReadModel u WHERE u.email = :email AND u.provider = :provider")
Optional<UserReadModel> findByEmailAndProvider(@Param("email") String email, @Param("provider") String provider);
```

**Отсутствие хардкода паролей:**
Все sensitive-данные хранятся в переменных окружения или конфигурационных файлах, исключённых из системы контроля версий.

#### 4. Покрытие тестами: JaCoCo

**JaCoCo (Java Code Coverage)** — инструмент для измерения покрытия кода тестами.

```groovy
jacoco {
    toolVersion = "0.8.11"
}

jacocoTestCoverageVerification {
    violationRules {
        rule {
            limit {
                minimum = 0.50  // Минимальное покрытие 50%
            }
        }
    }
}
```

Генерируемые отчёты:
- HTML-отчёт: `build/reports/jacoco/test/html/index.html`
- XML-отчёт: `build/reports/jacoco/test/jacocoTestReport.xml`

#### 5. Запуск проверок качества кода

Для запуска всех проверок качества кода используются следующие команды:

```bash
# Запуск всех проверок для конкретного сервиса
./gradlew :warehouse-service:codeQuality

# Запуск Checkstyle
./gradlew checkstyleMain

# Запуск PMD
./gradlew pmdMain

# Запуск SpotBugs
./gradlew spotbugsMain

# Запуск тестов с покрытием
./gradlew test jacocoTestReport

# Форматирование кода
./gradlew spotlessApply
```

---

## **Тестирование**

### Описание процесса тестирования

Процесс тестирования в проекте реализован на нескольких уровнях с использованием современных инструментов и подходов:

#### Используемые инструменты и технологии

| Инструмент | Назначение |
|------------|------------|
| **JUnit 5** | Фреймворк для написания и запуска тестов |
| **Mockito** | Создание моков и заглушек для изоляции тестируемых компонентов |
| **AssertJ** | Fluent API для написания читаемых assertions |
| **Spring Boot Test** | Интеграционное тестирование Spring-приложений |
| **MockMvc** | Тестирование REST API без запуска сервера |
| **Testcontainers** | Запуск реальных БД (PostgreSQL) в Docker для интеграционных тестов |
| **H2 Database** | In-memory БД для быстрых тестов репозиториев |
| **JaCoCo** | Измерение покрытия кода тестами |

#### Уровни тестирования

1. **Unit-тесты (модульные тесты)**
   - Тестирование отдельных классов в изоляции
   - Зависимости заменяются моками через `@Mock` и `@InjectMocks`
   - Проверка бизнес-логики сервисов, утилит, валидации

2. **Интеграционные тесты контроллеров**
   - Использование `@WebMvcTest` для тестирования веб-слоя
   - Проверка маршрутизации, валидации, сериализации JSON
   - Сервисы мокируются через `@MockBean`

3. **Полные интеграционные тесты**
   - Использование `@SpringBootTest` с Testcontainers
   - Тестирование полного цикла: Controller → Service → Repository → DB
   - Проверка взаимодействия компонентов в реальном окружении

#### Запуск тестов

```bash
# Запуск всех тестов с отчётом о покрытии
./gradlew test jacocoTestReport

# Запуск тестов для конкретного сервиса
./gradlew :SSOService:test
./gradlew :warehouse-service:test

# Просмотр отчёта о покрытии
# build/reports/jacoco/test/html/index.html
```

---

### Unit-тесты

Unit-тесты проверяют отдельные компоненты системы в изоляции от их зависимостей. Используется паттерн **AAA (Arrange-Act-Assert)** и моки для имитации поведения зависимостей.

#### Пример 1: Тест регистрации пользователя (UserServiceTest)

```java
@ExtendWith(MockitoExtension.class)
@DisplayName("UserService Unit Tests")
class UserServiceTest {

    @Mock
    private UserReadModelRepository readModelRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtTokenService jwtTokenService;
    @Mock
    private RefreshTokenService refreshTokenService;

    @InjectMocks
    private UserService userService;

    @Test
    @DisplayName("register: Given valid DIRECTOR request When registering Then should create user and return auth response")
    void register_GivenValidDirectorRequest_WhenRegistering_ThenShouldCreateUserAndReturnAuthResponse() {
        // Arrange
        RegisterRequest request = new RegisterRequest(
                "test@example.com", "John", "Doe", null,
                "password123", UserRole.DIRECTOR, null
        );
        
        when(readModelRepository.existsByEmail(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("encodedPassword123");
        when(jwtTokenService.generateAccessToken(any(), anyString(), any())).thenReturn("accessToken");
        when(jwtTokenService.generateRefreshToken()).thenReturn("refreshToken");

        // Act
        AuthResponse response = userService.register(request, "127.0.0.1", "Mozilla");

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.accessToken()).isEqualTo("accessToken");
        assertThat(response.refreshToken()).isEqualTo("refreshToken");
        
        verify(readModelRepository).existsByEmail("test@example.com");
        verify(passwordEncoder).encode("password123");
    }
}
```

**Пояснение:** Тест проверяет успешную регистрацию директора. Все зависимости (репозиторий, encoder, JWT-сервис) замокированы. Проверяется, что метод возвращает корректный `AuthResponse` и вызывает необходимые методы зависимостей.

---

#### Пример 2: Тест обработки дублирующегося email

```java
@Test
@DisplayName("register: Given duplicate email When registering Then should throw conflict exception")
void register_GivenDuplicateEmail_WhenRegistering_ThenShouldThrowConflictException() {
    // Arrange
    RegisterRequest request = new RegisterRequest(
            "existing@example.com", "John", "Doe", null,
            "password123", UserRole.DIRECTOR, null
    );
    when(readModelRepository.existsByEmail("existing@example.com")).thenReturn(true);

    // Act & Assert
    assertThatThrownBy(() -> userService.register(request, "127.0.0.1", "Mozilla"))
            .isInstanceOf(AppException.class)
            .hasMessageContaining("email уже существует");

    verify(readModelRepository).existsByEmail("existing@example.com");
    verify(passwordEncoder, never()).encode(anyString());  // Пароль не должен кодироваться
    verify(readModelRepository, never()).save(any());       // Сохранение не должно происходить
}
```

**Пояснение:** Тест проверяет, что при попытке регистрации с существующим email выбрасывается исключение `AppException`. Также проверяется, что последующие операции (кодирование пароля, сохранение) не выполняются.

---

#### Пример 3: Тест создания склада (WarehouseServiceTest)

```java
@ExtendWith(MockitoExtension.class)
@DisplayName("WarehouseService Unit Tests")
class WarehouseServiceTest {

    @Mock
    private WarehouseReadModelRepository readModelRepository;
    @Mock
    private WarehouseEventRepository eventRepository;
    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private WarehouseService warehouseService;

    @Test
    @DisplayName("createWarehouse: Given valid request Should create and return warehouse")
    void createWarehouse_GivenValidRequest_ShouldCreateAndReturnWarehouse() {
        // Arrange
        UUID orgId = UUID.randomUUID();
        UUID responsibleUserId = UUID.randomUUID();
        CreateWarehouseRequest request = new CreateWarehouseRequest(
                orgId, "Центральный склад", "г. Минск, ул. Ленина, 1", responsibleUserId
        );

        when(readModelRepository.existsByOrgIdAndName(orgId, "Центральный склад")).thenReturn(false);
        when(readModelRepository.save(any(WarehouseReadModel.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        WarehouseResponse response = warehouseService.createWarehouse(request);

        // Assert
        assertThat(response).isNotNull();
        assertThat(response.name()).isEqualTo("Центральный склад");
        assertThat(response.orgId()).isEqualTo(orgId);
        assertThat(response.isActive()).isTrue();

        verify(eventRepository).save(any(WarehouseEvent.class));  // Событие должно быть сохранено
        verify(readModelRepository).save(any(WarehouseReadModel.class));
    }
}
```

**Пояснение:** Тест проверяет создание нового склада. Используется паттерн Event Sourcing — проверяется сохранение события и read-модели. Мок `RabbitTemplate` позволяет изолировать тест от очереди сообщений.

---

#### Пример 4: Тест контроллера аутентификации (AuthControllerTest)

```java
@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private UserService userService;
    @Mock
    private JwtTokenService jwtTokenService;
    @Mock
    private HttpServletRequest httpServletRequest;

    @InjectMocks
    private AuthController authController;

    @Test
    void register_ShouldReturnCreatedResponse() {
        // Arrange
        RegisterRequest request = new RegisterRequest(
                "test@example.com", "First", "Last", null, 
                "password", UserRole.DIRECTOR, null
        );
        AuthResponse authResponse = AuthResponse.of("access", "refresh", 3600L);
        
        when(userService.register(eq(request), anyString(), anyString())).thenReturn(authResponse);
        when(httpServletRequest.getHeader("X-Forwarded-For")).thenReturn("127.0.0.1");
        when(httpServletRequest.getHeader("User-Agent")).thenReturn("Mozilla");

        // Act
        ResponseEntity<AuthResponse> response = authController.register(request, httpServletRequest);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).isEqualTo(authResponse);
    }

    @Test
    void logout_ShouldInvalidateToken() {
        // Arrange
        RefreshTokenRequest request = new RefreshTokenRequest("refresh-token");

        // Act
        ResponseEntity<Map<String, String>> response = authController.logout(request);

        // Assert
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).containsEntry("message", "Успешный выход");
        verify(userService).logout("refresh-token");
    }
}
```

**Пояснение:** Unit-тесты контроллера проверяют корректность HTTP-статусов ответов и делегирование логики сервисам. Тестируется изолированно без поднятия Spring-контекста.

---

### Интеграционные тесты

Интеграционные тесты проверяют взаимодействие нескольких компонентов системы. Используется `@WebMvcTest` для тестирования веб-слоя с MockMvc.

#### Пример: Интеграционный тест AuthController

```java
@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("AuthController Integration Tests")
class AuthControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtTokenService jwtTokenService;

    @Test
    @DisplayName("Успешная регистрация DIRECTOR - возвращает 201 и токены")
    void register_WithValidDirectorRequest_ShouldReturnCreatedWithTokens() throws Exception {
        // Arrange
        RegisterRequest request = new RegisterRequest(
                "director@test.com", "Иван", "Иванов", "Иванович",
                "password123", UserRole.DIRECTOR, null
        );

        AuthResponse expectedResponse = AuthResponse.of(
                "access-token-123", "refresh-token-456", 900L
        );

        when(userService.register(any(RegisterRequest.class), nullable(String.class), nullable(String.class)))
                .thenReturn(expectedResponse);

        // Act & Assert
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andDo(print())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").value("access-token-123"))
                .andExpect(jsonPath("$.refreshToken").value("refresh-token-456"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(900));

        verify(userService).register(any(RegisterRequest.class), nullable(String.class), nullable(String.class));
    }

    @Test
    @DisplayName("Ошибка валидации - некорректный email, возвращает 400")
    void register_WithInvalidEmail_ShouldReturnBadRequest() throws Exception {
        // Arrange
        RegisterRequest request = new RegisterRequest(
                "invalid-email",  // Некорректный формат email
                "Test", "User", null, "password123", UserRole.DIRECTOR, null
        );

        // Act & Assert
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());

        // Сервис не должен вызываться при ошибке валидации
        verify(userService, never()).register(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("Успешный вход - возвращает токены")
    void login_WithValidCredentials_ShouldReturnTokens() throws Exception {
        // Arrange
        LoginRequest loginRequest = new LoginRequest("login@test.com", "password123");
        AuthResponse expectedResponse = AuthResponse.of(
                "login-access-token", "login-refresh-token", 900L
        );

        when(userService.login(any(LoginRequest.class), nullable(String.class), nullable(String.class)))
                .thenReturn(expectedResponse);

        // Act & Assert
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("login-access-token"))
                .andExpect(jsonPath("$.refreshToken").value("login-refresh-token"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"));
    }

    @Test
    @DisplayName("Валидный токен - возвращает информацию о пользователе")
    void getCurrentUser_WithValidToken_ShouldReturnUserInfo() throws Exception {
        // Arrange
        UUID userId = UUID.randomUUID();
        UserResponse expectedResponse = new UserResponse(
                userId, "me@test.com", "Иванов Иван Иванович",
                UserRole.DIRECTOR, null, null, null
        );

        when(jwtTokenService.getUserIdFromToken(anyString())).thenReturn(userId);
        when(userService.getUserInfo(userId)).thenReturn(expectedResponse);

        // Act & Assert
        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer valid-jwt-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("me@test.com"))
                .andExpect(jsonPath("$.role").value("DIRECTOR"))
                .andExpect(jsonPath("$.fullName").value("Иванов Иван Иванович"));
    }
}
```

**Пояснение к интеграционным тестам:**

1. **@WebMvcTest** — поднимает только MVC-контекст (контроллеры, фильтры, валидация), что делает тесты быстрыми
2. **MockMvc** — позволяет выполнять HTTP-запросы без реального сервера
3. **@MockBean** — заменяет реальные сервисы моками в Spring-контексте
4. **jsonPath()** — проверяет структуру JSON-ответа
5. **Тестируется:**
   - Маршрутизация HTTP-запросов
   - Валидация входных данных (@Valid)
   - Сериализация/десериализация JSON
   - HTTP статус-коды ответов

#### Структура тестов в проекте

```
src/test/java/
├── controller/           # Unit-тесты контроллеров
│   ├── AuthControllerTest.java
│   ├── ProfileControllerTest.java
│   └── OAuthControllerTest.java
├── service/              # Unit-тесты сервисов
│   ├── UserServiceTest.java
│   ├── JwtTokenServiceTest.java
│   └── RefreshTokenServiceTest.java
├── integration/          # Интеграционные тесты
│   ├── AuthControllerIntegrationTest.java
│   └── BaseIntegrationTest.java
└── utils/                # Тесты утилит
    ├── JwkUtilsTest.java
    └── SecurityUtilsTest.java
```

---

## **Установка и  запуск**

### Манифесты для сборки docker образов

Docker образы строятся для каждого микросервиса отдельно. Ниже представлены ссылки на Dockerfile для всех компонентов системы:

#### Backend микросервисы
- **API Gateway**: [backend/api-gateway/Dockerfile](./backend/api-gateway/Dockerfile)
- **Eureka Server**: [backend/eureka-server/Dockerfile](./backend/eureka-server/Dockerfile)
- **SSO Service**: [backend/SSOService/Dockerfile](./backend/SSOService/Dockerfile)
- **Organization Service**: [backend/organization-service/Dockerfile](./backend/organization-service/Dockerfile)
- **Product Service**: [backend/product-service/Dockerfile](./backend/product-service/Dockerfile)
- **Warehouse Service**: [backend/warehouse-service/Dockerfile](./backend/warehouse-service/Dockerfile)
- **Document Service**: [backend/document-service/Dockerfile](./backend/document-service/Dockerfile)

#### Frontend
- **React Application**: [client/Dockerfile](./client/Dockerfile)

#### Docker Compose
Для локальной разработки и быстрого развертывания:
- **Docker Compose**: [docker-compose.yml](./docker-compose.yml)
- **Monitoring Stack**: [monitoring/docker-compose.monitoring.yml](./monitoring/docker-compose.monitoring.yml)

#### Скрипты развертывания Docker
- **Развертывание**: [deploy-docker.ps1](./deploy-docker.ps1) - автоматическая сборка и запуск всех контейнеров
- **Очистка**: [cleanup-docker.ps1](./cleanup-docker.ps1) - остановка и удаление контейнеров

### Манифесты для развертывания k8s кластера

Kubernetes манифесты организованы в директории `k8s/` и применяются в определенной последовательности:

#### Основные манифесты (применяются по порядку)

1. **Namespace**: [k8s/00-namespace.yaml](./k8s/00-namespace.yaml)
   - Создание изолированного пространства имен `wms` для всех ресурсов системы

2. **Storage**: [k8s/01-storage.yaml](./k8s/01-storage.yaml)
   - PersistentVolumes и PersistentVolumeClaims для хранения данных БД
   - StorageClass конфигурация

3. **Secrets**: [k8s/02-secrets.yaml](./k8s/02-secrets.yaml)
   - Учетные данные для баз данных (PostgreSQL)
   - Пароли и ключи доступа (закодированы в Base64)

4. **Databases**: [k8s/03-databases.yaml](./k8s/03-databases.yaml)
   - StatefulSets для PostgreSQL (4 экземпляра: user_db, organization_db, product_db, warehouse_db)
   - StatefulSet для Redis (кеширование и сессии)
   - Services для доступа к БД

5. **Backend Services**: [k8s/04-backend.yaml](./k8s/04-backend.yaml)
   - Deployments для всех микросервисов (Eureka, API Gateway, SSO, Organization, Product, Warehouse, Document)
   - Services (ClusterIP) для внутреннего взаимодействия
   - ConfigMaps с настройками приложений

6. **Infrastructure**: [k8s/05-infrastructure.yaml](./k8s/05-infrastructure.yaml)
   - RabbitMQ (брокер сообщений)
   - Prometheus (мониторинг метрик)
   - Grafana (визуализация)
   - Loki (централизованное логирование)
   - OpenTelemetry Collector (трассировка)

7. **Ingress**: [k8s/06-ingress.yaml](./k8s/06-ingress.yaml)
   - Правила маршрутизации внешнего трафика
   - Настройка доступа к API Gateway и Frontend

8. **Autoscaling**: [k8s/07-autoscaling.yaml](./k8s/07-autoscaling.yaml)
   - HorizontalPodAutoscaler для автоматического масштабирования микросервисов
   - Настройки min/max реплик и метрики для триггеров

9. **Network Policies**: [k8s/08-network-policies.yaml](./k8s/08-network-policies.yaml)
   - Правила сетевой изоляции между компонентами
   - Ограничение трафика для повышения безопасности

10. **Frontend**: [k8s/09-frontend.yaml](./k8s/09-frontend.yaml)
    - Deployment для React приложения
    - Service (LoadBalancer/NodePort) для доступа к UI

#### Скрипты развертывания Kubernetes

- **Автоматическое развертывание**: [deploy-k8s.ps1](./deploy-k8s.ps1)
  - Полностью автоматизированный процесс развертывания
  - Сборка Docker образов
  - Применение всех манифестов в правильной последовательности
  - Инициализация схем баз данных
  - Проверка готовности компонентов

- **Проброс портов**: [start-port-forwards.ps1](./start-port-forwards.ps1)
  - Автоматический проброс портов для локального доступа к сервисам
  - Доступ к Frontend, API Gateway, Grafana, Prometheus, RabbitMQ

- **Остановка пробросов**: [stop-port-forwards.ps1](./stop-port-forwards.ps1)
  - Остановка всех активных port-forward процессов

- **Очистка кластера**: [cleanup-k8s.ps1](./cleanup-k8s.ps1)
  - Удаление всех ресурсов WMS из кластера
  - Очистка PersistentVolumes
  - Удаление node labels

---

## **Лицензия**

Этот проект лицензирован по лицензии MIT - подробности представлены в файле [[License.md|LICENSE.md]]

---

## **Контакты**

Автор: pavelkarliuk1@gmail.com

