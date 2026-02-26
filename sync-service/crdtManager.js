const Y = require('yjs');
const awarenessProtocol = require('y-protocols/awareness');

// Persist at most once per interval while a document is being edited
const PERSIST_INTERVAL_MS = 1000;

// docId -> Promise<Room>. Storing the promise means concurrent connections
// to the same document share a single MongoDB load.
const rooms = new Map();

let collection = null;
let onRoomCreated = () => {};

function init(options) {
    collection = options.collection;
    onRoomCreated = options.onRoomCreated || onRoomCreated;
}

function getRoom(docId) {
    if (!rooms.has(docId)) {
        const loading = loadRoom(docId).catch(err => {
            rooms.delete(docId);
            throw err;
        });
        rooms.set(docId, loading);
    }
    return rooms.get(docId);
}

// Returns the room only if this node already has it in memory
function peekRoom(docId) {
    return rooms.get(docId);
}

async function loadRoom(docId) {
    const ydoc = new Y.Doc();

    // Hydrate state from MongoDB on first load
    const record = await collection.findOne({ docId });
    if (record && record.state) {
        Y.applyUpdate(ydoc, Buffer.from(record.state, 'base64'));
    }

    const awareness = new awarenessProtocol.Awareness(ydoc);
    // The server is a relay, not a participant, so it has no presence of its own
    awareness.setLocalState(null);

    const room = {
        docId,
        ydoc,
        awareness,
        // ws -> Set of awareness clientIDs that connection controls
        conns: new Map(),
        persistTimer: null,
    };

    ydoc.on('update', () => schedulePersist(room));
    onRoomCreated(room);
    return room;
}

function schedulePersist(room) {
    if (room.persistTimer) return;
    room.persistTimer = setTimeout(() => {
        persist(room).catch(err => console.error(`Failed to persist ${room.docId}:`, err));
    }, PERSIST_INTERVAL_MS);
}

async function persist(room) {
    clearTimeout(room.persistTimer);
    room.persistTimer = null;

    const fullState = Buffer.from(Y.encodeStateAsUpdate(room.ydoc));
    await collection.updateOne(
        { docId: room.docId },
        { $set: { state: fullState.toString('base64'), lastUpdated: new Date() } },
        { upsert: true }
    );
}

// Flush and unload a room once its last client has left
async function releaseRoom(room) {
    if (room.conns.size > 0) return;
    await persist(room);
    // A client may have joined while we were writing
    if (room.conns.size > 0) return;

    rooms.delete(room.docId);
    room.awareness.destroy();
    room.ydoc.destroy();
}

async function flushAll() {
    const loaded = await Promise.allSettled(rooms.values());
    await Promise.allSettled(
        loaded.filter(r => r.status === 'fulfilled').map(r => persist(r.value))
    );
}

module.exports = { init, getRoom, peekRoom, releaseRoom, flushAll };
