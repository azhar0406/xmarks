import { useState, useEffect, useRef } from 'react';
import { db, Bookmark, Category } from '../lib/database';
import BookmarkCard from '../components/BookmarkCard';
import { Loader2, Search } from 'lucide-react';
import { DEFAULT_AVATAR_URL, handleAvatarError } from '../lib/assets';

interface CategoryWithCount extends Category {
  count: number;
}

interface HomeProps {
  onCategoriesUpdate?: (categories: CategoryWithCount[]) => void;
}

export default function Home({ onCategoriesUpdate }: HomeProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Bookmark[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadInitialBookmarks();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const data = await db.getCategoriesWithCounts();
    onCategoriesUpdate?.(data);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMoreBookmarks();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, page]);

  const loadInitialBookmarks = async () => {
    setLoading(true);
    const data = await db.getRandomBookmarks(10);
    setBookmarks(data);
    setHasMore(data.length === 10);
    setPage(1);
    setLoading(false);
  };

  const loadMoreBookmarks = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    const data = await db.getRandomBookmarks(10);
    setBookmarks((prev) => [...prev, ...data]);
    setHasMore(data.length === 10);
    setPage((prev) => prev + 1);
    setLoadingMore(false);
  };

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      const results = await db.searchBookmarks(value, 3);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 300);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setShowSuggestions(false);
    const results = await db.searchBookmarks(searchQuery, 50);
    setBookmarks(results);
    setHasMore(false);
    setLoading(false);
  };

  const selectSuggestion = (bookmark: Bookmark) => {
    setShowSuggestions(false);
    setSearchQuery('');
    const element = document.getElementById(`bookmark-${bookmark.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-blue-500');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-blue-500');
      }, 2000);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
    loadInitialBookmarks();
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="border-b border-gray-800 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
        <div className="p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Home</h2>

          <div className="relative w-96">
            <form onSubmit={handleSearch}>
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search bookmarks..."
                className="w-full bg-gray-900 text-white rounded-full py-2 px-12 outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => selectSuggestion(suggestion)}
                    className="w-full px-4 py-3 hover:bg-gray-800 text-left border-b border-gray-800 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={suggestion.profile_image_url || DEFAULT_AVATAR_URL}
                        alt={suggestion.name}
                        className="w-10 h-10 rounded-full bg-gray-800"
                        onError={handleAvatarError}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{suggestion.name}</span>
                          <span className="text-gray-500 text-sm">@{suggestion.screen_name}</span>
                        </div>
                        <p className="text-gray-400 text-sm truncate">
                          {suggestion.full_text.substring(0, 100)}...
                        </p>
                        {suggestion.category && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                            {suggestion.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-400" size={32} />
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No bookmarks yet</p>
          <p className="text-gray-600 mt-2">Import your bookmarks from Settings</p>
        </div>
      ) : (
        <>
          <div>
            {bookmarks.map((bookmark) => (
              <div key={bookmark.id} id={`bookmark-${bookmark.id}`} className="transition-all">
                <BookmarkCard bookmark={bookmark} />
              </div>
            ))}
          </div>

          {hasMore && (
            <div ref={observerTarget} className="flex items-center justify-center py-8">
              {loadingMore && <Loader2 className="animate-spin text-blue-400" size={32} />}
            </div>
          )}

          {!hasMore && bookmarks.length > 0 && (
            <div className="text-center py-8 text-gray-500">
              No more bookmarks to load
            </div>
          )}
        </>
      )}
    </div>
  );
}
