import { useState, useMemo } from 'react';
import { generateSequence, randomFloat, randomString, randomInt } from '@/lib/utils';
import { BTree } from '@/structures/btree/btree';
import BTreeCanvas from '@/components/btree/BTreeCanvas';
import HashCanvas from '@/components/hash/HashCanvas';
import { HashTable } from '@/structures/hash/hash';
import SkipListCanvas from '@/components/skiplist/SkipListCanvas';
import { SkipList } from '@/structures/skiplist/skiplist';
import BloomCanvas from '@/components/bloom/BloomCanvas';
import { BloomFilter } from '@/structures/bloom/bloom';

type DataType = 'int' | 'float' | 'string';
type StructureType = 'btree' | 'bplus' | 'hash' | 'skiplist' | 'bloom';
type Preset = 'increasing' | 'decreasing' | 'random' | 'duplicates' | 'normal';

export default function CustomPage() {
  const [dataType, setDataType] = useState<DataType>('int');
  const [structure, setStructure] = useState<StructureType>('btree');
  const [count, setCount] = useState(20);
  const [preset, setPreset] = useState<Preset>('random');
  const [customData, setCustomData] = useState('');
  const [btreeOrder, setBtreeOrder] = useState(4);
  const [hashSize, setHashSize] = useState(16);
  const [bloomM, setBloomM] = useState(64);
  const [bloomK, setBloomK] = useState(4);

  const [generatedData, setGeneratedData] = useState<any[]>([]);
  const [visualization, setVisualization] = useState<any>(null);

  const generatePresetData = () => {
    let data: any[] = [];
    if (dataType === 'int') {
      data = generateSequence(preset, count);
    } else if (dataType === 'float') {
      for (let i = 0; i < count; i++) {
        data.push(randomFloat(0, 100, 2));
      }
      if (preset === 'increasing') data.sort((a, b) => a - b);
      if (preset === 'decreasing') data.sort((a, b) => b - a);
    } else if (dataType === 'string') {
      data = Array.from({ length: count }, () => randomString(4));
      if (preset === 'increasing') data.sort();
      if (preset === 'decreasing') data.sort((a, b) => b.localeCompare(a));
    }
    setGeneratedData(data);
    buildVisualization(data);
  };

  const parseCustom = () => {
    const parts = customData.split(/[\s,，;]+/).filter(Boolean);
    let data: any[] = [];
    if (dataType === 'int') data = parts.map((p) => parseInt(p)).filter((n) => !isNaN(n));
    else if (dataType === 'float') data = parts.map((p) => parseFloat(p)).filter((n) => !isNaN(n));
    else data = parts;
    setGeneratedData(data);
    buildVisualization(data);
  };

  const buildVisualization = (data: any[]) => {
    const numbers = data.map((d) => (typeof d === 'number' ? d : String(d).split('').reduce((a, c) => a + c.charCodeAt(0), 0)));

    if (structure === 'btree' || structure === 'bplus') {
      const t = new BTree(btreeOrder, structure === 'bplus');
      numbers.forEach((n) => t.insert(n));
      setVisualization({ type: 'btree', frame: t.makeFrame('自定义数据构建完成').data });
    } else if (structure === 'hash') {
      const h = new HashTable(hashSize, 'modulo', 'chaining');
      numbers.forEach((n) => h.insert(n));
      setVisualization({ type: 'hash', frame: h.makeFrame('自定义数据构建完成').data });
    } else if (structure === 'skiplist') {
      const s = new SkipList(8, 0.5);
      numbers.forEach((n) => s.insert(n));
      setVisualization({ type: 'skiplist', frame: s.makeFrame('自定义数据构建完成').data });
    } else if (structure === 'bloom') {
      const b = new BloomFilter(bloomM, bloomK);
      data.forEach((d) => b.insert(String(d)));
      setVisualization({ type: 'bloom', frame: b.makeFrame('自定义数据构建完成').data });
    }
  };

  const stats = useMemo(() => {
    if (generatedData.length === 0) return null;
    if (dataType === 'string') {
      return { count: generatedData.length, unique: new Set(generatedData).size };
    }
    const nums = generatedData as number[];
    return {
      count: nums.length,
      min: Math.min(...nums),
      max: Math.max(...nums),
      avg: nums.reduce((a, b) => a + b, 0) / nums.length,
      unique: new Set(nums).size,
    };
  }, [generatedData, dataType]);

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800">⚙️ 自定义数据模式</h2>
        <p className="text-sm text-slate-500">任意数据类型与数据结构组合实验</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 space-y-4">
          <h3 className="font-semibold text-slate-800">配置</h3>

          <div>
            <label className="block text-xs text-slate-600 mb-1">数据类型</label>
            <div className="flex gap-2">
              {(['int', 'float', 'string'] as DataType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setDataType(t)}
                  className={cn(
                    'flex-1 py-1.5 rounded border text-sm',
                    dataType === t ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-slate-300 hover:bg-slate-50'
                  )}
                >
                  {t === 'int' ? '整数' : t === 'float' ? '浮点数' : '字符串'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">数据结构</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { k: 'btree', l: 'B树' },
                { k: 'bplus', l: 'B+树' },
                { k: 'hash', l: 'Hash表' },
                { k: 'skiplist', l: '跳表' },
                { k: 'bloom', l: '布隆过滤器' },
              ] as { k: StructureType; l: string }[]).map((s) => (
                <button
                  key={s.k}
                  onClick={() => setStructure(s.k)}
                  className={cn(
                    'py-1.5 rounded border text-sm',
                    structure === s.k ? 'bg-primary-600 text-white border-primary-600' : 'bg-white border-slate-300 hover:bg-slate-50'
                  )}
                >
                  {s.l}
                </button>
              ))}
            </div>
          </div>

          {(structure === 'btree' || structure === 'bplus') && (
            <div>
              <label className="block text-xs text-slate-600 mb-1">B树阶数 M: {btreeOrder}</label>
              <input type="range" min={3} max={7} value={btreeOrder} onChange={(e) => setBtreeOrder(parseInt(e.target.value))} className="w-full" />
            </div>
          )}
          {structure === 'hash' && (
            <div>
              <label className="block text-xs text-slate-600 mb-1">哈希桶数量: {hashSize}</label>
              <input type="range" min={4} max={64} value={hashSize} onChange={(e) => setHashSize(parseInt(e.target.value))} className="w-full" />
            </div>
          )}
          {structure === 'bloom' && (
            <>
              <div>
                <label className="block text-xs text-slate-600 mb-1">位数组 m: {bloomM}</label>
                <input type="range" min={16} max={256} value={bloomM} onChange={(e) => setBloomM(parseInt(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">哈希函数 k: {bloomK}</label>
                <input type="range" min={1} max={10} value={bloomK} onChange={(e) => setBloomK(parseInt(e.target.value))} className="w-full" />
              </div>
            </>
          )}
        </div>

        <div className="card p-4 space-y-4">
          <h3 className="font-semibold text-slate-800">预设生成</h3>
          <div>
            <label className="block text-xs text-slate-600 mb-1">分布类型</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value as Preset)} className="input w-full">
              <option value="increasing">顺序递增</option>
              <option value="decreasing">顺序递减</option>
              <option value="random">随机分布</option>
              <option value="duplicates">大量重复</option>
              <option value="normal">正态分布</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">数量 N: {count}</label>
            <input type="range" min={1} max={200} value={count} onChange={(e) => setCount(parseInt(e.target.value))} className="w-full" />
          </div>
          <button onClick={generatePresetData} className="btn-primary w-full">🎲 生成并构建</button>

          <div className="border-t pt-3">
            <label className="block text-xs text-slate-600 mb-1">或粘贴自定义数据 (逗号/空格分隔)</label>
            <textarea
              value={customData}
              onChange={(e) => setCustomData(e.target.value)}
              placeholder={dataType === 'int' ? '如: 5, 3, 8, 1, 10' : dataType === 'float' ? '如: 3.14, 2.71, 1.41' : '如: apple, banana, cherry'}
              rows={4}
              className="input w-full resize-none"
            />
            <button onClick={parseCustom} className="btn-secondary w-full mt-2">✓ 解析并构建</button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold text-slate-800 mb-3">数据统计</h3>
          {stats ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">元素总数</span><span className="font-mono font-semibold">{stats.count}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">唯一值</span><span className="font-mono font-semibold">{stats.unique}</span></div>
              {'min' in stats && (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">最小值</span><span className="font-mono font-semibold">{stats.min}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">最大值</span><span className="font-mono font-semibold">{stats.max}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">平均值</span><span className="font-mono font-semibold">{stats.avg?.toFixed(2) ?? '0.00'}</span></div>
                </>
              )}
              <div className="border-t pt-2 mt-2">
                <div className="text-xs text-slate-500 mb-1">数据预览:</div>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-auto">
                  {generatedData.slice(0, 50).map((d, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-slate-100 rounded text-xs font-mono">{String(d)}</span>
                  ))}
                  {generatedData.length > 50 && <span className="text-xs text-slate-400">+{generatedData.length - 50}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-sm text-center py-8">生成或粘贴数据后显示统计</div>
          )}
        </div>
      </div>

      {visualization && (
        <div className="card p-4 flex-1 min-h-[400px]">
          <h3 className="font-semibold text-slate-800 mb-3">可视化结果</h3>
          <div className="border rounded-lg h-96 overflow-hidden">
            {visualization.type === 'btree' && <BTreeCanvas frame={visualization.frame} />}
            {visualization.type === 'hash' && <HashCanvas frame={visualization.frame} />}
            {visualization.type === 'skiplist' && <SkipListCanvas frame={visualization.frame} />}
            {visualization.type === 'bloom' && <BloomCanvas frame={visualization.frame} />}
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
