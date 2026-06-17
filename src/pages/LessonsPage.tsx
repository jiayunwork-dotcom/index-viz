import { useState } from 'react';
import { cn } from '@/lib/utils';

type QType = 'choice' | 'fill' | 'practice';

interface Lesson {
  id: number;
  title: string;
  module: string;
  type: QType;
  question: string;
  options?: string[];
  answer: string | number;
  explanation: string;
}

const LESSONS: Lesson[] = [
  { id: 1, module: '基础', title: '数组随机访问', type: 'choice',
    question: '数组支持随机访问的时间复杂度是?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    answer: 0, explanation: '数组内存连续, 通过下标计算地址可直接访问, O(1) 时间。' },
  { id: 2, module: '基础', title: '链表插入', type: 'choice',
    question: '已知节点指针, 在其后插入新节点的时间复杂度?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'],
    answer: 0, explanation: '修改两个指针即可, 无需遍历。' },
  { id: 3, module: '基础', title: '链表缺点', type: 'fill',
    question: '链表相比数组的主要缺点是不支持 ____ 访问。', answer: '随机',
    explanation: '链表内存不连续, 无法通过下标 O(1) 访问任意元素。' },
  { id: 4, module: 'B树', title: 'B树阶数含义', type: 'choice',
    question: 'M阶B树每个节点最多有多少个子节点?', options: ['M-1', 'M', '⌈M/2⌉', '2M'],
    answer: 1, explanation: 'M阶B树: 最多M个子节点, 最多M-1个key。' },
  { id: 5, module: 'B树', title: '分裂触发', type: 'fill',
    question: 'B树节点key数超过 ____ 时会触发分裂。', answer: 'M-1',
    explanation: '超过最大key数M-1后, 节点分裂为两个节点并上推中间key。' },
  { id: 6, module: 'B树', title: 'B树搜索路径', type: 'practice',
    question: '在3阶B树[5,10]中插入3后根节点有几个key?', answer: 1,
    explanation: '插入后叶子节点[3,5]溢出分裂, 中间key 5上推, 根节点变为[5]。' },
  { id: 7, module: 'B+树', title: 'B+树数据位置', type: 'choice',
    question: 'B+树的数据存储在哪些节点?', options: ['根节点', '内部节点', '叶节点', '所有节点'],
    answer: 2, explanation: 'B+树所有数据都在叶节点, 内部节点只存索引key。' },
  { id: 8, module: 'B+树', title: '叶节点链表', type: 'fill',
    question: 'B+树叶节点通过 ____ 连接, 便于范围查询。', answer: '链表',
    explanation: '叶节点链表使范围查询只需定位起点然后沿链表遍历。' },
  { id: 9, module: 'B+树', title: '删除合并', type: 'practice',
    question: 'B+树节点key数低于 ____ 时可能触发合并或借位。', answer: '⌈M/2⌉-1',
    explanation: '低于最小key数时, 先尝试向兄弟借位, 不行则合并。' },
  { id: 10, module: 'Hash', title: '碰撞链式法', type: 'choice',
    question: '链式法解决哈希碰撞的缺点是?', options: ['缓存不友好', '需要rehash', '不能删除', '有序'],
    answer: 0, explanation: '链表节点内存不连续, 对CPU缓存不友好。' },
  { id: 11, module: 'Hash', title: '负载因子', type: 'fill',
    question: '哈希表负载因子 = 元素数 / ____。', answer: '桶数量',
    explanation: '负载因子过高会导致性能下降, 需要扩容rehash。' },
  { id: 12, module: 'Hash', title: 'Rehash过程', type: 'practice',
    question: '桶数量从8扩容到16, 原桶3的元素可能被映射到哪些新桶?', answer: '3和11',
    explanation: '新hash值 = old或 old + 8, 即3和11。' },
  { id: 13, module: 'LSM', title: '写入路径', type: 'choice',
    question: 'LSM-Tree写入首先落在哪里?', options: ['SSTable', 'MemTable', 'WAL', 'L0'],
    answer: 1, explanation: '写入先写入内存MemTable, 满了再刷盘成SSTable。' },
  { id: 14, module: 'LSM', title: '写放大', type: 'fill',
    question: 'LSM-Tree的Compaction过程会导致 ____ 放大问题。', answer: '写',
    explanation: 'Compaction需要多次读写已写入的数据, 导致写放大。' },
  { id: 15, module: 'LSM', title: '墓碑标记', type: 'practice',
    question: 'LSM删除时不立刻清除数据, 而是写入一个 ____ 标记。', answer: '墓碑',
    explanation: '墓碑标记在后续Compaction时才真正清除对应数据。' },
  { id: 16, module: '综合', title: '写密集场景', type: 'choice',
    question: '写密集场景推荐哪种索引?', options: ['B+树', 'Hash', 'LSM-Tree', '跳表'],
    answer: 2, explanation: 'LSM-Tree将随机写转为顺序写, 写吞吐最高。' },
  { id: 17, module: '综合', title: '范围查询', type: 'choice',
    question: '以下哪种结构不支持高效范围查询?', options: ['B+树', '跳表', 'Hash', 'LSM-Tree'],
    answer: 2, explanation: 'Hash不保留数据有序性, 范围查询需要全表扫描。' },
  { id: 18, module: '综合', title: '内存KV存储', type: 'choice',
    question: 'Redis的Sorted Set内部使用哪种结构?', options: ['B+树', 'Hash', '跳表', 'LSM'],
    answer: 2, explanation: 'Redis ZSet 使用跳表 + 哈希表实现, 兼顾有序查询和O(1)查找。' },
];

