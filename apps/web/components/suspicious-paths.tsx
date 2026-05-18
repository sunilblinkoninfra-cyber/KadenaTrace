import { type ReactElement } from "react";
import { motion } from "framer-motion";

import type { SuspiciousPath, TraceGraph } from "@kadenatrace/shared/client";

import { RiskBadge } from "./risk-badge";
import { Card, Section, focusRingClassName } from "./ui";

const containerVariants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08
    }
  }
};

const itemVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring" as const, stiffness: 350, damping: 25 }
  }
};

export function SuspiciousPaths({
  graph,
  paths,
  onFocusPath
}: {
  graph: TraceGraph;
  paths: SuspiciousPath[];
  onFocusPath?: (edgeIds: string[]) => void;
}): ReactElement {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return (
    <Section className="pb-10 pt-0">
      <div className="mb-6 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 font-display">
          <span className="h-px w-6 bg-slate-300" />
          Suspicious Paths
        </div>
        <h2 className="text-xl font-black text-slate-800 font-display">
          Top Risk-Ranked Movement Paths
        </h2>
      </div>
      <motion.div 
        className="grid grid-cols-1 gap-5 lg:grid-cols-2"
        variants={containerVariants}
        initial="initial"
        animate="animate"
      >
        {paths.length > 0 ? (
          paths.map((path, index) => {
            const start = nodeById.get(path.startNodeId);
            const end = nodeById.get(path.endNodeId);
            const content = (
              <>
                <div className="mb-3.5 flex items-center flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600 border border-slate-200 font-display uppercase tracking-wider">
                    Path {index + 1}
                  </span>
                  <RiskBadge level={path.riskScore >= 80 ? "critical" : path.riskScore >= 60 ? "high" : "medium"} />
                  <span className="text-xs font-semibold text-slate-500">
                    {(path.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <p className="mb-4 text-sm leading-relaxed font-semibold text-slate-700">
                  {path.dominantReason}
                </p>
                <div className="mt-auto grid grid-cols-2 gap-2 text-[11px] font-bold text-slate-500 border-t border-slate-100 pt-3">
                  <span className="truncate col-span-2 text-slate-600">
                    <span className="font-mono text-[11px] bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded mr-1">
                      {start?.label ?? path.startNodeId}
                    </span>
                    <span className="text-sky-500 mx-1">→</span>
                    <span className="font-mono text-[11px] bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded ml-1">
                      {end?.label ?? path.endNodeId}
                    </span>
                  </span>
                  <span>Hops: {path.edgeIds.length}</span>
                  <span>Seed Flow: {path.valueFromSeedPct.toFixed(1)}%</span>
                  <span className="col-span-2">Active Chains: {path.chains.join(", ")}</span>
                </div>
              </>
            );
            return (
              onFocusPath ? (
                <motion.button
                  key={path.id}
                  variants={itemVariants}
                  whileHover={{ 
                    y: -4, 
                    borderColor: "rgba(14, 165, 233, 0.4)", 
                    boxShadow: "0 20px 40px -10px rgba(14, 165, 233, 0.15)" 
                  }}
                  whileTap={{ scale: 0.985 }}
                  className={`flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/95 to-slate-50/50 p-5 text-left shadow-sm transition-colors hover:bg-white cursor-pointer ${focusRingClassName}`}
                  type="button"
                  onClick={() => onFocusPath(path.edgeIds)}
                >
                  {content}
                </motion.button>
              ) : (
                <motion.div key={path.id} variants={itemVariants}>
                  <Card className="flex flex-col gap-4 text-left p-5 bg-gradient-to-br from-white/95 to-slate-50/50 border-slate-200/60 rounded-2xl shadow-sm">
                    {content}
                  </Card>
                </motion.div>
              )
            );
          })
        ) : (
          <motion.article 
            variants={itemVariants}
            className="col-span-1 flex justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/30 p-10 text-center shadow-sm lg:col-span-2"
          >
            <p className="text-sm font-medium text-slate-500">
              No suspicious paths were extracted from the current graph window.
            </p>
          </motion.article>
        )}
      </motion.div>
    </Section>
  );
}
