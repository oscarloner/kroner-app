"use client";

import "@xyflow/react/dist/style.css";

import { useCallback } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  SelectionMode,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Viewport
} from "@xyflow/react";

import ItemNode from "./nodes/ItemNode";
import SourceNode from "./nodes/SourceNode";
import GroupNode from "./nodes/GroupNode";
import FlowEdge from "./edges/FlowEdge";
import { FlytToolbar } from "./FlytToolbar";
import styles from "./flyt.module.css";

const NODE_TYPES = {
  item: ItemNode,
  source: SourceNode,
  group: GroupNode
} as const;

const EDGE_TYPES = {
  flow: FlowEdge
} as const;

export function FlytCanvas({
  nodes,
  edges,
  defaultViewport,
  selectedNodeId,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onMoveEnd,
  onNodeClick,
  onPaneClick,
  onAddSource,
  onAddGroup,
  onImport,
  onReset
}: {
  nodes: Node[];
  edges: Edge[];
  defaultViewport: Viewport;
  selectedNodeId: string | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onMoveEnd: (event: unknown, viewport: Viewport) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onAddSource: (label: string) => void;
  onAddGroup: (label: string) => void;
  onImport: () => void;
  onReset: () => void;
}) {
  const isEmpty = nodes.length === 0;

  return (
    <div className={styles.canvasWrap}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onMoveEnd={onMoveEnd}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        defaultViewport={defaultViewport}
        selectionMode={SelectionMode.Partial}
        selectionOnDrag
        panOnDrag={[1, 2]}
        deleteKeyCode="Delete"
        defaultEdgeOptions={{ type: "flow", animated: true }}
        fitView={isEmpty}
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#2e2e4a" gap={24} size={1.5} />
        <Controls />
        <MiniMap zoomable pannable />
        <Panel position="top-right">
          <FlytToolbar
            onAddSource={onAddSource}
            onAddGroup={onAddGroup}
            onImport={onImport}
            onReset={onReset}
          />
        </Panel>

        {isEmpty && (
          <div className={styles.emptyHint}>
            <div className={styles.emptyHintTitle}>Tomt canvas</div>
            <div className={styles.emptyHintSub}>
              Bruk knappene ovenfor for å legge til kilde, gruppe, eller importer poster
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}
