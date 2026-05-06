import { create } from "zustand";
import { v5 as uuidv5 } from "uuid";
import { getTrace } from "./get-trace";
import { adaptTraceData, type AdaptedTraceData } from "./adapter";

const NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";

interface TraceState {
  traceData: AdaptedTraceData | null;
  isLoading: boolean;
  isDemo: boolean;
  selectedNodeId: string | null;
  activeFilters: string | null; // e.g. finding code
  
  // Actions
  fetchAndSetTrace: (input: string) => Promise<string>;
  setSelectedNodeId: (id: string | null) => void;
  setActiveFilters: (filter: string | null) => void;
  reset: () => void;
}

export const useTraceStore = create<TraceState>((set, get) => ({
  traceData: null,
  isLoading: false,
  isDemo: false,
  selectedNodeId: null,
  activeFilters: null,

  fetchAndSetTrace: async (input: string) => {
    // Prevent duplicate API calls
    if (get().isLoading) {
      throw new Error("Trace is already loading");
    }

    set({ isLoading: true, selectedNodeId: null, activeFilters: null });
    
    try {
      const { data, isDemo } = await getTrace(input);
      const adapted = adaptTraceData(data);
      
      // Deterministic traceId if missing or demo
      const finalTraceId = isDemo ? uuidv5(input, NAMESPACE) : (adapted.traceId || uuidv5(input, NAMESPACE));
      adapted.traceId = finalTraceId;

      // Auto-select first node (preferably the seed if it exists, otherwise the first in the list)
      let defaultNodeId = null;
      if (adapted.graph.nodes.length > 0) {
        const seedNode = adapted.graph.nodes.find(n => n.address.toLowerCase() === input.toLowerCase());
        defaultNodeId = seedNode ? seedNode.id : (adapted.graph.nodes[0]?.id ?? null);
      }

      set({ 
        traceData: adapted, 
        isDemo, 
        isLoading: false,
        selectedNodeId: defaultNodeId
      });
      
      return finalTraceId;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setActiveFilters: (filter) => set({ activeFilters: filter }),
  reset: () => set({ traceData: null, isLoading: false, isDemo: false, selectedNodeId: null, activeFilters: null })
}));
