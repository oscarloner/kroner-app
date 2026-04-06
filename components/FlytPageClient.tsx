"use client";

import { useState, useCallback } from "react";
import { ReactFlowProvider, type Node } from "@xyflow/react";
import { useFlytStore } from "@/components/flyt/hooks/useFlytStore";
import { FlytCanvas } from "@/components/flyt/FlytCanvas";
import { NodeInspector } from "@/components/flyt/panels/NodeInspector";
import { ImportPanel } from "@/components/flyt/panels/ImportPanel";
import styles from "@/components/kroner.module.css";

export function FlytPageClient({ accountSlug }: { accountSlug: string }) {
  const store = useFlytStore(accountSlug);
  const [showImport, setShowImport] = useState(false);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    store.setSelectedNodeId(node.id);
  }, [store]);

  const handlePaneClick = useCallback(() => {
    store.setSelectedNodeId(null);
  }, [store]);

  const selectedNode = store.selectedNodeId
    ? store.nodes.find((n) => n.id === store.selectedNodeId) ?? null
    : null;

  return (
    <div className={styles.pageWrap} style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
      <ReactFlowProvider>
        <FlytCanvas
          nodes={store.nodes}
          edges={store.edges}
          defaultViewport={store.viewport}
          selectedNodeId={store.selectedNodeId}
          onNodesChange={store.onNodesChange}
          onEdgesChange={store.onEdgesChange}
          onConnect={store.onConnect}
          onMoveEnd={store.onMoveEnd}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onAddSource={(label) => store.addSourceNode(label)}
          onAddGroup={(label) => store.addGroupNode(label)}
          onImport={() => setShowImport(true)}
          onReset={store.resetCanvas}
        />

        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            onUpdate={store.updateNodeData}
            onDelete={store.deleteNode}
            onClose={() => store.setSelectedNodeId(null)}
            onRemoveFromGroup={store.removeFromGroup}
          />
        )}

        {showImport && (
          <ImportPanel
            onImport={store.importItems}
            onClose={() => setShowImport(false)}
          />
        )}
      </ReactFlowProvider>
    </div>
  );
}
