import Editor from './Editor';
import './App.css'; // Optional: keep if you want default Vite styles, or remove if unneeded

function App() {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ fontFamily: 'sans-serif', color: '#333', textAlign: 'center' }}>
        Real-Time Collaborative Engine
      </h1>
      
      {/* We are using 'crdt-demo-1' as the room/document ID */}
      <Editor docId="crdt-demo-1" />
    </div>
  );
}

export default App;