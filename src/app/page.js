'use client'

import { useState, useEffect } from 'react'
import { supabase, getPolls, createUser, getUserByUsername, vote, getLeaderboard, getUserVotes } from '@/lib/supabase'

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
  { min: 0, max: 500, name: 'มือใหม่', badge: '🌱' },
  { min: 501, max: 1000, name: 'นักทาย', badge: '🎯' },
  { min: 1001, max: 2000, name: 'นักวิเคราะห์', badge: '🔮' },
  { min: 2001, max: 5000, name: 'ผู้เชี่ยวชาญ', badge: '⭐' },
  { min: 5001, max: 10000, name: 'ปรมาจารย์', badge: '👑' },
  { min: 10001, max: Infinity, name: 'ตำนาน', badge: '🏆' }
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

const getTopTwo = (options) => {
  if (!options || options.length === 0) return [null, null]
  const sorted = [...options].sort((a, b) => b.votes - a.votes)
  return [sorted[0], sorted[1] || sorted[0]]
}

function PollCard({ poll, onClick, userVotes }) {
  const totalVotes = poll.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0
  const [first, second] = getTopTwo(poll.options)
  const daysRemaining = getDaysRemaining(poll.ends_at)
  const isExpired = daysRemaining === 'หมดเวลาแล้ว'
  const isBlind = poll.blind_mode && !isExpired && !poll.resolved
  const hasVoted = userVotes && userVotes[poll.id]

  const firstPercent = totalVotes > 0 && first ? Math.round((first.votes / totalVotes) * 100) : 50
  const secondPercent = totalVotes > 0 && second ? Math.round((second.votes / totalVotes) * 100) : 50

  return (
    <div className="poll-card" onClick={onClick}>
      <div className="poll-card-header">
        {poll.blind_mode && <span className="blind-badge">🔒 Blind</span>}
        {poll.poll_type === 'prediction' && <span className="prediction-badge">🎯 ทายผล</span>}
        {poll.resolved && <span className="resolved-badge">✅ เฉลยแล้ว</span>}
      </div>
      <div className="poll-question">{poll.question}</div>
      {isBlind ? (
        <div className="blind-container">
          <div className="blind-message">
            <span>🔒</span>
            <p>Blind Mode - ยังไม่เปิดเผยผล</p>
          </div>
          {hasVoted && <div style={{ marginTop: '0.5rem', color: '#065f46' }}>✓ คุณโหวตแล้ว</div>}
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
        <span className={daysRemaining === 'หมดเวลาแล้ว' ? 'time-remaining expired' : 'time-remaining'}>
          ⏱️ {daysRemaining}
        </span>
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

  useEffect(() => {
    loadPolls()
    loadLeaderboard()
    const savedUser = localStorage.getItem('kidwa-user')
    if (savedUser) setUser(JSON.parse(savedUser))
  }, [])

  useEffect(() => {
    if (user) loadUserVotes()
  }, [user])

  const loadPolls = async () => {
    setIsLoading(true)
    const { data } = await getPolls()
    if (data) setPolls(data)
    setIsLoading(false)
  }

  const loadLeaderboard = async () => {
    const { data } = await getLeaderboard(10)
    if (data) setLeaderboard(data)
  }

  const loadUserVotes = async () => {
    if (!user) return
    const { data } = await getUserVotes(user.id)
    if (data) {
      const votesMap = {}
      data.forEach(v => { votesMap[v.poll_id] = { optionId: v.option_id, confidence: v.confidence } })
      setUserVotes(votesMap)
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    const username = e.target.username.value.trim()
    if (!username) return
    let { data: existingUser } = await getUserByUsername(username)
    if (existingUser) {
      setUser(existingUser)
      localStorage.setItem('kidwa-user', JSON.stringify(existingUser))
    } else {
      const { data: newUser } = await createUser(username)
      if (newUser) {
        setUser(newUser)
        localStorage.setItem('kidwa-user', JSON.stringify(newUser))
      }
    }
    setShowAuthModal(false)
  }

  const handleLogout = () => {
    setUser(null)
    setUserVotes({})
    localStorage.removeItem('kidwa-user')
    setShowMenu(false)
  }

  const handleVote = async (pollId, optionId, confidence = 50) => {
    if (!user) { setShowAuthModal(true); return }
    const { error } = await vote(user.id, pollId, optionId, confidence)
    if (!error) {
      setUserVotes(prev => ({ ...prev, [pollId]: { optionId, confidence } }))
      loadPolls()
    }
  }

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

  if (isLoading) {
    return <div className="loading-screen"><div className="loading-spinner" /><p>กำลังโหลด...</p></div>
  }

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
                <button className="btn btn-create">➕ สร้างโพล</button>
                <div className="user-badge" onClick={() => setShowMenu(!showMenu)}>
                  <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                  <div>
                    <span>{user.username}</span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {getReputationLevel(user.reputation).badge} {user.reputation}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => setShowAuthModal(true)}>เข้าสู่ระบบ</button>
                <button className="btn btn-primary" onClick={() => setShowAuthModal(true)}>สมัครสมาชิก</button>
              </>
            )}
            <button style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }} onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        {showMenu && user && (
          <div style={{ position: 'absolute', top: '70px', right: '2rem', background: 'var(--bg-card)', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)', padding: '0.5rem', zIndex: 200 }}>
            <button onClick={handleLogout} style={{ display: 'block', width: '100%', padding: '0.75rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', borderRadius: '8px', fontFamily: 'inherit' }}>
              🚪 ออกจากระบบ
            </button>
          </div>
        )}
      </header>

      <nav className="categories">
        <div className="categories-content">
          {categories.map(cat => (
            <button key={cat.id} className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="main">
        <aside className="sidebar">
          <div className="sidebar-card">
            <h3 className="sidebar-title">🏆 Leaderboard</h3>
            {leaderboard.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <span>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`} {item.username}</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{item.reputation}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="content">
          {filteredPolls.length > 0 ? (
            <>
              {featuredPolls.length > 0 && (
                <section>
                  <h2 className="section-title">🌟 หัวข้อเด่น</h2>
                  <div className="poll-grid">
                    {featuredPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}
                  </div>
                </section>
              )}
              <section>
                <h2 className="section-title">{activeCategory === 'home' ? '🆕 ล่าสุด' : `${categories.find(c => c.id === activeCategory)?.icon} ${categories.find(c => c.id === activeCategory)?.name}`}</h2>
                <div className="poll-grid">
                  {latestPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}
                </div>
              </section>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</p>
              <p>ยังไม่มีโพลในหมวดนี้</p>
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
              {selectedPoll.blind_mode && <span className="blind-badge">🔒 Blind Mode</span>}
              {selectedPoll.poll_type === 'prediction' && <span className="prediction-badge" style={{ marginLeft: '0.5rem' }}>🎯 ทายผล</span>}
            </div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>{selectedPoll.question}</h2>
            <div style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <span>👥 {selectedPoll.options?.reduce((sum, o) => sum + o.votes, 0).toLocaleString()} คนโหวต</span>
              <span style={{ marginLeft: '1rem' }}>⏱️ {getDaysRemaining(selectedPoll.ends_at)}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedPoll.options?.map(option => {
                const totalVotes = selectedPoll.options.reduce((sum, o) => sum + o.votes, 0)
                const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
                const isSelected = userVotes[selectedPoll.id]?.optionId === option.id
                const isBlind = selectedPoll.blind_mode && !selectedPoll.resolved && getDaysRemaining(selectedPoll.ends_at) !== 'หมดเวลาแล้ว'
                return (
                  <button key={option.id} onClick={() => handleVote(selectedPoll.id, option.id, 50)}
                    style={{ position: 'relative', padding: '1rem', border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '10px', background: isSelected ? 'rgba(255, 107, 157, 0.1)' : 'var(--bg)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', overflow: 'hidden' }}>
                    {!isBlind && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${percent}%`, background: 'rgba(200, 200, 200, 0.2)', zIndex: 0 }} />}
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{isSelected && '✓ '}{option.text}</span>
                      {!isBlind && <span style={{ fontWeight: 600 }}>{percent}%</span>}
                    </div>
                  </button>
                )
              })}
            </div>
            {!user && (
              <div onClick={() => { setSelectedPoll(null); setShowAuthModal(true); }}
                style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: '10px', textAlign: 'center', color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>
                🔒 เข้าสู่ระบบเพื่อโหวต
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
