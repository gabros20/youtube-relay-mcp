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
    summary: 'Search YouTube and return a list of video summaries.',
    usage: 'ytrelay search "<query>" [--limit N]',
    args: [{ flag: '--limit N', description: 'Maximum number of results to return (default: 5).' }],
    example: 'ytrelay search "bun runtime intro" --limit 3',
  },
  {
    name: 'info',
    summary: 'Fetch title, description, channel, and duration for a single video.',
    usage: 'ytrelay info <id|url>',
    args: [],
    example: 'ytrelay info dQw4w9WgXcQ',
  },
  {
    name: 'transcript',
    summary: 'Fetch the transcript for a video, optionally in a specific language and format.',
    usage: 'ytrelay transcript <id|url> [--lang xx] [--format text|json]',
    args: [
      {
        flag: '--lang xx',
        description: 'BCP-47 language code for the caption track (default: auto).',
      },
      {
        flag: '--format text|json',
        description: 'Output format: plain text or JSON segments (default: text).',
      },
    ],
    example: 'ytrelay transcript dQw4w9WgXcQ --lang en --format json',
  },
  {
    name: 'context',
    summary: 'Fetch video info and transcript together in a single call.',
    usage: 'ytrelay context <id|url> [--lang xx]',
    args: [
      {
        flag: '--lang xx',
        description: 'BCP-47 language code for the caption track (default: auto).',
      },
    ],
    example: 'ytrelay context dQw4w9WgXcQ --lang en',
  },
];

export const commandNames: string[] = COMMANDS.map((c) => c.name);
