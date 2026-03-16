import { Home, Search, Bookmark, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Category } from '../lib/database';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
  categories?: CategoryWithCount[];
}

interface CategoryWithCount extends Category {
  count: number;
}

export default function Sidebar({ currentPage, onPageChange, categories = [] }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
  ];

  return (
    <div
      className={`${
        collapsed ? 'w-20' : 'w-72'
      } bg-black border-r border-gray-800 h-screen flex flex-col transition-all duration-300 sticky top-0`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!collapsed && (
          <h1 className="text-xl font-bold text-white">XMarks</h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-gray-900 rounded-full text-gray-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 hover:bg-gray-900 transition-colors ${
                currentPage === item.id ? 'bg-gray-900 text-white' : 'text-gray-400'
              }`}
            >
              <Icon size={24} />
              {!collapsed && <span className="text-lg">{item.label}</span>}
            </button>
          );
        })}

        {!collapsed && (
          <div className="mt-6">
            <div className="px-4 py-2 text-gray-500 text-sm font-semibold flex items-center gap-2">
              <Bookmark size={20} />
              <span>Categories</span>
            </div>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => onPageChange(`category-${category.name}`)}
                className={`w-full text-left px-8 py-2 hover:bg-gray-900 transition-colors flex items-center justify-between ${
                  currentPage === `category-${category.name}` ? 'bg-gray-900 text-white' : 'text-gray-400'
                }`}
              >
                <span>{category.name}</span>
                {category.count > 0 && (
                  <span className="text-xs bg-gray-800 px-2 py-1 rounded-full">
                    {category.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </nav>

      <button
        onClick={() => onPageChange('settings')}
        className={`flex items-center gap-4 px-4 py-4 border-t border-gray-800 hover:bg-gray-900 transition-colors ${
          currentPage === 'settings' ? 'bg-gray-900 text-white' : 'text-gray-400'
        }`}
      >
        <Settings size={24} />
        {!collapsed && <span className="text-lg">Settings</span>}
      </button>
    </div>
  );
}
