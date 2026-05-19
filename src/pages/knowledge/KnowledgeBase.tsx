import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { useKbStore } from '@/hooks/useKbStore'
import type { KbCategory, KbArticle, ArticleStatus } from '@/types/kb'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ArticleStatus, { bg: string; color: string }> = {
  published: { bg: 'var(--success-bg)', color: 'var(--success-text)' },
  draft: { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' },
}

function StatusBadge({ status }: { status: ArticleStatus }) {
  const s = STATUS_COLORS[status]
  return (
    <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: s.bg, color: s.color, textTransform: 'capitalize', letterSpacing: '0.02em' }}>
      {status}
    </span>
  )
}

const inputStyle: CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '8px',
  border: '0.5px solid var(--border)', background: 'var(--bg-input)',
  fontSize: '13px', color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
}

// ── Category Modal ─────────────────────────────────────────────────────────────

interface CategoryModalProps {
  initial?: KbCategory | null
  onClose: () => void
  onSave: (data: Omit<KbCategory, 'id' | 'orgId' | 'createdAt' | 'articleCount'>) => void
}

function CategoryModal({ initial, onClose, onSave }: CategoryModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [position, setPosition] = useState(initial?.position ?? 0)

  function handleSave() {
    if (!name.trim()) return
    onSave({ name: name.trim(), slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''), description: description.trim() || undefined, position })
    onClose()
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '440px', border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{initial ? 'Edit category' : 'New category'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Getting Started" style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description of this category" style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Position</label>
            <input type="number" value={position} onChange={(e) => setPosition(Number(e.target.value))} min={0} style={{ ...inputStyle, width: '80px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
            <button onClick={handleSave} disabled={!name.trim()} style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: 'var(--accent)', fontSize: '13px', fontWeight: 500, cursor: name.trim() ? 'pointer' : 'not-allowed', color: '#fff', opacity: name.trim() ? 1 : 0.5 }}>
              {initial ? 'Save changes' : 'Create category'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Article Modal ──────────────────────────────────────────────────────────────

interface ArticleModalProps {
  categories: KbCategory[]
  initial?: KbArticle | null
  onClose: () => void
  onSave: (data: Omit<KbArticle, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'viewCount'>) => void
}

function ArticleModal({ categories, initial, onClose, onSave }: ArticleModalProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [categoryId, setCategoryId] = useState<string | undefined>(initial?.categoryId)
  const [status, setStatus] = useState<ArticleStatus>(initial?.status ?? 'draft')

  function handleSave() {
    if (!title.trim() || !body.trim()) return
    onSave({
      title: title.trim(),
      slug: title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      body: body.trim(),
      categoryId,
      status,
      authorId: undefined,
    })
    onClose()
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '600px', border: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{initial ? 'Edit article' : 'New article'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title" style={inputStyle} autoFocus />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Body *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your article content here…"
              rows={8}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Category</label>
              <select
                value={categoryId ?? ''}
                onChange={(e) => setCategoryId(e.target.value || undefined)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">No category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px', color: 'var(--text-secondary)' }}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ArticleStatus)}
                style={{ ...inputStyle, cursor: 'pointer', textTransform: 'capitalize' }}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '13px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || !body.trim()}
              style={{ flex: 2, padding: '9px', borderRadius: '8px', border: 'none', background: 'var(--accent)', fontSize: '13px', fontWeight: 500, cursor: (title.trim() && body.trim()) ? 'pointer' : 'not-allowed', color: '#fff', opacity: (title.trim() && body.trim()) ? 1 : 0.5 }}
            >
              {initial ? 'Save changes' : 'Create article'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Article detail panel ───────────────────────────────────────────────────────

interface ArticlePanelProps {
  article: KbArticle
  categories: KbCategory[]
  onClose: () => void
  onEdit: (article: KbArticle) => void
  onPublish: (id: string) => void
}

function ArticlePanel({ article, categories, onClose, onEdit, onPublish }: ArticlePanelProps) {
  const category = categories.find((c) => c.id === article.categoryId)

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: 'var(--bg-card)', borderLeft: '0.5px solid var(--border)', zIndex: 500, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ flex: 1, paddingRight: '12px' }}>
            <div style={{ fontWeight: 600, fontSize: '15px', lineHeight: 1.3, marginBottom: '8px' }}>{article.title}</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusBadge status={article.status} />
              {category && (
                <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px', background: 'var(--info-bg)', color: 'var(--info-text)' }}>
                  {category.name}
                </span>
              )}
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{article.viewCount} views</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', color: 'var(--text-tertiary)', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onEdit(article)}
            style={{ flex: 1, padding: '7px', borderRadius: '7px', border: '0.5px solid var(--border)', background: 'transparent', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: 'var(--text-secondary)' }}
          >
            Edit
          </button>
          {article.status === 'draft' && (
            <button
              onClick={() => onPublish(article.id)}
              style={{ flex: 1, padding: '7px', borderRadius: '7px', border: 'none', background: 'var(--accent)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: '#fff' }}
            >
              Publish
            </button>
          )}
        </div>
      </div>

      {/* Meta */}
      <div style={{ padding: '10px 20px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          Updated {new Date(article.updatedAt).toLocaleDateString()} · Created {new Date(article.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <pre style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
          {article.body}
        </pre>
      </div>
    </div>
  )
}

// ── KnowledgeBase page ─────────────────────────────────────────────────────────

export function KnowledgeBase() {
  const categories = useKbStore((s) => s.categories)
  const articles = useKbStore((s) => s.articles)
  const activeArticle = useKbStore((s) => s.activeArticle)
  const isLoading = useKbStore((s) => s.isLoading)
  const loadCategories = useKbStore((s) => s.loadCategories)
  const loadArticles = useKbStore((s) => s.loadArticles)
  const loadArticle = useKbStore((s) => s.loadArticle)
  const createCategory = useKbStore((s) => s.createCategory)
  const updateCategory = useKbStore((s) => s.updateCategory)
  const deleteCategory = useKbStore((s) => s.deleteCategory)
  const createArticle = useKbStore((s) => s.createArticle)
  const updateArticle = useKbStore((s) => s.updateArticle)
  const deleteArticle = useKbStore((s) => s.deleteArticle)
  const publishArticle = useKbStore((s) => s.publishArticle)

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Modals
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<KbCategory | null>(null)
  const [showArticleModal, setShowArticleModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState<KbArticle | null>(null)

  useEffect(() => {
    loadCategories()
    loadArticles()
  }, [])

  // Reload articles when category filter changes
  useEffect(() => {
    loadArticles(selectedCategoryId ? { categoryId: selectedCategoryId } : undefined)
  }, [selectedCategoryId])

  // Keep active article in sync
  useEffect(() => {
    if (selectedArticleId) {
      const updated = articles.find((a) => a.id === selectedArticleId)
      if (updated && (!activeArticle || activeArticle.id !== selectedArticleId)) {
        loadArticle(selectedArticleId)
      }
    }
  }, [selectedArticleId])

  const filteredArticles = search
    ? articles.filter((a) => a.title.toLowerCase().includes(search.toLowerCase()) || a.body.toLowerCase().includes(search.toLowerCase()))
    : articles

  const displayArticle = selectedArticleId ? (articles.find((a) => a.id === selectedArticleId) ?? null) : null

  function handleSelectArticle(article: KbArticle) {
    if (selectedArticleId === article.id) {
      setSelectedArticleId(null)
    } else {
      setSelectedArticleId(article.id)
      loadArticle(article.id)
    }
  }

  function handleSaveCategory(data: Omit<KbCategory, 'id' | 'orgId' | 'createdAt' | 'articleCount'>) {
    if (editingCategory) {
      updateCategory(editingCategory.id, data)
    } else {
      createCategory(data)
    }
    setEditingCategory(null)
  }

  function handleSaveArticle(data: Omit<KbArticle, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'viewCount'>) {
    if (editingArticle) {
      updateArticle(editingArticle.id, data)
    } else {
      createArticle(data)
    }
    setEditingArticle(null)
  }

  function handleOpenEditArticle(article: KbArticle) {
    setEditingArticle(article)
    setShowArticleModal(true)
  }

  function handleDeleteCategory(id: string) {
    if (!window.confirm('Delete this category? This cannot be undone.')) return
    deleteCategory(id).catch((err: unknown) => {
      alert(err instanceof Error ? err.message : 'Failed to delete category')
    })
  }

  function handleDeleteArticle(id: string) {
    if (!window.confirm('Delete this article? This cannot be undone.')) return
    deleteArticle(id)
    if (selectedArticleId === id) setSelectedArticleId(null)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── Left sidebar: categories ── */}
      <div style={{ width: '200px', flexShrink: 0, borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', overflowY: 'auto' }}>
        <div style={{ padding: '12px', borderBottom: '0.5px solid var(--border)' }}>
          <button
            onClick={() => { setEditingCategory(null); setShowCategoryModal(true) }}
            style={{ width: '100%', padding: '7px', borderRadius: '7px', border: 'none', background: 'var(--accent)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', color: '#fff' }}
          >
            + New Category
          </button>
        </div>

        {/* All articles entry */}
        <button
          onClick={() => setSelectedCategoryId(null)}
          style={{
            width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', borderBottom: '0.5px solid var(--border)',
            background: selectedCategoryId === null ? 'var(--accent-bg)' : 'transparent',
            cursor: 'pointer', fontSize: '13px', fontWeight: 500,
            color: selectedCategoryId === null ? 'var(--accent-text)' : 'var(--text-primary)',
            transition: 'background 0.15s',
          }}
        >
          All articles
          <span style={{ marginLeft: '6px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
            {articles.length}
          </span>
        </button>

        {/* Category list */}
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              borderBottom: '0.5px solid var(--border)',
              background: selectedCategoryId === cat.id ? 'var(--accent-bg)' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <button
              onClick={() => setSelectedCategoryId(cat.id === selectedCategoryId ? null : cat.id)}
              style={{
                width: '100%', padding: '10px 14px', textAlign: 'left', border: 'none', background: 'transparent',
                cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                color: selectedCategoryId === cat.id ? 'var(--accent-text)' : 'var(--text-primary)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{cat.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: '4px' }}>
                  {cat.articleCount ?? 0}
                </span>
              </div>
            </button>
            <div style={{ display: 'flex', gap: '4px', padding: '0 14px 8px', opacity: selectedCategoryId === cat.id ? 1 : 0, transition: 'opacity 0.15s', pointerEvents: selectedCategoryId === cat.id ? 'auto' : 'none' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingCategory(cat); setShowCategoryModal(true) }}
                style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '0.5px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                Edit
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id) }}
                style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', border: '0.5px solid var(--danger)', background: 'transparent', cursor: 'pointer', color: 'var(--danger-text)' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Center: article list ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', marginRight: displayArticle ? '400px' : 0, transition: 'margin-right 0.2s' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              {selectedCategoryId ? (categories.find((c) => c.id === selectedCategoryId)?.name ?? 'Knowledge Base') : 'Knowledge Base'}
            </h1>
            <input
              type="text"
              placeholder="Search articles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '0.5px solid var(--border)', background: 'var(--bg-input)', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', minWidth: '180px' }}
            />
          </div>
          <button
            onClick={() => { setEditingArticle(null); setShowArticleModal(true) }}
            style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}
          >
            + New Article
          </button>
        </div>

        {/* Article list / empty state */}
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading…</p>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📄</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500, margin: '0 0 4px' }}>No articles yet</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: '0 0 16px' }}>
              {search ? 'No articles match your search.' : 'Get started by creating your first article.'}
            </p>
            {!search && (
              <button
                onClick={() => { setEditingArticle(null); setShowArticleModal(true) }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
              >
                Create your first article
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', padding: '12px 16px', gap: '8px' }}>
            {filteredArticles.map((article) => {
              const category = categories.find((c) => c.id === article.categoryId)
              const isSelected = selectedArticleId === article.id

              return (
                <div
                  key={article.id}
                  onClick={() => handleSelectArticle(article)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    background: 'var(--bg-card)',
                    border: '0.5px solid',
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    borderRadius: '10px', padding: '12px 14px', cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {article.title}
                      </span>
                      <StatusBadge status={article.status} />
                      {category && (
                        <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 7px', borderRadius: '4px', background: 'var(--info-bg)', color: 'var(--info-text)' }}>
                          {category.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{article.viewCount} views</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {new Date(article.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenEditArticle(article)}
                      style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '5px', border: '0.5px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteArticle(article.id)}
                      style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '5px', border: '0.5px solid var(--danger)', background: 'transparent', cursor: 'pointer', color: 'var(--danger-text)' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Right panel: article detail ── */}
      {displayArticle && (
        <ArticlePanel
          article={displayArticle}
          categories={categories}
          onClose={() => setSelectedArticleId(null)}
          onEdit={handleOpenEditArticle}
          onPublish={publishArticle}
        />
      )}

      {/* ── Category modal ── */}
      {showCategoryModal && (
        <CategoryModal
          initial={editingCategory}
          onClose={() => { setShowCategoryModal(false); setEditingCategory(null) }}
          onSave={handleSaveCategory}
        />
      )}

      {/* ── Article modal ── */}
      {showArticleModal && (
        <ArticleModal
          categories={categories}
          initial={editingArticle}
          onClose={() => { setShowArticleModal(false); setEditingArticle(null) }}
          onSave={handleSaveArticle}
        />
      )}
    </div>
  )
}
