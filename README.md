# Distributed Real-Time Collaborative Engine

A high-performance, microservices-based backend engine engineered to support real-time collaborative text editing. This distributed systems architecture handles concurrent document mutations across multiple clients utilizing Conflict-Free Replicated Data Types (CRDTs), guaranteeing eventual consistency and low-latency state synchronization without centralized locking.

## Distributed Systems Architecture

The infrastructure isolates relational constraints from high-throughput event streams using an event-driven microservices topology.

* **Core API (FastAPI / Python):** Relational service for users and document metadata (title, owner). Authentication and access control are not implemented yet; see [core-api/README.md](core-api/README.md).
* **Sync Service (Node.js / WebSockets):** Stateful real-time service that speaks the standard `y-websocket` protocol. On connect it runs the Yjs sync handshake, so a new client immediately receives the persisted document, then relays document updates and presence (cursors, names) to every client on the same document.
* **Low-Latency Event Routing (Redis Pub/Sub):** Acts as the message backplane to route binary document updates and presence changes across horizontally scaled Node.js instances, ensuring clients on different physical nodes sync seamlessly. Each node tags its messages and ignores its own echoes.
* **Hybrid Persistence Layer:** 
  * **PostgreSQL:** ACID-compliant relational storage for users and document ownership.
  * **MongoDB:** Document store holding each document's binary CRDT state. Writes are throttled to at most one per second while a document is being edited, and flushed when the last client leaves or the service shuts down, for session recovery across restarts.

##  Technology Stack
* **Backend:** Node.js, Express, FastAPI, Python 3.13
* **Real-Time Engine:** WebSockets (`ws`), Yjs (CRDT mathematical engine), `y-protocols` (sync and awareness)
* **Databases:** PostgreSQL (SQLAlchemy), MongoDB, Redis
* **Frontend:** React, Vite, Quill.js (`y-quill`, `quill-cursors`), `y-websocket`
* **Infrastructure:** Docker, Docker Compose

##  Algorithmic Approach: CRDTs vs. OT
Unlike legacy Operational Transformation (OT) which forces a centralized server to sequentially dictate all operations—creating a latency bottleneck—this engine implements CRDTs (Yjs). The mathematical commutativity of CRDTs ensures that concurrent client updates can cross paths over the network or arrive out of order, and all nodes will deterministically converge on the exact same state without data loss or race conditions.

## Frontend Editor

The React client uses the dark "Mocha & Matcha" theme: layered coffee browns with a matcha green accent.

* **Live co-editing** with each collaborator's cursor and selection shown in their color.
* **Presence ribbons:** everyone in the document appears as a bookmark ribbon on the page's top edge, in their cursor color; hover or focus a ribbon to see the name.
* **Connection status** (connecting, syncing, connected, offline). Edits made while offline sync automatically on reconnect.
* **Shareable documents:** the document ID lives in the URL (`?doc=<id>`). Opening the app without one starts a new document; **Copy link** shares it.

## Local Deployment Instructions

**Prerequisites:** Docker, Docker Compose, Node.js (v20+), Python (3.11+)

1. **Configure the environment.** Copy the example file and set your own passwords:

   ```sh
   cp .env.example .env
   ```

2. **Start the backend services** (PostgreSQL, MongoDB, Redis, Core API, Sync Service):

   ```sh
   docker compose up --build
   ```

   The Sync Service listens on `ws://localhost:3001` (set by `SYNC_SERVICE_PORT`).

3. **Start the frontend:**

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

   Open the URL Vite prints (usually `http://localhost:5173`). To point the client at a different Sync Service, copy `frontend/.env.example` to `frontend/.env` and set `VITE_SYNC_URL` (use `wss://` when the page is served over HTTPS).

4. **Collaborate:** open the same `?doc=` link in a second tab or browser and type in both.

## Testing

With the Sync Service running, run the end-to-end CRDT test. It connects simulated users with the same `y-websocket` client the frontend uses, and checks that concurrent edits converge without loss, that presence reaches other clients, and that a new client receives the persisted document:

```sh
cd sync-service
npm install
node test-crdt.js            # defaults to ws://localhost:3001/doc
```
