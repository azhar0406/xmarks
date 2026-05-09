import { useState, useEffect, useRef } from 'react';
import { Heart, Repeat2, MessageCircle, BarChart3, Bookmark as BookmarkIcon, ExternalLink, ImageOff, Check, ChevronDown, Loader2 } from 'lucide-react';
import { Bookmark, Category, db } from '../lib/database';
import { DEFAULT_AVATAR_URL, handleAvatarError } from '../lib/assets';
import { useToast } from './Toast';
import { translateToEnglish, looksNonEnglish } from '../lib/translate';

interface BookmarkCardProps {
  bookmark: Bookmark;
  categories?: Category[];
  onDelete?: (id: string) => void;
  onCategoryChange?: (id: string, category: string) => void;
}

interface MediaItem {
  type: string;
  url: string;
  thumbnail?: string;
  original?: string;
}

const PHOTO_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

const extractPhotoExtension = (url: string | undefined): string => {
  if (!url) return 'jpg';
  const match = url.match(/\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/);
  if (!match) return 'jpg';
  const ext = match[1].toLowerCase();
  return PHOTO_EXTS.has(ext) ? ext : 'jpg';
};

export default function BookmarkCard({ bookmark, categories = [], onDelete, onCategoryChange }: BookmarkCardProps) {
  const { showToast } = useToast();
  const [failedMedia, setFailedMedia] = useState<Set<number>>(new Set());
  const [hidden, setHidden] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(bookmark.category);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canTranslate = looksNonEnglish(bookmark.full_text);

  const handleTranslate = async () => {
    if (translation) {
      setShowTranslation(true);
      return;
    }
    setTranslating(true);
    try {
      const result = await translateToEnglish(bookmark.full_text);
      setTranslation(result);
      setShowTranslation(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Translation failed';
      showToast(`Could not translate: ${msg}`, { duration: 3000 });
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    if (!categoryOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [categoryOpen]);

  // Ensure pending delete still executes if component unmounts
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
        // Fire-and-forget the actual delete
        db.deleteBookmark(bookmark.id).catch((err) => console.error('[BookmarkCard] Delete on unmount failed:', err));
      }
    };
  }, [bookmark.id]);

  const handleRemoveBookmark = () => {
    setHidden(true);
    deleteTimerRef.current = setTimeout(async () => {
      deleteTimerRef.current = null;
      await db.deleteBookmark(bookmark.id);
      onDelete?.(bookmark.id);
    }, 2000);

    showToast('Bookmark removed', {
      actionLabel: 'Undo',
      duration: 2000,
      onAction: () => {
        if (deleteTimerRef.current) {
          clearTimeout(deleteTimerRef.current);
          deleteTimerRef.current = null;
        }
        setHidden(false);
      },
    });
  };

  const handleCategorySelect = async (categoryName: string) => {
    setCurrentCategory(categoryName);
    setCategoryOpen(false);
    await db.updateBookmarkCategory(bookmark.id, categoryName);
    onCategoryChange?.(bookmark.id, categoryName);
  };

  const markMediaFailed = (idx: number) => {
    setFailedMedia((prev) => {
      if (prev.has(idx)) return prev;
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };

  if (hidden) return null;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getLocalMediaPath = (media: MediaItem, index: number) => {
    const date = new Date(bookmark.created_at);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const isVideoLike = media.type === 'video' || media.type === 'animated_gif';
    const ext = isVideoLike
      ? 'mp4'
      : extractPhotoExtension(media.original || media.url || media.thumbnail);
    return `/media/${bookmark.screen_name}_${bookmark.id}_${media.type}_${index + 1}_${dateStr}.${ext}`;
  };

  const mediaArray = typeof bookmark.media === 'string' ? JSON.parse(bookmark.media) : bookmark.media || [];
  const displayCategory = currentCategory || 'Uncategorized';

  return (
    <div className="border-b border-gray-800 p-4 hover:bg-gray-900/50 transition-colors">
      <div className="flex gap-3">
        <img
          src={bookmark.profile_image_url || DEFAULT_AVATAR_URL}
          alt={bookmark.name}
          className="w-12 h-12 rounded-full flex-shrink-0 bg-gray-800"
          onError={handleAvatarError}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-white hover:underline cursor-pointer">
              {bookmark.name}
            </span>
            <span className="text-gray-500">@{bookmark.screen_name}</span>
            <span className="text-gray-500">·</span>
            <span className="text-gray-500">{formatDate(bookmark.created_at)}</span>
          </div>

          <div className="text-white whitespace-pre-wrap mb-2">
            {bookmark.full_text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
              part.match(/^https?:\/\//) ? (
                <a
                  key={i}
                  href={part}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  {part}
                </a>
              ) : (
                part
              )
            )}
          </div>

          {canTranslate && !showTranslation && (
            <button
              onClick={handleTranslate}
              disabled={translating}
              className="text-blue-400 hover:underline text-sm mb-3 flex items-center gap-1.5 disabled:opacity-60"
            >
              {translating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Translating...
                </>
              ) : (
                'Translate post'
              )}
            </button>
          )}

          {showTranslation && translation && (
            <div className="mb-3 border-l-2 border-blue-500/50 pl-3">
              <div className="text-xs text-gray-500 mb-1">Translated from detected language</div>
              <div className="text-white whitespace-pre-wrap mb-2">
                {translation.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                  part.match(/^https?:\/\//) ? (
                    <a
                      key={i}
                      href={part}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      {part}
                    </a>
                  ) : (
                    part
                  )
                )}
              </div>
              <button
                onClick={() => setShowTranslation(false)}
                className="text-blue-400 hover:underline text-sm"
              >
                Show original
              </button>
            </div>
          )}

          {mediaArray && mediaArray.length > 0 && (
            <div className={`grid gap-0.5 mb-3 rounded-2xl overflow-hidden border border-gray-700 ${
              mediaArray.length === 1 ? 'grid-cols-1' :
              mediaArray.length === 2 ? 'grid-cols-2' :
              mediaArray.length === 3 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {mediaArray.map((media: MediaItem, idx: number) => {
                const failed = failedMedia.has(idx);
                return (
                  <div
                    key={idx}
                    className={`${
                      mediaArray.length === 3 && idx === 0 ? 'col-span-2' : ''
                    } bg-gray-900 relative overflow-hidden ${
                      mediaArray.length === 1 ? 'max-h-[510px]' : 'h-[288px]'
                    }`}
                  >
                    {failed ? (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2 min-h-[160px]">
                        <ImageOff size={32} />
                        <span className="text-xs">Media unavailable</span>
                      </div>
                    ) : media.type === 'photo' ? (
                      <img
                        src={getLocalMediaPath(media, idx)}
                        alt=""
                        className={`w-full h-full ${
                          mediaArray.length === 1 ? 'object-contain' : 'object-cover'
                        }`}
                        onError={() => markMediaFailed(idx)}
                      />
                    ) : (
                      <video
                        src={getLocalMediaPath(media, idx)}
                        {...(media.type === 'animated_gif'
                          ? { autoPlay: true, loop: true, muted: true, playsInline: true }
                          : { controls: true })}
                        className={`w-full h-full ${
                          mediaArray.length === 1 ? 'object-contain' : 'object-cover'
                        }`}
                        preload="metadata"
                        onError={() => markMediaFailed(idx)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-3 relative inline-block" ref={categoryRef}>
            <button
              onClick={() => setCategoryOpen(!categoryOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-full text-sm transition-colors"
            >
              <span>{displayCategory}</span>
              <ChevronDown size={14} className={`transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
            </button>

            {categoryOpen && (
              <div className="absolute left-0 top-full mt-1 z-20 bg-gray-900 border border-gray-700 rounded-lg shadow-xl min-w-[200px] max-h-72 overflow-y-auto py-1">
                {categories.length === 0 ? (
                  <div className="px-4 py-2 text-sm text-gray-500">No categories. Add some in Settings.</div>
                ) : (
                  categories
                    .filter((cat) => cat.name !== 'Uncategorized')
                    .map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => handleCategorySelect(cat.name)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-2 text-sm text-white hover:bg-gray-800 transition-colors"
                      >
                        <span>{cat.name}</span>
                        {currentCategory === cat.name && <Check size={14} className="text-blue-400" />}
                      </button>
                    ))
                )}
                <div className="border-t border-gray-800 mt-1 pt-1">
                  <button
                    onClick={() => handleCategorySelect('Uncategorized')}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 transition-colors"
                  >
                    <span>Uncategorized</span>
                    {(currentCategory === 'Uncategorized' || !currentCategory) && <Check size={14} className="text-blue-400" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between max-w-md text-gray-500">
            <button className="flex items-center gap-2 hover:text-blue-400 transition-colors group">
              <MessageCircle size={18} className="group-hover:bg-blue-400/10 rounded-full p-2 w-9 h-9" />
              <span className="text-sm">{formatNumber(bookmark.reply_count)}</span>
            </button>

            <button className="flex items-center gap-2 hover:text-green-400 transition-colors group">
              <Repeat2 size={18} className="group-hover:bg-green-400/10 rounded-full p-2 w-9 h-9" />
              <span className="text-sm">{formatNumber(bookmark.retweet_count)}</span>
            </button>

            <button className="flex items-center gap-2 hover:text-pink-400 transition-colors group">
              <Heart size={18} className="group-hover:bg-pink-400/10 rounded-full p-2 w-9 h-9" />
              <span className="text-sm">{formatNumber(bookmark.favorite_count)}</span>
            </button>

            <button className="flex items-center gap-2 hover:text-blue-400 transition-colors group">
              <BarChart3 size={18} className="group-hover:bg-blue-400/10 rounded-full p-2 w-9 h-9" />
              <span className="text-sm">{formatNumber(bookmark.views_count)}</span>
            </button>

            <button
              onClick={handleRemoveBookmark}
              aria-label="Remove bookmark"
              className="flex items-center gap-2 hover:text-blue-400 transition-colors group"
            >
              <BookmarkIcon size={18} className="group-hover:bg-blue-400/10 rounded-full p-2 w-9 h-9 fill-blue-400" />
            </button>

            {bookmark.url && (
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-blue-400 transition-colors group"
              >
                <ExternalLink size={18} className="group-hover:bg-blue-400/10 rounded-full p-2 w-9 h-9" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
