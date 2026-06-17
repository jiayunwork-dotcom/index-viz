import { useState } from 'react';
import { generateSequence } from '@/lib/utils';

interface DataInputProps {
  onInsert: (keys: number[]) => void;
  onSearch?: (key: number) => void;
  onDelete?: (key: number) => void;
  onClear: () => void;
  showSearchDelete?: boolean;
}

type PresetType = 'increasing' | 'decreasing' | 'random' | 'duplicates' | 'normal';

const presets: { key: PresetType; label: string }[] = [
  { key: 'increasing', label: '顺序递增' },
  { key: 'decreasing', label: '顺序递减' },
  { key: 'random', label: '随机分布' },
  { key: 'duplicates', label: '大量重复' },
  { key: 'normal', label: '正态分布' },
];

export default function DataInput({
  onInsert,
  onSearch,
  onDelete,
  onClear,
  showSearchDelete = true,
}: DataInputProps) {
  const [singleValue, setSingleValue] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [presetType, setPresetType] = useState<PresetType>('random');
  const [presetCount, setPresetCount] = useState(15);
  const [searchValue, setSearchValue] = useState('');
  const [deleteValue, setDeleteValue] = useState('');

  const handleInsertSingle = () => {
    const num = parseInt(singleValue);
    if (!isNaN(num)) {
      onInsert([num]);
      setSingleValue('');
    }
  };

  const handleInsertBulk = () => {
    const nums = bulkValue
      .split(/[\s,，;]+/)
      .map((s) => parseInt(s))
      .filter((n) => !isNaN(n));
    if (nums.length > 0) {
      onInsert(nums);
      setBulkValue('');
    }
  };

  const handleGeneratePreset = () => {
    const seq = generateSequence(presetType, presetCount);
    onInsert(seq);
  };

  const handleSearch = () => {
    const num = parseInt(searchValue);
    if (!isNaN(num) && onSearch) {
      onSearch(num);
      setSearchValue('');
    }
  };

  const handleDelete = () => {
    const num = parseInt(deleteValue);
    if (!isNaN(num) && onDelete) {
      onDelete(num);
      setDeleteValue('');
    }
  };

  return (
    <div className="card p-4 space-y-4">
      <h3 className="font-semibold text-slate-800">数据输入</h3>

      <div>
        <label className="block text-xs text-slate-600 mb-1">单个插入</label>
        <div className="flex gap-2">
          <input
            type="number"
            value={singleValue}
            onChange={(e) => setSingleValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInsertSingle()}
            placeholder="输入整数"
            className="input flex-1"
          />
          <button onClick={handleInsertSingle} className="btn-primary">
            插入
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-600 mb-1">批量粘贴 (逗号/空格分隔)</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={bulkValue}
            onChange={(e) => setBulkValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleInsertBulk()}
            placeholder="如: 5, 3, 8, 1, 10"
            className="input flex-1"
          />
          <button onClick={handleInsertBulk} className="btn-primary">
            批量插入
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-600 mb-1">预设序列</label>
        <div className="flex gap-2 flex-wrap">
          <select
            value={presetType}
            onChange={(e) => setPresetType(e.target.value as PresetType)}
            className="input w-auto"
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={200}
            value={presetCount}
            onChange={(e) => setPresetCount(parseInt(e.target.value) || 1)}
            className="input w-24"
            placeholder="数量"
          />
          <button onClick={handleGeneratePreset} className="btn-secondary">
            生成并插入
          </button>
        </div>
      </div>

      {showSearchDelete && (
        <>
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-xs text-slate-600 mb-1">搜索操作</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="要搜索的key"
                className="input flex-1"
              />
              <button onClick={handleSearch} className="btn-success">
                🔍 搜索
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 mb-1">删除操作</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={deleteValue}
                onChange={(e) => setDeleteValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDelete()}
                placeholder="要删除的key"
                className="input flex-1"
              />
              <button onClick={handleDelete} className="btn-danger">
                🗑 删除
              </button>
            </div>
          </div>
        </>
      )}

      <div className="border-t border-slate-200 pt-2">
        <button onClick={onClear} className="btn-secondary w-full">
          清空所有数据
        </button>
      </div>
    </div>
  );
}
