import { Link } from 'react-router-dom';

const modules = [
  {
    path: '/btree',
    title: 'B树 / B+树',
    icon: '🌳',
    desc: '多路平衡搜索树，支持阶数调节，可视化插入分裂、删除合并、二分查找，B+树展示叶节点链表与范围查询。',
    color: 'from-green-500 to-emerald-600',
  },
  {
    path: '/hash',
    title: 'Hash索引',
    icon: '🔑',
    desc: '开放寻址与链式寻址两种哈希表，可视化碰撞处理、线性/二次/双重探测，以及扩容 rehash 全过程。',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    path: '/lsm',
    title: 'LSM-Tree',
    icon: '📚',
    desc: '写优化存储结构，MemTable → SSTable 刷盘、多层 Compaction、Size-Tiered 与 Leveled 策略对比。',
    color: 'from-orange-500 to-amber-600',
  },
  {
    path: '/wal',
    title: 'WAL 预写日志',
    icon: '📝',
    desc: '数据库 Write-Ahead Log 工作原理，日志追加、Checkpoint、崩溃模拟与恢复过程动画演示。',
    color: 'from-rose-500 to-pink-600',
  },
  {
    path: '/skiplist',
    title: '跳表',
    icon: '🎿',
    desc: '多层链表索引，抛硬币升层、概率层高分布，搜索路径可视化。',
    color: 'from-purple-500 to-fuchsia-600',
  },
  {
    path: '/bloom',
    title: '布隆过滤器',
    icon: '🌸',
    desc: '概率型数据结构，k个哈希函数映射、实时误判率计算、位数组饱和效果展示。',
    color: 'from-pink-500 to-rose-600',
  },
  {
    path: '/rtree',
    title: 'R树',
    icon: '📐',
    desc: '二维空间索引，最小面积增长插入、MBR分裂动画、范围查询与最近邻搜索。',
    color: 'from-cyan-500 to-teal-600',
  },
];

const tools = [
  {
    path: '/comparison',
    title: '性能对比',
    icon: '📊',
    desc: '同序列数据在各索引结构上的性能对比，支持柱状图与表格双视图。',
  },
  {
    path: '/lessons',
    title: '教学关卡',
    icon: '🎓',
    desc: '18个递进关卡，从基础数组链表到综合对比，包含选择/填空/操作题。',
  },
  {
    path: '/custom',
    title: '自定义模式',
    icon: '⚙️',
    desc: '任意 key 序列（整数/字符串/浮点数）、随机生成、预设场景一键填充。',
  },
];

export default function Home() {
  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            数据库索引交互式可视化教学工具
          </h1>
          <p className="text-slate-600 text-lg max-w-2xl mx-auto">
            通过动画直观理解 B树、Hash、LSM-Tree、跳表、布隆过滤器、R树
            等索引数据结构的工作原理与性能特征。
          </p>
        </div>

        <h2 className="text-xl font-semibold text-slate-800 mb-4">核心数据结构</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
          {modules.map((m) => (
            <Link
              key={m.path}
              to={m.path}
              className="card p-5 hover:shadow-md transition-all group"
            >
              <div
                className={`w-12 h-12 rounded-lg bg-gradient-to-br ${m.color}
                           flex items-center justify-center text-2xl mb-3
                           group-hover:scale-110 transition-transform`}
              >
                {m.icon}
              </div>
              <h3 className="font-semibold text-lg text-slate-900 mb-1.5">
                {m.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{m.desc}</p>
            </Link>
          ))}
        </div>

        <h2 className="text-xl font-semibold text-slate-800 mb-4">辅助工具</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tools.map((t) => (
            <Link
              key={t.path}
              to={t.path}
              className="card p-5 hover:shadow-md transition-all group border-l-4 border-primary-500"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{t.icon}</span>
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">{t.title}</h3>
                  <p className="text-sm text-slate-600">{t.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
