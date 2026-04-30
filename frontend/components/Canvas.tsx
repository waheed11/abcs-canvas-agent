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
  };
};

interface CanvasProps {
  ws: WebSocket | null;
  activeSessionId: string;
  draftNodes: {id: string, name: string}[];
  onSelectFolder?: (draftId: string, folderPath: string) => void;
  vaultTree?: any[];
}

export default function Canvas({ ws, activeSessionId, draftNodes, onSelectFolder, vaultTree }: CanvasProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  // Sync draft nodes from parent into canvas nodes
  useEffect(() => {
    const existingDraftIds = new Set(nodes.filter(n => n.id.startsWith('draft-')).map(n => n.id));
    const newDraftIds = new Set(draftNodes.map(d => d.id));

    const toAdd: Node[] = [];
    draftNodes.forEach((draft) => {
      if (!existingDraftIds.has(draft.id)) {
        toAdd.push({
          id: draft.id,
          position: { x: 350, y: 300 },
          data: { label: 'New' },
          style: createNodeStyle('draft'),
          draggable: true,
        });
      }
    });

    if (toAdd.length > 0 || existingDraftIds.size !== newDraftIds.size) {
      setNodes(prev => [
        ...prev.filter(n => !n.id.startsWith('draft-') || newDraftIds.has(n.id)),
        ...toAdd
      ]);
    }
  }, [draftNodes]);

  // Listen for WebSocket commands to draw nodes
  useEffect(() => {
    if (!ws) {
      console.log('[Canvas] ws is null, skipping listener setup');
      return;
    }

    console.log('[Canvas] Setting up WebSocket message listener');

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[Canvas] Received WS message:', data.type, data.action || '');
        
        if (data.type === 'canvas_update' && data.action === 'add_nodes') {
          console.log('[Canvas] Drawing nodes! Atomics:', data.atomics);
          
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

          console.log(`[Canvas] Adding ${newNodes.length} nodes, ${newEdges.length} edges`);
          
          // Remove draft nodes, add result nodes
          setNodes(nds => [...nds.filter(n => !n.id.startsWith('draft-')), ...newNodes]);
          setEdges(eds => [...eds, ...newEdges]);
        }
      } catch (e) {
        console.error("[Canvas] msg parse error", e);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  // Handle clicking a draft node on canvas → open folder picker
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.id.startsWith('draft-')) {
      setSelectedDraftId(node.id);
      setShowFolderPicker(true);
    }
  }, []);

  // Handle selecting a folder from the picker
  const handleFolderSelect = (folderPath: string) => {
    if (selectedDraftId && onSelectFolder) {
      onSelectFolder(selectedDraftId, folderPath);
    }
    setShowFolderPicker(false);
    setSelectedDraftId(null);
  };

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

  // Flatten vault tree into folder paths for the picker
  const flattenFolders = (treeNodes: any[], prefix = ''): {name: string, path: string, depth: number}[] => {
    const results: {name: string, path: string, depth: number}[] = [];
    for (const node of treeNodes) {
      if (node.type === 'directory') {
        const depth = node.path.split('/').length - 1;
        results.push({ name: node.name, path: node.path, depth });
        if (node.children) {
          results.push(...flattenFolders(node.children));
        }
      }
    }
    return results;
  };

  const folderList = vaultTree ? flattenFolders(vaultTree) : [];

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#f9fafb', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background gap={24} color="#e5e7eb" />
        <Controls />
      </ReactFlow>

      {/* Folder Picker Modal — appears when clicking a draft circle on canvas */}
      {showFolderPicker && (
        <div 
          className="absolute inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setShowFolderPicker(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 w-80 max-h-96 overflow-y-auto border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-gray-800 mb-1 text-lg">Select Target Folder</h3>
            <p className="text-xs text-gray-500 mb-4">Choose where to process this node</p>
            <div className="space-y-1">
              {folderList.map((folder) => (
                <button
                  key={folder.path}
                  onClick={() => handleFolderSelect(folder.path)}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2"
                  style={{ paddingLeft: `${12 + folder.depth * 16}px` }}
                >
                  <span>📁</span>
                  <span>{folder.name}</span>
                </button>
              ))}
            </div>
            <button 
              onClick={() => setShowFolderPicker(false)}
              className="mt-4 w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
