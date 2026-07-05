import { create } from 'zustand'
import type { CrmSubmission, CreateCrmSubmissionInput } from '@/types/crmReview'
import { api } from '@/lib/api/client'

interface CrmReviewStore {
  submissions: CrmSubmission[]
  activeSubmission: CrmSubmission | null
  isLoading: boolean
  isSubmitting: boolean
  error: string | null

  loadSubmissions: (params?: { page?: number; verdict?: string }) => Promise<void>
  loadSubmission: (id: string) => Promise<void>
  createSubmission: (data: CreateCrmSubmissionInput) => Promise<CrmSubmission>
  reanalyzeSubmission: (id: string) => Promise<void>
  setActiveSubmission: (submission: CrmSubmission | null) => void
  refreshActiveSubmission: () => Promise<void>
}

export const useCrmReviewStore = create<CrmReviewStore>((set, get) => ({
  submissions: [],
  activeSubmission: null,
  isLoading: false,
  isSubmitting: false,
  error: null,

  loadSubmissions: async (params) => {
    set({ isLoading: true, error: null })
    try {
      const result = await api.crmReviews.list(params)
      set({ submissions: result.data, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load submissions' })
    }
  },

  loadSubmission: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const submission = await api.crmReviews.get(id)
      set({ activeSubmission: submission, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load submission' })
    }
  },

  createSubmission: async (data) => {
    set({ isSubmitting: true, error: null })
    try {
      const submission = await api.crmReviews.create(data)
      set((state) => ({
        submissions: [submission, ...state.submissions],
        activeSubmission: submission,
        isSubmitting: false,
      }))
      return submission
    } catch (err) {
      set({ isSubmitting: false, error: err instanceof Error ? err.message : 'Failed to submit' })
      throw err
    }
  },

  reanalyzeSubmission: async (id) => {
    try {
      const updated = await api.crmReviews.reanalyze(id)
      set((state) => ({
        submissions: state.submissions.map((s) => (s.id === id ? updated : s)),
        activeSubmission: state.activeSubmission?.id === id ? updated : state.activeSubmission,
      }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to re-analyze' })
    }
  },

  setActiveSubmission: (submission) => set({ activeSubmission: submission }),

  refreshActiveSubmission: async () => {
    const { activeSubmission } = get()
    if (!activeSubmission) return
    try {
      const updated = await api.crmReviews.get(activeSubmission.id)
      set((state) => ({
        activeSubmission: updated,
        submissions: state.submissions.map((s) => (s.id === updated.id ? updated : s)),
      }))
    } catch {
      // silently ignore refresh failures
    }
  },
}))
