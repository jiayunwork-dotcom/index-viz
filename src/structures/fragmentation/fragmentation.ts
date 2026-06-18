import {
  PhysicalPage,
  LogicalNode,
  Slot,
  Stats,
  AnimationFrameData,
} from './types';

const genId = () => Math.random().toString(36).slice(2, 10);

const PAGE_WIDTH = 180;
const PAGE_HEIGHT = 140;
const PAGE_GAP_X = 40;
const PAGE_GAP_Y = 30;
const PAGES_PER_ROW = 5;

export class FragmentationSimulator {
  pages: Record<string, PhysicalPage> = {};
  logicalNodes: Record<string, LogicalNode> = {};
  logicalRootId: string | null = null;
  leafChain: string[] = [];
  pageOrder: string[] = [];
  maxSlots: number;
  nextPageIndex: number = 0;

  constructor(maxSlots: number = 8) {
    this.maxSlots = maxSlots;
  }

  createEmptyPage(x: number, y: number): PhysicalPage {
    const slots: Slot[] = [];
    for (let i = 0; i < this.maxSlots; i++) {
      slots.push({ key: null, status: 'free' });
    }
    const page: PhysicalPage = {
      id: genId(),
      slots,
      pageIndex: this.nextPageIndex++,
      x,
      y,
      maxSlots: this.maxSlots,
    };
    this.pages[page.id] = page;
    this.pageOrder.push(page.id);
    return page;
  }

  private getPagePosition(index: number): { x: number; y: number } {
    const col = index % PAGES_PER_ROW;
    const row = Math.floor(index / PAGES_PER_ROW);
    return {
      x: 20 + col * (PAGE_WIDTH + PAGE_GAP_X),
      y: 20 + row * (PAGE_HEIGHT + PAGE_GAP_Y),
    };
  }

  private findLeafPageForKey(key: number): string | null {
    if (!this.logicalRootId) return null;
    let nodeId = this.logicalRootId;
    while (true) {
      const node = this.logicalNodes[nodeId];
      if (node.isLeaf) return node.pageId;
      let childIdx = node.keys.length;
      for (let i = 0; i < node.keys.length; i++) {
        if (key < node.keys[i]) {
          childIdx = i;
          break;
        }
      }
      nodeId = node.children[childIdx];
    }
  }

  private getUsedSlotCount(pageId: string): number {
    const page = this.pages[pageId];
    return page.slots.filter((s) => s.status === 'used').length;
  }

  private insertIntoPage(pageId: string, key: number): number {
    const page = this.pages[pageId];
    const usedKeys = page.slots
      .filter((s) => s.status === 'used')
      .map((s) => s.key!);
    usedKeys.push(key);
    usedKeys.sort((a, b) => a - b);

    for (let i = 0; i < page.slots.length; i++) {
      if (page.slots[i].status === 'free') {
        const idx = usedKeys.indexOf(key);
        const insertIdx = idx < usedKeys.length ? idx : usedKeys.length - 1;
        page.slots[i] = { key, status: 'used' };
        return i;
      }
    }
    return -1;
  }

  private splitPage(pageId: string): { newPageId: string; upKey: number } {
    const page = this.pages[pageId];
    const usedKeys = page.slots
      .filter((s) => s.status === 'used')
      .map((s) => s.key!)
      .sort((a, b) => a - b);

    const mid = Math.ceil(usedKeys.length / 2);
    const leftKeys = usedKeys.slice(0, mid);
    const rightKeys = usedKeys.slice(mid);
    const upKey = rightKeys[0];

    for (let i = 0; i < page.slots.length; i++) {
      page.slots[i] = { key: null, status: 'free' };
    }
    leftKeys.forEach((k, i) => {
      page.slots[i] = { key: k, status: 'used' };
    });

    const newIdx = this.nextPageIndex;
    const pos = this.getPagePosition(newIdx);
    const newPage = this.createEmptyPage(pos.x, pos.y);
    newPage.isNew = true;
    rightKeys.forEach((k, i) => {
      newPage.slots[i] = { key: k, status: 'used' };
    });

    const leafIdx = this.leafChain.indexOf(pageId);
    if (leafIdx >= 0) {
      this.leafChain.splice(leafIdx + 1, 0, newPage.id);
    }

    const logicalNode = Object.values(this.logicalNodes).find(
      (n) => n.pageId === pageId
    );
    if (logicalNode) {
      const newLogicalNode: LogicalNode = {
        id: genId(),
        keys: rightKeys,
        children: [],
        isLeaf: true,
        level: logicalNode.level,
        pageId: newPage.id,
      };
      this.logicalNodes[newLogicalNode.id] = newLogicalNode;
    }

    return { newPageId: newPage.id, upKey };
  }

