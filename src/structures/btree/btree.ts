import { BTreeNode } from './types';
import type { AnimationFrame } from '@/store/animationStore';

export class BTree {
  root: BTreeNode | null = null;
  order: number;
  isPlus: boolean;

  constructor(order: number, isPlus = false) {
    this.order = order;
    this.isPlus = isPlus;
  }

  get maxKeys(): number {
    return this.order - 1;
  }
  get minKeys(): number {
    return Math.ceil(this.order / 2) - 1;
  }

  insert(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    if (!this.root) {
      this.root = new BTreeNode(true);
      this.root.keys.push(key);
      frames.push(this.mkFrame('创建根节点', key, null, null));
      return frames;
    }
    const path: BTreeNode[] = [];
    this._insert(this.root, key, path, frames);
    return frames;
  }

  private _insert(node: BTreeNode, key: number, path: BTreeNode[], frames: AnimationFrame[]): void {
    path.push(node);
    if (node.isLeaf) {
      const idx = this._bisectInsert(node.keys, key);
      frames.push(this.mkFrame('在节点中定位插入位置: ' + key, key, node.id, 'searching'));
      node.keys.splice(idx, 0, key);
      frames.push(this.mkFrame('插入 key ' + key + ' 到节点', key, node.id, 'inserting'));
      if (node.keys.length > this.maxKeys) {
        this._splitUpward(node, path, frames);
      }
      return;
    }
    const idx = this._bisectChild(node.keys, key);
    frames.push(this.mkFrame('二分查找选择子节点', key, node.id, 'searching'));
    this._insert(node.children[idx], key, path, frames);
  }

  private _splitUpward(node: BTreeNode, path: BTreeNode[], frames: AnimationFrame[]): void {
    const mid = Math.floor(node.keys.length / 2);
    const upKey = node.keys[mid];

    frames.push(this.mkFrame('节点溢出，准备分裂 - 第一次闪烁', upKey, node.id, 'splitting'));

    const left = new BTreeNode(node.isLeaf);
    const right = new BTreeNode(node.isLeaf);
    if (this.isPlus) {
      left.keys = node.keys.slice(0, mid);
      right.keys = node.keys.slice(mid);
    } else {
      left.keys = node.keys.slice(0, mid);
      right.keys = node.keys.slice(mid + 1);
    }
    if (!node.isLeaf) {
      left.children = node.children.slice(0, mid + 1);
      right.children = node.children.slice(mid + 1);
    }

    frames.push(this.mkFrame('节点闪烁变红 - 中间 key 高亮', upKey, node.id, 'splitting'));

    const parentIdx = path.indexOf(node) - 1;
    if (parentIdx >= 0) {
      const parent = path[parentIdx];
      const insertIdx = this._bisectInsert(parent.keys, upKey);
      if (!this.isPlus) {
        parent.keys.splice(insertIdx, 0, upKey);
      }
      parent.children.splice(insertIdx, 1, left);
      parent.children.splice(insertIdx + 1, 0, right);
      frames.push(this.mkFrameSplit('中间 key ' + upKey + ' 向上弹出到父节点，左右子节点分离滑开', upKey, node.id, 'inserting', left.id, right.id));
      frames.push(this.mkFrameSplit('分裂完成，新节点归位', upKey, parent.id, 'inserting', left.id, right.id));
      if (parent.keys.length > this.maxKeys) {
        this._splitUpward(parent, path, frames);
      }
    } else {
      const newRoot = new BTreeNode(false);
      if (!this.isPlus) {
        newRoot.keys.push(upKey);
      }
      newRoot.children = [left, right];
      this.root = newRoot;
      frames.push(this.mkFrameSplit('中间 key ' + upKey + ' 向上弹出，创建新根', upKey, null, 'inserting', left.id, right.id));
      frames.push(this.mkFrameSplit('新根节点创建完成，左右子节点归位', upKey, newRoot.id, 'inserting', left.id, right.id));
    }
  }

