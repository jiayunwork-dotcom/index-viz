import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { LogicalNode } from '@/structures/fragmentation/types';

interface LogicalBTreeViewProps {
  nodes: Record<string, LogicalNode>;
  rootId: string | null;
  scanPosition?: number;
  highlightNodeId?: string | null;
}

interface LaidOutNode extends LogicalNode {
  x: number;
  y: number;
  width: number;
  centerX: number;
}

const K_W = 32;
const K_H = 28;
const K_GAP = 3;
const PAD_X = 8;
const PAD_Y = 6;
const LV_GAP = 60;
const SIBLING_GAP = 30;

function nodeW(nKeys: number): number {
  const c = Math.max(nKeys, 1);
  return PAD_X * 2 + c * K_W + (c - 1) * K_GAP;
}

function layoutTree(
  nodes: Record<string, LogicalNode>,
  rootId: string | null
): LaidOutNode[] {
  if (!rootId || !nodes[rootId]) return [];
  const result: LaidOutNode[] = [];
  const nodeData: Record<string, { x: number; y: number; width: number; centerX: number; leftMost: number; rightMost: number }> = {};

  const layout = (id: string, depth: number): { leftMost: number; rightMost: number; centerX: number } => {
    const nd = nodes[id];
    if (!nd) return { leftMost: 0, rightMost: 0, centerX: 0 };

    const selfW = nodeW(nd.keys.length);
    const y = depth * (K_H + PAD_Y * 2 + LV_GAP) + 20;

    if (nd.children.length === 0) {
      nodeData[id] = { x: -selfW / 2, y, width: selfW, centerX: 0, leftMost: -selfW / 2, rightMost: selfW / 2 };
      return { leftMost: -selfW / 2, rightMost: selfW / 2, centerX: 0 };
    }

    let totalWidth = 0;
    const childResults: { leftMost: number; rightMost: number; centerX: number; id: string; width: number }[] = [];

    for (let i = 0; i < nd.children.length; i++) {
      const cid = nd.children[i];
      if (!cid || !nodes[cid]) continue;
      const cr = layout(cid, depth + 1);
      const childNd = nodes[cid];
      const childW = nodeW(childNd.keys.length);

      if (i > 0) {
        totalWidth += SIBLING_GAP;
      }
      const childCenterX = totalWidth + childW / 2;
      totalWidth += childW;

      childResults.push({ ...cr, id: cid, width: childW, centerX: childCenterX - totalWidth / 2 });
    }

    const childrenCenter = 0;
    const selfCenterX = 0;
    const shift = selfCenterX - (totalWidth / 2 - totalWidth / 2);

    let minLeft = Infinity;
    let maxRight = -Infinity;

    for (let i = 0; i < childResults.length; i++) {
      const cr = childResults[i];
      const newCenterX = cr.centerX + shift - totalWidth / 2 + selfW / 2;
      const childLeft = newCenterX - cr.width / 2;
      const childRight = newCenterX + cr.width / 2;
      minLeft = Math.min(minLeft, childLeft);
      maxRight = Math.max(maxRight, childRight);

      nodeData[cr.id].centerX = newCenterX;
      nodeData[cr.id].x = newCenterX - cr.width / 2;
    }

    const selfLeft = -selfW / 2;
    const selfRight = selfW / 2;

    nodeData[id] = {
      x: -selfW / 2,
      y,
      width: selfW,
      centerX: 0,
      leftMost: Math.min(selfLeft, minLeft),
      rightMost: Math.max(selfRight, maxRight),
    };

    return { leftMost: Math.min(selfLeft, minLeft), rightMost: Math.max(selfRight, maxRight), centerX: 0 };
  };

  layout(rootId, 0);

  let minX = Infinity;
  Object.values(nodeData).forEach((nd) => {
    minX = Math.min(minX, nd.x);
  });
  const xOffset = minX < 10 ? 10 - minX : 20;

  Object.keys(nodeData).forEach((id) => {
    const nd = nodeData[id];
    const laid: LaidOutNode = {
      ...nodes[id],
      x: nd.x + xOffset,
      y: nd.y,
      width: nd.width,
      centerX: nd.centerX + xOffset,
    };
    result.push(laid);
  });

  return result;
}

export default function LogicalBTreeView({
  nodes,
  rootId,
  scanPosition,
  highlightNodeId,
}: LogicalBTreeViewProps) {
  const nodeH = K_H + PAD_Y * 2;

  const { laidOut, bounds, nodeMap } = useMemo(() => {
    const laid = layoutTree(nodes, rootId);
    let maxX = 0, maxY = 0;
    laid.forEach((n) => {
      maxX = Math.max(maxX, n.x + n.width + 20);
      maxY = Math.max(maxY, n.y + nodeH + 20);
    });
    const nm: Record<string, LaidOutNode> = {};
    laid.forEach((n) => { nm[n.id] = n; });
    return { laidOut: laid, bounds: { w: maxX, h: maxY }, nodeMap: nm };
  }, [nodes, rootId, nodeH]);

  const svgW = Math.max(200, bounds.w);
  const svgH = Math.max(150, bounds.h);

  if (laidOut.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        逻辑树为空
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-auto">
      <svg width={svgW} height={svgH} className="block">
        <defs>
          <marker id="logical-edge" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#94a3b8" />
          </marker>
          <marker id="logical-chain" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="#0ea5e9" />
          </marker>
        </defs>

        <g>
          {laidOut.flatMap((node) =>
            node.children.map((childId, i) => {
              const child = nodeMap[childId];
              if (!child) return null;
              const exitX = node.x + (node.width / (node.children.length + 1)) * (i + 1);
              return (
                <line
                  key={`edge-${node.id}-${childId}`}
                  x1={exitX}
                  y1={node.y + nodeH}
                  x2={child.centerX}
                  y2={child.y}
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  markerEnd="url(#logical-edge)"
                />
              );
            })
          )}
        </g>

        <g>
          {laidOut.map((node) => {
            const isHighlighted = highlightNodeId === node.id;

            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={nodeH}
                  rx={6}
                  fill={isHighlighted ? '#fef3c7' : '#ffffff'}
                  stroke={isHighlighted ? '#f59e0b' : '#cbd5e1'}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                />

                {node.keys.map((k, ki) => {
                  const kx = node.x + PAD_X + ki * (K_W + K_GAP);
                  const ky = node.y + PAD_Y;
                  return (
                    <g key={`k-${node.id}-${ki}`}>
                      <rect
                        x={kx}
                        y={ky}
                        width={K_W}
                        height={K_H}
                        rx={4}
                        fill={node.isLeaf ? '#d1fae5' : '#f1f5f9'}
                      />
                      <text
                        x={kx + K_W / 2}
                        y={ky + K_H / 2 + 4}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="500"
                        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                        fill="#334155"
                      >
                        {k}
                      </text>
                    </g>
                  );
                })}

                {node.keys.length === 0 && (
                  <text
                    x={node.centerX}
                    y={node.y + nodeH / 2 + 4}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#94a3b8"
                  >
                    空
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute top-2 left-2 text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">
        逻辑视图
      </div>
    </div>
  );
}
