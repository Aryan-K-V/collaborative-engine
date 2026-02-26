import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Quill from 'quill';
import { QuillBinding } from 'y-quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';

Quill.register('modules/cursors', QuillCursors);

// Chosen to stay readable as cursor labels on both light and dark backgrounds
const CURSOR_COLORS = ['#e5484d', '#f76b15', '#d6a100', '#30a46c', '#12a594', '#0090ff', '#8e4ec6', '#d6409f'];
const ANIMALS = ['Otter', 'Falcon', 'Panda', 'Lynx', 'Heron', 'Koala', 'Badger', 'Orca', 'Gecko', 'Moose', 'Raven', 'Walrus'];

const STATUS_LABELS = {
    connecting: 'Connecting…',
    syncing: 'Syncing…',
    connected: 'Connected',
    offline: 'Offline, reconnecting…',
};

const pick = list => list[Math.floor(Math.random() * list.length)];

export default function Editor({ docId, syncUrl }) {
    const containerRef = useRef(null);
    const [status, setStatus] = useState('connecting');
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const ydoc = new Y.Doc();
        const provider = new WebsocketProvider(syncUrl, docId, ydoc);
        const { awareness } = provider;

        const onStatus = ({ status: next }) => {
            if (next === 'connected') {
                setStatus(provider.synced ? 'connected' : 'syncing');
            } else if (next === 'connecting') {
                // Keep showing "offline" during reconnect attempts instead of flickering
                setStatus(current => (current === 'offline' ? 'offline' : 'connecting'));
            }
        };
        const onSync = isSynced => {
            if (isSynced) setStatus('connected');
        };
        // Fires for every closed socket, including failed connection attempts
        const onClose = () => setStatus('offline');

        const onPresenceChange = () => {
            const list = [];
            awareness.getStates().forEach((state, clientId) => {
                if (state.user) {
                    list.push({ clientId, ...state.user, isSelf: clientId === awareness.clientID });
                }
            });
            list.sort((a, b) => b.isSelf - a.isSelf || a.name.localeCompare(b.name));
            setUsers(list);
        };

        provider.on('status', onStatus);
        provider.on('sync', onSync);
        provider.on('connection-close', onClose);
        awareness.on('change', onPresenceChange);

        // Quill inserts its toolbar as a sibling of the element it's given, so
        // mount into a child element and clear the whole container on cleanup
        const container = containerRef.current;
        const editorEl = document.createElement('div');
        container.appendChild(editorEl);

        const editor = new Quill(editorEl, {
            modules: {
                cursors: true,
                toolbar: [['bold', 'italic', 'underline'], [{ header: 1 }, { header: 2 }]],
                history: { userOnly: true }
            },
            placeholder: 'Start typing…',
            theme: 'snow'
        });

        const binding = new QuillBinding(ydoc.getText('quill'), editor, awareness);

        awareness.setLocalStateField('user', {
            name: `Anonymous ${pick(ANIMALS)}`,
            color: pick(CURSOR_COLORS)
        });

        return () => {
            provider.off('status', onStatus);
            provider.off('sync', onSync);
            provider.off('connection-close', onClose);
            awareness.off('change', onPresenceChange);
            binding.destroy();
            provider.destroy();
            ydoc.destroy();
            container.innerHTML = '';
        };
    }, [docId, syncUrl]);

    return (
        <section className="editor-panel">
            <div className="editor-bar">
                <div className={`status status--${status}`} role="status">
                    <span className="status-dot" aria-hidden="true" />
                    {STATUS_LABELS[status]}
                </div>
                <ul className="presence" aria-label="People in this document">
                    {users.map(user => (
                        <li key={user.clientId} className="presence-user" title={user.name}>
                            <span className="presence-avatar" style={{ backgroundColor: user.color }} aria-hidden="true">
                                {user.name.split(' ').pop()[0]}
                            </span>
                            <span className="presence-name">
                                {user.name}{user.isSelf && ' (you)'}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
            <div ref={containerRef} className="editor" />
        </section>
    );
}
