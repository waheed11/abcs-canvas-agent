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
  const [activeTab, setActiveTab] = useState<string>("main");
  const [tabs, setTabs] = useState([{ id: "main", title: "Main Canvas" }]);
  const [activeAgent, setActiveAgent] = useState("Hermes");
  const [agentMetadata, setAgentMetadata] = useState<string>("");

  useEffect(() => {
    // Fetch Vault Tree from backend
    fetch("http://localhost:8000/api/vault/tree")
      .then(res => res.json())
      .then(data => setVaultTree(data.tree))
      .catch(err => console.error("Failed to fetch vault tree:", err));

    // Connect WebSocket
    const socket = connectWebSocket('ws://localhost:8000/ws', (data) => {
      if (data.type === 'system') {
        setAgentMetadata(data.message);
        setMessages(prev => [...prev, data]);
      } else if (data.type === 'chat') {
        setMessages(prev => [...prev, data]);
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
        sessionId: `session-${new Date().toISOString()}`,
        taskId: activeTab
      }));
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      {/* Left Toolbar - Agents */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-4 border-r border-gray-800 shrink-0">
        <div 
          onClick={() => setActiveAgent("Hermes")}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mb-4 cursor-pointer transition-all ${activeAgent === "Hermes" ? "bg-indigo-500 ring-2 ring-white" : "bg-gray-700 hover:bg-gray-600"}`}
          title="Hermes Agent"
        >
          H
        </div>
        <div 
          onClick={() => setActiveAgent("OpenClaw")}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mb-4 cursor-pointer transition-all ${activeAgent === "OpenClaw" ? "bg-orange-500 ring-2 ring-white" : "bg-gray-700 hover:bg-gray-600"}`}
          title="OpenClaw Agent"
        >
          O
        </div>
        <div 
          onClick={() => setActiveAgent("Mercury")}
          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold cursor-pointer transition-all ${activeAgent === "Mercury" ? "bg-blue-500 ring-2 ring-white" : "bg-gray-700 hover:bg-gray-600"}`}
          title="Mercury Agent"
        >
          M
        </div>
      </div>

      {/* Left Panel - Vault Tree */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 font-semibold bg-gray-50">Vault (Root)</div>
        <div className="flex-1 overflow-y-auto p-4 text-sm space-y-3">
          {vaultTree.length === 0 ? <p className="text-gray-400">Loading tree...</p> : vaultTree.map((node: any) => (
            <div key={node.path} className="mb-2">
              <div className="font-medium text-gray-800 flex items-center">
                <span className="mr-2">📁</span> {node.name}
              </div>
              {node.children && node.children.map((child: any) => (
                <div 
                  key={child.path} 
                  className="ml-6 py-1 text-gray-600 hover:text-indigo-600 cursor-pointer border-l-2 border-transparent hover:border-indigo-500 pl-2 transition-colors"
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
        
        {/* Tab Header */}
        <div className="h-10 bg-white border-b border-gray-200 flex items-center px-2">
          {tabs.map(tab => (
            <div 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium cursor-pointer border-b-2 transition-colors ${activeTab === tab.id ? "border-indigo-500 text-indigo-600 bg-indigo-50" : "border-transparent text-gray-500 hover:text-gray-800"}`}
            >
              {tab.title}
            </div>
          ))}
          <button 
            onClick={() => setTabs([...tabs, { id: `task-${Date.now()}`, title: "New Task" }])}
            className="ml-2 text-gray-400 hover:text-gray-800 px-2 font-bold"
          >
            +
          </button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative">
          <Canvas ws={ws} activeTab={activeTab} />
          
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <div 
              className="bg-white shadow-md rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 cursor-grab active:cursor-grabbing hover:bg-gray-50 flex items-center gap-2"
              draggable
              onDragStart={(e) => handleDragStart(e, 'A')}
            >
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              New Node (Drag to folder)
            </div>
          </div>
        </div>

        {/* Bottom Panel - Chat */}
        <div className="h-48 border-t border-gray-200 bg-white p-4 flex flex-col z-10 relative shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="font-semibold mb-2 text-gray-800 flex justify-between items-center">
            <span>Chat with {activeAgent}</span>
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-md p-3 text-sm text-gray-700 mb-3 border border-gray-100 font-mono">
            {messages.length === 0 ? (
              <span className="text-gray-400 italic">Connecting to agent...</span>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`mb-2 ${m.sender === 'System' ? 'text-gray-500' : 'text-indigo-800'}`}>
                  <strong>{m.sender || 'System'}: </strong>
                  {m.message}
                </div>
              ))
            )}
          </div>
          <input 
            type="text" 
            placeholder={`Type a message to ${activeAgent}...`} 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm" 
          />
        </div>
      </div>

      {/* Right Panel - Sessions List & Agent Info */}
      <div className="w-72 bg-white border-l border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 font-semibold bg-gray-50 flex justify-between items-center">
          <span>Agent Info</span>
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">{activeAgent}</span>
        </div>
        <div className="p-4 text-sm text-gray-600 border-b border-gray-100">
          <div className="mb-2"><strong>Status:</strong> {agentMetadata ? 'Connected' : 'Connecting...'}</div>
          <div className="mb-2"><strong>Model:</strong> {activeAgent === "Hermes" ? "Hermes 3.2" : "Local Model"}</div>
          <div className="mb-2"><strong>Memory:</strong> Persistent SQLite</div>
          <div className="mb-2"><strong>Tools:</strong> UI Simulator, File System, Subprocess</div>
        </div>

        <div className="p-4 border-b border-gray-200 font-semibold bg-gray-50">Task Progress</div>
        <div className="flex-1 overflow-y-auto p-4 text-sm text-gray-600">
          {/* Example live task tracking */}
          <div className="mb-4 bg-white border border-gray-200 rounded p-3 shadow-sm">
            <div className="font-medium text-gray-800 mb-1 flex items-center justify-between">
              Current Task ({activeTab})
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            </div>
            <div className="text-xs text-gray-500 mb-2">Monitoring Canvas events...</div>
          </div>
        </div>
      </div>
    </div>
  );
}
