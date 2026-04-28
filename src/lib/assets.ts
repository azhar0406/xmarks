import type { SyntheticEvent } from 'react';

export const DEFAULT_AVATAR_URL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'><rect width='48' height='48' fill='%23374151'/><circle cx='24' cy='19' r='8' fill='%236b7280'/><path d='M8 44c0-9 7-14 16-14s16 5 16 14' fill='%236b7280'/></svg>";

export const handleAvatarError = (e: SyntheticEvent<HTMLImageElement>) => {
  const target = e.currentTarget;
  if (target.src !== DEFAULT_AVATAR_URL) {
    target.src = DEFAULT_AVATAR_URL;
  }
};
