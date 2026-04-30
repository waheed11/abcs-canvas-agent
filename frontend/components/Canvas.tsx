"use client";
import React, { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
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
  Connection,
  useReactFlow,
  ReactFlowProvider
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
    case 'draft': return '#FB923C'; // Orange for drafts
    default: return '#E5E7EB';
  }
};

const createNodeStyle = (type: string) => {
  const isDraft = type === 'draft';
  const size = type === 'B' ? 100 : (isDraft ? 70 : 60);
  return {
    borderRadius: '50%', 
    width: size,
    height: size,
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: isDraft ? 'white' : getColorForType(type),
    color: isDraft ? '#FB923C' : 'white',
    fontWeight: 'bold',
    boxShadow: isDraft 
      ? '0 4px 14px -2px rgba(251, 146, 60, 0.4)' 
      : `0 4px 14px -2px ${getColorForType(type)}66`,
    fontSize: type === 'B' ? '14px' : (isDraft ? '11px' : '10px'),
    textAlign: 'center' as const,
    padding: '4px',
    border: isDraft ? '3px dashed #FB923C' : `3px solid ${getColorForType(type)}33`,
    overflow: 'hidden' as const,
    wordBreak: 'break-all' as const,
    lineHeight: '1.1',
    cursor: isDraft ? 'grab' : 'default',
  };
};

interface CanvasProps {
  ws: WebSocket | null;
  activeSessionId: string;
  onDraftDragStart?: (e: any, draftId: string) => void;
}

const CanvasInner = forwardRef(function CanvasInner(
  { ws, activeSessionId, onDraftDragStart }: CanvasProps,
  ref: React.Ref<{ addDraftCircle: (id: string) => void }>
) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // Expose addDraftCircle to parent
  useImperativeHandle(ref, () => ({
    addDraftCircle: (id: string) => {
      const newNode: Node = {
        id: id,
        position: { x: 350, y: 300 }, // Center of canvas
        data: { label: 'New' },
        style: createNodeStyle('draft'),
        draggable: true,
      };
      setNodes(prev => [...prev, newNode]);
    }
  }));

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
          const centerY = 350;
          
          const newBNode: Node = {
            id: targetNodeId,
            position: { x: centerX - 50, y: centerY - 50 },
            data: { label: 'Source' },
            style: createNodeStyle('B')
          };

          const newNodes: Node[] = [newBNode];
          const newEdges: Edge[] = [];

          // Flatten atomics into an array
          const atomicsList: {id: string, label: string}[] = [];
          let categoryIndex = 0;
          for (const [category, count] of Object.entries(data.atomics || {})) {
            const visualCount = Math.min(count as number, 5);
            for (let j = 0; j < visualCount; j++) {
               atomicsList.push({
                 id: `A-${Date.now()}-${categoryIndex}-${j}`,
                 label: `${category.substring(0,3)} ${j+1}`
               });
            }
            categoryIndex++;
          }

          // Full 360° multi-ring layout
          const totalAtomics = atomicsList.length;
          const maxPerRing = 12;
          const ringGap = 120;
          const baseRadius = 180;

          let placed = 0;
          let ringIndex = 0;

          while (placed < totalAtomics) {
            const nodesInThisRing = Math.min(maxPerRing + ringIndex * 4, totalAtomics - placed);
            const radius = baseRadius + ringIndex * ringGap;
            const ringOffset = ringIndex * 0.3;

            for (let i = 0; i < nodesInThisRing; i++) {
              const atomic = atomicsList[placed + i];
              const angle = ringOffset + (i / nodesInThisRing) * Math.PI * 2;
              
              const x = centerX + radius * Math.cos(angle) - 30;
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

          // Remove any draft nodes from canvas (they've been consumed)
          setNodes(nds => [...nds.filter(n => !n.id.startsWith('draft-')), ...newNodes]);
          setEdges(eds => [...eds, ...newEdges]);
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
  );
});

// Wrapper to provide ReactFlowProvider
const Canvas = forwardRef(function Canvas(props: CanvasProps, ref: React.Ref<{ addDraftCircle: (id: string) => void }>) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#f9fafb' }}>
      <ReactFlowProvider>
        <CanvasInner {...props} ref={ref} />
      </ReactFlowProvider>
    </div>
  );
});

export default Canvas;
