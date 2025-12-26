'use client'

import { useState, useEffect } from 'react'
import { 
  supabase, getPolls, createUser, getUserByUsername, vote, getLeaderboard, getUserVotes, 
  createPoll, getTags, createTag, getAllPollsAdmin, getPendingPolls, resolvePoll, 
  deletePoll, getAllUsers, toggleBanUser, toggleFeatured, getAdminStats 
} from '@/lib/supabase'

const categories = [
  { id: 'home', name: 'หน้าแรก', icon: '🏠' },
  { id: 'sports', name: 'กีฬา', icon: '⚽' },
  { id: 'entertainment', name: 'บันเทิง', icon: '🎬' },
  { id: 'politics', name: 'การเมือง', icon: '🏛️' },
  { id: 'tech', name: 'เทคโนโลยี', icon: '💻' },
  { id: 'business', name: 'ธุรกิจ', icon: '💰' },
  { id: 'world', name: 'โลก', icon: '🌍' },
  { id: 'auto', name: 'ยานยนต์', icon: '🚗' },
  { id: 'food', name: 'อาหาร', icon: '🍜' },
  { id: 'travel', name: 'ท่องเที่ยว', icon: '✈️' },
  { id: 'health', name: 'สุขภาพ', icon: '💪' },
  { id: 'relationship', name: 'ความสัมพันธ์', icon: '❤️' },
  { id: 'education', name: 'การศึกษา', icon: '📚' },
  { id: 'pets', name: 'สัตว์เลี้ยง', icon: '🐱' },
  { id: 'housing', name: 'บ้าน', icon: '🏡' },
  { id: 'other', name: 'อื่นๆ', icon: '🎭' }
]

const reputationLevels = [
  { min: 0, max: 500, name: 'นักศึกษา', badge: '🌱' },
  { min: 501, max: 1500, name: 'ผู้เริ่มต้น', badge: '🎯' },
  { min: 1501, max: 3000, name: 'นักวิเคราะห์', badge: '🔮' },
  { min: 3001, max: 5000, name: 'ผู้เชี่ยวชาญ', badge: '⭐' },
  { min: 5001, max: 10000, name: 'ปรมาจารย์', badge: '👑' },
  { min: 10001, max: Infinity, name: 'ตำนาน', badge: '🏆' }
]

const confidenceLevels = [
  { value: 20, label: 'ไม่มั่นใจ', emoji: '😅', color: '#22c55e', description: '±20 คะแนน' },
  { value: 50, label: 'ปกติ', emoji: '🤔', color: '#f59e0b', description: '±50 คะแนน' },
  { value: 100, label: 'มั่นใจมาก', emoji: '💪', color: '#ef4444', description: '±100 คะแนน' }
]

const getReputationLevel = (rep) => {
  return reputationLevels.find(l => rep >= l.min && rep <= l.max) || reputationLevels[0]
}

const getDaysRemaining = (endDate) => {
  const end = new Date(endDate)
  const now = new Date()
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'หมดเวลาแล้ว'
  if (diff === 0) return 'วันสุดท้าย!'
  return `เหลืออีก ${diff} วัน`
}

const isExpired = (endDate) => {
  const end = new Date(endDate)
  const now = new Date()
  return now > end
}

const getTopTwo = (options) => {
  if (!options || options.length === 0) return [null, null]
  const sorted = [...options].sort((a, b) => b.votes - a.votes)
  return [sorted[0], sorted[1] || sorted[0]]
}

