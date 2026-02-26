// End-to-end check against a running sync service, using the same
// y-websocket client the frontend uses.
//   node test-crdt.js [ws://localhost:3001/doc]
const WebSocket = require('ws');
const Y = require('yjs');
const { WebsocketProvider } = require('y-websocket');

const SYNC_URL = process.argv[2] || 'ws://localhost:3001/doc';
const DOC_ID = `test-${Date.now()}`;

function connect(name) {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(SYNC_URL, DOC_ID, ydoc, { WebSocketPolyfill: WebSocket });
    provider.awareness.setLocalStateField('user', { name });
    const synced = new Promise(resolve => provider.once('sync', resolve));
    return { ydoc, provider, text: ydoc.getText('quill'), synced };
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(label, ok) {
    console.log(`${ok ? '✅' : '❌'} ${label}`);
    if (!ok) process.exitCode = 1;
}

async function main() {
    const a = connect('A');
    const b = connect('B');
    await Promise.all([a.synced, b.synced]);
    console.log(`Both users synced on ${DOC_ID}. Firing simultaneous edits...`);

    // Both users type at position 0 at the same moment
    a.text.insert(0, 'User_A_Types_This ');
    b.text.insert(0, 'User_B_Types_This ');
    await wait(500);

    console.log('User A sees:', a.text.toString());
    console.log('User B sees:', b.text.toString());
    check('Concurrent edits converge', a.text.toString() === b.text.toString());
    check('No edits lost', a.text.length === 36);

    const names = [...a.provider.awareness.getStates().values()].map(s => s.user?.name).sort();
    check('Presence reaches other clients', names.join() === 'A,B');

    // Everyone leaves; the server should persist the doc and serve it to a newcomer
    const finalText = a.text.toString();
    a.provider.destroy();
    b.provider.destroy();
    await wait(1500);

    const c = connect('C');
    await c.synced;
    check('Persisted state is served to a new client', c.text.toString() === finalText);
    c.provider.destroy();
}

main().catch(err => {
    console.error(err);
    process.exitCode = 1;
}).finally(() => setTimeout(() => process.exit(), 100));
