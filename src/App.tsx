import { useState } from 'react';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import Home from './pages/Home';
import Search from './pages/Search';
import CategoryView from './pages/CategoryView';
import Settings from './pages/Settings';
import { Category } from './lib/database';

interface CategoryWithCount extends Category {
  count: number;
}

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);

  const renderPage = () => {
    if (currentPage === 'home') return <Home onCategoriesUpdate={setCategories} />;
    if (currentPage === 'search') return <Search />;
    if (currentPage === 'settings') return <Settings onDatabaseWipe={() => setCategories([])} onDatabaseImport={() => window.location.reload()} />;
    if (currentPage.startsWith('category-')) {
      const categoryName = currentPage.replace('category-', '');
      return <CategoryView categoryName={categoryName} />;
    }
    return <Home onCategoriesUpdate={setCategories} />;
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="flex min-h-screen mx-[10%]">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} categories={categories} />
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
        <RightSidebar />
      </div>
    </div>
  );
}

export default App;
