"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Viewport,
  type XYPosition
} from "@xyflow/react";
import type { ItemNodeData, SourceNodeData, GroupNodeData, ImportedItem, FlytState } from "../flyt-types";
import { loadFlytState, saveFlytState, clearFlytState } from "./useFlytPersist";

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function stateToRF(state: FlytState): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = state.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    ...(n.parentId ? { parentId: n.parentId, extent: "parent" as const } : {})
  }));
  const edges: Edge[] = state.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: e.animated,
    type: "flow",
    label: e.label
  }));
  return { nodes, edges };
}

function rfToState(nodes: Node[], edges: Edge[], viewport: Viewport): FlytState {
  return {
    version: 1,
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type as "item" | "group" | "source",
      position: n.position,
      data: n.data as unknown as ItemNodeData | SourceNodeData | GroupNodeData,
      ...(n.parentId ? { parentId: n.parentId, extent: "parent" as const } : {})
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.animated ?? true,
      label: typeof e.label === "string" ? e.label : undefined
    })),
    viewport
  };
}

export function useFlytStore(accountSlug: string) {
  const initialState = loadFlytState(accountSlug);
  const { nodes: initNodes, edges: initEdges } = stateToRF(initialState);

  const [nodes, setNodes] = useState<Node[]>(initNodes);
  const [edges, setEdges] = useState<Edge[]>(initEdges);
  const [viewport, setViewport] = useState<Viewport>(initialState.viewport);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Debounced persist
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const viewportRef = useRef(viewport);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  const persist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      saveFlytState(accountSlug, rfToState(nodesRef.current, edgesRef.current, viewportRef.current));
    }, 300);
  }, [accountSlug]);

  // RF callbacks
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    persist();
  }, [persist]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    persist();
  }, [persist]);

  const onConnect: OnConnect = useCallback((connection) => {
    setEdges((eds) => addEdge({ ...connection, type: "flow", animated: true }, eds));
    persist();
  }, [persist]);

  const onMoveEnd = useCallback((_: unknown, vp: Viewport) => {
    setViewport(vp);
    persist();
  }, [persist]);

  // Node operations
  const addItemNode = useCallback((pos: XYPosition = { x: 100, y: 100 }) => {
    const id = makeId();
    const node: Node = {
      id,
      type: "item",
      position: pos,
      data: { label: "Ny post", amount: 0, kind: "expense" } satisfies ItemNodeData
    };
    setNodes((nds) => [...nds, node]);
    setSelectedNodeId(id);
    persist();
    return id;
  }, [persist]);

  const addSourceNode = useCallback((label: string, pos: XYPosition = { x: 50, y: 200 }) => {
    const id = makeId();
    const node: Node = {
      id,
      type: "source",
      position: pos,
      data: { label, color: "#6366f1" } satisfies SourceNodeData
    };
    setNodes((nds) => [...nds, node]);
    persist();
    return id;
  }, [persist]);

  const addGroupNode = useCallback((label: string, pos: XYPosition = { x: 300, y: 200 }) => {
    const id = makeId();
    const node: Node = {
      id,
      type: "group",
      position: pos,
      data: { label, isExpanded: true, childIds: [] } satisfies GroupNodeData
    };
    setNodes((nds) => [...nds, node]);
    persist();
    return id;
  }, [persist]);

  const updateNodeData = useCallback((id: string, patch: Partial<ItemNodeData & SourceNodeData & GroupNodeData>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
      )
    );
    persist();
  }, [persist]);

  const deleteNode = useCallback((id: string) => {
    setNodes((nds) => {
      const updated = nds.filter((n) => n.id !== id && n.parentId !== id);
      // If this node was a child of a group, update group's childIds
      return updated.map((n) => {
        if (n.type === "group") {
          const data = n.data as unknown as GroupNodeData;
          return { ...n, data: { ...data, childIds: data.childIds.filter((c) => c !== id) } };
        }
        return n;
      });
    });
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId((sel) => (sel === id ? null : sel));
    persist();
  }, [persist]);

  const addToGroup = useCallback((nodeId: string, groupId: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === groupId) {
          const data = n.data as unknown as GroupNodeData;
          if (data.childIds.includes(nodeId)) return n;
          return { ...n, data: { ...data, childIds: [...data.childIds, nodeId] } };
        }
        if (n.id === nodeId) {
          return { ...n, parentId: groupId, extent: "parent" as const };
        }
        return n;
      })
    );
    persist();
  }, [persist]);

  const removeFromGroup = useCallback((nodeId: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          const { parentId: _p, extent: _e, ...rest } = n;
          return rest;
        }
        if (n.type === "group") {
          const data = n.data as unknown as GroupNodeData;
          return { ...n, data: { ...data, childIds: data.childIds.filter((c) => c !== nodeId) } };
        }
        return n;
      })
    );
    persist();
  }, [persist]);

  const toggleGroupExpanded = useCallback((groupId: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === groupId) {
          const data = n.data as unknown as GroupNodeData;
          return { ...n, data: { ...data, isExpanded: !data.isExpanded } };
        }
        return n;
      })
    );
    persist();
  }, [persist]);

  const importItems = useCallback((items: ImportedItem[]) => {
    const existingLabels = new Set(
      nodesRef.current
        .filter((n) => n.type === "item")
        .map((n) => (n.data as unknown as ItemNodeData).label.toLowerCase())
    );

    const newNodes: Node[] = [];
    items.forEach((item, i) => {
      if (existingLabels.has(item.name.toLowerCase())) return;
      const id = makeId();
      const col = i % 5;
      const row = Math.floor(i / 5);
      newNodes.push({
        id,
        type: "item",
        position: { x: 40 + col * 220, y: 40 + row * 100 },
        data: {
          label: item.name,
          amount: item.amount,
          kind: item.type ?? "expense"
        } satisfies ItemNodeData
      });
    });

    if (newNodes.length === 0) return;
    setNodes((nds) => [...nds, ...newNodes]);
    persist();
  }, [persist]);

  const resetCanvas = useCallback(() => {
    clearFlytState(accountSlug);
    setNodes([]);
    setEdges([]);
    setViewport({ x: 0, y: 0, zoom: 1 });
    setSelectedNodeId(null);
  }, [accountSlug]);

  return {
    nodes,
    edges,
    viewport,
    selectedNodeId,
    setSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onMoveEnd,
    addItemNode,
    addSourceNode,
    addGroupNode,
    updateNodeData,
    deleteNode,
    addToGroup,
    removeFromGroup,
    toggleGroupExpanded,
    importItems,
    resetCanvas
  };
}
