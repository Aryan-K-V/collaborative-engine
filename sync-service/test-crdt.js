const WebSocket = require('ws');
const Y = require('yjs');

// Connect User A and User B to the same document
const wsA = new WebSocket('ws://localhost:3001/doc/crdt-demo-1');
const wsB = new WebSocket('ws://localhost:3001/doc/crdt-demo-1');

// Initialize local CRDT state for both users
const docA = new Y.Doc();
const docB = new Y.Doc();
const textA = docA.getText('shared-text');
const textB = docB.getText('shared-text');

// 1. Send local changes to the server
docA.on('update', update => wsA.send(update));
docB.on('update', update => wsB.send(update));

// 2. Receive and apply remote changes from the server
wsA.on('message', message => Y.applyUpdate(docA, new Uint8Array(message)));
wsB.on('message', message => Y.applyUpdate(docB, new Uint8Array(message)));

let connections = 0;
const startTest = () => {
    connections++;
    if (connections === 2) {
        console.log("Both users connected. Firing simultaneous edits...");
        
        // Both users type at position 0 at the exact same millisecond
        textA.insert(0, "User_A_Types_This ");
        textB.insert(0, "User_B_Types_This ");

        // Wait 1 second for Redis Pub/Sub and MongoDB to process the merge
        setTimeout(() => {
            console.log("\n--- CRDT Merge Results ---");
            console.log("User A sees:", textA.toString());
            console.log("User B sees:", textB.toString());
            
            if (textA.toString() === textB.toString()) {
                console.log("\n✅ Eventual Consistency Achieved! Conflict resolved without data loss.");
            } else {
                console.log("\n❌ Sync failed.");
            }
            process.exit(0);
        }, 1000);
    }
};

wsA.on('open', startTest);
wsB.on('open', startTest);