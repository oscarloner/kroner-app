// Types for the Flyt canvas

export interface ItemNodeData extends Record<string, unknown> {
  label: string;
  amount: number;
  kind: "income" | "expense" | "neutral";
}

export interface SourceNodeData extends Record<string, unknown> {
  label: string;
  color: string;
}

export interface GroupNodeData extends Record<string, unknown> {
  label: string;
  isExpanded: boolean;
  childIds: string[];
}

export type FlytNodeData = ItemNodeData | SourceNodeData | GroupNodeData;

export interface FlytNodeRecord {
  id: string;
  type: "item" | "group" | "source";
  position: { x: number; y: number };
  data: FlytNodeData;
  parentId?: string;
  extent?: "parent";
}

export interface FlytEdgeRecord {
  id: string;
  source: string;
  target: string;
  animated: boolean;
  label?: string;
}

export interface FlytState {
  version: 1;
  nodes: FlytNodeRecord[];
  edges: FlytEdgeRecord[];
  viewport: { x: number; y: number; zoom: number };
}

export interface ImportedItem {
  name: string;
  amount: number;
  type?: "income" | "expense";
}
