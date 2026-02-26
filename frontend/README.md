# Frontend

React + Vite client for the collaborative editor. It uses Quill for editing and
Yjs (via `y-websocket`) to sync with the sync service.

## Running

```sh
cp .env.example .env   # optional; defaults to ws://localhost:3001/doc
npm install
npm run dev
```

Open the printed URL. A new document ID is generated and put in the URL
(`?doc=<id>`); share that link to edit together.

## Configuration

| Variable        | Default                   | Description                                    |
| --------------- | ------------------------- | ---------------------------------------------- |
| `VITE_SYNC_URL` | `ws://localhost:3001/doc` | Sync service WebSocket URL (`wss://` on HTTPS) |
