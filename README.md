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

### Где взять значения переменных
* `ALLOWED_TELEGRAM_USER_ID`: откройте бота @userinfobot и отправьте ему любое сообщение — он пришлёт ваш user id. Используйте его для ограничения доступа.
* `DATABASE_URL`: по умолчанию можно не задавать (будет использован SQLite файл в проекте). Если нужно явно указать, используйте формат `sqlite:///./app.db` для файла рядом с сервером. При использовании Docker укажите путь внутри контейнера, например `sqlite:///./data/app.db` и примонтируйте том. 

Пример `.env` для локального запуска:
```dotenv
ALLOWED_TELEGRAM_USER_ID=123456789
DATABASE_URL=sqlite:///./app.db
```

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

## GitHub Pages для фронтенда
Фронтенд можно публиковать отдельно на GitHub Pages, а API оставить на вашем сервере.

### Одноразовая настройка
1. Убедитесь, что вы используете ветку `main`.
2. Включите GitHub Pages через скрипт (нужен `gh`):
   ```bash
   ./scripts/setup_github_pages.sh --api-base https://your-api.example.com
   ```
   Скрипт переключит Pages на GitHub Actions и создаст переменную `PHX_API_BASE_URL`.
3. В Telegram BotFather укажите GitHub Pages URL в настройках WebApp.

### Где задаётся PHX_API_BASE_URL
`PHX_API_BASE_URL` — это **репозиторная переменная** GitHub (Actions Variable), а не секрет. Её можно задать двумя способами:
1. Скриптом: `./scripts/setup_github_pages.sh --api-base https://your-api.example.com` (автоматически создаёт/обновляет переменную).
2. Вручную: **GitHub → Settings → Secrets and variables → Actions → Variables** → `New repository variable` → имя `PHX_API_BASE_URL`.

Если API на том же домене (редкий случай), переменную можно не задавать — фронтенд будет обращаться к относительным `/api/...`.

### Как будут обновляться страницы
* Каждый `git push` в `main` автоматически запускает workflow `Deploy GitHub Pages`.
* Workflow копирует `app/static` в артефакт Pages и подставляет `PHX_API_BASE_URL` в `static/config.js`.
* Ручных действий после этого не требуется: обновления публикуются автоматически после мержа в `main`.

Если API размещён на том же домене, переменную `PHX_API_BASE_URL` можно оставить пустой.

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
