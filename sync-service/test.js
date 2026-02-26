const WebSocket = require('ws');

// Simulate User A and User B connecting to the same document
const userA = new WebSocket('ws://localhost:3001/doc/doc-123');
const userB = new WebSocket('ws://localhost:3001/doc/doc-123');

userA.on('open', () => {
    console.log('User A connected');
    // User A makes a change and sends it to the server
    userA.send('{"action": "insert", "char": "H", "position": 0}');
});

userB.on('open', () => {
    console.log('User B connected');
});

// Listen for incoming sync messages on User B
userB.on('message', (data) => {
    console.log('User B received update via Redis:', data.toString());
    process.exit(0); // Exit successfully once the message routes
});