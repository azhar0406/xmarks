import { useState, useEffect } from 'react';
import { db, Bookmark } from '../lib/database';
import BookmarkCard from '../components/BookmarkCard';
import { Loader2 } from 'lucide-react';

interface CategoryViewProps {
  categoryName: string;
}

export default function CategoryView({ categoryName }: CategoryViewProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, [categoryName]);

  const loadBookmarks = async () => {
    setLoading(true);
    const data = await db.getBookmarks(1000, 0, categoryName);
    setBookmarks(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="border-b border-gray-800 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
        <div className="p-4">
          <h2 className="text-xl font-bold text-white">{categoryName}</h2>
          {!loading && (
            <p className="text-gray-500 text-sm mt-1">
              {bookmarks.length} bookmark{bookmarks.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-400" size={32} />
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No bookmarks in this category yet</p>
        </div>
      ) : (
        <div>
          {bookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
        </div>
      )}
    </div>
  );
}