  private insertIntoLogicalTree(key: number, newLeafPageId: string): void {
    // For simplicity, we'll maintain a flat structure for the logical tree
    // This is a simplified version that focuses on the physical page visualization
  }

  insert(key: number): AnimationFrameData[] {
    const frames: AnimationFrameData[] = [];

    if (!this.logicalRootId) {
      const pos = this.getPagePosition(0);
      const page = this.createEmptyPage(pos.x, pos.y);
      const logicalNode: LogicalNode = {
        id: genId(),
        keys: [],
        children: [],
        isLeaf: true,
        level: 0,
        pageId: page.id,
      };
      this.logicalNodes[logicalNode.id] = logicalNode;
      this.logicalRootId = logicalNode.id;
      this.leafChain.push(page.id);
    }

    const pageId = this.findLeafPageForKey(key);
    if (!pageId) return frames;

    const page = this.pages[pageId];
    const usedCount = this.getUsedSlotCount(pageId);

    if (usedCount < this.maxSlots) {
      const slotIdx = this.insertIntoPage(pageId, key);
      frames.push({
        type: 'insert',
        pageId,
        slotIndex: slotIdx,
        key,
      });

      const logicalNode = Object.values(this.logicalNodes).find(
        (n) => n.pageId === pageId
      );
      if (logicalNode) {
        logicalNode.keys.push(key);
        logicalNode.keys.sort((a, b) => a - b);
      }
    } else {
      const slotIdx = page.slots.findIndex((s) => s.status === 'free');
      if (slotIdx >= 0) {
        page.slots[slotIdx] = { key, status: 'used' };
      }
      const { newPageId, upKey } = this.splitPage(pageId);
      frames.push({
        type: 'split',
        sourcePageId: pageId,
        newPageId,
        splitIndex: Math.ceil(this.maxSlots / 2),
        newPageX: this.pages[newPageId].x,
        newPageY: this.pages[newPageId].y,
      });

      this._insertIntoParent(pageId, upKey, newPageId);
    }

    return frames;
  }

  private _insertIntoParent(leftPageId: string, key: number, rightPageId: string): void {
    const leftNode = Object.values(this.logicalNodes).find(
      (n) => n.pageId === leftPageId
    );
    const rightNode = Object.values(this.logicalNodes).find(
      (n) => n.pageId === rightPageId
    );
    if (!leftNode) return;

    // Find parent
    const parentNode = Object.values(this.logicalNodes).find((n) =>
      n.children.some((c) => this.logicalNodes[c]?.pageId === leftPageId)
    );

    if (!parentNode) {
      const newRoot: LogicalNode = {
        id: genId(),
        keys: [key],
        children: [leftNode.id, rightNode?.id || ''],
        isLeaf: false,
        level: leftNode.level + 1,
        pageId: '',
      };

      // Update levels
      this._updateLevels(newRoot.id, newRoot.level);

      this.logicalNodes[newRoot.id] = newRoot;
      this.logicalRootId = newRoot.id;
    } else {
      const leftChildIdx = parentNode.children.findIndex(
        (c) => this.logicalNodes[c]?.pageId === leftPageId
      );
      parentNode.keys.splice(leftChildIdx, 0, key);
      parentNode.children.splice(leftChildIdx + 1, 0, rightNode?.id || '');

      if (parentNode.keys.length > this.maxSlots) {
        // Split internal node - simplified
        const mid = Math.floor(parentNode.keys.length / 2);
        const upKey = parentNode.keys[mid];
        const leftKeys = parentNode.keys.slice(0, mid);
        const rightKeys = parentNode.keys.slice(mid + 1);
        const leftChildren = parentNode.children.slice(0, mid + 1);
        const rightChildren = parentNode.children.slice(mid + 1);

        parentNode.keys = leftKeys;
        parentNode.children = leftChildren;

        // Create new right internal node - simplified, no physical page for internal
        const newInternalNode: LogicalNode = {
          id: genId(),
          keys: rightKeys,
          children: rightChildren,
          isLeaf: false,
          level: parentNode.level,
          pageId: '',
        };
        this.logicalNodes[newInternalNode.id] = newInternalNode;

        this._insertIntoParent(
          leftPageId,
          upKey,
          this.logicalNodes[rightChildren[0]]?.pageId || ''
        );
      }
    }
  }