function PollCard({ poll, onClick, userVotes }) {
  const totalVotes = poll.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0
  const [first, second] = getTopTwo(poll.options)
  const daysRemaining = getDaysRemaining(poll.ends_at)
  const expired = isExpired(poll.ends_at)
  const isBlind = poll.blind_mode && !expired && !poll.resolved
  const hasVoted = userVotes && userVotes[poll.id]

  const firstPercent = totalVotes > 0 && first ? Math.round((first.votes / totalVotes) * 100) : 50
  const secondPercent = totalVotes > 0 && second ? Math.round((second.votes / totalVotes) * 100) : 50

  return (
    <div className="poll-card" onClick={onClick}>
      <div className="poll-card-header">
        {poll.blind_mode && !expired && <span className="blind-badge">🔒 Blind</span>}
        {poll.poll_type === 'prediction' && <span className="prediction-badge">🎯 ทายผล</span>}
        {poll.resolved && <span className="resolved-badge">✅ เฉลยแล้ว</span>}
        {expired && !poll.resolved && <span className="resolved-badge">⏰ รอเฉลย</span>}
      </div>
      <div className="poll-question">{poll.question}</div>
      {isBlind ? (
        <div className="blind-container">
          <div className="blind-message">
            <span>🔒</span>
            <p>Blind Mode - ยังไม่เปิดเผยผล</p>
          </div>
          {hasVoted && (
            <div style={{ marginTop: '0.5rem', color: '#065f46' }}>
              ✓ คุณโหวตแล้ว ({confidenceLevels.find(c => c.value === hasVoted.confidence)?.emoji || '🤔'})
            </div>
          )}
        </div>
      ) : first && second ? (
        <div className="dual-bar-container">
          <div className="dual-bar-labels">
            <span className="label-left">{first.text}</span>
            <span className="label-right">{second.text}</span>
          </div>
          <div className="dual-bar">
            <div className="dual-bar-left" style={{ width: `${firstPercent}%` }}>
              <span className="bar-percent">{firstPercent}%</span>
            </div>
            <div className="dual-bar-right" style={{ width: `${secondPercent}%` }}>
              <span className="bar-percent">{secondPercent}%</span>
            </div>
          </div>
        </div>
      ) : null}
      {poll.options?.length > 2 && (
        <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--primary)' }}>
          +{poll.options.length - 2} ตัวเลือกอื่น
        </div>
      )}
      <div className="poll-footer">
        <span>👥 {totalVotes.toLocaleString()} คน</span>
        <span className={expired ? 'time-remaining expired' : 'time-remaining'}>
          ⏱️ {daysRemaining}
        </span>
      </div>
    </div>
  )
}

