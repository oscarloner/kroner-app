"use client";

import { useCallback } from "react";
import type { FlytState } from "../flyt-types";

const DEFAULT_STATE: FlytState = {
  version: 1,
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
};

export function loadFlytState(accountSlug: string): FlytState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(`kroner-flyt-${accountSlug}`);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as FlytState;
    if (parsed.version !== 1) return DEFAULT_STATE;
    return parsed;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveFlytState(accountSlug: string, state: FlytState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`kroner-flyt-${accountSlug}`, JSON.stringify(state));
}

export function clearFlytState(accountSlug: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`kroner-flyt-${accountSlug}`);
}

export function useFlytPersist(accountSlug: string) {
  const save = useCallback(
    (state: FlytState) => saveFlytState(accountSlug, state),
    [accountSlug]
  );
  const clear = useCallback(() => clearFlytState(accountSlug), [accountSlug]);
  const load = useCallback(() => loadFlytState(accountSlug), [accountSlug]);

  return { save, clear, load };
}
