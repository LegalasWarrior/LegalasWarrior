## Архитектура проекта

- Клиент (статический): HTML/CSS/ESM JS. Локальный игровой движок, сохранения в localStorage. Опциональная связь с сервером по WebSocket (чат/присутствие) и REST.
- Сервер (Node.js, Express + ws): статика, REST (ping, auth mock, presence), WS (чат). В демо — память; прод — PostgreSQL/Redis.
- Масштабирование: фронты за CDN, статика на S3, API за балансировщиком, WS через шардирование/Sticky Sessions, Redis Pub/Sub для фан-аута, PostgreSQL с репликами.
- Безопасность: CORS, валидация входов, rate limit, защита от XSS (экранирование на клиенте), CSRF токены для state-changing REST.

### Компоненты
- `client/app.js`: локальный игровой цикл, бой, переходы, инвентарь, чат.
- `server/index.js`: REST + WS, статика.
- `content/world.json`: данные мира.
- `docs/*`: документация.