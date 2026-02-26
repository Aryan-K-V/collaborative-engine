require('dotenv').config({ path: '../.env' });
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('redis');
const { MongoClient } = require('mongodb');
const Y = require('yjs');
const syncProtocol = require('y-protocols/sync');
const awarenessProtocol = require('y-protocols/awareness');
const encoding = require('lib0/encoding');
const decoding = require('lib0/decoding');
const rooms = require('./crdtManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379/0';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:secret@mongodb:27017/crdt_store?authSource=admin';
const PORT = process.env.SYNC_SERVICE_PORT || 3001;
const PING_INTERVAL_MS = 30000;

// Message types from the y-websocket wire protocol
const messageSync = 0;
const messageAwareness = 1;
const messageQueryAwareness = 3;

// Identifies this node so it can ignore its own Redis broadcasts
const NODE_ID = crypto.randomUUID();
// Transaction origin for changes that arrived from another node via Redis
const REDIS_ORIGIN = Symbol('redis');

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

function send(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(message, err => err && ws.terminate());
    }
}

function broadcast(room, message, exclude) {
    for (const ws of room.conns.keys()) {
        if (ws !== exclude) send(ws, message);
    }
}

function publish(docId, type, payload) {
    const message = JSON.stringify({
        node: NODE_ID,
        type,
        data: Buffer.from(payload).toString('base64'),
    });
    pubClient.publish(`doc:${docId}`, message).catch(err => {
        console.error(`Redis publish failed for ${docId}:`, err);
    });
}

function encodeAwareness(awareness, clientIds) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds)
    );
    return encoding.toUint8Array(encoder);
}

// Wire up fan-out for a freshly loaded document
function onRoomCreated(room) {
    room.ydoc.on('update', (update, origin) => {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        broadcast(room, encoding.toUint8Array(encoder), origin);

        if (origin !== REDIS_ORIGIN) publish(room.docId, 'update', update);
    });

    room.awareness.on('update', ({ added, updated, removed }, origin) => {
        // Remember which awareness clients belong to which socket so we can
        // clear their cursors when the socket closes
        const controlled = room.conns.get(origin);
        if (controlled) {
            added.forEach(id => controlled.add(id));
            removed.forEach(id => controlled.delete(id));
        }

        const changed = added.concat(updated, removed);
        broadcast(room, encodeAwareness(room.awareness, changed), origin);

        if (origin !== REDIS_ORIGIN) {
            publish(
                room.docId,
                'awareness',
                awarenessProtocol.encodeAwarenessUpdate(room.awareness, changed)
            );
        }
    });
}

function handleMessage(ws, room, data) {
    const decoder = decoding.createDecoder(new Uint8Array(data));
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
        case messageSync: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            // Answers sync step 1 with step 2, and applies step 2 / updates
            // with the socket as the transaction origin
            syncProtocol.readSyncMessage(decoder, encoder, room.ydoc, ws);
            if (encoding.length(encoder) > 1) {
                send(ws, encoding.toUint8Array(encoder));
            }
            break;
        }
        case messageAwareness:
            awarenessProtocol.applyAwarenessUpdate(
                room.awareness,
                decoding.readVarUint8Array(decoder),
                ws
            );
            break;
        case messageQueryAwareness:
            send(ws, encodeAwareness(room.awareness, Array.from(room.awareness.getStates().keys())));
            break;
        default:
            console.warn(`Ignoring unknown message type ${messageType} on ${room.docId}`);
    }
}

function getDocId(req) {
    const { pathname } = new URL(req.url, 'http://localhost');
    const segment = pathname.split('/').filter(Boolean).pop();
    return segment ? decodeURIComponent(segment) : null;
}

function handleConnection(ws, req) {
    const docId = getDocId(req);
    if (!docId) {
        ws.close(1008, 'Missing document id');
        return;
    }
    console.log(`Client connected to CRDT document: ${docId}`);

    // Register handlers immediately so messages sent while the document is
    // loading from MongoDB are queued (in order) rather than dropped
    const roomReady = rooms.getRoom(docId).then(room => {
        room.conns.set(ws, new Set());

        // Start the handshake: send our state vector so the client replies
        // with anything we're missing, and share who else is here
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeSyncStep1(encoder, room.ydoc);
        send(ws, encoding.toUint8Array(encoder));

        const clientIds = Array.from(room.awareness.getStates().keys());
        if (clientIds.length > 0) {
            send(ws, encodeAwareness(room.awareness, clientIds));
        }
        return room;
    });

    roomReady.catch(err => {
        console.error(`Failed to load ${docId}:`, err);
        ws.close(1011, 'Failed to load document');
    });

    ws.on('message', async data => {
        try {
            handleMessage(ws, await roomReady, data);
        } catch (err) {
            console.error(`Bad message on ${docId}:`, err);
        }
    });

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('close', async () => {
        let room;
        try {
            room = await roomReady;
        } catch {
            return;
        }
        const controlled = room.conns.get(ws);
        room.conns.delete(ws);
        if (controlled && controlled.size > 0) {
            awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(controlled), null);
        }
        rooms.releaseRoom(room).catch(err => console.error(`Failed to release ${docId}:`, err));
    });
}

async function handleRedisMessage(raw, channel) {
    const docId = channel.slice('doc:'.length);
    const pending = rooms.peekRoom(docId);
    // Nobody on this node has the doc open; the originating node persists it
    if (!pending) return;

    let message;
    try {
        message = JSON.parse(raw);
    } catch {
        return;
    }
    if (message.node === NODE_ID) return;

    const room = await pending;
    const payload = new Uint8Array(Buffer.from(message.data, 'base64'));
    if (message.type === 'update') {
        Y.applyUpdate(room.ydoc, payload, REDIS_ORIGIN);
    } else if (message.type === 'awareness') {
        awarenessProtocol.applyAwarenessUpdate(room.awareness, payload, REDIS_ORIGIN);
    }
}

async function init() {
    await pubClient.connect();
    await subClient.connect();

    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const documentsCollection = mongoClient.db('crdt_store').collection('documents');
    console.log('Connected to Redis and MongoDB');

    rooms.init({ collection: documentsCollection, onRoomCreated });

    await subClient.pSubscribe('doc:*', (raw, channel) => {
        handleRedisMessage(raw, channel).catch(err => {
            console.error(`Failed to apply Redis message on ${channel}:`, err);
        });
    });

    wss.on('connection', handleConnection);

    // Drop connections that stopped answering pings so their cursors clear
    const pingTimer = setInterval(() => {
        wss.clients.forEach(ws => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, PING_INTERVAL_MS);

    const shutdown = async () => {
        clearInterval(pingTimer);
        await rooms.flushAll();
        process.exit(0);
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    server.listen(PORT, () => {
        console.log(`CRDT Sync Service active on port ${PORT}`);
    });
}

init().catch(err => {
    console.error(err);
    process.exit(1);
});
