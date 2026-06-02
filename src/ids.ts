const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract the canonical 11-char YouTube video ID from a bare ID or any common URL form.
 * Returns null if the input is not a recognisable YouTube video reference.
 */
export function extractVideoId(input: string): string | null {
  if (!input) return null;

  // Try treating the whole input as a bare ID first
  if (VIDEO_ID_RE.test(input)) return input;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const { hostname, pathname, searchParams } = url;
  const isYouTube =
    hostname === 'www.youtube.com' || hostname === 'youtube.com' || hostname === 'm.youtube.com';
  const isShortLink = hostname === 'youtu.be';

  if (isShortLink) {
    // pathname is /<id>
    const id = pathname.slice(1);
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  if (isYouTube) {
    // /watch?v=<id>
    if (pathname === '/watch') {
      const v = searchParams.get('v');
      return v && VIDEO_ID_RE.test(v) ? v : null;
    }
    // /embed/<id>
    if (pathname.startsWith('/embed/')) {
      const id = pathname.slice('/embed/'.length);
      return VIDEO_ID_RE.test(id) ? id : null;
    }
    // /shorts/<id>
    if (pathname.startsWith('/shorts/')) {
      const id = pathname.slice('/shorts/'.length);
      return VIDEO_ID_RE.test(id) ? id : null;
    }
  }

  return null;
}

export function toWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

export function toEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}`;
}
