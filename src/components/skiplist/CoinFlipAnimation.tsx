import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Props {
  coinFlip: 'heads' | 'tails' | null;
  coinResults?: ('heads' | 'tails')[];
  currentLevel?: number;
  insertingKey?: number;
}

export default function CoinFlipAnimation({ coinFlip, coinResults = [], currentLevel = 0, insertingKey }: Props) {
  const isHeads = coinFlip === 'heads';
  const isAnimating = coinFlip !== null;

  return (
    <div className="absolute top-4 right-4 z-10">
      <div className="card p-4 bg-white/95 backdrop-blur-sm shadow-lg border border-slate-200 rounded-xl w-48">
      <h4 className="text-sm font-semibold text-slate-800 mb-3 text-center">
        🪙 抛硬币升层
      </h4>

      <div className="flex flex-col items-center">
        <AnimatePresence mode="wait">
          {isAnimating ? (
            <motion.div
              key={coinFlip}
              initial={{ rotateY: 0, scale: 0.8 }}
              animate={{ rotateY: 360, scale: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ perspective: 1000 }}
              className="relative"
            >
              <div
                className={cn(
                  'w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-4 shadow-lg',
                  isHeads
                    ? 'bg-gradient-to-br from-green-400 to-green-600 border-green-700 text-white'
                    : 'bg-gradient-to-br from-red-400 to-red-600 border-red-700 text-white'
                )}
              >
                {isHeads ? '正' : '反'}
              </div>
              <div
                className={cn(
                  'absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-semibold',
                  isHeads ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}
              >
                {isHeads ? '升层 ↑' : '停止 ✗'}
              </div>
            </motion.div>
          ) : (
            <motion.div
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl border-4 border-dashed border-slate-300 bg-slate-50 text-slate-400"
          >
            🪙
          </motion.div>
          )}
        </AnimatePresence>

        {insertingKey !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 text-xs text-slate-600 text-center"
          >
            <span className="font-mono font-bold text-slate-800">{insertingKey}</span>
            {isAnimating && (
              <span className="ml-1 text-slate-500">
              → L{currentLevel + 1}层
            </span>
            )}
          </motion.div>
        )}
      </div>

      {coinResults.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="text-xs text-slate-500 mb-2 text-center">
            本次抛硬币序列
          </div>
          <div className="flex justify-center gap-1 flex-wrap">
            {coinResults.map((result, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2',
                  result === 'heads'
                    ? 'bg-green-100 border-green-400 text-green-700'
                    : 'bg-red-100 border-red-400 text-red-700'
                )}
              >
                {result === 'heads' ? '正' : '反'}
              </motion.div>
            ))}
          </div>
          <div className="text-xs text-slate-400 text-center mt-2">
            {coinResults.filter(r => r === 'heads').length} 正 / {coinResults.length} 次
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
