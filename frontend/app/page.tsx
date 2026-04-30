"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { connectWebSocket } from '@/lib/websocket';

// React Flow dynamically imported
const Canvas = dynamic(() => import('@/components/Canvas'), { ssr: false });

export default function Home() {
  const [messages, setMessages] = useState<any[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [vaultTree, setVaultTree] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("session-main");
  const [activeAgent, setActiveAgent] = useState("Hermes");
  const [agentMetadata, setAgentMetadata] = useState<string>("");
  const [isAgentInfoOpen, setIsAgentInfoOpen] = useState(false);
  const [draftNodes, setDraftNodes] = useState<number>(0);

  const fetchSessions = () => {
    fetch("http://localhost:8000/api/sessions")
      .then(res => res.json())
      .then(data => setSessions(data.sessions || []))
      .catch(err => console.error("Failed to fetch sessions:", err));
  };

  useEffect(() => {
    // Fetch Vault Tree
    fetch("http://localhost:8000/api/vault/tree")
      .then(res => res.json())
      .then(data => setVaultTree(data.tree))
      .catch(err => console.error("Failed to fetch vault tree:", err));

    fetchSessions();

    // Connect WebSocket
    const socket = connectWebSocket('ws://localhost:8000/ws', (data) => {
      if (data.type === 'system') {
        setAgentMetadata(data.message);
        setMessages(prev => [...prev, data]);
      } else if (data.type === 'chat') {
        setMessages(prev => [...prev, data]);
        // Refresh sessions when tasks complete
        fetchSessions();
      }
    });
    setWs(socket);
    return () => socket.close();
  }, []);

  const handleDragStart = (e: any, type: string) => {
    e.dataTransfer.setData("application/reactflow", type);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropToFolder = (e: any, folderPath: string) => {
    e.preventDefault();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "node_drop",
        folder: folderPath,
        sessionId: activeSessionId,
        taskId: `task-${Date.now()}`
      }));
      // Remove a draft node if we successfully dropped one
      if (draftNodes > 0) setDraftNodes(d => d - 1);
    }
  };

  const createDraftNode = () => {
    setDraftNodes(prev => prev + 1);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      {/* Left Toolbar - Agents */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-4 border-r border-gray-800 shrink-0 shadow-lg z-20">
        <div 
          onClick={() => setActiveAgent("Hermes")}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mb-4 cursor-pointer transition-all ${activeAgent === "Hermes" ? "bg-indigo-500 ring-2 ring-white scale-110" : "bg-gray-700 hover:bg-gray-600"}`}
          title="Hermes Agent"
        >
          H
        </div>
        <div 
          onClick={() => setActiveAgent("OpenClaw")}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mb-4 cursor-pointer transition-all ${activeAgent === "OpenClaw" ? "bg-orange-500 ring-2 ring-white scale-110" : "bg-gray-700 hover:bg-gray-600"}`}
          title="OpenClaw Agent"
        >
          O
        </div>
        <div 
          onClick={() => setActiveAgent("Mercury")}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold cursor-pointer transition-all ${activeAgent === "Mercury" ? "bg-blue-500 ring-2 ring-white scale-110" : "bg-gray-700 hover:bg-gray-600"}`}
          title="Mercury Agent"
        >
          M
        </div>
      </div>

      {/* Left Panel - Vault Tree */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 z-10 shadow-sm">
        <div className="p-4 border-b border-gray-200 font-semibold bg-gray-50 flex justify-between items-center">
          <span>Vault (Root)</span>
          <button 
            onClick={createDraftNode} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 hover:text-indigo-800 font-bold transition-colors" 
            title="Create Draft Node"
          >
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm space-y-3">
          
          {/* Draft Nodes */}
          {draftNodes > 0 && (
             <div className="mb-4 pb-4 border-b border-dashed border-gray-300">
                <div className="text-xs text-gray-400 mb-3 uppercase font-bold tracking-wider">Draft Nodes</div>
                {Array.from({ length: draftNodes }).map((_, idx) => (
                  <div 
                    key={`draft-${idx}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, 'draft')}
                    className="flex items-center justify-center w-12 h-12 bg-yellow-400 border-2 border-white rounded-full cursor-grab active:cursor-grabbing hover:scale-105 transition-transform shadow-md mx-auto mb-2 text-white font-bold text-xs"
                    title="Drag me to a folder"
                  >
                    Draft
                  </div>
                ))}
                <div className="text-center text-xs text-gray-500 mt-2">Drag to a folder</div>
             </div>
          )}

          {/* Actual Tree */}
          {vaultTree.length === 0 ? <p className="text-gray-400">Loading tree...</p> : vaultTree.map((node: any) => (
            <div key={node.path} className="mb-2">
              <div className="font-medium text-gray-800 flex items-center">
                <span className="mr-2">📁</span> {node.name}
              </div>
              {node.children && node.children.map((child: any) => (
                <div 
                  key={child.path} 
                  className="ml-6 py-1.5 text-gray-600 hover:text-indigo-600 cursor-pointer border-l-2 border-transparent hover:border-indigo-500 pl-2 transition-colors rounded-r hover:bg-indigo-50"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDropToFolder(e, child.path)}
                >
                  📄 {child.name}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Center Canvas & Bottom Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        
        {/* Header - No Tabs */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shadow-sm z-10">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-indigo-600">ABCs Canvas</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600 font-medium text-base truncate">
              {activeSessionId}
            </span>
          </h1>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <Canvas ws={ws} activeSessionId={activeSessionId} />
        </div>

        {/* Bottom Panel - Chat */}
        <div className="h-56 border-t border-gray-200 bg-white p-4 flex flex-col z-10 relative shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)]">
          <div className="font-semibold mb-3 text-gray-800 flex justify-between items-center">
            <span>Chat with {activeAgent}</span>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded border border-green-200">Online</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-md p-4 text-sm text-gray-700 mb-3 border border-gray-200 font-mono shadow-inner">
            {messages.length === 0 ? (
              <span className="text-gray-400 italic">Connecting to agent...</span>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`mb-3 pb-2 border-b border-gray-100 last:border-0 ${m.sender === 'System' ? 'text-gray-500' : 'text-indigo-900'}`}>
                  <strong className="block mb-1 opacity-75 text-xs uppercase tracking-wider">{m.sender || 'System'}</strong>
                  <div className="whitespace-pre-wrap">{m.message}</div>
                </div>
              ))
            )}
          </div>
          <input 
            type="text" 
            placeholder={`Type a message to ${activeAgent}...`} 
            className="w-full border border-gray-300 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" 
          />
        </div>
      </div>

      {/* Right Panel - Sessions List & Agent Info */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col shrink-0 shadow-[-4px_0_10px_-1px_rgba(0,0,0,0.02)] z-10">
        
        {/* Agent Info Accordion (Secondary) */}
        <div className="border-b border-gray-200">
          <button 
            onClick={() => setIsAgentInfoOpen(!isAgentInfoOpen)}
            className="w-full p-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition-colors font-semibold text-gray-800"
          >
            <span className="flex items-center gap-2">🤖 Agent Info</span>
            <span className="text-gray-400 text-xs">{isAgentInfoOpen ? '▲ COLLAPSE' : '▼ EXPAND'}</span>
          </button>
          
          {isAgentInfoOpen && (
            <div className="p-4 text-sm text-gray-600 bg-white shadow-inner border-t border-gray-100">
              <div className="mb-3 flex items-center justify-between">
                <strong>Active Engine:</strong> 
                <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded font-bold border border-indigo-200">{activeAgent}</span>
              </div>
              <div className="mb-2"><strong>Status:</strong> {agentMetadata ? 'Connected' : 'Connecting...'}</div>
              <div className="mb-2"><strong>Memory:</strong> Persistent SQLite</div>
            </div>
          )}
        </div>

        {/* Sessions List (Primary) */}
        <div className="p-4 border-b border-gray-200 font-semibold bg-white flex items-center justify-between">
          <span>📚 Sessions History</span>
          <button 
            onClick={() => {
              const newSessionId = `session-${new Date().toISOString()}`;
              setActiveSessionId(newSessionId);
              setMessages([]); // Clear chat for new session
            }}
            className="text-xs bg-gray-900 text-white px-2 py-1 rounded hover:bg-gray-800 transition-colors"
          >
            New Session
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 text-sm text-gray-600 space-y-4 bg-gray-50">
          {sessions.length === 0 ? (
            <p className="text-gray-400 italic text-center py-8">No historical sessions found.</p>
          ) : (
            sessions.map((session, idx) => (
              <div 
                key={session.session_id} 
                className={`bg-white border rounded-lg shadow-sm overflow-hidden transition-all ${activeSessionId === session.session_id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 cursor-pointer'}`}
                onClick={() => setActiveSessionId(session.session_id)}
              >
                <div className="bg-gray-100 p-2.5 font-mono text-xs text-gray-500 flex justify-between items-center border-b border-gray-100">
                  <span>{new Date(session.created_at).toLocaleString()}</span>
                </div>
                
                <div className="p-3">
                  {session.tasks && session.tasks.length > 0 ? (
                    <ul className="space-y-3">
                      {session.tasks.map((task: any) => (
                        <li key={task.task_id} className="text-xs border-l-2 border-indigo-400 pl-3">
                          <div className="font-bold text-gray-800 truncate text-[13px]">{task.task_name}</div>
                          <div className="text-gray-500 flex justify-between mt-1.5">
                            <span className="bg-gray-100 px-1.5 py-0.5 rounded">{task.main_agent}</span>
                            <span className={`font-medium ${task.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                              {task.status}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No tasks in this session.</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
