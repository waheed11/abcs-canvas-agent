"use client";
import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  addEdge,
  Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Node Color Rules
const getColorForType = (type: string) => {
  switch(type) {
    case 'A': return '#FBBF24'; // Yellow
    case 'B': return '#60A5FA'; // Blue
    case 'C': return '#F87171'; // Red
    case 'D': return '#34D399'; // Green
    case 'E': return '#9CA3AF'; // Gray
    default: return '#E5E7EB';
  }
};

const createNodeStyle = (type: string) => ({
  borderRadius: '8px', 
  width: 150, 
  padding: '10px',
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center',
  background: 'white',
  border: `2px solid ${getColorForType(type)}`,
  borderLeft: `8px solid ${getColorForType(type)}`,
  fontWeight: 'bold',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  fontSize: '12px'
});

export default function Canvas({ ws, activeTab }: { ws: WebSocket | null, activeTab: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Listen for WebSocket commands to draw nodes
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'canvas_update' && data.action === 'add_nodes') {
          // Add a central B node
          const targetNodeId = `B-${Date.now()}`;
          const newBNode: Node = {
            id: targetNodeId,
            position: { x: 300, y: 150 },
            data: { label: 'Extracted Source' },
            style: createNodeStyle('B')
          };

          const newNodes: Node[] = [newBNode];
          const newEdges: Edge[] = [];

          // Add surrounding A nodes
          let i = 0;
          for (const [category, count] of Object.entries(data.atomics || {})) {
            // Cap at 5 nodes per category for visual sanity in UI
            const visualCount = Math.min(count as number, 5); 
            for (let j = 0; j < visualCount; j++) {
               const id = `A-${Date.now()}-${i}-${j}`;
               newNodes.push({
                 id,
                 position: { x: 100 + (j * 160), y: 300 + (i * 100) },
                 data: { label: `${category} ${j+1}` },
                 style: createNodeStyle('A')
               });
               newEdges.push({
                 id: `e-${targetNodeId}-${id}`,
                 source: targetNodeId,
                 target: id,
                 animated: true,
                 style: { stroke: '#9CA3AF', strokeWidth: 2 }
               });
            }
            i++;
          }

          setNodes((nds) => [...nds, ...newNodes]);
          setEdges((eds) => [...eds, ...newEdges]);
        }
      } catch (e) {
        console.error("Canvas msg parse error", e);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    []
  );

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#f9fafb' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
