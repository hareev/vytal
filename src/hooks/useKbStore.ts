import { create } from 'zustand'
import type { KbCategory, KbArticle, ArticleStatus } from '@/types/kb'
import type { ListParams } from '@/lib/api/client'
import { api } from '@/lib/api/client'
import { mockApi } from '@/lib/api/mock'

// ─── Mock flag ────────────────────────────────────────────────────────────────

const USE_MOCK =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: { VITE_USE_MOCK?: string } }).env?.VITE_USE_MOCK === 'true')

const client = USE_MOCK ? mockApi : api

// ─── State & Actions ─────────────────────────────────────────────────────────

interface KbStore {
  categories: KbCategory[]
  articles: KbArticle[]
  activeArticle: KbArticle | null
  isLoading: boolean
  error: string | null

  loadCategories: () => Promise<void>
  loadArticles: (params?: ListParams & { categoryId?: string; status?: ArticleStatus }) => Promise<void>
  loadArticle: (id: string) => Promise<void>

  createCategory: (data: Omit<KbCategory, 'id' | 'orgId' | 'createdAt' | 'articleCount'>) => Promise<KbCategory>
  updateCategory: (id: string, data: Partial<Omit<KbCategory, 'id' | 'orgId' | 'createdAt' | 'articleCount'>>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>

  createArticle: (data: Omit<KbArticle, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'viewCount'>) => Promise<KbArticle>
  updateArticle: (id: string, data: Partial<Omit<KbArticle, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'viewCount'>>) => Promise<void>
  deleteArticle: (id: string) => Promise<void>
  publishArticle: (id: string) => Promise<void>
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useKbStore = create<KbStore>((set, get) => ({
  categories: [],
  articles: [],
  activeArticle: null,
  isLoading: false,
  error: null,

  loadCategories: async () => {
    set({ isLoading: true, error: null })
    try {
      const categories = await client.kb.categories.list()
      set({ categories, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load categories' })
    }
  },

  loadArticles: async (params) => {
    set({ isLoading: true, error: null })
    try {
      const articles = await client.kb.articles.list(params)
      set({ articles, isLoading: false })
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load articles' })
    }
  },

  loadArticle: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const article = await client.kb.articles.get(id)
      set({ activeArticle: article, isLoading: false })
      // Keep article list in sync with updated view count
      set((state) => ({
        articles: state.articles.map((a) => (a.id === id ? article : a)),
      }))
    } catch (err) {
      set({ isLoading: false, error: err instanceof Error ? err.message : 'Failed to load article' })
    }
  },

  createCategory: async (data) => {
    const category = await client.kb.categories.create(data)
    set((state) => ({ categories: [...state.categories, category] }))
    return category
  },

  updateCategory: async (id, data) => {
    const updated = await client.kb.categories.update(id, data)
    set((state) => ({
      categories: state.categories.map((c) => (c.id === id ? updated : c)),
    }))
  },

  deleteCategory: async (id) => {
    await client.kb.categories.delete(id)
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== id),
    }))
  },

  createArticle: async (data) => {
    const article = await client.kb.articles.create(data)
    set((state) => ({ articles: [...state.articles, article] }))
    // Refresh categories to update article counts
    get().loadCategories()
    return article
  },

  updateArticle: async (id, data) => {
    const updated = await client.kb.articles.update(id, data)
    set((state) => ({
      articles: state.articles.map((a) => (a.id === id ? updated : a)),
      activeArticle: state.activeArticle?.id === id ? updated : state.activeArticle,
    }))
  },

  deleteArticle: async (id) => {
    await client.kb.articles.delete(id)
    set((state) => ({
      articles: state.articles.filter((a) => a.id !== id),
      activeArticle: state.activeArticle?.id === id ? null : state.activeArticle,
    }))
    get().loadCategories()
  },

  publishArticle: async (id) => {
    const updated = await client.kb.articles.publish(id)
    set((state) => ({
      articles: state.articles.map((a) => (a.id === id ? updated : a)),
      activeArticle: state.activeArticle?.id === id ? updated : state.activeArticle,
    }))
  },
}))
