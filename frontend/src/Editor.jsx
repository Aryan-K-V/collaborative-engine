import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Quill from 'quill';
import { QuillBinding } from 'y-quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';

Quill.register('modules/cursors', QuillCursors);

export default function Editor({ docId }) {
    const editorRef = useRef(null);

    useEffect(() => {
        const ydoc = new Y.Doc();
        
        // Connect to your Node.js Sync Service
        const provider = new WebsocketProvider(
            'ws://localhost:3001/doc',
            docId,
            ydoc
        );

        const ytext = ydoc.getText('quill');

        const editor = new Quill(editorRef.current, {
            modules: {
                cursors: true,
                toolbar: [['bold', 'italic', 'underline'], [{ header: 1 }, { header: 2 }]],
                history: { userOnly: true }
            },
            theme: 'snow'
        });

        const binding = new QuillBinding(ytext, editor, provider.awareness);

        provider.awareness.setLocalStateField('user', {
            name: `User ${Math.floor(Math.random() * 1000)}`,
            color: '#' + Math.floor(Math.random()*16777215).toString(16)
        });

        return () => {
            binding.destroy();
            provider.disconnect();
            ydoc.destroy();
            if (editorRef.current) editorRef.current.innerHTML = '';
        };
    }, [docId]);

    return (
        <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontFamily: 'sans-serif' }}>Editing Document: {docId}</h3>
            <div ref={editorRef} style={{ height: '400px', backgroundColor: '#fff' }} />
        </div>
    );
}