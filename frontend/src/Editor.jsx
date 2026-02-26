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
    offline: 'Offline. Edits sync when you reconnect.',
};

const pick = list => list[Math.floor(Math.random() * list.length)];

export default function Editor({ docId, syncUrl }) {
    const toolbarSlotRef = useRef(null);
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

        const container = containerRef.current;
        const toolbarSlot = toolbarSlotRef.current;
        const editorEl = document.createElement('div');
        container.appendChild(editorEl);

        const editor = new Quill(editorEl, {
            modules: {
                cursors: true,
                toolbar: [['bold', 'italic', 'underline'], [{ header: 1 }, { header: 2 }]],
                history: { userOnly: true }
            },
            placeholder: 'Start writing. Anyone with the link can edit with you.',
            theme: 'snow'
        });

        // Quill inserts its toolbar next to the editor; move it into the page's
        // top row so it sits alongside the status and collaborator ribbons
        toolbarSlot.appendChild(editor.getModule('toolbar').container);

        const binding = new QuillBinding(ydoc.getText('quill'), editor, awareness);

        // Pick a color nobody here is using yet, once we know who is here
        const claimIdentity = () => {
            const taken = new Set();
            awareness.getStates().forEach(state => state.user && taken.add(state.user.color));
            const free = CURSOR_COLORS.filter(color => !taken.has(color));
            awareness.setLocalStateField('user', {
                name: `Anonymous ${pick(ANIMALS)}`,
                color: pick(free.length > 0 ? free : CURSOR_COLORS)
            });
        };
        provider.once('sync', claimIdentity);

        return () => {
            provider.off('status', onStatus);
            provider.off('sync', onSync);
            provider.off('connection-close', onClose);
            awareness.off('change', onPresenceChange);
            binding.destroy();
            provider.destroy();
            ydoc.destroy();
            container.innerHTML = '';
            toolbarSlot.innerHTML = '';
        };
    }, [docId, syncUrl]);

    return (
        <article className="page">
            <div className="page-head">
                <div ref={toolbarSlotRef} className="toolbar-slot" />
                <p className={`status status--${status}`} role="status">
                    <span className="status-dot" aria-hidden="true" />
                    {STATUS_LABELS[status]}
                </p>
                <ul className="ribbons" aria-label="People in this document">
                    {users.map(user => (
                        <li
                            key={user.clientId}
                            className={`ribbon${user.isSelf ? ' ribbon--self' : ''}`}
                            style={{ '--ribbon-color': user.color }}
                            tabIndex={0}
                        >
                            <span className="ribbon-shape" aria-hidden="true" />
                            <span className="ribbon-name">
                                {user.name}{user.isSelf && ' (you)'}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
            <div ref={containerRef} className="page-body" />
        </article>
    );
}
