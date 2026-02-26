# Distributed Real-Time Collaborative Engine

A high-performance, microservices-based backend engine engineered to support real-time collaborative text editing. This distributed systems architecture handles concurrent document mutations across multiple clients utilizing Conflict-Free Replicated Data Types (CRDTs), guaranteeing eventual consistency and low-latency state synchronization without centralized locking.

## Distributed Systems Architecture

The infrastructure isolates relational constraints from high-throughput event streams using an event-driven microservices topology.

* **Core API (FastAPI / Python):** Relational engine managing user authentication, workspace metadata, and strict Role-Based Access Control (RBAC).
* **Sync Service (Node.js / WebSockets):** Stateful real-time service that computes CRDT state merges and maintains active bidirectional client connections.
* **Low-Latency Event Routing (Redis Pub/Sub):** Acts as the message backplane to instantly route binary update payloads across horizontally scaled Node.js instances, ensuring clients on different physical nodes sync seamlessly.
* **Hybrid Persistence Layer:** 
  * **PostgreSQL:** ACID-compliant relational storage for schema-normalized user and document permissions.
  * **MongoDB:** Document store handling debounced, binary CRDT state vectors to ensure immediate session recovery and fault tolerance during server restarts.

##  Technology Stack
* **Backend:** Node.js, Express, FastAPI, Python 3.13
* **Real-Time Engine:** WebSockets (`ws`), Yjs (CRDT mathematical engine)
* **Databases:** PostgreSQL (SQLAlchemy), MongoDB, Redis
* **Frontend:** React, Vite, Quill.js (`y-quill`)
* **Infrastructure:** Docker, Docker Compose

##  Algorithmic Approach: CRDTs vs. OT
Unlike legacy Operational Transformation (OT) which forces a centralized server to sequentially dictate all operations—creating a latency bottleneck—this engine implements CRDTs (Yjs). The mathematical commutativity of CRDTs ensures that concurrent client updates can cross paths over the network or arrive out of order, and all nodes will deterministically converge on the exact same state without data loss or race conditions.

## Local Deployment Instructions

**Prerequisites:** Docker, Docker Compose, Node.js (v20+), Python (3.11+)

