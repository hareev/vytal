import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyseProcessFit, type StageDef, type ClosedDeal, type StageHistoryRow } from '../core/salesforce/processFit'

const stages: StageDef[] = [
  { value: 'Prospecting', label: 'Prospecting', sortOrder: 1, isClosed: false, isWon: false },
  { value: 'Qualification', label: 'Qualification', sortOrder: 2, isClosed: false, isWon: false },
  { value: 'Proposal', label: 'Proposal/Price Quote', sortOrder: 3, isClosed: false, isWon: false },
  { value: 'Negotiation', label: 'Negotiation', sortOrder: 4, isClosed: false, isWon: false },
  { value: 'Closed Won', label: 'Closed Won', sortOrder: 5, isClosed: true, isWon: true },
  { value: 'Closed Lost', label: 'Closed Lost', sortOrder: 6, isClosed: true, isWon: false },
]

/** Build deals and history from stage paths, one day per step. */
function build(paths: Array<{ won: boolean; path: string[] }>) {
  const deals: ClosedDeal[] = []
  const history: StageHistoryRow[] = []
  paths.forEach((p, i) => {
    const id = `006${String(i).padStart(3, '0')}`
    deals.push({ id, isWon: p.won })
    p.path.forEach((stage, step) => {
      history.push({ opportunityId: id, stage, createdDate: new Date(Date.UTC(2026, 0, 1 + step)).toISOString() })
    })
  })
  return { deals, history }
}

const FULL = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won']

test('too few closed deals: nothing is measured, with a reason', () => {
  const { deals, history } = build(Array.from({ length: 5 }, () => ({ won: true, path: FULL })))
  const r = analyseProcessFit(stages, deals, history)
  assert.equal(r.closedDealsAnalysed, null)
  assert.equal(r.backwardMoveDeals, null)
  assert.equal(r.skippedStageDeals, null)
  assert.match(r.notMeasuredReason ?? '', /Only 5 closed deals/)
})

test('a clean pipeline shows no skipped, backward or created-closed deals', () => {
  const { deals, history } = build([
    ...Array.from({ length: 15 }, () => ({ won: true, path: FULL })),
    ...Array.from({ length: 10 }, () => ({ won: false, path: ['Prospecting', 'Qualification', 'Closed Lost'] })),
  ])
  const r = analyseProcessFit(stages, deals, history)
  assert.equal(r.closedDealsAnalysed, 25)
  assert.equal(r.wonDealsAnalysed, 15)
  assert.equal(r.skippedStageDeals, 0)
  assert.equal(r.backwardMoveDeals, 0)
  assert.equal(r.createdClosedDeals, 0)
  assert.deepEqual(r.usualPath, ['Prospecting', 'Qualification', 'Proposal', 'Negotiation'])
})

test('finds skipped stages, backward moves and deals entered already closed', () => {
  const { deals, history } = build([
    ...Array.from({ length: 12 }, () => ({ won: true, path: FULL })),
    // 3 won deals jump from Qualification straight to Negotiation
    ...Array.from({ length: 3 }, () => ({ won: true, path: ['Prospecting', 'Qualification', 'Negotiation', 'Closed Won'] })),
    // 4 deals slide back from Proposal to Qualification
    ...Array.from({ length: 4 }, () => ({ won: false, path: ['Prospecting', 'Qualification', 'Proposal', 'Qualification', 'Closed Lost'] })),
    // 6 deals logged after the fact
    ...Array.from({ length: 6 }, () => ({ won: true, path: ['Closed Won'] })),
  ])
  const r = analyseProcessFit(stages, deals, history)
  assert.equal(r.closedDealsAnalysed, 25)
  assert.equal(r.wonDealsAnalysed, 15) // created-closed won deals have no open path
  assert.equal(r.skippedStageDeals, 3)
  assert.equal(r.backwardMoveDeals, 4)
  assert.equal(r.createdClosedDeals, 6)
  assert.equal(r.samples.skipped.length, 3)
  assert.ok(r.samples.createdClosed.length <= 5)
})

test('repeated rows for the same stage are not counted as moves', () => {
  const { deals, history } = build(Array.from({ length: 20 }, () => ({
    won: true,
    path: ['Prospecting', 'Prospecting', 'Qualification', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won'],
  })))
  const r = analyseProcessFit(stages, deals, history)
  assert.equal(r.backwardMoveDeals, 0)
  assert.equal(r.skippedStageDeals, 0)
})

test('history recorded by label matches the stage value', () => {
  const { deals, history } = build(Array.from({ length: 20 }, () => ({
    won: true,
    path: ['Prospecting', 'Qualification', 'Proposal/Price Quote', 'Negotiation', 'Closed Won'],
  })))
  const r = analyseProcessFit(stages, deals, history)
  assert.equal(r.skippedStageDeals, 0)
  assert.deepEqual(r.unknownStages, [])
})

test('stages no longer active are reported and ignored for ordering', () => {
  const { deals, history } = build(Array.from({ length: 20 }, () => ({
    won: true,
    path: ['Prospecting', 'Old Discovery', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won'],
  })))
  const r = analyseProcessFit(stages, deals, history)
  assert.deepEqual(r.unknownStages, ['Old Discovery'])
  assert.equal(r.backwardMoveDeals, 0)
})

test('too few won deals: stage skipping is not measured, the rest is', () => {
  const { deals, history } = build([
    ...Array.from({ length: 5 }, () => ({ won: true, path: FULL })),
    ...Array.from({ length: 20 }, () => ({ won: false, path: ['Prospecting', 'Closed Lost'] })),
  ])
  const r = analyseProcessFit(stages, deals, history)
  assert.equal(r.closedDealsAnalysed, 25)
  assert.equal(r.wonDealsAnalysed, null)
  assert.equal(r.skippedStageDeals, null)
  assert.equal(r.backwardMoveDeals, 0)
  assert.match(r.skippedNotMeasuredReason ?? '', /Only 5 won deals/)
})

test('deals without any history are left out', () => {
  const { deals, history } = build(Array.from({ length: 20 }, () => ({ won: true, path: FULL })))
  deals.push({ id: '006NOHIST', isWon: true })
  const r = analyseProcessFit(stages, deals, history)
  assert.equal(r.closedDealsAnalysed, 20)
})