function ConfidenceSelector({ selectedConfidence, onSelect, disabled }) {
  return (
    <div className="confidence-selector">
      <label className="confidence-label">🎲 เลือกระดับความมั่นใจ:</label>
      <div className="confidence-options">
        {confidenceLevels.map((level) => (
          <button
            key={level.value}
            type="button"
            disabled={disabled}
            className={`confidence-btn ${selectedConfidence === level.value ? 'active' : ''}`}
            style={{
              '--confidence-color': level.color,
              borderColor: selectedConfidence === level.value ? level.color : 'var(--border)'
            }}
            onClick={() => onSelect(level.value)}
          >
            <span className="confidence-emoji">{level.emoji}</span>
            <span className="confidence-text">{level.label}</span>
            <span className="confidence-desc">{level.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function CreatePollModal({ onClose, user, onSuccess, darkMode }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [category, setCategory] = useState('other')
  const [blindMode, setBlindMode] = useState(false)
  const [endsAt, setEndsAt] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [availableTags, setAvailableTags] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    loadTags()
    const defaultDate = new Date()
    defaultDate.setDate(defaultDate.getDate() + 7)
    setEndsAt(defaultDate.toISOString().split('T')[0])
  }, [])

  const loadTags = async () => {
    const { data } = await getTags()
    if (data) setAvailableTags(data)
  }

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ''])
  }

  const removeOption = (index) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index))
  }

  const updateOption = (index, value) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  const addTag = async () => {
    if (!tagInput.trim()) return
    if (selectedTags.length >= 5) { alert('เลือกแท็กได้สูงสุด 5 แท็ก'); return }
    let tag = availableTags.find(t => t.name.toLowerCase() === tagInput.toLowerCase().trim())
    if (!tag) {
      const { data } = await createTag(tagInput.trim())
      if (data) { tag = data; setAvailableTags([...availableTags, data]) }
    }
    if (tag && !selectedTags.find(t => t.id === tag.id)) setSelectedTags([...selectedTags, tag])
    setTagInput('')
  }

  const removeTag = (tagId) => setSelectedTags(selectedTags.filter(t => t.id !== tagId))

  const selectExistingTag = (tag) => {
    if (selectedTags.length >= 5) { alert('เลือกแท็กได้สูงสุด 5 แท็ก'); return }
    if (!selectedTags.find(t => t.id === tag.id)) setSelectedTags([...selectedTags, tag])
  }

  const validate = () => {
    const newErrors = {}
    if (!question.trim()) newErrors.question = 'กรุณาใส่คำถาม'
    if (options.filter(o => o.trim()).length < 2) newErrors.options = 'ต้องมีตัวเลือกอย่างน้อย 2 ตัว'
    if (!endsAt) newErrors.endsAt = 'กรุณาเลือกวันหมดเวลา'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    const { error } = await createPoll({
      question: question.trim(),
      options: options.filter(o => o.trim()),
      category,
      tags: selectedTags.map(t => t.id),
      blindMode,
      endsAt: new Date(endsAt).toISOString(),
      pollType: 'prediction',
      createdBy: user.id
    })
    setIsSubmitting(false)
    if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
    else { alert('🎉 สร้างโพลสำเร็จ!'); onSuccess(); onClose() }
  }

  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.find(t => t.id === tag.id)
  ).slice(0, 5)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal create-poll-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">➕ สร้างโพลใหม่</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>❓ คำถาม</label>
            <input type="text" className={`form-input ${errors.question ? 'error' : ''}`} placeholder="เช่น ทีมไหนจะชนะฟุตบอลโลก 2026?" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
            {errors.question && <span className="error-text">{errors.question}</span>}
            <span className="char-count">{question.length}/200</span>
          </div>
          <div className="form-group">
            <label>📋 ตัวเลือก (2-6 ตัว)</label>
            {options.map((opt, index) => (
              <div key={index} className="option-input-row">
                <input type="text" className="form-input" placeholder={`ตัวเลือกที่ ${index + 1}`} value={opt} onChange={(e) => updateOption(index, e.target.value)} maxLength={100} />
                {options.length > 2 && <button type="button" className="remove-option-btn" onClick={() => removeOption(index)}>✕</button>}
              </div>
            ))}
            {errors.options && <span className="error-text">{errors.options}</span>}
            {options.length < 6 && <button type="button" className="add-option-btn" onClick={addOption}>+ เพิ่มตัวเลือก</button>}
          </div>
          <div className="form-group">
            <label>📂 หมวดหมู่</label>
            <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.filter(c => c.id !== 'home').map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>🏷️ แท็ก (สูงสุด 5)</label>
            <div className="tags-selected">
              {selectedTags.map(tag => <span key={tag.id} className="tag-chip">#{tag.name}<button type="button" onClick={() => removeTag(tag.id)}>✕</button></span>)}
            </div>
            <div className="tag-input-wrapper">
              <input type="text" className="form-input" placeholder="พิมพ์แท็กแล้วกด Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() }}} />
              {tagInput && <button type="button" className="add-tag-btn" onClick={addTag}>เพิ่ม</button>}
            </div>
            {filteredTags.length > 0 && tagInput && (
              <div className="tag-suggestions">
                {filteredTags.map(tag => <button key={tag.id} type="button" className="tag-suggestion" onClick={() => selectExistingTag(tag)}>#{tag.name}</button>)}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>📅 วันหมดเวลา</label>
            <input type="date" className={`form-input ${errors.endsAt ? 'error' : ''}`} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            {errors.endsAt && <span className="error-text">{errors.endsAt}</span>}
          </div>
          <div className="form-group">
            <label className="toggle-label">
              <input type="checkbox" checked={blindMode} onChange={(e) => setBlindMode(e.target.checked)} />
              <span className="toggle-switch"></span>
              <span>🔒 Blind Mode</span>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? '⏳ กำลังสร้าง...' : '🚀 สร้างโพล'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== Admin Panel =====
function AdminPanel({ onClose, darkMode, onRefresh }) {
  const [activeTab, setActiveTab] = useState('pending')
  const [polls, setPolls] = useState([])
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPollForResolve, setSelectedPollForResolve] = useState(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setIsLoading(true)
    if (activeTab === 'pending') {
      const { data } = await getPendingPolls()
      setPolls(data || [])
    } else if (activeTab === 'all') {
      const { data } = await getAllPollsAdmin()
      setPolls(data || [])
    } else if (activeTab === 'users') {
      const { data } = await getAllUsers()
      setUsers(data || [])
    }
    const statsData = await getAdminStats()
    setStats(statsData)
    setIsLoading(false)
  }

  const handleResolvePoll = async (pollId, correctOptionId) => {
    if (!confirm('ยืนยันการเฉลยโพลนี้? คะแนนจะถูกคำนวณให้ผู้โหวตทันที')) return
    const { error } = await resolvePoll(pollId, correctOptionId)
    if (error) alert('เกิดข้อผิดพลาด')
    else { alert('✅ เฉลยโพลสำเร็จ!'); loadData(); onRefresh(); setSelectedPollForResolve(null) }
  }

  const handleDeletePoll = async (pollId) => {
    if (!confirm('ยืนยันการลบโพลนี้? ข้อมูลทั้งหมดจะถูกลบ')) return
    const { error } = await deletePoll(pollId)
    if (error) alert('เกิดข้อผิดพลาด')
    else { alert('🗑️ ลบโพลสำเร็จ!'); loadData(); onRefresh() }
  }

  const handleToggleFeatured = async (pollId, featured) => {
    await toggleFeatured(pollId, featured)
    loadData()
    onRefresh()
  }

  const handleToggleBan = async (userId, isBanned) => {
    await toggleBanUser(userId, isBanned)
    loadData()
  }

  const expiredPolls = polls.filter(p => !p.resolved && isExpired(p.ends_at))
  const upcomingPolls = polls.filter(p => !p.resolved && !isExpired(p.ends_at))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal admin-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">🔧 Admin Panel</h2>

        {/* Stats */}
        <div className="admin-stats">
          <div className="stat-card">
            <span className="stat-number">{stats.totalPolls || 0}</span>
            <span className="stat-label">โพลทั้งหมด</span>
          </div>
          <div className="stat-card warning">
            <span className="stat-number">{stats.expiredUnresolved || 0}</span>
            <span className="stat-label">รอเฉลย</span>
          </div>
          <div className="stat-card success">
            <span className="stat-number">{stats.resolvedPolls || 0}</span>
            <span className="stat-label">เฉลยแล้ว</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.totalUsers || 0}</span>
            <span className="stat-label">Users</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            📋 รอเฉลย {stats.expiredUnresolved > 0 && <span className="badge">{stats.expiredUnresolved}</span>}
          </button>
          <button className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>📊 โพลทั้งหมด</button>
          <button className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Users</button>
        </div>

        {/* Content */}
        <div className="admin-content">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>⏳ กำลังโหลด...</div>
          ) : activeTab === 'pending' ? (
            <>
              {expiredPolls.length > 0 && (
                <div className="admin-section">
                  <h3 className="admin-section-title">🔴 หมดเวลาแล้ว - รอเฉลย</h3>
                  {expiredPolls.map(poll => (
                    <div key={poll.id} className="admin-poll-item">
                      <div className="admin-poll-info">
                        <span className="admin-poll-question">{poll.question}</span>
                        <span className="admin-poll-meta">👥 {poll.options?.reduce((s, o) => s + o.votes, 0)} โหวต</span>
                      </div>
                      <div className="admin-poll-actions">
                        <button className="btn btn-sm btn-success" onClick={() => setSelectedPollForResolve(poll)}>✅ เฉลย</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeletePoll(poll.id)}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {upcomingPolls.length > 0 && (
                <div className="admin-section">
                  <h3 className="admin-section-title">🟢 ยังไม่หมดเวลา</h3>
                  {upcomingPolls.slice(0, 5).map(poll => (
                    <div key={poll.id} className="admin-poll-item">
                      <div className="admin-poll-info">
                        <span className="admin-poll-question">{poll.question}</span>
                        <span className="admin-poll-meta">⏱️ {getDaysRemaining(poll.ends_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {expiredPolls.length === 0 && upcomingPolls.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>ไม่มีโพลรอเฉลย</div>
              )}
            </>
          ) : activeTab === 'all' ? (
            <div className="admin-section">
              {polls.map(poll => (
                <div key={poll.id} className="admin-poll-item">
                  <div className="admin-poll-info">
                    <span className="admin-poll-question">
                      {poll.featured && '⭐ '}
                      {poll.resolved && '✅ '}
                      {poll.question}
                    </span>
                    <span className="admin-poll-meta">
                      {categories.find(c => c.id === poll.category)?.icon} {poll.category} • 
                      👥 {poll.options?.reduce((s, o) => s + o.votes, 0)} โหวต
                    </span>
                  </div>
                  <div className="admin-poll-actions">
                    <button className={`btn btn-sm ${poll.featured ? 'btn-warning' : 'btn-secondary'}`} onClick={() => handleToggleFeatured(poll.id, !poll.featured)}>
                      {poll.featured ? '⭐' : '☆'}
                    </button>
                    {!poll.resolved && isExpired(poll.ends_at) && (
                      <button className="btn btn-sm btn-success" onClick={() => setSelectedPollForResolve(poll)}>✅</button>
                    )}
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeletePoll(poll.id)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          ) : activeTab === 'users' ? (
            <div className="admin-section">
              {users.map((u, i) => (
                <div key={u.id} className="admin-user-item">
                  <div className="admin-user-info">
                    <span className="admin-user-rank">{i + 1}</span>
                    <span className="admin-user-name">{u.is_banned && '🚫 '}{u.is_admin && '👑 '}{u.username}</span>
                    <span className="admin-user-rep">{getReputationLevel(u.reputation).badge} {u.reputation}</span>
                  </div>
                  <div className="admin-user-actions">
                    {!u.is_admin && (
                      <button className={`btn btn-sm ${u.is_banned ? 'btn-success' : 'btn-danger'}`} onClick={() => handleToggleBan(u.id, !u.is_banned)}>
                        {u.is_banned ? '✅ ปลดแบน' : '🚫 แบน'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Resolve Poll Modal */}
        {selectedPollForResolve && (
          <div className="resolve-modal-overlay" onClick={() => setSelectedPollForResolve(null)}>
            <div className="resolve-modal" onClick={e => e.stopPropagation()}>
              <h3>✅ เฉลยโพล</h3>
              <p className="resolve-question">{selectedPollForResolve.question}</p>
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>เลือกคำตอบที่ถูกต้อง:</p>
              <div className="resolve-options">
                {selectedPollForResolve.options?.map(opt => (
                  <button key={opt.id} className="resolve-option" onClick={() => handleResolvePoll(selectedPollForResolve.id, opt.id)}>
                    {opt.text}
                    <span className="resolve-votes">({opt.votes} โหวต)</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setSelectedPollForResolve(null)}>ยกเลิก</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  const [darkMode, setDarkMode] = useState(false)
  const [activeCategory, setActiveCategory] = useState('home')
  const [polls, setPolls] = useState([])
  const [userVotes, setUserVotes] = useState({})
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPoll, setSelectedPoll] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState([])
  const [selectedConfidence, setSelectedConfidence] = useState(50)
  const [selectedOption, setSelectedOption] = useState(null)
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)

  useEffect(() => {
    loadPolls()
    loadLeaderboard()
    const savedUser = localStorage.getItem('kidwa-user')
    if (savedUser) setUser(JSON.parse(savedUser))
    const savedDarkMode = localStorage.getItem('kidwa-darkmode')
    if (savedDarkMode) setDarkMode(JSON.parse(savedDarkMode))
  }, [])

  useEffect(() => { if (user) loadUserVotes() }, [user])
  useEffect(() => { localStorage.setItem('kidwa-darkmode', JSON.stringify(darkMode)) }, [darkMode])
  useEffect(() => {
    if (selectedPoll) {
      const existingVote = userVotes[selectedPoll.id]
      if (existingVote) { setSelectedOption(existingVote.optionId); setSelectedConfidence(existingVote.confidence || 50) }
      else { setSelectedOption(null); setSelectedConfidence(50) }
    }
  }, [selectedPoll, userVotes])

  const loadPolls = async () => { setIsLoading(true); const { data } = await getPolls(); if (data) setPolls(data); setIsLoading(false) }
  const loadLeaderboard = async () => { const { data } = await getLeaderboard(10); if (data) setLeaderboard(data) }
  const loadUserVotes = async () => {
    if (!user) return
    const { data } = await getUserVotes(user.id)
    if (data) { const votesMap = {}; data.forEach(v => { votesMap[v.poll_id] = { optionId: v.option_id, confidence: v.confidence } }); setUserVotes(votesMap) }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    const username = e.target.username.value.trim()
    if (!username) return
    let { data: existingUser } = await getUserByUsername(username)
    if (existingUser) { setUser(existingUser); localStorage.setItem('kidwa-user', JSON.stringify(existingUser)) }
    else { const { data: newUser } = await createUser(username); if (newUser) { setUser(newUser); localStorage.setItem('kidwa-user', JSON.stringify(newUser)) }}
    setShowAuthModal(false)
  }

  const handleLogout = () => { setUser(null); setUserVotes({}); localStorage.removeItem('kidwa-user'); setShowMenu(false) }

  const handleVote = async (pollId, optionId, confidence) => {
    if (!user) { setShowAuthModal(true); return }
    const poll = polls.find(p => p.id === pollId)
    if (poll && isExpired(poll.ends_at)) { alert('โพลนี้หมดเวลาแล้ว'); return }
    const { error } = await vote(user.id, pollId, optionId, confidence)
    if (!error) {
      setUserVotes(prev => ({ ...prev, [pollId]: { optionId, confidence } }))
      loadPolls()
      const confLevel = confidenceLevels.find(c => c.value === confidence)
      alert(`✅ โหวตสำเร็จ!\n\nความมั่นใจ: ${confLevel?.emoji} ${confLevel?.label}\nคะแนนเดิมพัน: ±${confidence}`)
    }
  }

  const confirmVote = () => { if (!selectedOption) { alert('กรุณาเลือกตัวเลือกก่อน'); return }; handleVote(selectedPoll.id, selectedOption, selectedConfidence) }
  const openCreatePoll = () => { if (!user) { setShowAuthModal(true); return }; setShowCreatePoll(true); setShowMenu(false) }
  const openAdminPanel = () => { setShowAdminPanel(true); setShowMenu(false) }

  const filteredPolls = polls.filter(poll => {
    if (activeCategory !== 'home' && poll.category !== activeCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return poll.question.toLowerCase().includes(q) || poll.tags?.some(t => t.name.toLowerCase().includes(q))
    }
    return true
  })

  const featuredPolls = filteredPolls.filter(p => p.featured).slice(0, 3)
  const latestPolls = [...filteredPolls].slice(0, 9)

  if (isLoading) return <div className={`loading-screen ${darkMode ? 'dark' : ''}`}><div className="loading-spinner" /><p>กำลังโหลด...</p></div>

  return (
    <div className={darkMode ? 'dark' : ''}>
      <header className="header">
        <div className="header-content">
          <div className="logo" onClick={() => setActiveCategory('home')}>คิดว่า..</div>
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="ค้นหาหัวข้อ..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="header-actions">
            {user ? (
              <>
                <button className="btn btn-create hide-mobile" onClick={openCreatePoll}>➕ สร้างโพล</button>
                <div className="user-badge hide-mobile" onClick={() => setShowMenu(!showMenu)}>
                  <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                  <div>
                    <span style={{ color: 'var(--text)' }}>{user.username}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{getReputationLevel(user.reputation).badge} {user.reputation}</div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <button className="btn btn-secondary hide-mobile" onClick={() => setShowAuthModal(true)}>เข้าสู่ระบบ</button>
                <button className="btn btn-primary hide-mobile" onClick={() => setShowAuthModal(true)}>สมัครสมาชิก</button>
              </>
            )}
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>☰</button>
          </div>
        </div>

        {showMenu && (
          <div className="dropdown-menu">
            {!user && (
              <>
                <button className="dropdown-item" onClick={() => { setShowAuthModal(true); setShowMenu(false) }}>🔐 เข้าสู่ระบบ</button>
                <button className="dropdown-item" onClick={() => { setShowAuthModal(true); setShowMenu(false) }}>✨ สมัครสมาชิก</button>
                <div className="dropdown-divider"></div>
              </>
            )}
            {user && (
              <>
                <div className="dropdown-item user-info-mobile">
                  <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                  <div>
                    <span style={{ color: 'var(--text)' }}>{user.username}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{getReputationLevel(user.reputation).badge} {user.reputation}</div>
                  </div>
                </div>
                <button className="dropdown-item" onClick={openCreatePoll}>➕ สร้างโพล</button>
                {user.is_admin && (
                  <button className="dropdown-item" onClick={openAdminPanel}>🔧 Admin Panel</button>
                )}
                <div className="dropdown-divider"></div>
              </>
            )}
            <button className="dropdown-item" onClick={() => { setDarkMode(!darkMode); setShowMenu(false) }}>{darkMode ? '☀️ โหมดสว่าง' : '🌙 โหมดมืด'}</button>
            {user && (
              <>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={handleLogout}>🚪 ออกจากระบบ</button>
              </>
            )}
          </div>
        )}
      </header>

      <nav className="categories">
        <div className="categories-content">
          {categories.map(cat => (
            <button key={cat.id} className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>{cat.icon} {cat.name}</button>
          ))}
        </div>
      </nav>

      <main className="main">
        <aside className="sidebar">
          <div className="sidebar-card">
            <h3 className="sidebar-title">🏆 Leaderboard</h3>
            {leaderboard.map((item, i) => {
              const rankEmoji = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][i] || `#${i + 1}`
              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text)' }}>{rankEmoji} {item.username}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{item.reputation}</span>
                </div>
              )
            })}
          </div>
        </aside>

        <div className="content">
          {filteredPolls.length > 0 ? (
            <>
              {featuredPolls.length > 0 && (
                <section>
                  <h2 className="section-title">🌟 หัวข้อเด่น</h2>
                  <div className="poll-grid">{featuredPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}</div>
                </section>
              )}
              <section>
                <h2 className="section-title">{activeCategory === 'home' ? '🆕 ล่าสุด' : `${categories.find(c => c.id === activeCategory)?.icon} ${categories.find(c => c.id === activeCategory)?.name}`}</h2>
                <div className="poll-grid">{latestPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}</div>
              </section>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</p>
              <p>ยังไม่มีโพลในหมวดนี้</p>
              {user && <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={openCreatePoll}>➕ สร้างโพลแรก</button>}
            </div>
          )}
        </div>
      </main>

      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAuthModal(false)}>✕</button>
            <h2 className="modal-title">🎯 เข้าสู่ระบบ / สมัครสมาชิก</h2>
            <form onSubmit={handleAuth}>
              <div className="form-group">
                <label>ชื่อผู้ใช้</label>
                <input type="text" name="username" className="form-input" placeholder="กรอกชื่อผู้ใช้" required />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>🎁 สมัครใหม่ได้ 1,000 Reputation เริ่มต้น!</p>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAuthModal(false)}>ยกเลิก</button>
                <button type="submit" className="btn btn-primary">เข้าสู่ระบบ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPoll && (
        <div className="modal-overlay" onClick={() => setSelectedPoll(null)}>
          <div className="modal" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPoll(null)}>✕</button>
            <div style={{ marginBottom: '1rem' }}>
              {selectedPoll.blind_mode && !isExpired(selectedPoll.ends_at) && <span className="blind-badge">🔒 Blind Mode</span>}
              {selectedPoll.poll_type === 'prediction' && <span className="prediction-badge" style={{ marginLeft: '0.5rem' }}>🎯 ทายผล</span>}
              {selectedPoll.resolved && <span className="resolved-badge" style={{ marginLeft: '0.5rem' }}>✅ เฉลยแล้ว</span>}
              {isExpired(selectedPoll.ends_at) && !selectedPoll.resolved && <span className="resolved-badge" style={{ marginLeft: '0.5rem' }}>⏰ รอเฉลย</span>}
            </div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text)' }}>{selectedPoll.question}</h2>
            <div style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <span>👥 {selectedPoll.options?.reduce((sum, o) => sum + o.votes, 0).toLocaleString()} คนโหวต</span>
              <span style={{ marginLeft: '1rem' }}>⏱️ {getDaysRemaining(selectedPoll.ends_at)}</span>
            </div>
            
            {isExpired(selectedPoll.ends_at) && !selectedPoll.resolved && <div className="expired-notice">⏰ โพลนี้หมดเวลาแล้ว รอ Admin เฉลย</div>}
            {userVotes[selectedPoll.id] && (
              <div className="voted-notice">
                ✅ คุณโหวตแล้ว ({confidenceLevels.find(c => c.value === userVotes[selectedPoll.id].confidence)?.emoji} {confidenceLevels.find(c => c.value === userVotes[selectedPoll.id].confidence)?.label})
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {selectedPoll.options?.map(option => {
                const totalVotes = selectedPoll.options.reduce((sum, o) => sum + o.votes, 0)
                const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
                const isVoted = userVotes[selectedPoll.id]?.optionId === option.id
                const isSelected = selectedOption === option.id
                const expired = isExpired(selectedPoll.ends_at)
                const isBlind = selectedPoll.blind_mode && !selectedPoll.resolved && !expired
                const hasVoted = !!userVotes[selectedPoll.id]
                const isCorrect = selectedPoll.correct_option_id === option.id
                
                return (
                  <button 
                    key={option.id} 
                    onClick={() => !expired && !hasVoted && setSelectedOption(option.id)}
                    disabled={expired || hasVoted}
                    className={`option-btn ${isVoted ? 'voted' : ''} ${isSelected ? 'selected' : ''} ${expired || hasVoted ? 'disabled' : ''} ${isCorrect ? 'correct' : ''}`}
                  >
                    {!isBlind && <div className="option-bar" style={{ width: `${percent}%` }} />}
                    <div className="option-content">
                      <span>{isCorrect && '✅ '}{isVoted && '✓ '}{option.text}</span>
                      {!isBlind && <span style={{ fontWeight: 600 }}>{percent}%</span>}
                    </div>
                  </button>
                )
              })}
            </div>

            {!userVotes[selectedPoll.id] && !isExpired(selectedPoll.ends_at) && user && (
              <>
                <ConfidenceSelector selectedConfidence={selectedConfidence} onSelect={setSelectedConfidence} disabled={!selectedOption} />
                <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }} onClick={confirmVote} disabled={!selectedOption}>
                  {selectedOption ? <>🎯 ยืนยันโหวต ({confidenceLevels.find(c => c.value === selectedConfidence)?.emoji} ±{selectedConfidence} คะแนน)</> : <>👆 เลือกตัวเลือกก่อน</>}
                </button>
              </>
            )}

            {!user && !isExpired(selectedPoll.ends_at) && (
              <div onClick={() => { setSelectedPoll(null); setShowAuthModal(true) }} className="login-prompt">🔒 เข้าสู่ระบบเพื่อโหวต</div>
            )}
          </div>
        </div>
      )}

      {showCreatePoll && <CreatePollModal onClose={() => setShowCreatePoll(false)} user={user} onSuccess={loadPolls} darkMode={darkMode} />}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} darkMode={darkMode} onRefresh={() => { loadPolls(); loadLeaderboard() }} />}
    </div>
  )
}
