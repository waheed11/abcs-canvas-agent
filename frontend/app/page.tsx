"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { connectWebSocket } from '@/lib/websocket';

// React Flow dynamically imported
const Canvas = dynamic(() => import('@/components/Canvas'), { ssr: false });

// ABCs pillar colors for root folders
const pillarColors: Record<string, string> = {
  A: 'text-yellow-600',
  B: 'text-blue-600',
  C: 'text-red-600',
  D: 'text-green-600',
  E: 'text-gray-500',
};

// Recursive tree node component
function TreeNode({ node, onDropToFolder, depth }: { 
  node: any, 
  onDropToFolder: (e: any, path: string) => void, 
  depth: number,
}) {
  const [isOpen, setIsOpen] = useState(depth < 1); // auto-expand root level
  const [isDragOver, setIsDragOver] = useState(false);
  const isDir = node.type === 'directory';
  const hasChildren = isDir && node.children && node.children.length > 0;
  const isRoot = depth === 0;
  const rootColor = isRoot ? (pillarColors[node.name] || 'text-gray-800') : '';

  if (!isDir) {
    // File leaf node
    return (
      <div
        className="flex items-center gap-1.5 py-1 pl-2 text-gray-500 text-xs hover:text-gray-700 rounded hover:bg-gray-50 transition-colors cursor-default"
        style={{ marginLeft: depth * 16 }}
      >
        <span className="opacity-50">📄</span>
        <span className="truncate">{node.name}</span>
      </div>
    );
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    onDropToFolder(e, node.path);
  };

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1.5 cursor-pointer rounded transition-all
          ${isRoot ? 'font-semibold text-sm mb-1' : 'text-xs'}
          ${rootColor || 'text-gray-700'}
          ${isDragOver ? 'bg-indigo-100 ring-2 ring-indigo-400 ring-inset' : 'hover:bg-gray-50'}
        `}
        style={{ paddingLeft: Math.max(depth * 16, 0) }}
        onClick={() => setIsOpen(!isOpen)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="text-[10px] text-gray-400 w-3 text-center shrink-0">
          {hasChildren ? (isOpen ? '▼' : '▶') : ' '}
        </span>
        <span>{isRoot ? '📁' : (isOpen ? '📂' : '📁')}</span>
        <span className="truncate">{node.name}</span>
        {isDragOver && (
          <span className="ml-auto text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded font-bold animate-pulse">
            DROP HERE
          </span>
        )}
      </div>
      {isOpen && hasChildren && (
        <div className={isRoot ? 'border-l border-gray-200 ml-2' : 'ml-1'}>
          {node.children.map((child: any) => (
            <TreeNode key={child.path} node={child} onDropToFolder={onDropToFolder} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<any[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [vaultTree, setVaultTree] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("session-main");
  const [activeAgent, setActiveAgent] = useState("Hermes");
  const [agentMetadata, setAgentMetadata] = useState<string>("");
  const [isAgentInfoOpen, setIsAgentInfoOpen] = useState(false);
  // Draft nodes live at the vault root AND appear on the canvas
  const [draftNodes, setDraftNodes] = useState<{id: string, name: string}[]>([]);

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
        fetchSessions();
      }
    });
    setWs(socket);
    return () => socket.close();
  }, []);

  // Drag start handler for draft nodes (both tree and canvas drag to folder)
  const handleDragStartDraft = (e: any, draftId: string) => {
    e.dataTransfer.setData("application/draftId", draftId);
    e.dataTransfer.effectAllowed = "move";
  };

  // Drop handler on a folder — triggers LLM interaction
  const handleDropToFolder = (e: any, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draftId = e.dataTransfer?.getData("application/draftId") || "";
    
    console.log(`[DROP] folder=${folderPath}, draftId=${draftId}`);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "node_drop",
        folder: folderPath,
        sessionId: activeSessionId,
        taskId: `task-${Date.now()}`
      }));
      // Remove the draft node that was dropped
      if (draftId) {
        setDraftNodes(prev => prev.filter(d => d.id !== draftId));
      }
    } else {
      console.warn("[DROP] WebSocket not connected!");
    }
  };

  // Create a new draft node — appears both in tree root AND as circle on canvas
  const createNewNode = () => {
    const id = `draft-${Date.now()}`;
    const name = `New Node ${draftNodes.length + 1}`;
    setDraftNodes(prev => [...prev, { id, name }]);
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
        <div className="p-4 border-b border-gray-200 font-semibold bg-gray-50">
          Vault (Root)
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-sm space-y-1">
          
          {/* Draft nodes at vault root — visually distinct */}
          {draftNodes.length > 0 && (
            <div className="mb-3 pb-3 border-b border-dashed border-orange-300">
              {draftNodes.map((draft) => (
                <div 
                  key={draft.id}
                  draggable
                  onDragStart={(e) => handleDragStartDraft(e, draft.id)}
                  className="flex items-center gap-2 py-1.5 px-2 mb-1 border-2 border-dashed border-orange-300 rounded-md cursor-grab active:cursor-grabbing hover:border-orange-500 hover:bg-orange-50 transition-all group"
                  title="Drag this to a folder to start processing"
                >
                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center text-white text-[8px] font-bold shrink-0 group-hover:scale-110 transition-transform">◆</span>
                  <span className="text-xs text-gray-700 truncate flex-1">{draft.name}</span>
                  <span className="text-[8px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-bold shrink-0">DRAFT</span>
                </div>
              ))}
            </div>
          )}

          {/* Actual Tree — recursive, folders first then files */}
          {vaultTree.length === 0 ? <p className="text-gray-400">Loading tree...</p> : vaultTree.map((node: any) => (
            <TreeNode key={node.path} node={node} onDropToFolder={handleDropToFolder} depth={0} />
          ))}
        </div>
      </div>

      {/* Center Canvas & Bottom Chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        
        {/* Header */}
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
          <Canvas ws={ws} activeSessionId={activeSessionId} draftNodes={draftNodes} />
          
          {/* Fixed "New Node" button — top-right corner of the canvas */}
          <button
            onClick={createNewNode}
            className="absolute top-4 right-4 z-20 flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 rounded-xl shadow-lg hover:shadow-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group cursor-pointer"
            title="Create a new node on the canvas"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold group-hover:scale-110 transition-transform shadow-sm">
              +
            </div>
            <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-700">New Node</span>
          </button>
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
              setMessages([]);
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
            sessions.map((session: any) => (
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
