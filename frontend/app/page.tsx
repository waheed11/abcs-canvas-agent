"use client";
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { connectWebSocket } from '@/lib/websocket';

// React Flow must be dynamically imported to avoid SSR issues
const Canvas = dynamic(() => import('@/components/Canvas'), { ssr: false });

export default function Home() {
  const [messages, setMessages] = useState<string[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const socket = connectWebSocket('ws://localhost:8000/ws', (data) => {
      setMessages(prev => [...prev, JSON.stringify(data)]);
    });
    setWs(socket);
    return () => socket.close();
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 text-gray-900">
      {/* Left Toolbar - Agents */}
      <div className="w-16 bg-gray-900 flex flex-col items-center py-4 border-r border-gray-800 shrink-0">
        <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center text-white font-bold mb-4 cursor-pointer hover:bg-indigo-400">H</div>
        <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:bg-gray-600">O</div>
      </div>

      {/* Left Panel - Vault Tree */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 font-semibold">Vault (Root)</div>
        <div className="flex-1 overflow-y-auto p-4 text-sm space-y-2">
          <div><span className="text-yellow-500 mr-2">📁</span>A - Atomic</div>
          <div className="ml-4 text-gray-600">📁 Concepts</div>
          <div className="ml-4 text-gray-600">📁 Principles</div>
          <div><span className="text-blue-500 mr-2">📁</span>B - Build</div>
          <div className="ml-4 text-gray-600">📁 Books</div>
          <div><span className="text-green-500 mr-2">📁</span>C - Control</div>
          <div><span className="text-purple-500 mr-2">📁</span>D - Deliveries</div>
          <div><span className="text-red-500 mr-2">📁</span>E - Evaluate</div>
        </div>
      </div>

      {/* Center Canvas & Bottom Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Canvas Area */}
        <div className="flex-1 relative">
          <Canvas />
          <button className="absolute top-4 right-4 bg-white shadow-md rounded-lg px-4 py-2 text-sm font-medium border border-gray-200 hover:bg-gray-50 z-10">
            + New Node
          </button>
        </div>

        {/* Bottom Panel - Chat */}
        <div className="h-48 border-t border-gray-200 bg-white p-4 flex flex-col z-10 relative">
          <div className="font-semibold mb-2">Chat with AI agent</div>
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded p-2 text-sm text-gray-600 mb-2">
            {messages.length === 0 ? "Agent is ready... (WebSocket connected)" : messages.map((m, i) => <div key={i}>{m}</div>)}
          </div>
          <input type="text" placeholder="Type a message..." className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
        </div>
      </div>

      {/* Right Panel - Sessions List */}
      <div className="w-64 bg-white border-l border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 font-semibold">Sessions List</div>
        <div className="p-4 text-sm text-gray-600">
          <div className="mb-4">
            <div className="font-medium text-gray-800">Session 20260430</div>
            <div className="pl-2 mt-1 text-indigo-600 cursor-pointer">Reading The Safekeep</div>
          </div>
        </div>
      </div>
    </div>
  );
}