  search(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    const path: string[] = [];
    this._searchNode(this.root, key, path, frames);
    return frames;
  }

  private _searchNode(node: BTreeNode | null, key: number, path: string[], frames: AnimationFrame[]): void {
    if (!node) return;
    path.push(node.id);
    const idx = this._bisectFind(node.keys, key);
    frames.push(this.mkFramePath('访问节点，二分查找定位', key, node.id, 'searching', path));
    if (idx < node.keys.length && node.keys[idx] === key) {
      frames.push(this.mkFramePath('找到 key ' + key, key, node.id, 'found', path));
      return;
    }
    if (node.isLeaf) {
      frames.push(this.mkFramePath('未找到 key ' + key, key, null, null, path));
      return;
    }
    this._searchNode(node.children[idx], key, path, frames);
  }

  rangeQuery(start: number, end: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    if (!this.isPlus || !this.root) return frames;
    frames.push(this.mkFrame('范围查询 [' + start + ', ' + end + ']', null, null, null));
    return frames;
  }

  delete(key: number): AnimationFrame[] {
    const frames: AnimationFrame[] = [];
    if (!this.root) return frames;
    this._delete(this.root, key, [], frames);
    if (this.root.keys.length === 0 && !this.root.isLeaf) {
      this.root = this.root.children[0] || null;
    }
    return frames;
  }

  private _delete(node: BTreeNode, key: number, path: BTreeNode[], frames: AnimationFrame[]): boolean {
    path.push(node);
    const idx = this._bisectFind(node.keys, key);
    if (idx < node.keys.length && node.keys[idx] === key) {
      frames.push(this.mkFrame('找到 key ' + key, key, node.id, 'found'));
      if (node.isLeaf) {
        node.keys.splice(idx, 1);
        frames.push(this.mkFrame('从叶节点删除 key ' + key, key, node.id, 'merging'));
      } else {
        const pred = this._getPredecessor(node, idx);
        node.keys[idx] = pred;
        frames.push(this.mkFrame('用前驱 ' + pred + ' 替换 ' + key, pred, null, null));
        this._delete(node.children[idx], pred, path, frames);
      }
      this._rebalance(node, path, frames);
      return true;
    }
    if (node.isLeaf) {
      frames.push(this.mkFrame('未找到 key ' + key, key, null, null));
      return false;
    }
    const found = this._delete(node.children[idx], key, path, frames);
    if (found) this._rebalance(node, path, frames);
    return found;
  }

  private _getPredecessor(node: BTreeNode, idx: number): number {
    let cur = node.children[idx];
    while (!cur.isLeaf) cur = cur.children[cur.children.length - 1];
    return cur.keys[cur.keys.length - 1];
  }

  private _rebalance(node: BTreeNode, path: BTreeNode[], frames: AnimationFrame[]): void {
    if (node.keys.length >= this.minKeys || node === this.root) return;
    const parentIdx = path.indexOf(node) - 1;
    if (parentIdx < 0) return;
    const parent = path[parentIdx];
    const nodeIdx = parent.children.indexOf(node);

    if (nodeIdx > 0) {
      const leftSibling = parent.children[nodeIdx - 1];
      if (leftSibling.keys.length > this.minKeys) {
        frames.push(this.mkFrame('从左兄弟借位', null, leftSibling.id, 'borrowing'));
        node.keys.unshift(parent.keys[nodeIdx - 1]);
        parent.keys[nodeIdx - 1] = leftSibling.keys.pop()!;
        if (!node.isLeaf && leftSibling.children.length > 0) {
          node.children.unshift(leftSibling.children.pop()!);
        }
        return;
      }
    }
    if (nodeIdx < parent.children.length - 1) {
      const rightSibling = parent.children[nodeIdx + 1];
      if (rightSibling.keys.length > this.minKeys) {
        frames.push(this.mkFrame('从右兄弟借位', null, rightSibling.id, 'borrowing'));
        node.keys.push(parent.keys[nodeIdx]);
        parent.keys[nodeIdx] = rightSibling.keys.shift()!;
        if (!node.isLeaf && rightSibling.children.length > 0) {
          node.children.push(rightSibling.children.shift()!);
        }
        return;
      }
    }
    if (nodeIdx > 0) {
      const leftSibling = parent.children[nodeIdx - 1];
      frames.push(this.mkFrame('与左兄弟合并', null, node.id, 'merging'));
      leftSibling.keys.push(parent.keys[nodeIdx - 1]);
      leftSibling.keys.push(...node.keys);
      leftSibling.children.push(...node.children);
      parent.keys.splice(nodeIdx - 1, 1);
      parent.children.splice(nodeIdx, 1);
    } else {
      const rightSibling = parent.children[nodeIdx + 1];
      frames.push(this.mkFrame('与右兄弟合并', null, node.id, 'merging'));
      node.keys.push(parent.keys[nodeIdx]);
      node.keys.push(...rightSibling.keys);
      node.children.push(...rightSibling.children);
      parent.keys.splice(nodeIdx, 1);
      parent.children.splice(nodeIdx + 1, 1);
    }
  }

