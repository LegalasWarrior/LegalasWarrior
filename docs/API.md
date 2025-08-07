## API (прототип)

- GET `/api/ping` → `{ ok, ts }`
- POST `/api/auth/login` body `{ name }` → `{ token, playerId, name }`
- GET `/api/presence` → `{ list: [{ playerId, name, lastSeen }] }`
- WS `/ws?token=...` messages:
  - send `{ type:'chat', text }`
  - recv `{ type:'chat', entry }`, `{ type:'hello', now, playerId, playerName, chatHistory }`