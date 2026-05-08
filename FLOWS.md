# FLOWS.md — нереализованные флоу и отложенные задачи

> Документ содержит только то, что ещё **не сделано**. Реализованные флоу удалены — состояние backend описано в коде и в `backend/CLAUDE.md`.
> Последнее обновление: 2026-05-06.

---

## document-service (отложено пользователем)

- **Q-DOC-1.** Шаблоны для типов документов без POI-шаблона (`picking-list`, `receipt-act`, `invoice-fact`, `invoice`, `transport-note`, `cmr`, `discrepancy-act`) — пользователь сам найдёт и добавит госформы.
- **Q-DOC-2.** Строго типизированные DTO (`ReceiptOrderRequest`, `WaybillRequest`, …) вместо `Map<String,Object>` + `@Schema` для Swagger.
- **Q-DOC-3.** Персистентное хранилище документов (S3/MinIO/диск + БД) вместо `ConcurrentHashMap` (после рестарта документы теряются).
- **Q-DOC-4.** Настоящий RPA через UI-автоматизацию (Selenium и т.п.) для заполнения готовых форм — сейчас Apache POI templates как MVP.
- **Q-DOC-5.** Конвертация XLS → PDF через выбранный движок (LibreOffice headless / Apache POI XSL-FO) с поддержкой кириллицы и сложного layout.
- **Q-DOC-6.** Multi-format response: `GET /api/documents/{id}` сейчас всегда отдаёт PDF; нужно отдавать в формате генерации (xls/docx).

---

## Сквозные (cross-cutting)

- **Q-X-2.** Тесты для новых флоу (ship-saga, инвентаризация, переоценка, RPA extractor). Включаются по запросу пользователя.
- **Q-X-3.** Frontend (сейчас в основном на mock-данных). Очередность страниц после закрытия бэка:
  1. ReceivePage (4-step wizard).
  2. ShipPage (заявка + лист подбора + pick UI с прогресс-баром).
  3. InventoryPage (start session → walk + record + complete).
  4. RevaluationPage / WriteoffPage (акты).
  5. AnalyticsPage (графики, замена mock на API).