  private _updateLevels(nodeId: string, level: number): void {
    const node = this.logicalNodes[nodeId];
    if (!node) return;
    node.level = level;
    node.children.forEach((childId) => {
      this._updateLevels(childId, level + 1);
    });
  }

  delete(key: number): AnimationFrameData[] {
    const frames: AnimationFrameData[] = [];
    const pageId = this.findLeafPageForKey(key);
    if (!pageId) return frames;

    const page = this.pages[pageId];
    const slotIdx = page.slots.findIndex(
      (s) => s.status === 'used' && s.key === key
    );

    if (slotIdx >= 0) {
      page.slots[slotIdx].status = 'deleted';
      frames.push({
        type: 'delete',
        pageId,
        slotIndex: slotIdx,
      });

      const logicalNode = Object.values(this.logicalNodes).find(
        (n) => n.pageId === pageId
      );
      if (logicalNode) {
        const keyIdx = logicalNode.keys.indexOf(key);
        if (keyIdx >= 0) {
          logicalNode.keys.splice(keyIdx, 1);
        }
      }
    }

    return frames;
  }

  getStats(): Stats {
    const pageIds = Object.keys(this.pages);
    const totalPages = pageIds.length;
    let usedPages = 0;
    let emptyPages = 0;
    let totalUsedSlots = 0;
    let totalSlots = 0;

    pageIds.forEach((id) => {
      const page = this.pages[id];
      const used = page.slots.filter((s) => s.status === 'used').length;
      const deleted = page.slots.filter((s) => s.status === 'deleted').length;
      totalUsedSlots += used;
      totalSlots += page.slots.length;

      if (used > 0) usedPages++;
      else if (used === 0 && deleted === 0) emptyPages++;
    });

    const avgFillRate = totalSlots > 0 ? (totalUsedSlots / totalSlots) * 100 : 0;

    const totalKeys = totalUsedSlots;
    const theoreticalMinPages = Math.ceil(totalKeys / this.maxSlots);
    const fragmentationIndex =
      theoreticalMinPages > 0
        ? usedPages / theoreticalMinPages - 1
        : 0;

    let maxJump = 0;
    if (this.leafChain.length > 1) {
      for (let i = 0; i < this.leafChain.length - 1; i++) {
        const p1 = this.pages[this.leafChain[i]];
        const p2 = this.pages[this.leafChain[i + 1]];
        if (p1 && p2) {
          const dist = Math.abs(p2.pageIndex - p1.pageIndex);
          if (dist > maxJump) maxJump = dist;
        }
      }
    }

    return {
      totalPages,
      usedPages,
      emptyPages,
      avgFillRate,
      fragmentationIndex: Math.max(0, fragmentationIndex),
      maxPointerJump: maxJump,
    };
  }

  getAllLeafKeys(): number[] {
    const keys: number[] = [];
    this.leafChain.forEach((pageId) => {
      const page = this.pages[pageId];
      if (page) {
        page.slots.forEach((slot) => {
          if (slot.status === 'used' && slot.key !== null) {
            keys.push(slot.key);
          }
        });
      }
    });
    return keys.sort((a, b) => a - b);
  }

