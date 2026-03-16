import { useState, useEffect } from 'react';
import { db, Bookmark } from '../lib/database';
import { Sparkles, ExternalLink } from 'lucide-react';

export default function RightSidebar() {
  const [randomBookmarks, setRandomBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRandomBookmarks();
  }, []);

  const loadRandomBookmarks = async () => {
    setLoading(true);
    const randomCount = Math.floor(Math.random() * 2) + 2;
    const bookmarks = await db.getRandomBookmarks(randomCount);
    setRandomBookmarks(bookmarks);
    setLoading(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="w-80 bg-black border-l border-gray-800 h-screen sticky top-0 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="text-blue-400" size={20} />
          <h2 className="text-lg font-bold text-white">Random Picks</h2>
        </div>
        <div className="text-gray-500 text-center py-8">Loading...</div>
      </div>
    );
  }

  if (randomBookmarks.length === 0) {
    return (
      <div className="w-80 bg-black border-l border-gray-800 h-screen sticky top-0 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="text-blue-400" size={20} />
          <h2 className="text-lg font-bold text-white">Random Picks</h2>
        </div>
        <div className="text-gray-500 text-center py-8">
          No bookmarks yet. Import some to see random picks!
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-black border-l border-gray-800 h-screen sticky top-0 overflow-y-auto">
      <div className="p-4 border-b border-gray-800 sticky top-0 bg-black z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="text-blue-400" size={20} />
          <h2 className="text-lg font-bold text-white">Random Picks</h2>
        </div>
        <p className="text-gray-500 text-xs mt-1">Refresh to see different bookmarks</p>
      </div>

      <div className="p-4 space-y-4">
        {randomBookmarks.map((bookmark) => {
          const mediaArray = typeof bookmark.media === 'string'
            ? JSON.parse(bookmark.media)
            : bookmark.media || [];

          return (
            <div
              key={bookmark.id}
              className="bg-gray-900 rounded-lg p-3 hover:bg-gray-800 transition-colors border border-gray-800"
            >
              <div className="flex items-start gap-2 mb-2">
                <img
                  src={bookmark.profile_image_url || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'}
                  alt={bookmark.name}
                  className="w-8 h-8 rounded-full flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white text-sm truncate">
                    {bookmark.name}
                  </div>
                  <div className="text-gray-500 text-xs truncate">
                    @{bookmark.screen_name}
                  </div>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-2 line-clamp-4">
                {bookmark.full_text}
              </p>

              {mediaArray && mediaArray.length > 0 && (
                <div className="mb-2 rounded overflow-hidden">
                  {mediaArray[0].type === 'photo' ? (
                    <img
                      src={mediaArray[0].original || mediaArray[0].thumbnail}
                      alt=""
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="bg-gray-800 h-32 flex items-center justify-center">
                      <span className="text-gray-500 text-xs">Video</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{formatDate(bookmark.created_at)}</span>
                {bookmark.category && (
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                    {bookmark.category}
                  </span>
                )}
              </div>

              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
              >
                <ExternalLink size={12} />
                View on X
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
