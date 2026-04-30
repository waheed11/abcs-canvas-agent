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

const createNodeStyle = (type: string) => {
  const size = type === 'B' ? 100 : 60;
  return {
    borderRadius: '50%', 
    width: size,
    height: size,
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: getColorForType(type),
    color: 'white',
    fontWeight: 'bold',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    fontSize: type === 'B' ? '14px' : '10px',
    textAlign: 'center' as const,
    padding: '8px',
    border: '2px solid white'
  };
};

export default function Canvas({ ws, activeSessionId }: { ws: WebSocket | null, activeSessionId: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Listen for WebSocket commands to draw nodes
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'canvas_update' && data.action === 'add_nodes') {
          // Central Source Node (B)
          const targetNodeId = `B-${Date.now()}`;
          const centerX = 400;
          const centerY = 150;
          
          const newBNode: Node = {
            id: targetNodeId,
            position: { x: centerX, y: centerY },
            data: { label: 'Source' },
            style: createNodeStyle('B')
          };

          const newNodes: Node[] = [newBNode];
          const newEdges: Edge[] = [];

          // Flatten atomics into an array
          const atomicsList: {id: string, label: string}[] = [];
          let categoryIndex = 0;
          for (const [category, count] of Object.entries(data.atomics || {})) {
            const visualCount = Math.min(count as number, 6); // Max 6 per category for UI
            for (let j = 0; j < visualCount; j++) {
               atomicsList.push({
                 id: `A-${Date.now()}-${categoryIndex}-${j}`,
                 label: `${category.substring(0,3)} ${j+1}`
               });
            }
            categoryIndex++;
          }

          // Radial layout algorithm (Arc below the source)
          const totalAtomics = atomicsList.length;
          const radius = Math.max(180, totalAtomics * 20); // Scale radius based on count
          
          atomicsList.forEach((atomic, index) => {
             // Map index to an angle between Math.PI * 0.1 and Math.PI * 0.9
             // If only 1 node, put it straight down (Math.PI / 2)
             let angle = Math.PI / 2;
             if (totalAtomics > 1) {
                 const minAngle = Math.PI * 0.1;
                 const maxAngle = Math.PI * 0.9;
                 angle = minAngle + (index / (totalAtomics - 1)) * (maxAngle - minAngle);
             }
             
             // X and Y in React Flow (Y grows downwards)
             const x = centerX + radius * Math.cos(angle);
             const y = centerY + radius * Math.sin(angle);
             
             newNodes.push({
               id: atomic.id,
               position: { x, y },
               data: { label: atomic.label },
               style: createNodeStyle('A')
             });
             
             newEdges.push({
               id: `e-${targetNodeId}-${atomic.id}`,
               source: targetNodeId,
               target: atomic.id,
               animated: true,
               style: { stroke: '#9CA3AF', strokeWidth: 2, strokeDasharray: 'none' } // Solid animated line
             });
          });

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