  private _bisectInsert(keys: number[], key: number): number {
    let lo = 0, hi = keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid] < key) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private _bisectFind(keys: number[], key: number): number {
    return this._bisectInsert(keys, key);
  }

  private _bisectChild(keys: number[], key: number): number {
    return this._bisectFind(keys, key);
  }

  serialize() {
    const nodes: Record<string, any> = {};
    const leafChain: { from: string; to: string }[] = [];
    const leaves: BTreeNode[] = [];
    const walk = (n: BTreeNode, level: number) => {
      nodes[n.id] = {
        id: n.id,
        keys: [...n.keys],
        children: n.children.map((c) => c.id),
        isLeaf: n.isLeaf,
        level,
      };
      if (n.isLeaf) leaves.push(n);
      n.children.forEach((c) => walk(c, level + 1));
    };
    if (this.root) walk(this.root, 0);
    if (this.isPlus) {
      for (let i = 0; i < leaves.length - 1; i++) {
        leafChain.push({ from: leaves[i].id, to: leaves[i + 1].id });
      }
    }
    return { nodes, rootId: this.root?.id ?? null, leafChain };
  }

  private mkFrame(description: string, insertingKey: number | null, nodeId: string | null, type: string | null): AnimationFrame {
    const s = this.serialize();
    const data: any = { ...s, order: this.order, isPlus: this.isPlus };
    if (nodeId) data.nodeId = nodeId;
    if (type) data.type = type;
    if (insertingKey !== null) data.insertingKey = insertingKey;
    return { id: Math.random().toString(36).slice(2), data, description };
  }

  private mkFramePath(description: string, insertingKey: number | null, nodeId: string | null, type: string | null, path: string[]): AnimationFrame {
    const s = this.serialize();
    const data: any = { ...s, order: this.order, isPlus: this.isPlus };
    if (nodeId) data.nodeId = nodeId;
    if (type) data.type = type;
    if (insertingKey !== null) data.insertingKey = insertingKey;
    if (path) data.path = [...path];
    return { id: Math.random().toString(36).slice(2), data, description };
  }

  makeFrame(description: string, extra: any = {}): AnimationFrame {
    const s = this.serialize();
    const data: any = { ...s, order: this.order, isPlus: this.isPlus, ...extra };
    return { id: Math.random().toString(36).slice(2), data, description };
  }

  private mkFrameSplit(description: string, insertingKey: number | null, nodeId: string | null, type: string | null, leftId: string, rightId: string): AnimationFrame {
    const s = this.serialize();
    const data: any = { ...s, order: this.order, isPlus: this.isPlus };
    if (nodeId) data.nodeId = nodeId;
    if (type) data.type = type;
    if (insertingKey !== null) data.insertingKey = insertingKey;
    data.splitInfo = { leftId, rightId, upKey: insertingKey };
    return { id: Math.random().toString(36).slice(2), data, description };
  }
}
