import { useState } from 'react';
import { Heart, Repeat2, MessageCircle, BarChart3, Bookmark as BookmarkIcon, ExternalLink, ImageOff } from 'lucide-react';
import { Bookmark } from '../lib/database';
import { DEFAULT_AVATAR_URL, handleAvatarError } from '../lib/assets';

interface BookmarkCardProps {
  bookmark: Bookmark;
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

export default function BookmarkCard({ bookmark }: BookmarkCardProps) {
  const [failedMedia, setFailedMedia] = useState<Set<number>>(new Set());

  const markMediaFailed = (idx: number) => {
    setFailedMedia((prev) => {
      if (prev.has(idx)) return prev;
      const next = new Set(prev);
      next.add(idx);
      return next;
    });
  };
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
    const path = `/media/${bookmark.screen_name}_${bookmark.id}_${media.type}_${index + 1}_${dateStr}.${ext}`;
    console.log('[Media] Trying path:', path, {
      tweetId: bookmark.id,
      screen_name: bookmark.screen_name,
      created_at: bookmark.created_at,
      type: media.type,
      index: index + 1,
      mediaUrls: { url: media.url, original: media.original, thumbnail: media.thumbnail },
    });
    return path;
  };

  const mediaArray = typeof bookmark.media === 'string' ? JSON.parse(bookmark.media) : bookmark.media || [];

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

          <div className="text-white whitespace-pre-wrap mb-3">
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
                        onError={(e) => {
                          console.warn('[Media] Photo failed to load:', (e.currentTarget as HTMLImageElement).src, {
                            tweetId: bookmark.id,
                            screen_name: bookmark.screen_name,
                          });
                          markMediaFailed(idx);
                        }}
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
                        onError={(e) => {
                          console.warn('[Media] Video failed to load:', (e.currentTarget as HTMLVideoElement).src, {
                            tweetId: bookmark.id,
                            screen_name: bookmark.screen_name,
                            mediaType: media.type,
                            error: (e.currentTarget as HTMLVideoElement).error,
                          });
                          markMediaFailed(idx);
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {bookmark.category && (
            <div className="mb-3">
              <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm">
                {bookmark.category}
              </span>
            </div>
          )}

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

            <button className="flex items-center gap-2 hover:text-blue-400 transition-colors group">
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
