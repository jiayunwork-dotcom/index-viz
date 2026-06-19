import { motion, AnimatePresence } from 'framer-motion';
import { useMVCCStore } from '@/store/mvccStore';
import { cn } from '@/lib/utils';

export default function VisibilityPanel() {
  const { readResult, transactions, versions, clearReadResult } = useMVCCStore();

  const txn = readResult ? transactions.find((t) => t.txnId === readResult.txnId) : null;
  const rowVersions = readResult ? versions.get(readResult.rowId) || [] : [];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">可见性判定过程</h3>
        {readResult && (
          <button
            onClick={clearReadResult}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            清空
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
        {!readResult && (
          <div className="text-center py-16 text-slate-400 text-sm">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium mb-1">等待读取操作</p>
            <p className="text-xs text-slate-400/80 max-w-[180px] mx-auto">
              在左侧事务面板点击"读取"按钮，这里将逐步展示可见性判定过程
            </p>
          </div>
        )}

        {readResult && txn && (
          <div className="space-y-3">
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-800 rounded-lg p-3 text-xs text-white"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">读取上下文</span>
                <span className="bg-white/10 px-1.5 py-0.5 rounded">行 #{readResult.rowId}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-white/80">
                <div>
                  <span className="text-white/50">事务:</span>{' '}
                  <span className="font-mono font-semibold text-white">T{txn.txnNum}</span>
                </div>
                <div>
                  <span className="text-white/50">快照TS:</span>{' '}
                  <span className="font-mono font-semibold text-amber-300">{txn.snapshotTs}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-white/50">行版本数:</span>{' '}
                  <span className="font-mono font-semibold">{rowVersions.length}</span>
                </div>
              </div>
            </motion.div>

            <div className="space-y-2">
              <AnimatePresence mode="wait">
                {readResult.steps.map((step, idx) => {
                  const version = rowVersions.find((v) => v.versionId === step.versionId);
                  const isFinalVisible = step.isFinal && step.visible;
                  const isFinalDone = step.isFinal && !step.visible;

                  return (
                    <motion.div
                      key={`${step.versionId}-${readResult.timestamp}`}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        scale: step.isHighlighted ? 1.01 : 1,
                      }}
                      transition={{
                        duration: 0.3,
                        delay: idx * 0.08,
                        ease: 'easeOut',
                      }}
                      className={cn(
                        'rounded-lg border-2 p-3 transition-all duration-300',
                        step.isHighlighted
                          ? step.visible
                            ? 'border-emerald-400 bg-emerald-50 shadow-md shadow-emerald-100'
                            : 'border-red-400 bg-red-50 shadow-md shadow-red-100'
                          : step.visible
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : 'border-slate-200 bg-white',
                        isFinalVisible && 'ring-2 ring-emerald-400 ring-offset-1'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <motion.span
                            className={cn(
                              'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                              step.visible ? 'bg-emerald-500' : 'bg-slate-400'
                            )}
                            animate={step.isHighlighted ? { scale: [1, 1.2, 1] } : {}}
                            transition={{ duration: 0.3 }}
                          >
                            {idx + 1}
                          </motion.span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-700 truncate">
                              版本 V{rowVersions.findIndex((v) => v.versionId === step.versionId) + 1}
                              {version && (
                                <span className="ml-2 text-slate-400 font-normal">
                                  #{version.rowId} {version.name} ¥{version.balance}
                                </span>
                              )}
                            </div>
                            {version && (
                              <div className="text-[10px] font-mono text-slate-500">
                                xmin=T{version.xmin}({version.xminStatus === 'active' ? '活跃' : version.xminStatus === 'committed' ? '已提交' : '已回滚'})
                                {version.xmax ? (
                                  <> · xmax=T{version.xmax}({version.xmaxStatus === 'active' ? '活跃' : version.xmaxStatus === 'committed' ? '已提交' : '已回滚'})</>
                                ) : (
                                  <> · xmax=∞</>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <motion.span
                          className={cn(
                            'flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded',
                            step.visible
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          )}
                          animate={step.isHighlighted ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 0.3 }}
                        >
                          {step.visible ? '✓ 可见' : '✗ 不可见'}
                        </motion.span>
                      </div>

                      <div
                        className={cn(
                          'text-xs pl-8 leading-relaxed',
                          step.visible ? 'text-emerald-700' : 'text-red-600'
                        )}
                      >
                        <span className="font-semibold">判定：</span>
                        {step.reason}
                      </div>

                      {(isFinalVisible || isFinalDone) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className={cn(
                            'mt-2 pt-2 border-t ml-8 text-xs font-semibold',
                            isFinalVisible
                              ? 'border-emerald-200 text-emerald-700'
                              : 'border-slate-200 text-slate-600'
                          )}
                        >
                          {isFinalVisible
                            ? '🎯 找到可见版本，返回此版本的数据！'
                            : '⚠️ 所有版本均不可见，该行无数据返回'}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {readResult.foundVersion && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: readResult.steps.length * 0.08 + 0.2, type: 'spring', damping: 20 }}
                className="mt-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-lg"
              >
                <div className="text-xs text-emerald-100 mb-1">📋 读取结果</div>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold">{readResult.foundVersion.name}</span>
                  <span className="font-mono text-lg">¥{readResult.foundVersion.balance.toLocaleString()}</span>
                </div>
                <div className="mt-2 text-[11px] text-emerald-100/80 font-mono">
                  由 T{readResult.foundVersion.xmin} 创建 · 版本ID: {readResult.foundVersion.versionId.slice(0, 8)}...
                </div>
              </motion.div>
            )}

            {!readResult.foundVersion && readResult.steps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: readResult.steps.length * 0.08 + 0.2 }}
                className="mt-4 bg-slate-100 rounded-xl p-4 text-slate-700 border-2 border-dashed border-slate-300 text-center"
              >
                <div className="text-2xl mb-1">🚫</div>
                <div className="font-semibold text-sm">无可见版本</div>
                <div className="text-xs text-slate-500 mt-1">该行对当前事务不可见</div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
