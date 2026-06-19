import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import BTreePage from './pages/BTreePage';
import FragmentationPage from './pages/FragmentationPage';
import HashPage from './pages/HashPage';
import LSMTreePage from './pages/LSMTreePage';
import SkipListPage from './pages/SkipListPage';
import BloomFilterPage from './pages/BloomFilterPage';
import RTreePage from './pages/RTreePage';
import ComparisonPage from './pages/ComparisonPage';
import LessonsPage from './pages/LessonsPage';
import CustomPage from './pages/CustomPage';
import WALPage from './pages/WALPage';
import MVCCPage from './pages/MVCCPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="btree" element={<BTreePage />} />
        <Route path="fragmentation" element={<FragmentationPage />} />
        <Route path="hash" element={<HashPage />} />
        <Route path="lsm" element={<LSMTreePage />} />
        <Route path="wal" element={<WALPage />} />
        <Route path="skiplist" element={<SkipListPage />} />
        <Route path="bloom" element={<BloomFilterPage />} />
        <Route path="rtree" element={<RTreePage />} />
        <Route path="mvcc" element={<MVCCPage />} />
        <Route path="comparison" element={<ComparisonPage />} />
        <Route path="lessons" element={<LessonsPage />} />
        <Route path="custom" element={<CustomPage />} />
      </Route>
    </Routes>
  );
}
