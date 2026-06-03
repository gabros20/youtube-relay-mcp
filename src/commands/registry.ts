type CommandArg = {
  flag: string;
  description: string;
};

type CommandMeta = {
  name: string;
  summary: string;
  usage: string;
  args: CommandArg[];
  example: string;
};

export const COMMANDS: CommandMeta[] = [
  {
    name: 'search',
    summary:
      'Search YouTube (captioned-only by default) → enriched results (views, recency, verified, snippet). CHEAP — rank on this before fetching transcripts.',
    usage:
      'ytrelay search "<query>" [--limit N] [--features cc|all] [--sort relevance|date|views|rating] [--upload-date all|hour|today|week|month|year] [--duration any|short|medium|long]',
    args: [
      { flag: '--limit N', description: 'Max results, following pages as needed (default: 10).' },
      {
        flag: '--features cc|all',
        description: 'cc (default) = captioned only; all = include uncaptioned.',
      },
      { flag: '--sort', description: 'relevance (default) | date | views | rating.' },
      { flag: '--upload-date', description: 'all | hour | today | week | month | year.' },
      { flag: '--duration', description: 'any | short | medium | long.' },
    ],
    example: 'ytrelay search "prompt engineering" --limit 30 --sort views',
  },
  {
    name: 'info',
    summary:
      'Rich detail for a video: full description, views, chapters, caption availability. 1 CALL — use to re-rank shortlisted candidates. Accepts multiple ids.',
    usage: 'ytrelay info <id|url> [<id|url> ...]',
    args: [
      {
        flag: '<id|url> ...',
        description: 'One or more video ids/URLs; a `-` reads ids from stdin.',
      },
    ],
    example: 'ytrelay info dQw4w9WgXcQ jNQXAC9IVRw',
  },
  {
    name: 'transcript',
    summary:
      'Fetch a transcript. EXPENSIVE (full text) — use --head/--max-chars to PEEK cheaply before a full read. Accepts multiple ids.',
    usage:
      'ytrelay transcript <id|url> [<id|url> ...] [--lang xx] [--format text|json] [--head SECONDS] [--max-chars N]',
    args: [
      {
        flag: '--lang xx',
        description: 'Preferred caption language (BCP-47); falls back sensibly.',
      },
      {
        flag: '--format text|json',
        description: 'json (default) includes timestamped segments; text is the string only.',
      },
      { flag: '--head SECONDS', description: 'Peek: keep only the opening N seconds.' },
      { flag: '--max-chars N', description: 'Peek: cap the transcript to N characters.' },
    ],
    example: 'ytrelay transcript dQw4w9WgXcQ --head 120',
  },
  {
    name: 'context',
    summary:
      'Video info + transcript together (metadata always returned even if the transcript is unavailable). Accepts multiple ids.',
    usage: 'ytrelay context <id|url> [<id|url> ...] [--lang xx]',
    args: [{ flag: '--lang xx', description: 'Preferred caption language (BCP-47).' }],
    example: 'ytrelay context dQw4w9WgXcQ',
  },
  {
    name: 'frame',
    summary:
      'Extract high-res still frame(s) at timestamp(s). Pairs with transcript startMs to SEE a moment. Requires ffmpeg + yt-dlp on PATH.',
    usage:
      'ytrelay frame <id|url> --at <t> [--at <t2> ...] [--res 720|1080|1440|2160|max] [--format jpg|png] [--out <dir>]',
    args: [
      { flag: '--at <t>', description: 'Timestamp (repeatable): seconds, mm:ss, h:mm:ss, or Nms.' },
      { flag: '--res', description: '720|1080|1440|2160|max (default 1080).' },
      { flag: '--format jpg|png', description: 'jpg (default, q2) or png (lossless).' },
      { flag: '--out <dir>', description: 'Output directory (default: current dir).' },
    ],
    example: 'ytrelay frame dQw4w9WgXcQ --at 1:30 --at 2:05 --res 1080',
  },
];

export const commandNames: string[] = COMMANDS.map((c) => c.name);
