# PHXBody Log — Telegram Mini App

Современный дневник тренировок для опытного атлета силы. Структура строится вокруг **тренировочных дней** и **блоков** (ГТГ, силовые, гири, активность, комментарии), чтобы лог был быстрее и понятнее, чем заметки.

## Возможности
- Быстрое создание дня через сценарии (ГТГ, силовая, гири, активность, смешанная).
- Карточные блоки с быстрым вводом повторов, подходов и шагов.
- Шаблоны для повторяющихся дней.
- История, фильтры и поиск по движениям.
- Минимальная аналитика на 7/14 дней.
- Telegram WebApp интеграция (тема, haptics, back button).

## Запуск локально (uv)
```bash
uv venv
source .venv/bin/activate
uv sync
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Откройте: http://localhost:8000

## Docker + docker-compose
```bash
docker compose up --build
```

Переменные окружения:
- `ALLOWED_TELEGRAM_USER_ID` — разрешённый ID пользователя Telegram (если не задан, доступ открыт).
- `DATABASE_URL` — URL базы SQLite.

## Настройка Telegram Bot и WebApp
1. Создайте бота через **@BotFather** и получите токен.
2. Создайте кнопку WebApp:
   - `/setdomain` → укажите домен, где будет доступно приложение.
   - `/setmenubutton` → выберите `Web App` и укажите URL вашего приложения.
3. В `docker-compose.yml` установите `ALLOWED_TELEGRAM_USER_ID` (ваш Telegram user ID), чтобы разрешить доступ только себе.
4. Откройте бота в Telegram → нажмите кнопку меню.

## Развёртывание
1. Соберите и запустите контейнер:
   ```bash
   docker compose up --build -d
   ```
2. Настройте внешний доступ (Nginx / reverse proxy, HTTPS).
3. Укажите публичный HTTPS URL в BotFather как WebApp URL.

## Структура проекта
```
app/
  main.py        # FastAPI API + статический фронтенд
  models.py      # SQLAlchemy модели
  schemas.py     # Pydantic схемы
  crud.py        # операции с БД
  static/
    index.html   # UI
    app.js       # логика интерфейса
```

## API (основное)
- `GET /api/workout-days`
- `POST /api/workout-days`
- `PUT /api/workout-days/{id}`
- `GET /api/templates`
- `POST /api/templates`
- `GET /api/search?query=присед`
- `GET /api/analytics?days=14`
