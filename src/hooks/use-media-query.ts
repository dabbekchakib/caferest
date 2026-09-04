"use client";

import { useSyncExternalStore } from "react";

function getMediaSnapshot(query: string): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(query).matches;
}

function getMediaServerSnapshot(): boolean {
  return false;
}

function subscribeToMedia(query: string, callback: () => void): () => void {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => subscribeToMedia(query, callback),
    () => getMediaSnapshot(query),
    getMediaServerSnapshot
  );
}
