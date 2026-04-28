import { useState, useRef } from 'react';
import { db, Bookmark } from '../lib/database';
import BookmarkCard from '../components/BookmarkCard';
import { Search as SearchIcon, Loader2 } from 'lucide-react';
import { DEFAULT_AVATAR_URL, handleAvatarError } from '../lib/assets';

export default function Search() {
  const [query, setQuery] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [suggestions, setSuggestions] = useState<Bookmark[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout>();

  const handleSearchInput = (value: string) => {
    setQuery(value);

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
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    setShowSuggestions(false);

    const data = await db.searchBookmarks(query, 100);
    setBookmarks(data);
    setLoading(false);
  };

  const selectSuggestion = async (suggestion: Bookmark) => {
    setQuery(suggestion.full_text.substring(0, 50));
    setShowSuggestions(false);
    setLoading(true);
    setSearched(true);

    const data = await db.searchBookmarks(suggestion.full_text.substring(0, 50), 100);
    setBookmarks(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="border-b border-gray-800 sticky top-0 bg-black/80 backdrop-blur-sm z-10">
        <div className="p-4">
          <h2 className="text-xl font-bold text-white mb-4">Search</h2>
          <div className="relative">
            <form onSubmit={handleSearch}>
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Search bookmarks by content or category..."
                className="w-full bg-gray-900 text-white rounded-full py-3 px-12 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-gray-900 border border-gray-800 rounded-lg shadow-xl overflow-hidden">
                <div className="px-4 py-2 text-gray-500 text-xs font-semibold">
                  TOP MATCHES
                </div>
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    onClick={() => selectSuggestion(suggestion)}
                    className="w-full px-4 py-3 hover:bg-gray-800 text-left border-t border-gray-800"
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
      ) : searched && bookmarks.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">No results found</p>
          <p className="text-gray-600 mt-2">Try searching with different keywords</p>
        </div>
      ) : !searched ? (
        <div className="text-center py-20">
          <SearchIcon className="mx-auto mb-4 text-gray-600" size={48} />
          <p className="text-gray-500 text-lg">Search your bookmarks</p>
          <p className="text-gray-600 mt-2">Enter keywords to find specific tweets by content or category</p>
        </div>
      ) : (
        <div>
          <div className="p-4 border-b border-gray-800 bg-gray-900/50">
            <p className="text-gray-400">
              Found <span className="text-white font-semibold">{bookmarks.length}</span> results
            </p>
          </div>
          {bookmarks.map((bookmark) => (
            <BookmarkCard key={bookmark.id} bookmark={bookmark} />
          ))}
        </div>
      )}
    </div>
  );
}
