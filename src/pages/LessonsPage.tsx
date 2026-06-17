import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type QType = 'choice' | 'fill' | 'practice';

interface PracticeAction {
  kind: 'order' | 'click' | 'classify';
  items: string[];
  targets?: string[];
  prompt: string;
}

interface Lesson {
  id: number;
  title: string;
  module: string;
  type: QType;
  question: string;
  options?: string[];
  answer: string | number;
  explanation: string;
  practiceAction?: PracticeAction;
}

const LESSONS: Lesson[] = [
  { id: 1, module: '基础', title: '数组随机访问', type: 'choice',
    question: '数组支持随机访问的时间复杂度是?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    answer: 0, explanation: '数组内存连续, 通过下标计算地址可直接访问, O(1) 时间。' },
  { id: 2, module: '基础', title: '链表插入操作', type: 'practice',
    question: '将链表节点按正确的插入操作步骤排序:', answer: '1-2-3',
    practiceAction: { kind: 'order', items: ['创建新节点', '新节点.next指向后继', '前驱.next指向新节点'], prompt: '拖拽排序正确的插入步骤' },
    explanation: '先创建新节点, 然后连接新节点到后继, 最后断开前驱旧连接指向新节点。' },
  { id: 3, module: '基础', title: '链表缺点', type: 'fill',
    question: '链表相比数组的主要缺点是不支持 ____ 访问。', answer: '随机',
    explanation: '链表内存不连续, 无法通过下标 O(1) 访问任意元素。' },
  { id: 4, module: 'B树', title: 'B树阶数含义', type: 'choice',
    question: 'M阶B树每个节点最多有多少个子节点?', options: ['M-1', 'M', '⌈M/2⌉', '2M'],
    answer: 1, explanation: 'M阶B树: 最多M个子节点, 最多M-1个key。' },
  { id: 5, module: 'B树', title: '分裂触发条件', type: 'fill',
    question: '3阶B树每个节点最多容纳 ____ 个key, 超过则分裂。', answer: '2',
    explanation: '3阶B树最多M-1=2个key, 插入第3个时触发分裂。' },
  { id: 6, module: 'B树', title: '分裂过程排序', type: 'practice',
    question: '将B树节点分裂的正确步骤排序:', answer: '1-2-3',
    practiceAction: { kind: 'order', items: ['节点溢出闪烁变红', '中间key向上弹出', '左右子节点分离滑开'], prompt: '排序分裂动画的正确顺序' },
    explanation: '先检测到溢出(变红), 然后中间key上推到父节点, 最后左右子节点分离。' },
  { id: 7, module: 'B+树', title: 'B+树数据位置', type: 'choice',
    question: 'B+树的数据存储在哪些节点?', options: ['根节点', '内部节点', '叶节点', '所有节点'],
    answer: 2, explanation: 'B+树所有数据都在叶节点, 内部节点只存索引key。' },
  { id: 8, module: 'B+树', title: '叶节点连接方式', type: 'fill',
    question: 'B+树叶节点通过 ____ 指针连接, 便于范围查询。', answer: '链表',
    explanation: '叶节点链表使范围查询只需定位起点然后沿链表遍历。' },
  { id: 9, module: 'B+树', title: '范围查询步骤', type: 'practice',
    question: 'B+树范围查询[10,30]的正确步骤是?', answer: '1-2-3',
    practiceAction: { kind: 'order', items: ['从根节点二分查找定位到10所在叶节点', '从叶节点10开始沿链表向右遍历', '遍历到30后停止返回结果'], prompt: '排序范围查询的正确步骤' },
    explanation: '先定位范围起点, 然后沿叶链遍历, 到终点后停止。' },
  { id: 10, module: 'Hash', title: '碰撞链式法', type: 'choice',
    question: '链式法解决哈希碰撞的缺点是?', options: ['缓存不友好', '需要rehash', '不能删除', '有序'],
    answer: 0, explanation: '链表节点内存不连续, 对CPU缓存不友好。' },
  { id: 11, module: 'Hash', title: '负载因子公式', type: 'fill',
    question: '哈希表负载因子 = 元素数 / ____。', answer: '桶数量',
    explanation: '负载因子过高会导致性能下降, 需要扩容rehash。' },
  { id: 12, module: 'Hash', title: 'Rehash分类', type: 'practice',
    question: '将以下哈希碰撞处理策略分类:', answer: 'open-chaining',
    practiceAction: { kind: 'classify', items: ['线性探测', '二次探测', '拉链法', '双重散列'], targets: ['开放寻址', '链式寻址'], prompt: '将每个策略拖入正确的分类' },
    explanation: '开放寻址法包含线性探测、二次探测、双重散列; 链式寻址即拉链法。' },
  { id: 13, module: 'LSM', title: '写入路径', type: 'choice',
    question: 'LSM-Tree写入首先落在哪里?', options: ['SSTable', 'MemTable', 'WAL', 'L0'],
    answer: 1, explanation: '写入先写入内存MemTable, 满了再刷盘成SSTable。' },
  { id: 14, module: 'LSM', title: '写放大', type: 'fill',
    question: 'LSM-Tree的Compaction过程会导致 ____ 放大问题。', answer: '写',
    explanation: 'Compaction需要多次读写已写入的数据, 导致写放大。' },
  { id: 15, module: 'LSM', title: 'LSM写入路径排序', type: 'practice',
    question: 'LSM-Tree写入数据的正确路径排序:', answer: '1-2-3-4',
    practiceAction: { kind: 'order', items: ['写入MemTable', 'MemTable满后冻结为Immutable', '刷盘生成L0 SSTable', 'Compaction合并到下层'], prompt: '排序数据从写入到最终落盘的路径' },
    explanation: 'MemTable→Immutable→SSTable(L0)→Compaction合并是完整的写入路径。' },
  { id: 16, module: '综合', title: '写密集场景', type: 'choice',
    question: '写密集场景推荐哪种索引?', options: ['B+树', 'Hash', 'LSM-Tree', '跳表'],
    answer: 2, explanation: 'LSM-Tree将随机写转为顺序写, 写吞吐最高。' },
  { id: 17, module: '综合', title: '索引选择填空', type: 'fill',
    question: '需要精确点查且不需要范围查询, 应选择 ____ 索引。', answer: 'Hash',
    explanation: 'Hash索引O(1)点查, 但不保留有序性, 不支持范围查询。' },
  { id: 18, module: '综合', title: 'Workload匹配', type: 'practice',
    question: '将以下场景匹配到最合适的索引结构:', answer: 'bplus-lsm-hash-skip',
    practiceAction: { kind: 'classify', items: ['范围查询为主', '写密集日志', '精确点查', '内存有序集合'], targets: ['B+树', 'LSM-Tree', 'Hash', '跳表'], prompt: '将每个场景拖入最合适的索引分类' },
    explanation: '范围查询→B+树(叶链遍历); 写密集→LSM(顺序写); 点查→Hash(O(1)); 内存有序→跳表(平衡+简单)。' },
];

function OrderPractice({ action, onComplete }: { action: PracticeAction; onComplete: (correct: boolean) => void }) {
  const [items, setItems] = useState(() => [...action.items].sort(() => Math.random() - 0.5));
  const [submitted, setSubmitted] = useState(false);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setItems(next);
  };
  const moveDown = (idx: number) => {
    if (idx === items.length - 1) return;
    const next = [...items];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setItems(next);
  };

  const isCorrect = items.every((item, i) => item === action.items[i]);

  const handleSubmit = () => {
    setSubmitted(true);
    onComplete(isCorrect);
  };

  return (
    <div>
      <p className="text-sm text-slate-500 mb-2">{action.prompt}</p>
      <div className="space-y-1.5 mb-4">
        {items.map((item, i) => (
          <div key={item} className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all',
            submitted && item === action.items[i] ? 'border-emerald-400 bg-emerald-50' : '',
            submitted && item !== action.items[i] ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
          )}>
            <span className="text-xs font-bold text-slate-400 w-5">{i + 1}.</span>
            <span className="flex-1 text-sm text-slate-700">{item}</span>
            {!submitted && (
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveUp(i)} disabled={i === 0} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30">↑</button>
                <button onClick={() => moveDown(i)} disabled={i === items.length - 1} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30">↓</button>
              </div>
            )}
            {submitted && item === action.items[i] && <span className="text-emerald-600">✓</span>}
            {submitted && item !== action.items[i] && <span className="text-red-600">✗</span>}
          </div>
        ))}
      </div>
      {!submitted && (
        <button onClick={handleSubmit} className="btn-primary w-full">确认排序</button>
      )}
    </div>
  );
}

