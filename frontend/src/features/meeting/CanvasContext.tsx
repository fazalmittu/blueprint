import { createContext, useContext } from "react";

interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

const CanvasContext = createContext<CanvasTransform>({ x: 0, y: 0, scale: 1 });

export const CanvasProvider = CanvasContext.Provider;

export function useCanvasTransform() {
  return useContext(CanvasContext);
}

