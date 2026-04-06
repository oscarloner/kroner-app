"use client";

import { memo } from "react";
import {
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps
} from "@xyflow/react";

const DOT_COLOR = "#0f7b55";
const BASE_WIDTH = 1.5;
const MAX_EXTRA = 5;
const MAX_AMOUNT = 50000;

function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected
}: EdgeProps & { data?: { amount?: number } }) {
  const amount = data?.amount ?? 0;
  const strokeWidth = BASE_WIDTH + Math.min(1, amount / MAX_AMOUNT) * MAX_EXTRA;
  const color = selected ? "#a5b4fc" : DOT_COLOR;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const duration = Math.max(0.8, 2 - (amount / MAX_AMOUNT));

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: color, strokeWidth, opacity: 0.7 }}
      />
      <circle r={4} fill={color} opacity={0.9}>
        <animateMotion
          dur={`${duration}s`}
          repeatCount="indefinite"
          path={edgePath}
        />
      </circle>
    </>
  );
}

export default memo(FlowEdge);