function ClassifyPractice({ action, onComplete }: { action: PracticeAction; onComplete: (correct: boolean) => void }) {
  const targets = action.targets || [];
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const assign = (item: string, target: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      if (next[item] === target) {
        delete next[item];
      } else {
        next[item] = target;
      }
      return next;
    });
  };

  const correctMap: Record<string, string> = {};
  if (action.kind === 'classify') {
    if (action.items.length === 4 && targets.length === 2) {
      correctMap[action.items[0]] = targets[0];
      correctMap[action.items[1]] = targets[0];
      correctMap[action.items[2]] = targets[1];
      correctMap[action.items[3]] = targets[0];
    }
    if (action.items.length === 4 && targets.length === 4) {
      action.items.forEach((item, i) => {
        correctMap[item] = targets[i];
      });
    }
  }

  const isCorrect = action.items.every((item) => assignments[item] === correctMap[item]);

  const handleSubmit = () => {
    setSubmitted(true);
    onComplete(isCorrect);
  };

  const allAssigned = action.items.every((item) => assignments[item]);

  return (
    <div>
      <p className="text-sm text-slate-500 mb-2">{action.prompt}</p>
      <div className="flex gap-3 mb-4">
        {targets.map((target) => (
          <div key={target} className="flex-1">
            <div className="text-center font-semibold text-sm text-slate-700 mb-2 px-2 py-1 bg-slate-100 rounded">{target}</div>
            <div className="min-h-[80px] border-2 border-dashed border-slate-300 rounded-lg p-2 space-y-1">
              {action.items.filter((item) => assignments[item] === target).map((item) => (
                <div key={item} className={cn(
                  'px-2 py-1.5 rounded text-xs font-medium text-center cursor-pointer transition-all',
                  submitted && assignments[item] === correctMap[item] ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : '',
                  submitted && assignments[item] !== correctMap[item] ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-blue-100 text-blue-700 border border-blue-300 hover:bg-blue-200'
                )} onClick={() => !submitted && assign(item, target)}>
                  {item}
                  {submitted && assignments[item] !== correctMap[item] && <span className="ml-1">→{correctMap[item]}</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mb-3">
        <p className="text-xs text-slate-500 mb-1">点击项目分配到分类 (再次点击取消):</p>
        <div className="flex flex-wrap gap-1.5">
          {action.items.filter((item) => !assignments[item]).map((item) => (
            <button key={item} className="px-2 py-1 rounded text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200" onClick={() => {
              const firstTarget = targets[0];
              if (firstTarget) assign(item, firstTarget);
            }}>
              {item}
            </button>
          ))}
        </div>
      </div>
      {!submitted && (
        <button onClick={handleSubmit} disabled={!allAssigned} className="btn-primary w-full disabled:opacity-50">确认分类</button>
      )}
    </div>
  );
}

export default function LessonsPage() {
  const [unlocked, setUnlocked] = useState(1);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [userChoice, setUserChoice] = useState<number | null>(null);
  const [userFill, setUserFill] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [practiceCorrect, setPracticeCorrect] = useState(false);

  const current = LESSONS.find((l) => l.id === currentId) || null;

  const isCorrect = useCallback(() => {
    if (!current) return false;
    if (current.type === 'choice') return userChoice === current.answer;
    if (current.type === 'practice') return practiceCorrect;
    return userFill.trim().toLowerCase() === String(current.answer).toLowerCase();
  }, [current, userChoice, userFill, practiceCorrect]);

  const submit = () => {
    setSubmitted(true);
    if (current && isCorrect()) {
      const stars = 3;
      setScores((s) => ({ ...s, [current.id]: Math.max(s[current.id] || 0, stars) }));
      setUnlocked((u) => Math.max(u, current.id + 1));
    }
  };

  const close = () => {
    setCurrentId(null);
    setUserChoice(null);
    setUserFill('');
    setSubmitted(false);
    setPracticeCorrect(false);
  };

  const groups = Array.from(new Set(LESSONS.map((l) => l.module)));

  const getTypeBadge = (type: QType) => {
    switch (type) {
      case 'choice': return { label: '选择', color: 'bg-blue-100 text-blue-700' };
      case 'fill': return { label: '填空', color: 'bg-amber-100 text-amber-700' };
      case 'practice': return { label: '操作', color: 'bg-purple-100 text-purple-700' };
    }
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🎓 教学关卡</h2>
          <p className="text-sm text-slate-500">18个递进关卡, 掌握索引核心原理</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600">
            已通过 <b className="text-emerald-600">{Object.keys(scores).length}</b> / {LESSONS.length} 关
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">选择</span>
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">填空</span>
            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700">操作</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g} className="card p-4">
            <h3 className="font-semibold text-slate-700 mb-3">{g}</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {LESSONS.filter((l) => l.module === g).map((l) => {
                const locked = l.id > unlocked;
                const stars = scores[l.id] || 0;
                const done = stars > 0;
                const badge = getTypeBadge(l.type);
                return (
                  <button
                    key={l.id}
                    onClick={() => !locked && setCurrentId(l.id)}
                    disabled={locked}
                    className={cn(
                      'p-3 rounded-lg border-2 text-left transition-all',
                      locked && 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed',
                      !locked && done && 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100',
                      !locked && !done && 'bg-white border-slate-300 hover:border-primary-400 hover:bg-primary-50'
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-slate-500">L{l.id}</span>
                      {locked && <span>🔒</span>}
                      {!locked && done && <span className="text-xs">{'⭐'.repeat(stars)}</span>}
                    </div>
                    <div className="text-sm font-medium text-slate-800 truncate">{l.title}</div>
                    <div className={`mt-1 inline-block px-1.5 py-0.5 rounded text-xs ${badge.color}`}>{badge.label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {current && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">L{current.id} · {current.module}</span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getTypeBadge(current.type).color}`}>
                      {current.type === 'choice' ? '选择题' : current.type === 'fill' ? '填空题' : '操作题'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mt-1">{current.title}</h3>
                </div>
                <button onClick={close} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>

              <p className="text-slate-700 mb-4 leading-relaxed">{current.question}</p>

              {current.type === 'choice' && current.options && (
                <div className="space-y-2 mb-4">
                  {current.options.map((opt, i) => {
                    const isCorrectOpt = i === current.answer;
                    const showCorrect = submitted && isCorrectOpt;
                    const showWrong = submitted && userChoice === i && !isCorrectOpt;
                    return (
                      <button
                        key={i}
                        disabled={submitted}
                        onClick={() => setUserChoice(i)}
                        className={cn(
                          'w-full text-left px-4 py-2.5 rounded-lg border-2 transition-all flex items-center gap-2',
                          userChoice === i && !submitted && 'border-primary-500 bg-primary-50',
                          userChoice !== i && !submitted && 'border-slate-200 hover:border-slate-300',
                          showCorrect && 'border-emerald-500 bg-emerald-50',
                          showWrong && 'border-red-500 bg-red-50'
                        )}
                      >
                        <span className="font-semibold mr-1">{String.fromCharCode(65 + i)}.</span>{opt}
                        {showCorrect && <span className="ml-auto text-emerald-600">✓</span>}
                        {showWrong && <span className="ml-auto text-red-600">✗</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {current.type === 'fill' && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={userFill}
                    onChange={(e) => setUserFill(e.target.value)}
                    disabled={submitted}
                    placeholder="请输入答案..."
                    className={cn(
                      'input w-full',
                      submitted && isCorrect() && 'border-emerald-500 bg-emerald-50',
                      submitted && !isCorrect() && 'border-red-500 bg-red-50'
                    )}
                  />
                  <p className="text-xs text-slate-400 mt-1">输入关键词即可, 不区分大小写</p>
                </div>
              )}

              {current.type === 'practice' && current.practiceAction && (
                <div className="mb-4">
                  {current.practiceAction.kind === 'order' && (
                    <OrderPractice
                      action={current.practiceAction}
                      onComplete={(correct) => setPracticeCorrect(correct)}
                    />
                  )}
                  {current.practiceAction.kind === 'classify' && (
                    <ClassifyPractice
                      action={current.practiceAction}
                      onComplete={(correct) => setPracticeCorrect(correct)}
                    />
                  )}
                </div>
              )}

              {submitted && (
                <div className={cn(
                  'p-4 rounded-lg mb-4',
                  isCorrect() ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
                )}>
                  <div className="font-semibold mb-1 text-base">
                    {isCorrect() ? '✅ 回答正确! ' + '⭐'.repeat(3) : '❌ 回答错误'}
                  </div>
                  <div className="text-sm text-slate-600">
                    <b>正确答案:</b> {current.type === 'choice' && current.options ? current.options[current.answer as number] : current.answer}
                  </div>
                  <div className="text-sm text-slate-600 mt-1.5"><b>解析:</b> {current.explanation}</div>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <button onClick={close} className="btn-secondary">{submitted ? '关闭' : '取消'}</button>
                {!submitted && current.type !== 'practice' && (
                  <button
                    onClick={submit}
                    disabled={(current.type === 'choice' && userChoice === null) || (current.type === 'fill' && !userFill.trim())}
                    className="btn-primary disabled:opacity-50"
                  >
                    提交答案
                  </button>
                )}
                {!submitted && current.type === 'practice' && practiceCorrect && (
                  <button onClick={submit} className="btn-primary">确认完成</button>
                )}
                {!submitted && current.type === 'practice' && !practiceCorrect && submitted === false && (
                  <span className="text-sm text-slate-400 self-center">请先完成操作</span>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
