# Contributing to Vytal

Thanks for wanting to help. The most valuable contributions right now:

## Adding a new CRM connector

1. Create `src/lib/adapters/yourplatform.ts`
2. Implement the `BaseAdapter` interface from `src/lib/adapters/base.ts`
3. Add a `manifest` static property (defines the connect form fields)
4. Register in `src/lib/adapters/index.ts`
5. Add connection UI if needed in `src/components/connectors/`

The scoring engine is fully platform-agnostic — your adapter just maps API responses to `RawHealthPayload`.

## Adding scoring rules

Rules live in `src/lib/scoring/engine.ts` per dimension function.
Each rule: fires against `RawHealthPayload`, pushes an `Issue`, adds a `penalty`.
Keep penalties proportional to real-world impact (critical = 15–25, high = 10–15, medium = 5–10).

## Reporting issues

Open a GitHub issue with:
- Platform (D365, Salesforce, etc.)
- What you expected vs what happened
- Steps to reproduce

## Code style

- TypeScript strict mode — no `any`
- No external CSS frameworks
- Keep components small and focused
- New components go in the appropriate `src/components/` subfolder

## License

By contributing, you agree your code is licensed under MIT.
