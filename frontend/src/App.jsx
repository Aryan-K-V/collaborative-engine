import { useState } from 'react';
import Editor from './Editor';
import './App.css';

const SYNC_URL = import.meta.env.VITE_SYNC_URL || 'ws://localhost:3001/doc';

// The document lives in the URL (?doc=<id>) so the link can be shared.
// Visiting without one starts a fresh document.
function resolveDocId() {
    const params = new URLSearchParams(window.location.search);
    let docId = params.get('doc')?.trim();
    if (!docId) {
        docId = Math.random().toString(36).slice(2, 10);
        params.set('doc', docId);
        window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
    }
    return docId;
}

function App() {
    const [docId] = useState(resolveDocId);
    const [copyState, setCopyState] = useState('idle');

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
        setTimeout(() => setCopyState('idle'), 2500);
    };

    return (
        <main className="desk">
            <header className="desk-head">
                <h1 className="product">Real-Time Collaborative Engine</h1>
                <div className="share">
                    <span className="doc-name" title="Document ID">{docId}</span>
                    <button type="button" className="button" onClick={copyLink}>
                        {copyState === 'copied' ? 'Link copied' : 'Copy link'}
                    </button>
                    {copyState === 'failed' && (
                        <span className="share-hint" role="alert">Copy the link from the address bar.</span>
                    )}
                </div>
            </header>

            <Editor docId={docId} syncUrl={SYNC_URL} />
        </main>
    );
}

export default App;
