// ---------------------------------------------------------------------------
// crmAnalyzer.ts — AI-powered CRM validation
// ---------------------------------------------------------------------------

export interface CrmAiReport {
  verdict: 'looks_good' | 'needs_improvement' | 'not_a_crm';
  score: number;
  summary: string;
  techStack: string[];
  featuresDetected: {
    contactManagement: boolean;
    dealPipeline: boolean;
    activityTracking: boolean;
    userAuth: boolean;
    search: boolean;
    reporting: boolean;
    emailIntegration: boolean;
    tags: boolean;
  };
  strengths: string[];
  gaps: string[];
  recommendations: string[];
  useCaseFit: string;
}

interface AnthropicContent {
  type: string;
  text: string;
}

interface AnthropicResponse {
  content: AnthropicContent[];
}

// ---------------------------------------------------------------------------
// GitHub context fetcher
// ---------------------------------------------------------------------------

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const match = url.match(/github\.com\/([^/]+)\/([^/?\s#]+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

async function fetchGithubContext(repoUrl: string): Promise<string> {
  const parsed = parseGithubUrl(repoUrl);
  if (!parsed) return `Repo URL: ${repoUrl}`;

  const { owner, repo } = parsed;
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = { 'User-Agent': 'Vytal-CRM-Validator/1.0', Accept: 'application/vnd.github+json' };

  const parts: string[] = [`Repository: ${owner}/${repo}`];

  type RepoMeta = { description?: string; language?: string; topics?: string[]; stargazers_count?: number };
  type FileContent = { content?: string };
  type FileListing = Array<{ name: string; type: string }>;
  type PackageJson = { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

  await Promise.all([
    // Repo metadata
    fetch(base, { headers })
      .then((r) => r.ok ? r.json() as Promise<RepoMeta> : null)
      .then((data) => {
        if (!data) return;
        if (data.description) parts.push(`Description: ${data.description}`);
        if (data.language) parts.push(`Primary language: ${data.language}`);
        if (data.topics?.length) parts.push(`Topics: ${data.topics.join(', ')}`);
        if (data.stargazers_count !== undefined) parts.push(`Stars: ${data.stargazers_count}`);
      })
      .catch(() => {}),

    // README
    fetch(`${base}/readme`, { headers })
      .then((r) => r.ok ? r.json() as Promise<FileContent> : null)
      .then((data) => {
        if (!data?.content) return;
        const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
        parts.push(`\nREADME (first 4000 chars):\n${decoded.slice(0, 4000)}`);
      })
      .catch(() => {}),

    // Root file listing
    fetch(`${base}/contents`, { headers })
      .then((r) => r.ok ? r.json() as Promise<FileListing> : null)
      .then(async (files) => {
        if (!Array.isArray(files)) return;
        const names = files.map((f) => f.name).join(', ');
        parts.push(`\nRoot files: ${names}`);

        // Try to fetch package.json if it exists
        const hasPkg = files.some((f) => f.name === 'package.json');
        if (hasPkg) {
          const raw = await fetch(`${base}/contents/package.json`, { headers })
            .then((r) => r.ok ? r.json() as Promise<FileContent> : null)
            .catch(() => null);

          if (raw?.content) {
            try {
              const pkg = JSON.parse(Buffer.from(raw.content, 'base64').toString('utf-8')) as PackageJson;
              const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(', ');
              parts.push(`\nDependencies: ${deps}`);
            } catch { /* ignore parse errors */ }
          }
        }
      })
      .catch(() => {}),
  ]);

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Live URL context fetcher
// ---------------------------------------------------------------------------

async function fetchLiveUrlContext(appUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(appUrl, {
      headers: { 'User-Agent': 'Vytal-CRM-Validator/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return `Live URL returned status ${res.status}`;

    const html = await res.text();
    let stripped = html;
    let previous: string;
    do {
      previous = stripped;
      stripped = stripped
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } while (stripped !== previous);

    return `Live App Content (first 3000 chars):\n${stripped.slice(0, 3000)}`;
  } catch {
    clearTimeout(timer);
    return `Could not fetch live URL: ${appUrl}`;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function analyzeCrm(
  repoUrl: string | null,
  appUrl: string | null,
  description: string,
  builtFor: string | null,
): Promise<CrmAiReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';

  // Gather context from URLs
  const contextParts: string[] = [];

  if (repoUrl) {
    let isGithub = false;
    try {
      const { hostname } = new URL(repoUrl);
      const normalizedHost = hostname.toLowerCase();
      isGithub = normalizedHost === 'github.com' || normalizedHost === 'www.github.com';
    } catch {
      isGithub = false;
    }
    if (isGithub) {
      contextParts.push(await fetchGithubContext(repoUrl));
    } else {
      contextParts.push(`Repository URL: ${repoUrl}`);
    }
  }

  if (appUrl) {
    contextParts.push(await fetchLiveUrlContext(appUrl));
  }

  const context = contextParts.join('\n\n---\n\n') || '(No additional context available)';

  const prompt = `You are an expert CRM consultant reviewing a standalone CRM application for validation.

SUBMISSION:
Description: ${description}
${builtFor ? `Built for / Use case: ${builtFor}` : ''}

GATHERED CONTEXT:
${context}

---

Analyze whether this is a proper CRM application and respond with ONLY valid JSON (no markdown fences, no explanation) matching this exact schema:

{
  "verdict": "looks_good | needs_improvement | not_a_crm",
  "score": 0-100,
  "summary": "2-3 sentence assessment of what this CRM is and how well-built it is",
  "techStack": ["technology1", "technology2"],
  "featuresDetected": {
    "contactManagement": true or false,
    "dealPipeline": true or false,
    "activityTracking": true or false,
    "userAuth": true or false,
    "search": true or false,
    "reporting": true or false,
    "emailIntegration": true or false,
    "tags": true or false
  },
  "strengths": ["strength1", "strength2"],
  "gaps": ["gap1", "gap2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "useCaseFit": "Assessment of how well the CRM matches the stated use case and target users"
}

Scoring rules:
- "looks_good": score 70–100 — has contact management plus at least 3 other CRM features, clean architecture
- "needs_improvement": score 35–69 — has some CRM features but missing core functionality
- "not_a_crm": score 0–34 — does not function as a CRM (wrong category of app, or missing all core features)

Be constructive and specific. Focus on what would make this CRM better for its stated use case.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const textContent = data.content.find((c) => c.type === 'text');
  if (!textContent) throw new Error('Anthropic returned no text content');

  const raw = textContent.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const parsed = JSON.parse(raw) as CrmAiReport;

  // Normalise
  parsed.techStack = parsed.techStack ?? [];
  parsed.strengths = parsed.strengths ?? [];
  parsed.gaps = parsed.gaps ?? [];
  parsed.recommendations = parsed.recommendations ?? [];
  parsed.score = Math.max(0, Math.min(100, parsed.score ?? 0));

  return parsed;
}
