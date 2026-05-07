"use client";

import type { TraceGraph } from "@kadenatrace/shared/client";
import { useMemo, type ReactElement } from "react";

type FlowNode = {
  id: string;
  label: string;
  riskLevel: string;
  column: number;
  row: number;
};

type FlowLink = {
  source: FlowNode;
  target: FlowNode;
  value: number;
  txCount: number;
};

const RISK_COLOR: Record<string, string> = {
  critical: "#f43f5e",
  high: "#fb7185",
  medium: "#f59e0b",
  low: "#22c55e"
};

function riskWeight(level: string): number {
  if (level === "critical") return 4;
  if (level === "high") return 3;
  if (level === "medium") return 2;
  return 1;
}

export function FlowSankey({ graph, focusNodeId }: { graph: TraceGraph; focusNodeId?: string }): ReactElement {
  const layout = useMemo(() => {
    if (!graph.nodes.length || !graph.edges.length) {
      return null;
    }

    const topNodes = graph.nodes
      .slice()
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 16);

    const nodeMap = new Map(
      topNodes.map((node, index) => [
        node.id,
        {
          id: node.id,
          label: node.label,
          riskLevel: node.riskLevel,
          column: 0,
          row: index
        }
      ])
    );

    if (focusNodeId && !nodeMap.has(focusNodeId)) {
      const found = graph.nodes.find((node) => node.id === focusNodeId);
      if (found) {
        nodeMap.set(found.id, {
          id: found.id,
          label: found.label,
          riskLevel: found.riskLevel,
          column: 1,
          row: 0
        });
      }
    }

    const depthByNode = new Map<string, number>();
    const rootId = focusNodeId && nodeMap.has(focusNodeId) ? focusNodeId : topNodes[0]?.id;
    if (rootId) {
      const queue: string[] = [rootId];
      depthByNode.set(rootId, 0);
      while (queue.length) {
        const current = queue.shift()!;
        const currentDepth = depthByNode.get(current) ?? 0;
        for (const edge of graph.edges) {
          if (edge.from !== current || !nodeMap.has(edge.to) || depthByNode.has(edge.to)) {
            continue;
          }
          depthByNode.set(edge.to, currentDepth + 1);
          queue.push(edge.to);
        }
      }
    }

    for (const node of nodeMap.values()) {
      node.column = Math.min(depthByNode.get(node.id) ?? 4, 5);
    }

    const grouped = new Map<string, { source: string; target: string; value: number; txCount: number }>();
    for (const edge of graph.edges) {
      if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
        continue;
      }
      const key = `${edge.from}::${edge.to}`;
      const current = grouped.get(key);
      const value = Math.max(edge.amountUsd ?? edge.amount, 0.2);
      if (current) {
        current.value += value;
        current.txCount += 1;
      } else {
        grouped.set(key, { source: edge.from, target: edge.to, value, txCount: 1 });
      }
    }

    const links: FlowLink[] = Array.from(grouped.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 28)
      .map((entry) => ({
        source: nodeMap.get(entry.source)!,
        target: nodeMap.get(entry.target)!,
        value: entry.value,
        txCount: entry.txCount
      }));

    if (!links.length) {
      return null;
    }

    const rowsByColumn = new Map<number, string[]>();
    for (const node of nodeMap.values()) {
      const list = rowsByColumn.get(node.column) ?? [];
      list.push(node.id);
      rowsByColumn.set(node.column, list);
    }

    for (const [col, ids] of rowsByColumn.entries()) {
      ids.sort((left, right) => {
        const leftNode = nodeMap.get(left)!;
        const rightNode = nodeMap.get(right)!;
        return riskWeight(rightNode.riskLevel) - riskWeight(leftNode.riskLevel);
      });
      ids.forEach((id, idx) => {
        nodeMap.get(id)!.row = idx;
      });
      rowsByColumn.set(col, ids);
    }

    return { nodes: Array.from(nodeMap.values()), links, rowsByColumn };
  }, [graph, focusNodeId]);

  if (!layout) {
    return <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Insufficient connected flow for Sankey rendering.</div>;
  }

  const width = 980;
  const height = 420;
  const colStep = 160;
  const rowStep = 44;

  const nodePos = (node: FlowNode) => {
    const x = 36 + node.column * colStep;
    const y = 20 + node.row * rowStep;
    return { x, y };
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 text-xs uppercase tracking-[0.14em] text-muted-foreground">Sankey-style flow concentration</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
        {layout.links.map((link, idx) => {
          const source = nodePos(link.source);
          const target = nodePos(link.target);
          const controlX = (source.x + target.x) / 2;
          const stroke = Math.max(1.5, Math.log10(link.value + 1) * 2.4);
          return (
            <path
              key={idx}
              d={`M ${source.x + 12} ${source.y + 8} C ${controlX} ${source.y + 8}, ${controlX} ${target.y + 8}, ${target.x - 2} ${target.y + 8}`}
              fill="none"
              stroke="rgba(34,211,238,0.45)"
              strokeWidth={stroke}
              strokeLinecap="round"
            >
              <title>{`${link.source.label} → ${link.target.label} | ${link.value.toFixed(2)} value (${link.txCount} tx)`}</title>
            </path>
          );
        })}

        {layout.nodes.map((node, idx) => {
          const pos = nodePos(node);
          const isFocused = focusNodeId === node.id;
          return (
            <g key={idx}>
              <rect
                x={pos.x - 12}
                y={pos.y}
                width={14}
                height={16}
                fill={RISK_COLOR[node.riskLevel] ?? "#60a5fa"}
                stroke={isFocused ? "#ffffff" : "rgba(255,255,255,0.2)"}
                strokeWidth={isFocused ? 2 : 1}
                rx={3}
              />
              <text x={pos.x + 8} y={pos.y + 11} fill="#d1d5db" fontSize={10}>
                {node.label.length > 22 ? `${node.label.slice(0, 22)}…` : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
