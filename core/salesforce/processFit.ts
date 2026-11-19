// ─── Process fit from opportunity stage history ──────────────────────────────
//
// Pure functions, no API calls, so the logic can be tested on fixtures.
//
// The question: does the sales process as built match how deals really move?
// We read each closed deal's stage path from OpportunityHistory and look for
// three signals:
//
//   1. Skipped stages: a won deal that never passed through an open stage that
//      most won deals pass through (the "usual path"). Using the stages deals
//      actually use, rather than every stage in the picklist, avoids false
//      alarms when different sales processes use different stage subsets.
//   2. Backward moves: a deal that went from an open stage to an earlier open
//      stage at least once.
//   3. Created already closed: the first recorded stage is a closed stage, so
//      the deal was logged after the fact.

export interface StageDef {
  /** Picklist API value as stored in OpportunityHistory.StageName. */
  value: string
  label: string
  sortOrder: number
  isClosed: boolean
  isWon: boolean
}

export interface ClosedDeal {
  id: string
  isWon: boolean
}

export interface StageHistoryRow {
  opportunityId: string
  stage: string
  createdDate: string
}

export interface ProcessFitThresholds {
  /** Below this many closed deals with history, nothing is scored. */
  minClosedDeals: number
  /** Below this many won deals with a real path, stage skipping is not scored. */
  minWonDeals: number
  /** Share of won deals that must pass through a stage for it to be on the usual path. */
  usualPathShare: number
}

export const DEFAULT_THRESHOLDS: ProcessFitThresholds = {
  minClosedDeals: 20,
  minWonDeals: 10,
  usualPathShare: 0.5,
}

export interface ProcessFitResult {
  closedDealsAnalysed: number | null
  wonDealsAnalysed: number | null
  skippedStageDeals: number | null
  backwardMoveDeals: number | null
  createdClosedDeals: number | null
  /** Why a metric is null, when it is. */
  notMeasuredReason?: string
  skippedNotMeasuredReason?: string
  usualPath: string[]
  /** Up to 5 example opportunity IDs per signal, for the evidence file. */
  samples: {
    skipped: string[]
    backward: string[]
    createdClosed: string[]
  }
  /** Stage names seen in history that are not active stages today. */
  unknownStages: string[]
}

const SAMPLE_SIZE = 5

export function analyseProcessFit(
  stages: StageDef[],
  deals: ClosedDeal[],
  history: StageHistoryRow[],
  thresholds: ProcessFitThresholds = DEFAULT_THRESHOLDS,
): ProcessFitResult {
  const byName = new Map<string, StageDef>()
  for (const s of stages) {
    byName.set(s.value, s)
    if (!byName.has(s.label)) byName.set(s.label, s)
  }

  // Group history by deal, oldest first, collapsing repeats of the same stage
  // (an amount or close date change writes a history row with the same stage).
  const paths = new Map<string, string[]>()
  const sorted = [...history].sort((a, b) =>
    a.opportunityId === b.opportunityId
      ? a.createdDate.localeCompare(b.createdDate)
      : a.opportunityId.localeCompare(b.opportunityId))
  for (const row of sorted) {
    const path = paths.get(row.opportunityId) ?? []
    if (path[path.length - 1] !== row.stage) path.push(row.stage)
    paths.set(row.opportunityId, path)
  }

  const unknown = new Set<string>()
  const analysed: Array<{ deal: ClosedDeal; path: string[] }> = []
  for (const deal of deals) {
    const path = paths.get(deal.id)
    if (!path || path.length === 0) continue
    for (const stage of path) if (!byName.has(stage)) unknown.add(stage)
    analysed.push({ deal, path })
  }

  const empty: ProcessFitResult = {
    closedDealsAnalysed: analysed.length,
    wonDealsAnalysed: null,
    skippedStageDeals: null,
    backwardMoveDeals: null,
    createdClosedDeals: null,
    usualPath: [],
    samples: { skipped: [], backward: [], createdClosed: [] },
    unknownStages: [...unknown].sort(),
  }

  if (stages.length === 0) {
    return { ...empty, closedDealsAnalysed: null, notMeasuredReason: 'No active opportunity stages were readable.' }
  }
  if (analysed.length < thresholds.minClosedDeals) {
    return {
      ...empty,
      closedDealsAnalysed: null,
      notMeasuredReason: `Only ${analysed.length} closed deals with stage history; need at least ${thresholds.minClosedDeals} to judge process fit.`,
    }
  }

  const isOpen = (stage: string) => {
    const def = byName.get(stage)
    return def !== undefined && !def.isClosed
  }
  const order = (stage: string) => byName.get(stage)?.sortOrder

  const createdClosed: string[] = []
  const backward: string[] = []
  const wonWithPath: Array<{ id: string; openStages: Set<string> }> = []

  for (const { deal, path } of analysed) {
    const first = byName.get(path[0])
    const startedClosed = first !== undefined && first.isClosed
    if (startedClosed) createdClosed.push(deal.id)

    let movedBack = false
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1]
      const next = path[i]
      if (!isOpen(prev) || !isOpen(next)) continue
      const a = order(prev)
      const b = order(next)
      if (a !== undefined && b !== undefined && b < a) {
        movedBack = true
        break
      }
    }
    if (movedBack) backward.push(deal.id)

    if (deal.isWon && !startedClosed) {
      // Map to the canonical stage value so label/value mixes count once.
      const openStages = new Set(path.filter(isOpen).map(s => byName.get(s)!.value))
      wonWithPath.push({ id: deal.id, openStages })
    }
  }

  let skipped: string[] = []
  let usualPath: string[] = []
  let skippedNotMeasuredReason: string | undefined
  let wonDealsAnalysed: number | null = wonWithPath.length
  let skippedStageDeals: number | null = null

  if (wonWithPath.length < thresholds.minWonDeals) {
    wonDealsAnalysed = null
    skippedNotMeasuredReason = `Only ${wonWithPath.length} won deals with an open-stage path; need at least ${thresholds.minWonDeals} to find the usual path.`
  } else {
    const visits = new Map<string, number>()
    for (const w of wonWithPath) for (const s of w.openStages) visits.set(s, (visits.get(s) ?? 0) + 1)
    usualPath = stages
      .filter(s => !s.isClosed && (visits.get(s.value) ?? 0) / wonWithPath.length >= thresholds.usualPathShare)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(s => s.value)
    skipped = wonWithPath.filter(w => usualPath.some(s => !w.openStages.has(s))).map(w => w.id)
    skippedStageDeals = skipped.length
  }

  return {
    closedDealsAnalysed: analysed.length,
    wonDealsAnalysed,
    skippedStageDeals,
    backwardMoveDeals: backward.length,
    createdClosedDeals: createdClosed.length,
    skippedNotMeasuredReason,
    usualPath,
    samples: {
      skipped: skipped.slice(0, SAMPLE_SIZE),
      backward: backward.slice(0, SAMPLE_SIZE),
      createdClosed: createdClosed.slice(0, SAMPLE_SIZE),
    },
    unknownStages: [...unknown].sort(),
  }
}
