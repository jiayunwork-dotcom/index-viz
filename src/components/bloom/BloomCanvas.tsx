import { motion } from 'framer-motion';
import type { BloomState } from '@/structures/bloom/types';
import { HASH_COLORS } from '@/structures/bloom/bloom';

interface Props { frame: BloomState | null; }

export default function BloomCanvas({ frame }: Props) {
  if (!frame) return <div className="flex items-center justify-center h-full text-slate-400">插入数据开始可视化</div>;

  const { bits, m, k, fpr, n, highlighting, insertedElements } = frame;
  const posSet = new Set(highlighting.positions || []);
  const posColorMap: Record<number, string> = {};
  (highlighting.positions || []).forEach((p, i) => {
    posColorMap[p] = highlighting.colors?.[i] || HASH_COLORS[i % HASH_COLORS.length];
  });

  const cols = Math.min(32, Math.ceil(Math.sqrt(m)));
  const fillRatio = bits.filter(Boolean).length / m;
  const fprPercent = fpr * 100;
  const fprColor = fprPercent < 1 ? 'text-green-600' : fprPercent < 10 ? 'text-yellow-600' : fprPercent < 50 ? 'text-orange-600' : 'text-red-600';
  const fprBarColor = fprPercent < 1 ? 'bg-green-500' : fprPercent < 10 ? 'bg-yellow-500' : fprPercent < 50 ? 'bg-orange-500' : 'bg-red-500';

  const optimalK = Math.round((m / Math.max(n, 1)) * Math.LN2);
  const fprAtOptimal = n > 0 ? Math.pow(1 - Math.pow(1 - 1 / m, optimalK * n), optimalK) : 0;

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
        <div className="card p-4 border-2 border-rose-200">
          <h4 className="text-sm font-semibold mb-2 text-rose-700">⚠️ 误判率 (FPR)</h4>
          <div className={`text-4xl font-bold font-mono ${fprColor}`}>
            {fprPercent.toFixed(4)}%
          </div>
          <div className="mt-2 h-3 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${fprBarColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, fprPercent)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-3 p-2 bg-slate-50 rounded border border-slate-200">
            <div className="text-xs text-slate-500 mb-1">数学公式:</div>
            <div className="font-mono text-sm text-slate-700 text-center">
              FPR = (1 - (1 - 1/m)<sup>kn</sup>)<sup>k</sup>
            </div>
            <div className="mt-1 text-xs text-slate-500 text-center">
              m={m}, k={k}, n={n}
            </div>
            <div className="mt-1 text-xs text-slate-400 text-center">
              = (1 - (1 - 1/{m})<sup>{k}×{n}</sup>)<sup>{k}</sup>
            </div>
          </div>
          {n > 0 && (
            <div className="mt-2 text-xs text-slate-500">
              最优 k ≈ (m/n)·ln2 = {optimalK} → FPR={fprAtOptimal < 0.001 ? fprAtOptimal.toExponential(2) : (fprAtOptimal * 100).toFixed(4) + '%'}
            </div>
          )}
        </div>
        <div className="card p-4">
          <h4 className="text-sm font-semibold mb-2">位数组填充率</h4>
          <div className="text-4xl font-bold text-blue-600 font-mono">
            {(fillRatio * 100).toFixed(1)}%
          </div>
          <div className="mt-2 h-3 bg-slate-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${fillRatio * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-2 text-xs text-slate-500">
            {bits.filter(Boolean).length} / {m} 位被置 1
          </div>
          <div className="mt-3">
            <div className="text-xs text-slate-500 mb-1">FPR 随元素数变化趋势:</div>
            <div className="flex items-end gap-0.5 h-16">
              {Array.from({ length: Math.min(20, m) }, (_, i) => {
                const nn = i + 1;
                const ff = Math.pow(1 - Math.pow(1 - 1 / m, k * nn), k);
                const h = Math.max(4, ff * 60);
                const isCurrent = nn === n;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${isCurrent ? 'bg-rose-500' : nn <= n ? 'bg-rose-300' : 'bg-slate-200'}`}
                    style={{ height: h }}
                    title={`n=${nn}: FPR=${(ff * 100).toFixed(2)}%`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-1">
              <span>n=1</span>
              <span>n={Math.min(20, m)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 mt-4">
        <h4 className="text-sm font-semibold mb-2">已插入元素 ({insertedElements.length})</h4>
        <div className="flex flex-wrap gap-1.5">
          {insertedElements.map((e, i) => (
            <span key={`${e}-${i}`} className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono">{e}</span>
          ))}
          {insertedElements.length === 0 && <span className="text-xs text-slate-400">暂无</span>}
        </div>
      </div>
    </div>
  );
}
