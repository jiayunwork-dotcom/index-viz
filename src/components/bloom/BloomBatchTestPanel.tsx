import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface BloomBatchResult {
  element: string;
  result: 'maybe' | 'none';
  markedAsFalsePositive?: boolean;
}

interface Props {
  onQuery: (element: string) => 'maybe' | 'none';
  theoreticalFPR: number;
  insertedElements: string[];
}

export default function BloomBatchTestPanel({ onQuery, theoreticalFPR, insertedElements }: Props) {
  const [inputValue, setInputValue] = useState('');
  const [results, setResults] = useState<BloomBatchResult[]>([]);
  const [hasRun, setHasRun] = useState(false);

  const handleBatchQuery = () => {
    if (!inputValue.trim()) return;
    
    const elements = inputValue
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    
    if (elements.length === 0) return;

    const newResults: BloomBatchResult[] = elements.map((elem) => ({
      element: elem,
      result: onQuery(elem),
    }));

    setResults(newResults);
    setHasRun(true);
  };

  const toggleFalsePositive = (index: number) => {
    if (results[index].result !== 'maybe') return;
    setResults((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, markedAsFalsePositive: !r.markedAsFalsePositive } : r
      )
    );
  };

  const maybeCount = results.filter((r) => r.result === 'maybe').length;
  const noneCount = results.filter((r) => r.result === 'none').length;
  const falsePositiveCount = results.filter((r) => r.result === 'maybe' && r.markedAsFalsePositive).length;
  const actualFPR = maybeCount > 0 ? falsePositiveCount / results.length : 0;
  const fprDeviation = theoreticalFPR > 0 ? ((actualFPR - theoreticalFPR) / theoreticalFPR) * 100 : 0;

  const autoDetectFP = () => {
    const insertedSet = new Set(insertedElements);
    setResults((prev) =>
      prev.map((r) => ({
        ...r,
        markedAsFalsePositive: r.result === 'maybe' && !insertedSet.has(r.element),
      }))
    );
  };

  return (
    <div className="card p-4">
      <h3 className="font-semibold text-slate-800 mb-3 text-sm">🧪 批量测试</h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-slate-600 mb-1">
            批量查询元素 (逗号分隔)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBatchQuery()}
              placeholder="如: apple, banana, 123"
              className="input flex-1 text-sm"
            />
            <button
              onClick={handleBatchQuery}
              className="btn-primary text-sm"
              disabled={!inputValue.trim()}
            >
              查询
            </button>
          </div>
        </div>

        {insertedElements.length > 0 && (
          <button
            onClick={autoDetectFP}
            disabled={!hasRun || maybeCount === 0}
            className="btn-secondary w-full text-xs"
          >
            🤖 自动标记误判 (对比已插入元素)
          </button>
        )}

        {hasRun && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-slate-100 pt-3"
          >
            <div className="text-xs text-slate-500 mb-2 flex items-center justify-between">
              <span>查询结果 ({results.length} 个)</span>
              <span className="flex gap-2">
                <span className="text-green-600">可能存在: {maybeCount}</span>
                <span className="text-red-600">一定不存在: {noneCount}</span>
              </span>
            </div>

            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              <AnimatePresence>
                {results.map((item, index) => (
                  <motion.div
                    key={`${item.element}-${index}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => toggleFalsePositive(index)}
                    className={cn(
                      'flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors',
                      item.result === 'maybe' && item.markedAsFalsePositive
                        ? 'bg-orange-50 hover:bg-orange-100'
                        : item.result === 'maybe'
                        ? 'bg-green-50 hover:bg-green-100'
                        : 'bg-slate-50 hover:bg-slate-100'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn(
                        'w-4 h-4 rounded flex items-center justify-center text-xs flex-shrink-0',
                        item.result === 'maybe'
                          ? item.markedAsFalsePositive
                            ? 'bg-orange-500 text-white'
                            : 'bg-green-500 text-white'
                          : 'bg-slate-400 text-white'
                      )}>
                        {item.result === 'maybe' ? (item.markedAsFalsePositive ? '✗' : '✓') : '✗'}
                      </span>
                      <span className="font-mono font-medium text-slate-700 truncate">
                        {item.element}
                      </span>
                    </div>
                    <span className={cn(
                      'flex-shrink-0 ml-2',
                      item.result === 'maybe'
                        ? item.markedAsFalsePositive
                          ? 'text-orange-600'
                          : 'text-green-600'
                        : 'text-red-600'
                    )}>
                      {item.result === 'maybe'
                        ? item.markedAsFalsePositive
                          ? '误判 (假阳性)'
                          : '可能存在'
                        : '一定不存在'}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {results.some((r) => r.result === 'maybe') && (
              <p className="text-xs text-slate-400 mt-2">
                💡 点击"可能存在"的结果可手动标注为误判
              </p>
            )}

            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
              <h4 className="text-xs font-semibold text-slate-700">📊 统计对比</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-orange-50 rounded p-2 text-center">
                  <div className="text-xs text-orange-600">标注误判数</div>
                  <div className="text-lg font-bold text-orange-600 font-mono">
                    {falsePositiveCount}
                  </div>
                </div>
                <div className="bg-rose-50 rounded p-2 text-center">
                  <div className="text-xs text-rose-600">实测误判率</div>
                  <div className="text-lg font-bold text-rose-600 font-mono">
                    {(actualFPR * 100).toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded p-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">理论 FPR:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {(theoreticalFPR * 100).toFixed(4)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-slate-500">偏差:</span>
                  <span className={cn(
                    'font-mono font-semibold',
                    fprDeviation > 0 ? 'text-red-600' : fprDeviation < 0 ? 'text-green-600' : 'text-slate-600'
                  )}>
                    {fprDeviation > 0 ? '+' : ''}{fprDeviation.toFixed(1)}%
                  </span>
                </div>
                <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-rose-500 rounded-full"
                    style={{ width: `${Math.min(100, actualFPR * 100 * 10)}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-500"
                    style={{ left: `${Math.min(100, theoreticalFPR * 100 * 10)}%` }}
                    title="理论FPR"
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>实测</span>
                  <span className="text-blue-500">▼ 理论</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
