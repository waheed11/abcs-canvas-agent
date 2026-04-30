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
    boxShadow: `0 4px 14px -2px ${getColorForType(type)}66`,
    fontSize: type === 'B' ? '14px' : '10px',
    textAlign: 'center' as const,
    padding: '4px',
    border: `3px solid ${getColorForType(type)}33`,
    overflow: 'hidden' as const,
    wordBreak: 'break-all' as const,
    lineHeight: '1.1',
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
          // Central Source Node (B) — placed at center of canvas
          const targetNodeId = `B-${Date.now()}`;
          const centerX = 400;
          const centerY = 350;
          
          const newBNode: Node = {
            id: targetNodeId,
            position: { x: centerX - 50, y: centerY - 50 }, // offset by half size so center aligns
            data: { label: 'Source' },
            style: createNodeStyle('B')
          };

          const newNodes: Node[] = [newBNode];
          const newEdges: Edge[] = [];

          // Flatten atomics into an array
          const atomicsList: {id: string, label: string}[] = [];
          let categoryIndex = 0;
          for (const [category, count] of Object.entries(data.atomics || {})) {
            const visualCount = Math.min(count as number, 5); // Max 5 per category for UI
            for (let j = 0; j < visualCount; j++) {
               atomicsList.push({
                 id: `A-${Date.now()}-${categoryIndex}-${j}`,
                 label: `${category.substring(0,3)} ${j+1}`
               });
            }
            categoryIndex++;
          }

          // ====== FULL 360° MULTI-RING LAYOUT ======
          const totalAtomics = atomicsList.length;
          const maxPerRing = 12; // max nodes in one ring before we start a new ring
          const ringGap = 120;  // spacing between concentric rings
          const baseRadius = 180;

          let placed = 0;
          let ringIndex = 0;

          while (placed < totalAtomics) {
            const ringCapacity = Math.min(maxPerRing + ringIndex * 4, totalAtomics - placed);
            const nodesInThisRing = Math.min(ringCapacity, totalAtomics - placed);
            const radius = baseRadius + ringIndex * ringGap;

            // Start angle offset so rings don't line up perfectly
            const ringOffset = ringIndex * 0.3;

            for (let i = 0; i < nodesInThisRing; i++) {
              const atomic = atomicsList[placed + i];
              
              // Full 360° distribution: angle from 0 to 2π
              const angle = ringOffset + (i / nodesInThisRing) * Math.PI * 2;
              
              const x = centerX + radius * Math.cos(angle) - 30; // offset by half node size (60/2)
              const y = centerY + radius * Math.sin(angle) - 30;
              
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
                style: { stroke: '#d1d5db', strokeWidth: 1.5 }
              });
            }

            placed += nodesInThisRing;
            ringIndex++;
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
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={24} color="#e5e7eb" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
