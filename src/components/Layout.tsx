import { Outlet, NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: '首页', icon: '🏠' },
  { path: '/btree', label: 'B树/B+树', icon: '🌳' },
  { path: '/fragmentation', label: '页面碎片化', icon: '📊' },
  { path: '/hash', label: 'Hash索引', icon: '🔑' },
  { path: '/lsm', label: 'LSM-Tree', icon: '📚' },
  { path: '/wal', label: 'WAL预写日志', icon: '📝' },
  { path: '/mvcc', label: 'MVCC多版本并发', icon: '🔄' },
  { path: '/skiplist', label: '跳表', icon: '🎿' },
  { path: '/bloom', label: '布隆过滤器', icon: '🌸' },
  { path: '/rtree', label: 'R树', icon: '📐' },
  { path: '/comparison', label: '性能对比', icon: '📈' },
  { path: '/lessons', label: '教学关卡', icon: '🎓' },
  { path: '/custom', label: '自定义', icon: '⚙️' },
];

export default function Layout() {
  return (
    <div className="flex h-screen w-full overflow-hidden">
      <aside className="w-56 flex-shrink-0 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-4 py-5 border-b border-slate-700">
          <h1 className="text-lg font-bold">索引可视化</h1>
          <p className="text-xs text-slate-400 mt-0.5">Interactive Index Viz</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
          数据库索引教学工具
        </div>
      </aside>

      <main className="flex-1 overflow-auto bg-slate-50">
        <Outlet />
      </main>
    </div>
  );
}
