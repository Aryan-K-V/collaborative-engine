# Sync Service

Node.js WebSocket server that keeps collaborative documents in sync. It speaks the
standard [`y-websocket`](https://github.com/yjs/y-websocket) protocol, so any Yjs
client using `WebsocketProvider` (like the [frontend](../frontend)) can connect.
Documents are persisted in MongoDB, and Redis relays changes between instances so
the service can run on several nodes.

## Running

With Docker Compose from the repository root (recommended):

```sh
docker compose up --build sync-service
```

This also starts Redis and MongoDB. The service listens on
`ws://localhost:${SYNC_SERVICE_PORT}` (3001 in `.env.example`).

Or locally with Node.js 20+, with Redis and MongoDB still running in Docker:

```sh
npm install
REDIS_URL=redis://localhost:16379/0 \
MONGO_URI="mongodb://admin:your_mongodb_password@localhost:27017/crdt_store?authSource=admin" \
npm start
```

The service loads `../.env`, but its hostnames (`redis`, `mongodb`) only resolve
inside Docker, so override them as above. Variables already set in the shell take
precedence over `.env`.

## Configuration

| Variable            | Default                                                           | Description               |
| ------------------- | ----------------------------------------------------------------- | ------------------------- |
| `PORT`              | (unset)                                                           | HTTP/WebSocket port set by hosts like Render; wins over `SYNC_SERVICE_PORT` |
| `SYNC_SERVICE_PORT` | `3001`                                                            | HTTP/WebSocket port       |
| `REDIS_URL`         | `redis://redis:6379/0`                                            | Redis for cross-node fan-out (`rediss://` for TLS) |
| `MONGO_URI`         | `mongodb://admin:secret@mongodb:27017/crdt_store?authSource=admin` | MongoDB for persistence   |
| `ALLOWED_ORIGINS`   | (unset: any origin)                                               | Comma-separated web origins allowed to connect, e.g. `https://collab-editor.onrender.com` |

`GET /health` returns `{"status":"ok"}` for hosting health checks. Messages over
10 MB are rejected.

`ALLOWED_ORIGINS` stops other websites from connecting from a browser; others are
refused with `403`. Connections with no `Origin` header, such as `test-crdt.js`,
are still allowed, so it isn't authentication. For deploying, see
[DEPLOY.md](../DEPLOY.md).

## Connecting

Connect to `ws://<host>:<port>/doc/<docId>`. The last path segment is taken as
the document ID, whatever comes before it; a connection to `/` with no path is
closed with code `1008`. With
`y-websocket`, pass the base URL and the ID separately:

```js
new WebsocketProvider('ws://localhost:3001/doc', docId, ydoc)
```

## How it works

| File             | Role                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| `server.js`      | WebSocket protocol handling, Redis relay, heartbeats and shutdown        |
| `crdtManager.js` | Loads documents from MongoDB, keeps them in memory, persists and unloads them |
| `test-crdt.js`   | End-to-end test against a running service                                |

**Documents in memory.** The first connection to a document loads it from MongoDB
into a `Y.Doc`, along with an awareness instance for presence. Later connections
share it. Messages that arrive while the document is loading are queued in order,
not dropped.

**Protocol.** Each message starts with a type:

| Type | Name            | Handling                                                                       |
| ---- | --------------- | ------------------------------------------------------------------------------ |
| `0`  | Sync            | Sync step 1 is answered with step 2; step 2 and updates are applied to the document |
| `1`  | Awareness       | Presence (cursor, name, color) is applied and relayed                          |
| `3`  | Query awareness | Replies with everyone's current presence                                       |

On connect, the server sends its sync step 1 and the current presence, so a new
client receives the saved document even when nobody else is online. Every change
is broadcast to the document's other clients on this node, but not echoed back to
its sender.

**Multiple nodes.** Local changes are published to the Redis channel
`doc:<docId>` as JSON `{ node, type: "update" | "awareness", data }`, with `data`
base64-encoded. Each node has a random ID and ignores its own messages. A node
only applies messages for documents it has open; the others load the latest state
from MongoDB when first opened.

**Persistence.** Each document is stored in the `crdt_store.documents` collection
as `{ docId, state, lastUpdated }`, where `state` is the base64-encoded full Yjs
state. While a document is being edited it is saved at most once per second. It is
saved again and unloaded from memory when its last client leaves, and all open
documents are saved on `SIGINT` or `SIGTERM`.

**Presence cleanup.** The server tracks which presence entries belong to which
socket and removes them when the socket closes, so cursors don't linger. Sockets
that miss a 30-second ping are terminated.

**Errors.** A malformed message is logged and ignored; it does not close the
connection or crash the process. If a document fails to load, its clients are
closed with code `1011`.

## Testing

With the service running:

```sh
node test-crdt.js                             # defaults to ws://localhost:3001/doc
node test-crdt.js ws://localhost:3001/doc     # or pass another URL
```

It connects simulated users to a new document with the real `y-websocket` client,
and checks that:

- simultaneous edits converge with nothing lost,
- each user sees the others' presence,
- after everyone leaves, a new user receives the saved document.

`npm test` is still the npm placeholder; use the command above.

## Current limitations

- **No authentication.** Anyone who can reach the service can open or edit any
  document ID. It doesn't check document IDs against the [Core API](../core-api).
- **Full snapshots.** Each save rewrites the document's whole state; there is no
  incremental update log or compaction.
