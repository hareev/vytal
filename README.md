# Vytal — CRM Health Doctor

> Connect any CRM org and get a live AI-powered health dashboard in seconds.

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-D365%20%7C%20Salesforce%20%7C%20Siebel-informational)
![AI](https://img.shields.io/badge/AI-Claude%20API-orange)

Vytal is an open-source, CRM-agnostic health monitoring dashboard for developers and architects. Connect your org once — get scored, prioritised, AI-interpreted diagnostics across schema hygiene, automation complexity, data quality, security posture, and adoption health.

**No vendor lock-in. No agents to install. Just connect and diagnose.**

---

## Why Vytal?

Every major CRM platform ships its own health check tool — but they're siloed, CLI-only, or hidden behind expensive licenses. Developers managing multi-platform estates have no unified view.

Vytal solves this with:
- A **standard health data model** that all connectors map to
- A **platform-agnostic scoring engine** (0–100 per dimension)
- **Claude API** interpreting scores into prioritised, actionable findings
- A **live React dashboard** — no backend needed, credentials stay in-browser

---

## Supported Platforms

| Platform | Connector | Status |
|---|---|---|
| Microsoft Dynamics 365 / Dataverse | `D365Adapter` | ✅ v0.1 |
| Salesforce | `SalesforceAdapter` | 🔜 v0.2 |
| Oracle Siebel | `SiebelAdapter` | 🔜 v0.3 |
| HubSpot | `HubSpotAdapter` | 📋 Planned |
| Custom / API | `BaseAdapter` | Extend yourself |

---

## Health Dimensions

| Dimension | What it measures |
|---|---|
| **Schema hygiene** | Unused fields/entities, naming conventions, deprecated objects |
| **Automation complexity** | Flow nesting depth, circular dependencies, error handling gaps |
| **Data quality** | Duplicate records, completeness %, stale data patterns |
| **Security posture** | Over-privileged roles, dormant admin accounts, audit log gaps |
| **Adoption health** | Active user ratios, feature utilisation, inactive automation |

---

## Quick Start

```bash
# Clone
git clone https://github.com/hareev/vytal.git
cd vytal

# Install
npm install

# Add your Anthropic API key
cp .env.example .env
# Edit .env and add VITE_ANTHROPIC_API_KEY=sk-ant-...

# Run
npm run dev
```

Then open `http://localhost:5173` and connect your first org.

---

## Architecture

```
src/
├── lib/
│   ├── adapters/       # CRM connectors (one file per platform)
│   │   ├── base.ts     # BaseAdapter interface — implement to add a new CRM
│   │   ├── d365.ts     # Dynamics 365 / Dataverse adapter
│   │   └── salesforce.ts
│   ├── scoring/
│   │   ├── engine.ts   # Platform-agnostic health scoring (0–100)
│   │   └── rules/      # Per-dimension rule sets
│   └── ai/
│       └── triage.ts   # Claude API integration — score → diagnosis
├── components/
│   ├── dashboard/      # ScoreRing, DimensionBars, IssueList, AIPanel
│   ├── connectors/     # ConnectModal, OrgPicker
│   └── shared/         # Badge, MetricCard, Trend
├── types/
│   └── health.ts       # HealthPayload, Issue, Diagnosis types
└── pages/
    └── Dashboard.tsx   # Main view
```

---

## Adding a New CRM Connector

Implement `BaseAdapter` in `src/lib/adapters/base.ts`:

```typescript
export interface BaseAdapter {
  name: string;
  connect(credentials: Record<string, string>): Promise<void>;
  fetchHealthPayload(): Promise<RawHealthPayload>;
}
```

That's it. The scoring engine and AI layer are fully platform-agnostic — your adapter just needs to return a `RawHealthPayload`.

---

## Contributing

PRs welcome. The highest-value contributions right now:

1. **Salesforce adapter** — REST + Tooling API, map to `RawHealthPayload`
2. **New scoring rules** — add rule files under `src/lib/scoring/rules/`
3. **Dashboard panels** — trend history, org comparison view

Please open an issue first for anything beyond bug fixes.

---

## License

MIT — use it, fork it, build on it.

---

*Built by [@hareev](https://github.com/hareev) — 18 years in CRM, tired of bad tooling.*