export default function LessonsPage() {
  const [unlocked, setUnlocked] = useState(1);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [userChoice, setUserChoice] = useState<number | null>(null);
  const [userFill, setUserFill] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [scores, setScores] = useState<Record<number, number>>({});

  const current = LESSONS.find((l) => l.id === currentId) || null;

  const isCorrect = () => {
    if (!current) return false;
    if (current.type === 'choice') return userChoice === current.answer;
    return userFill.trim().toLowerCase() === String(current.answer).toLowerCase();
  };

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
  };

  const groups = Array.from(new Set(LESSONS.map((l) => l.module)));

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">🎓 教学关卡</h2>
          <p className="text-sm text-slate-500">18个递进关卡, 掌握索引核心原理</p>
        </div>
        <div className="text-sm text-slate-600">
          已通过 <b className="text-emerald-600">{Object.keys(scores).length}</b> / {LESSONS.length} 关
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
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {current && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-xs text-slate-500">L{current.id} · {current.module} · {current.type === 'choice' ? '选择题' : current.type === 'fill' ? '填空题' : '操作题'}</div>
                <h3 className="text-lg font-bold text-slate-800 mt-0.5">{current.title}</h3>
              </div>
              <button onClick={close} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>

            <p className="text-slate-700 mb-4">{current.question}</p>

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
                        'w-full text-left px-4 py-2.5 rounded-lg border-2 transition-all',
                        userChoice === i && !submitted && 'border-primary-500 bg-primary-50',
                        userChoice !== i && !submitted && 'border-slate-200 hover:border-slate-300',
                        showCorrect && 'border-emerald-500 bg-emerald-50',
                        showWrong && 'border-red-500 bg-red-50'
                      )}
                    >
                      <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                      {showCorrect && <span className="ml-2 text-emerald-600">✓</span>}
                      {showWrong && <span className="ml-2 text-red-600">✗</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {current.type === 'fill' && (
              <input
                type="text"
                value={userFill}
                onChange={(e) => setUserFill(e.target.value)}
                disabled={submitted}
                placeholder="请输入答案"
                className={cn(
                  'input w-full mb-4',
                  submitted && isCorrect() && 'border-emerald-500 bg-emerald-50',
                  submitted && !isCorrect() && 'border-red-500 bg-red-50'
                )}
              />
            )}

            {current.type === 'practice' && (
              <input
                type="text"
                value={userFill}
                onChange={(e) => setUserFill(e.target.value)}
                disabled={submitted}
                placeholder="请输入答案"
                className={cn(
                  'input w-full mb-4',
                  submitted && isCorrect() && 'border-emerald-500 bg-emerald-50',
                  submitted && !isCorrect() && 'border-red-500 bg-red-50'
                )}
              />
            )}

            {submitted && (
              <div className={cn(
                'p-3 rounded-lg mb-4',
                isCorrect() ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'
              )}>
                <div className="font-semibold mb-1">
                  {isCorrect() ? '✅ 回答正确! ' + '⭐'.repeat(3) : '❌ 回答错误'}
                </div>
                <div className="text-sm text-slate-600">
                  <b>正确答案:</b> {current.type === 'choice' && current.options ? current.options[current.answer as number] : current.answer}
                </div>
                <div className="text-sm text-slate-600 mt-1"><b>解析:</b> {current.explanation}</div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={close} className="btn-secondary">{submitted ? '关闭' : '取消'}</button>
              {!submitted && (
                <button
                  onClick={submit}
                  disabled={(current.type === 'choice' && userChoice === null) || (current.type !== 'choice' && !userFill.trim())}
                  className="btn-primary"
                >
                  提交答案
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
