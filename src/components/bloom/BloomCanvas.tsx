import { motion } from 'framer-motion';
import type { BloomState } from '@/structures/bloom/types';
import { HASH_COLORS } from '@/structures/bloom/bloom';

interface Props { frame: BloomState | null; }

export default function BloomCanvas({ frame }: Props) {
  if (!frame) return <div className="flex items-center justify-center h-full text-slate-400">插入数据开始可视化</div>;

  const { bits, m, k, fpr, n, highlighting } = frame;
  const posSet = new Set(highlighting.positions || []);
  const posColorMap: Record<number, string> = {};
  (highlighting.positions || []).forEach((p, i) => {
    posColorMap[p] = highlighting.colors?.[i] || HASH_COLORS[i % HASH_COLORS.length];
  });

  const cols = Math.min(32, Math.ceil(Math.sqrt(m)));

  return (
    <div className="h-full overflow-auto p-6">
      {highlighting.element && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-300 rounded-lg"
        >
          <span className="font-mono font-bold text-blue-700">"{highlighting.element}"</span>
          <span className="text-sm text-blue-600">
            {highlighting.action === 'insert' ? '插入中' : '查询中'}
          </span>
          {highlighting.result && (
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
              highlighting.result === 'maybe' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {highlighting.result === 'maybe' ? '✅ 可能存在' : '❌ 一定不存在'}
            </span>
          )}
        </motion.div>
      )}

      <div className="card p-4 mb-4">
        <h4 className="text-sm font-semibold mb-3">位数组 (m={m}, k={k}, n={n})</h4>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {bits.map((bit, i) => {
            const highlighted = posSet.has(i);
            const color = posColorMap[i];
            return (
              <motion.div
                key={i}
                animate={highlighted ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
                className="aspect-square rounded flex items-center justify-center text-xs font-mono font-bold border"
                style={{
                  background: bit ? (highlighted && color ? color : '#22c55e') : (highlighted && color ? `${color}55` : '#f1f5f9'),
                  color: bit ? '#fff' : '#94a3b8',
                  borderColor: highlighted ? color : (bit ? '#16a34a' : '#cbd5e1'),
                  boxShadow: highlighted ? `0 0 0 2px ${color}44` : undefined,
                }}
                title={`位置 ${i}: ${bit ? 1 : 0}`}
              >
                {bit ? 1 : 0}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <h4 className="text-sm font-semibold mb-2">误判率 (FPR)</h4>
          <div className="text-3xl font-bold text-rose-600 font-mono">
            {(fpr * 100).toFixed(4)}%
          </div>
          <div className="mt-2 h-2 bg-slate-200 rounded overflow-hidden">
            <div className="h-full bg-rose-500 transition-all" style={{ width: `${Math.min(100, fpr * 100)}%` }} />
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono">
            (1-(1-1/m)^(kn))^k
          </div>
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-semibold mb-2">位数组填充率</h4>
          <div className="text-3xl font-bold text-blue-600 font-mono">
            {((bits.filter(Boolean).length / m) * 100).toFixed(1)}%
          </div>
          <div className="mt-2 h-2 bg-slate-200 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${(bits.filter(Boolean).length / m) * 100}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {bits.filter(Boolean).length} / {m} 位被置 1
          </div>
        </div>
      </div>

      <div className="card p-4 mt-4">
        <h4 className="text-sm font-semibold mb-2">已插入元素 ({frame.insertedElements.length})</h4>
        <div className="flex flex-wrap gap-1.5">
          {frame.insertedElements.map((e) => (
            <span key={e} className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">{e}</span>
          ))}
          {frame.insertedElements.length === 0 && <span className="text-xs text-slate-400">暂无</span>}
        </div>
      </div>
    </div>
  );
}
