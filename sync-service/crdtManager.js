const Y = require('yjs');

// In-memory cache of active Yjs documents
const activeDocs = new Map();

async function applyUpdate(docId, updateBase64, collection) {
    if (!activeDocs.has(docId)) {
        const ydoc = new Y.Doc();
        
        // Hydrate state from MongoDB on first load
        const record = await collection.findOne({ docId });
        if (record && record.state) {
            const dbState = Buffer.from(record.state, 'base64');
            Y.applyUpdate(ydoc, dbState);
        }
        activeDocs.set(docId, ydoc);
    }

    const ydoc = activeDocs.get(docId);
    
    // Convert base64 back to binary and apply to the CRDT engine
    const updateBuffer = Buffer.from(updateBase64, 'base64');
    Y.applyUpdate(ydoc, updateBuffer);

    // Encode the mathematically merged state to persist
    // Note: In production, debounce this database write to avoid thrashing
    const fullStateBuffer = Y.encodeStateAsUpdate(ydoc);
    
    await collection.updateOne(
        { docId },
        { $set: { state: fullStateBuffer.toString('base64'), lastUpdated: new Date() } },
        { upsert: true }
    );
}

module.exports = { applyUpdate };