  reindex(): AnimationFrameData[] {
    const frames: AnimationFrameData[] = [];
    const allKeys = this.getAllLeafKeys();

    // Scan phase
    allKeys.forEach((key, idx) => {
      frames.push({
        type: 'reindex',
        phase: 'scan',
        scanIndex: idx,
        key,
      });
    });

    // Compact phase - create new pages at bottom
    const oldPages = { ...this.pages };
    const oldLeafChain = [...this.leafChain];

    // Mark old pages for fading
    Object.keys(oldPages).forEach((id) => {
      this.pages[id].isFading = true;
    });

    const newLeafChain: string[] = [];
    let currentKeyIdx = 0;
    let newPageIdx = 0;

    while (currentKeyIdx < allKeys.length) {
      const row = Math.floor(newPageIdx / PAGES_PER_ROW);
      const col = newPageIdx % PAGES_PER_ROW;
      const x = 20 + col * (PAGE_WIDTH + PAGE_GAP_X);
      const y = 20 + (row + Math.ceil(this.pageOrder.length / PAGES_PER_ROW) + 2) * (PAGE_HEIGHT + PAGE_GAP_Y);

      const newPage = this.createEmptyPage(x, y);
      newPage.isNew = true;
      newLeafChain.push(newPage.id);

      for (let i = 0; i < this.maxSlots && currentKeyIdx < allKeys.length; i++) {
        newPage.slots[i] = { key: allKeys[currentKeyIdx], status: 'used' };
        frames.push({
          type: 'reindex',
          phase: 'compact',
          newPageIndex: newPageIdx,
          key: allKeys[currentKeyIdx],
        });
        currentKeyIdx++;
      }
      newPageIdx++;
    }

    // Relink phase
    frames.push({
      type: 'reindex',
      phase: 'relink',
    });

    // Complete phase - remove old pages
    frames.push({
      type: 'reindex',
      phase: 'complete',
    });

    // Update leaf chain
    this.leafChain = newLeafChain;

    // Remove old pages from logical structure
    oldLeafChain.forEach((pageId) => {
      const nodeId = Object.keys(this.logicalNodes).find(
        (nid) => this.logicalNodes[nid].pageId === pageId
      );
      if (nodeId) {
        delete this.logicalNodes[nodeId];
      }
    });

    // Add new pages to logical structure
    newLeafChain.forEach((pageId, idx) => {
      const page = this.pages[pageId];
      const keys = page.slots
        .filter((s) => s.status === 'used')
        .map((s) => s.key!);
      const node: LogicalNode = {
        id: genId(),
        keys,
        children: [],
        isLeaf: true,
        level: 0,
        pageId,
      };
      this.logicalNodes[node.id] = node;
    });

    // Rebuild logical tree (simplified - flat for now)
    if (newLeafChain.length > 0) {
      const firstNode = Object.values(this.logicalNodes).find(
        (n) => n.pageId === newLeafChain[0]
      );
      if (firstNode) {
        this.logicalRootId = firstNode.id;
      }
    }

    // Remove old pages
    Object.keys(oldPages).forEach((id) => {
      delete this.pages[id];
      const idx = this.pageOrder.indexOf(id);
      if (idx >= 0) this.pageOrder.splice(idx, 1);
    });

    // Reindex page indices
    this.pageOrder.forEach((id, idx) => {
      this.pages[id].pageIndex = idx;
      this.pages[id].isNew = false;
      this.pages[id].isFading = false;
    });
    this.nextPageIndex = this.pageOrder.length;

    return frames;
  }

  reset(maxSlots: number): void {
    this.maxSlots = maxSlots;
    this.pages = {};
    this.logicalNodes = {};
    this.logicalRootId = null;
    this.leafChain = [];
    this.pageOrder = [];
    this.nextPageIndex = 0;
  }

  updatePagePosition(pageId: string, x: number, y: number): void {
    if (this.pages[pageId]) {
      this.pages[pageId].x = x;
      this.pages[pageId].y = y;
    }
  }
}
