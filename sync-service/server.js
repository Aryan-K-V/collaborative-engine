require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('redis');
const { MongoClient } = require('mongodb');
const { applyUpdate } = require('./crdtManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379/0';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:secret@mongodb:27017/crdt_store?authSource=admin';
const PORT = process.env.SYNC_SERVICE_PORT || 3001;

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

async function init() {
    await pubClient.connect();
    await subClient.connect();
    
    const mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    const documentsCollection = mongoClient.db('crdt_store').collection('documents');
    console.log('Connected to Redis and MongoDB');

    // Redis subscriber expects base64 strings
    await subClient.pSubscribe('doc:*', (messageBase64, channel) => {
        const docId = channel.split(':')[1];
        const binaryMessage = Buffer.from(messageBase64, 'base64');
        
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && client.docId === docId) {
                client.send(binaryMessage); // Send binary directly to Yjs frontend
            }
        });
    });

    wss.on('connection', (ws, req) => {
        const docId = req.url.split('/').pop();
        ws.docId = docId;
        console.log(`Client connected to CRDT document: ${docId}`);

        ws.on('message', async (data) => {
            // 'data' is a Buffer from WebSocket. Convert to base64 for safe Redis transport.
            const updateBase64 = data.toString('base64');
            
            // 1. Broadcast to other nodes
            await pubClient.publish(`doc:${docId}`, updateBase64);
            
            // 2. Apply mathematically and persist to MongoDB
            await applyUpdate(docId, updateBase64, documentsCollection);
        });
    });

    server.listen(PORT, () => {
        console.log(`CRDT Sync Service active on port ${PORT}`);
    });
}

init().catch(console.error);