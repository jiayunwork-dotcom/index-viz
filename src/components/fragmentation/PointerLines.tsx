import { motion } from 'framer-motion';
import type { PhysicalPage } from '@/structures/fragmentation/types';

interface PointerLinesProps {
  pages: Record<string, PhysicalPage>;
  leafChain: string[];
  pageWidth?: number;
  pageHeight?: number;
}

const PAGE_WIDTH = 180;
const PAGE_HEIGHT = 140;

export default function PointerLines({
  pages,
  leafChain,
  pageWidth = PAGE_WIDTH,
  pageHeight = PAGE_HEIGHT,
}: PointerLinesProps) {
  const lines: { x1: number; y1: number; x2: number; y2: number; id: string }[] = [];

  for (let i = 0; i < leafChain.length - 1; i++) {
    const fromPage = pages[leafChain[i]];
    const toPage = pages[leafChain[i + 1]];
    if (!fromPage || !toPage) continue;

    const x1 = fromPage.x + pageWidth;
    const y1 = fromPage.y + pageHeight / 2;
    const x2 = toPage.x;
    const y2 = toPage.y + pageHeight / 2;

    lines.push({
      x1,
      y1,
      x2,
      y2,
      id: `${leafChain[i]}-${leafChain[i + 1]}`,
    });
  }

  const maxX = Math.max(
    ...Object.values(pages).map((p) => p.x + pageWidth + 50),
    100
  );
  const maxY = Math.max(
    ...Object.values(pages).map((p) => p.y + pageHeight + 50),
    100
  );

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={maxX + 100}
      height={maxY + 100}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
        </marker>
        <marker
          id="arrowhead-sky"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#0ea5e9" />
        </marker>
      </defs>
      {lines.map((line) => (
        <motion.line
          key={line.id}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#64748b"
          strokeWidth="1.5"
          markerEnd="url(#arrowhead)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.7 }}
          transition={{ duration: 0.3 }}
        />
      ))}
    </svg>
  );
}
