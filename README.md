# Trading Calendar

Визуальный трейдинг-журнал в формате календаря. Показывает прибыльные/убыточные дни цветами с градиентом интенсивности.

## Структура проекта

```
trading-calendar/
├── app/
│   ├── api/trades/route.ts   # Серверный прокси для Google Sheets
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── TradingCalendar.tsx
│   └── TradingCalendar.module.css
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── next.config.js
```

## Быстрый старт (Docker)

### 1. Клонируй / скопируй проект

```bash
cd trading-calendar
```

### 2. Создай `.env` из шаблона

```bash
cp .env.example .env
```

Отредактируй `.env`:

```env
GOOGLE_SHEETS_API_KEY=AIzaSy...
GOOGLE_SHEET_ID=1BxiMVs0XRA5...
GOOGLE_SHEET_RANGE=Sheet1!A:D
DEPOSIT=100000
```

> Если оставить пустым — приложение запустится с демо-данными.

### 3. Запусти

```bash
docker compose up --build
```

Открой http://localhost:3000

---

## Получить Google Sheets API Key

1. Зайди на https://console.cloud.google.com
2. Создай новый проект (или выбери существующий)
3. Перейди в **APIs & Services → Library**
4. Найди и включи **Google Sheets API**
5. Перейди в **APIs & Services → Credentials**
6. Нажми **Create Credentials → API Key**
7. (Рекомендуется) Ограничь ключ: **API restrictions → Google Sheets API**

### Найти Sheet ID

В URL таблицы:
```
https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SHEET_ID/edit
```

### Открыть доступ к таблице

Таблица должна быть:
- **Общедоступной** (Anyone with the link → Viewer), ИЛИ
- Иметь доступ для сервисного аккаунта

---

## Структура таблицы Google Sheets

| Date       | Profit ($) | % Change | Trades Count |
|------------|------------|----------|--------------|
| 2026-03-02 | 2607       | 2.6      | 2            |
| 2026-03-03 | 1189       | 1.1      | 1            |
| 2026-03-06 | -260       | -0.3     | 2            |

- **Date**: формат `YYYY-MM-DD`
- **Profit ($)**: число (положительное или отрицательное)
- **% Change**: опционально (пересчитывается из PnL и депозита)
- **Trades Count**: количество сделок в этот день

> Если в таблице несколько строк на один день — они автоматически агрегируются.

---

## Команды Docker

```bash
# Запустить (с пересборкой)
docker compose up --build

# Запустить в фоне
docker compose up -d --build

# Остановить
docker compose down

# Посмотреть логи
docker compose logs -f

# Пересобрать после изменений
docker compose up --build --force-recreate
```

## Локальная разработка (без Docker)

```bash
npm install
cp .env.example .env  # заполни переменные
npm run dev
```

Открой http://localhost:3000

---

## Данные обновляются автоматически каждые 5 минут.
