'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { 
  supabase, getPolls, createUser, getUserByUsername, vote, getLeaderboard, getUserVotes, 
  createPoll, getTags, createTag, getAllPollsAdmin, getPendingPolls, resolvePoll, 
  deletePoll, getAllUsers, toggleBanUser, toggleFeatured, getAdminStats,
  getUserProfile, getUserVoteHistory, getUserCreatedPolls, calculateBadges,
  getWeeklyLeaderboard, getMonthlyLeaderboard,
  getUserNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead,
  followUser, unfollowUser, isFollowing, getFollowers, getFollowing, getFollowCounts,
  uploadAvatar, getUserPublicProfile, searchUsers,
  createTimeCapsule, getTimeCapsules,
  createLiveBattleV2, getLiveBattles, endLiveBattle,
  signUpWithEmail, signInWithEmail, signInWithMagicLink, signOut, getSession, getUserFromSession, 
  resetPassword, updatePassword, onAuthStateChange, signInWithGoogle,
  submitVerification, skipVerification, checkNeedsVerification, getUserPollLimit, findSimilarPolls, checkAndAwardCreatorPoints,
  getTrendingTags, getPollsByTag
} from '@/lib/supabase'

// ===== Categories =====
const categories = [
  { id: 'home', name: 'หน้าแรก', icon: '🏠' },
  { id: 'live', name: 'ถ่ายทอดสด', icon: '⚡' },
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
  { id: 'other', name: 'อื่นๆ', icon: '🎭' },
  { id: 'timecapsule', name: 'Time Capsule', icon: '💊' }
]

// Categories to show before "More" button (first 8)
const VISIBLE_CATEGORIES = 8

// ===== Reputation Levels =====
const reputationLevels = [
  { min: 0, max: 500, name: 'นักศึกษา', badge: '🌱' },
  { min: 501, max: 1500, name: 'ผู้เริ่มต้น', badge: '🎯' },
  { min: 1501, max: 3000, name: 'นักวิเคราะห์', badge: '🔮' },
  { min: 3001, max: 5000, name: 'ผู้เชี่ยวชาญ', badge: '⭐' },
  { min: 5001, max: 10000, name: 'ปรมาจารย์', badge: '🏆' },
  { min: 10001, max: Infinity, name: 'ตำนาน', badge: '👑' }
]

// ===== Confidence/Conviction Levels =====
const confidenceLevels = [
  { value: 20, label: 'ไม่ค่อยมั่นใจ', emoji: '🥶', color: '#22c55e', description: 'ผลกระทบต่ำ', conviction: 'low' },
  { value: 50, label: 'โหวตเลย', emoji: '🥺', color: '#f59e0b', description: 'ผลกระทบปานกลาง', conviction: 'medium' },
  { value: 100, label: 'มั่นใจมาก', emoji: '😎', color: '#ef4444', description: 'ผลกระทบสูง', conviction: 'high' }
]

// ===== Helper Functions =====
const getReputationLevel = (rep) => reputationLevels.find(l => rep >= l.min && rep <= l.max) || reputationLevels[0]

// Convert UTC to Bangkok time
const toBangkokTime = (date) => {
  const d = new Date(date)
  return new Date(d.getTime() + (7 * 60 * 60 * 1000))
}

// Get current Bangkok time
const getBangkokNow = () => {
  return new Date(Date.now() + (7 * 60 * 60 * 1000))
}

const getDaysRemaining = (endDate) => {
  const end = new Date(endDate)
  const now = new Date()
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'หมดเวลาแล้ว'
  if (diff === 0) return 'วันสุดท้าย!'
  return `เหลืออีก ${diff} วัน`
}

const isExpired = (endDate) => new Date() > new Date(endDate)

const getTopTwo = (options) => {
  if (!options || options.length === 0) return [null, null]
  const sorted = [...options].sort((a, b) => b.votes - a.votes)
  return [sorted[0], sorted[1] || sorted[0]]
}

const getTimeAgo = (date) => {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now - past
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'เมื่อสักครู่'
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`
  return past.toLocaleDateString('th-TH')
}

// สำหรับ Time Capsule
const getYearsRemaining = (endDate) => {
  const end = new Date(endDate)
  const now = new Date()
  const diffMs = end - now
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)
  
  if (diffDays < 0) return 'เปิดแล้ว!'
  if (diffYears >= 1) return `เปิดใน ${diffYears} ปี ${diffMonths % 12} เดือน`
  if (diffMonths >= 1) return `เปิดใน ${diffMonths} เดือน`
  return `เปิดใน ${diffDays} วัน`
}

// สำหรับ Live Battle - real-time countdown
const getLiveTimeRemaining = (endDate) => {
  const end = new Date(endDate)
  const now = new Date()
  const diffMs = end - now
  
  if (diffMs < 0) return { text: 'จบแล้ว', expired: true }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000)
  
  if (hours > 0) return { text: `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`, expired: false }
  return { text: `${mins}:${secs.toString().padStart(2, '0')}`, expired: false }
}

// ===== Poll Card Component =====
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
        {poll.poll_type === 'prediction' && <span className="prediction-badge">🎯 คิดว่าในอนาคต..</span>}
        {poll.resolved && <span className="resolved-badge">✅ เฉลยแล้ว</span>}
        {expired && !poll.resolved && <span className="resolved-badge">⏰ รอเฉลย</span>}
      </div>
      <div className="poll-question">{poll.question}</div>
      {isBlind ? (
        <div className="blind-container">
          <div className="blind-message"><span>🔒</span><p>Blind Mode - ยังไม่เปิดเผยผล</p></div>
          {hasVoted && <div style={{ marginTop: '0.5rem', color: '#065f46' }}>✓ คุณโหวตแล้ว ({confidenceLevels.find(c => c.value === hasVoted.confidence)?.emoji || '🤩'})</div>}
        </div>
      ) : first && second ? (
        <div className="dual-bar-container">
          <div className="dual-bar-labels"><span className="label-left">{first.text}</span><span className="label-right">{second.text}</span></div>
          <div className="dual-bar">
            <div className="dual-bar-left" style={{ width: `${firstPercent}%` }}><span className="bar-percent">{firstPercent}%</span></div>
            <div className="dual-bar-right" style={{ width: `${secondPercent}%` }}><span className="bar-percent">{secondPercent}%</span></div>
          </div>
        </div>
      ) : null}
      {poll.options?.length > 2 && <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--primary)' }}>+{poll.options.length - 2} ตัวเลือกอื่น</div>}
      <div className="poll-footer">
        <span>👥 {totalVotes.toLocaleString()} คน</span>
        <span className={expired ? 'time-remaining expired' : 'time-remaining'}>⏱️ {daysRemaining}</span>
      </div>
    </div>
  )
}

// ===== Live Battle Card =====
function LiveBattleCard({ poll, onClick, userVotes }) {
  const [timeLeft, setTimeLeft] = useState(getLiveTimeRemaining(poll.ends_at))
  const [liveVotes, setLiveVotes] = useState(poll.options || [])
  const totalVotes = liveVotes?.reduce((sum, opt) => sum + opt.votes, 0) || 0
  const [first, second] = getTopTwo(liveVotes)
  const hasVoted = userVotes && userVotes[poll.id]
  const firstPercent = totalVotes > 0 && first ? Math.round((first.votes / totalVotes) * 100) : 50
  const secondPercent = totalVotes > 0 && second ? Math.round((second.votes / totalVotes) * 100) : 50

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getLiveTimeRemaining(poll.ends_at))
    }, 1000)
    return () => clearInterval(timer)
  }, [poll.ends_at])
  
  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`live-battle-${poll.id}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'options', filter: `poll_id=eq.${poll.id}` }, 
        (payload) => {
          setLiveVotes(prev =>
            prev.map(opt =>
              opt.id === payload.new.id
                ? { ...opt, votes: payload.new.votes }
                : opt
            )
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [poll.id])

  return (
    <div className={`poll-card live-battle-card ${timeLeft.expired ? 'expired' : ''}`} onClick={onClick}>
      <div className="poll-card-header">
        <span className="live-badge">⚡ LIVE</span>
        <span className={`live-timer ${timeLeft.expired ? 'expired' : ''}`}>
          {timeLeft.expired ? '🏁 จบแล้ว' : `⏱️ ${timeLeft.text}`}
        </span>
      </div>
      <div className="poll-question">{poll.question}</div>
      {first && second && (
        <div className="dual-bar-container">
          <div className="dual-bar-labels">
            <span className="label-left">{first.text}</span>
            <span className="label-right">{second.text}</span>
          </div>
          <div className="dual-bar live-bar">
            <div className="dual-bar-left" style={{ width: `${firstPercent}%` }}>
              <span className="bar-percent">{firstPercent}%</span>
            </div>
            <div className="dual-bar-right" style={{ width: `${secondPercent}%` }}>
              <span className="bar-percent">{secondPercent}%</span>
            </div>
          </div>
        </div>
      )}
      <div className="poll-footer">
        <span className="live-vote-count">
          <span className="live-pulse"></span>
          👥 {totalVotes.toLocaleString()} คน
        </span>
        {poll.users && <span>โดย @{poll.users.username}</span>}
        {hasVoted && <span style={{ color: 'var(--green)' }}>✓ โหวตแล้ว</span>}
      </div>
    </div>
  )
}

// ===== Time Capsule Card =====
function TimeCapsuleCard({ poll, onClick }) {
  const totalVotes = poll.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0
  const yearsRemaining = getYearsRemaining(poll.ends_at)
  const isOpened = new Date() > new Date(poll.ends_at)

  return (
    <div className={`poll-card time-capsule-card ${isOpened ? 'opened' : ''}`} onClick={onClick}>
      <div className="poll-card-header">
        <span className="capsule-badge">💊 Time Capsule</span>
        {poll.resolved && <span className="resolved-badge">✅ เฉลยแล้ว</span>}
      </div>
      <div className="poll-question">{poll.question}</div>
      <div className="capsule-info">
        <div className="capsule-timer">
          <span className="capsule-icon">{isOpened ? '🔓' : '🔒'}</span>
          <span className="capsule-text">{yearsRemaining}</span>
        </div>
        <div className="capsule-meta">
          <span>👥 {totalVotes.toLocaleString()} คนโหวต</span>
          <span>📅 หมดเขต {new Date(poll.ends_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })}</span>
        </div>
      </div>
    </div>
  )
}

// ===== Confidence Selector =====
function ConfidenceSelector({ selectedConfidence, onSelect, disabled, user, stake = 50 }) {
  const currentLevel = confidenceLevels.find(l => l.value === selectedConfidence)
  const conviction = currentLevel?.conviction || 'medium'
  
  const impactLevels = {
    low: { label: 'ต่ำ', bars: 2, color: '#22c55e', gainText: 'เพิ่มเล็กน้อย', lossText: 'ลดเล็กน้อย' },
    medium: { label: 'ปานกลาง', bars: 3, color: '#f59e0b', gainText: 'เพิ่ม', lossText: 'ลด' },
    high: { label: 'สูง', bars: 5, color: '#ef4444', gainText: 'เพิ่มมาก', lossText: 'ลดมาก' }
  }
  const impact = impactLevels[conviction] || impactLevels.medium
  
  return (
    <div className="conviction-selector">
      <label className="conviction-label">
        <span>🎯 ระดับความมั่นใจ</span>
      </label>
      
      <div className="conviction-options">
        {confidenceLevels.map((level) => (
          <button 
            key={level.value} 
            type="button" 
            disabled={disabled} 
            className={`conviction-btn ${selectedConfidence === level.value ? 'active' : ''}`} 
            style={{ 
              '--conviction-color': level.color, 
              borderColor: selectedConfidence === level.value ? level.color : 'var(--border)' 
            }} 
            onClick={() => onSelect(level.value)}
          >
            <span className="conviction-emoji">{level.emoji}</span>
            <span className="conviction-text">{level.label}</span>
          </button>
        ))}
      </div>
      
      {conviction === 'high' && (
        <div className="conviction-warning">
          <span className="warning-icon">⚠️</span>
          <span className="warning-text">
            <strong>การโหวตของคุณมีผลกระทบสูงต่อชื่อเสียง</strong><br/>
            ถ้าโหวตนี้คลาดเคลื่อน อาจจะเสีย Reputation มากขึ้น
          </span>
        </div>
      )}
      
      <div className="impact-preview">
        <div className="impact-header">
          <span>ระดับผลกระทบต่อชื่อเสียง:</span>
          <span className="impact-level" style={{ color: impact.color }}>{impact.label}</span>
        </div>
        
        <div className="impact-bar">
          {[1, 2, 3, 4, 5].map(i => (
            <div 
              key={i} 
              className={`impact-segment ${i <= impact.bars ? 'active' : ''}`}
              style={{ backgroundColor: i <= impact.bars ? impact.color : 'var(--border)' }}
            />
          ))}
        </div>
        
        <div className="impact-outcomes">
          <div className="impact-item correct">
            <span className="impact-dot">•</span>
            <span>ถ้าโหวตของคุณดี → ชื่อเสียง{impact.gainText}</span>
          </div>
          <div className="impact-item incorrect">
            <span className="impact-dot">•</span>
            <span>ถ้าคลาดเคลื่อน → ชื่อเสียง{impact.lossText}</span>
          </div>
        </div>
        
        <div className="impact-tooltip">
          <span className="tooltip-icon">ℹ️</span>
          <span className="tooltip-text">
            ความมั่นใจสูง = ผลลัพธ์แรงขึ้นทั้งสองทาง<br/>
            ระบบออกแบบให้สะท้อนความแม่นในระยะยาว
          </span>
        </div>
      </div>
    </div>
  )
}

// ===== Share Buttons =====
function ShareButtons({ poll }) {
  const [copied, setCopied] = useState(false)
  const baseUrl = 'https://www.i-kidwa.com'
  const totalVotes = poll.options?.reduce((sum, o) => sum + o.votes, 0) || 0
  const timeInfo = getDaysRemaining(poll.ends_at)
  
  const shareText = `🎯 ${poll.question}\n\n👥 ${totalVotes.toLocaleString()} คนโหวตแล้ว | ⏱️ ${timeInfo}\n\nแล้วคุณล่ะ คิดว่า..\n${baseUrl}`
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      const textArea = document.createElement('textarea')
      textArea.value = shareText
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  
  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(baseUrl)}`, '_blank', 'width=600,height=400')
  }
  
  const handleShareX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'width=600,height=400')
  }
  
  return (
    <div className="share-buttons">
      <span className="share-label">แชร์:</span>
      <button className="share-btn copy" onClick={handleCopy} title="คัดลอกข้อความ">
        {copied ? '✓' : '📋'}
      </button>
      <button className="share-btn facebook" onClick={handleShareFacebook} title="แชร์ไป Facebook">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      </button>
      <button className="share-btn twitter" onClick={handleShareX} title="แชร์ไป X">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </button>
      {copied && <span className="copy-toast">คัดลอกแล้ว!</span>}
    </div>
  )
}

// ===== Auth Modal =====
function AuthModal({ onClose, onSuccess, darkMode }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const { data, error } = await signInWithEmail(email, password)
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message)
    } else if (data?.user) {
      onSuccess(data.user)
    }
    setIsLoading(false)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('รหัสผ่านไม่ตรงกัน'); return }
    if (password.length < 8) { setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return }
    if (username.length < 3) { setError('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร'); return }
    setIsLoading(true)
    const { data, error } = await signUpWithEmail(email, password, username)
    if (error) { setError(error.message) } else { setSuccess('✅ สำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี') }
    setIsLoading(false)
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const { error } = await signInWithMagicLink(email)
    if (error) { setError(error.message) } else { setSuccess('✅ ส่งลิงก์ไปยังอีเมลแล้ว!') }
    setIsLoading(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    const { error } = await resetPassword(email)
    if (error) { setError(error.message) } else { setSuccess('✅ ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว!') }
    setIsLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal auth-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="auth-header">
          <h2 className="auth-title">🎯 คิดว่า..</h2>
          <p className="auth-subtitle">
            {mode === 'login' && 'เข้าสู่ระบบ'}
            {mode === 'register' && 'สมัครสมาชิก'}
            {mode === 'magic' && 'เข้าสู่ระบบด้วย Magic Link'}
            {mode === 'forgot' && 'ลืมรหัสผ่าน'}
          </p>
        </div>
        {error && <div className="auth-error">❌ {error}</div>}
        {success && <div className="auth-success">{success}</div>}
        {!success && (
          <>
            {mode === 'login' && (
              <form onSubmit={handleLogin}>
                <div className="form-group"><label>📧 อีเมล</label><input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div className="form-group"><label>🔒 รหัสผ่าน</label><input type="password" className="form-input" placeholder="รหัสผ่าน" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                <button type="button" className="auth-link" onClick={() => setMode('forgot')}>ลืมรหัสผ่าน?</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>{isLoading ? '⏳ กำลังเข้าสู่ระบบ...' : '🚀 เข้าสู่ระบบ'}</button>
              </form>
            )}
            {mode === 'register' && (
              <form onSubmit={handleRegister}>
                <div className="form-group"><label>👤 ชื่อผู้ใช้</label><input type="text" className="form-input" placeholder="ชื่อที่แสดงในเว็บ" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={20} /></div>
                <div className="form-group"><label>📧 อีเมล</label><input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div className="form-group"><label>🔒 รหัสผ่าน</label><input type="password" className="form-input" placeholder="อย่างน้อย 8 ตัวอักษร" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></div>
                <div className="form-group"><label>🔒 ยืนยันรหัสผ่าน</label><input type="password" className="form-input" placeholder="พิมพ์รหัสผ่านอีกครั้ง" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></div>
                <p className="auth-bonus">🎁 สมัครใหม่ได้ 1,000 Point เริ่มต้น!</p>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>{isLoading ? '⏳ กำลังสมัคร...' : '✨ สมัครสมาชิก'}</button>
              </form>
            )}
            {mode === 'magic' && (
              <form onSubmit={handleMagicLink}>
                <div className="form-group"><label>📧 อีเมล</label><input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <p className="auth-hint">เราจะส่งลิงก์สำหรับเข้าสู่ระบบไปยังอีเมลของคุณ</p>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>{isLoading ? '⏳ กำลังส่ง...' : '📨 ส่ง Magic Link'}</button>
              </form>
            )}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword}>
                <div className="form-group"><label>📧 อีเมล</label><input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>{isLoading ? '⏳ กำลังส่ง...' : '🔑 รีเซ็ตรหัสผ่าน'}</button>
              </form>
            )}
            <div className="auth-divider"><span>หรือ</span></div>
            {mode !== 'magic' && <button type="button" className="btn btn-magic btn-full" onClick={() => { setMode('magic'); setError(''); setSuccess('') }}>✨ เข้าสู่ระบบด้วย Magic Link</button>}
            <button type="button" className="btn btn-google btn-full" onClick={async () => { setIsLoading(true); const { error } = await signInWithGoogle(); if (error) { setError(error.message); setIsLoading(false) }}} disabled={isLoading}>
              <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: '8px' }}><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
            </button>
            <div className="auth-switch">
              {mode === 'login' && <p>ยังไม่มีบัญชี? <button type="button" onClick={() => { setMode('register'); setError(''); setSuccess('') }}>สมัครสมาชิก</button></p>}
              {mode === 'register' && <p>มีบัญชีแล้ว? <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>เข้าสู่ระบบ</button></p>}
              {(mode === 'magic' || mode === 'forgot') && <p><button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>← กลับไปหน้าเข้าสู่ระบบ</button></p>}
            </div>
          </>
        )}
        {success && <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>ปิด</button>}
      </div>
    </div>
  )
}

// ===== Account Modal =====
function AccountModal({ onClose, user, darkMode, onUpdateUser }) {
  const [activeTab, setActiveTab] = useState('stats')
  const [profile, setProfile] = useState(null)
  const [voteHistory, setVoteHistory] = useState([])
  const [createdPolls, setCreatedPolls] = useState([])
  const [badges, setBadges] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 })
  const [isUploading, setIsUploading] = useState(false)
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setIsLoading(true)
    const { data: profileData } = await getUserProfile(user.id)
    if (profileData) {
      setProfile(profileData)
      setBadges(calculateBadges(profileData))
      localStorage.setItem('kidwa-user', JSON.stringify(profileData))
      onUpdateUser(profileData)
    }
    const { data: historyData } = await getUserVoteHistory(user.id)
    if (historyData) setVoteHistory(historyData)
    const { data: pollsData } = await getUserCreatedPolls(user.id)
    if (pollsData) setCreatedPolls(pollsData)
    const counts = await getFollowCounts(user.id)
    setFollowCounts(counts)
    setIsLoading(false)
  }

  const loadFollowers = async () => { const { data } = await getFollowers(user.id); setFollowers(data || []) }
  const loadFollowing = async () => { const { data } = await getFollowing(user.id); setFollowing(data || []) }

  useEffect(() => {
    if (activeTab === 'followers') loadFollowers()
    if (activeTab === 'following') loadFollowing()
  }, [activeTab])

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('ไฟล์ใหญ่เกินไป (สูงสุด 2MB)'); return }
    if (!file.type.startsWith('image/')) { alert('กรุณาเลือกไฟล์รูปภาพ'); return }
    setIsUploading(true)
    const { data, error } = await uploadAvatar(user.id, file)
    setIsUploading(false)
    if (error) { alert('อัพโหลดไม่สำเร็จ: ' + error.message) } 
    else {
      const updatedUser = { ...user, avatar_url: data.url }
      setProfile(prev => ({ ...prev, avatar_url: data.url }))
      localStorage.setItem('kidwa-user', JSON.stringify(updatedUser))
      onUpdateUser(updatedUser)
      alert('✅ อัพโหลดรูปโปรไฟล์สำเร็จ!')
    }
  }

  const winRate = profile?.total_predictions > 0 ? Math.round((profile.correct_predictions / profile.total_predictions) * 100) : 0
  const level = profile ? getReputationLevel(profile.reputation) : reputationLevels[0]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal account-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {isLoading ? <div style={{ textAlign: 'center', padding: '3rem' }}>⏳ กำลังโหลด...</div> : profile ? (
          <>
            <div className="account-header">
              <div className="account-avatar-wrapper">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.username} className="account-avatar-img" /> : <div className="account-avatar">{profile.username[0].toUpperCase()}</div>}
                <label className="avatar-upload-btn" title="เปลี่ยนรูปโปรไฟล์">
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={isUploading} />
                  {isUploading ? '⏳' : '📷'}
                </label>
              </div>
              <div className="account-info">
                <h2 className="account-username">
                  {profile.username}
                  {profile.is_verified && <span className="verified-badge" title="ยืนยันตัวตนแล้ว"><svg viewBox="0 0 24 24" className="verified-check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>}
                </h2>
                <div className="account-level"><span className="level-badge">{level.badge}</span><span className="level-name">{level.name}</span></div>
                <div className="account-reputation">{profile.reputation.toLocaleString()} point</div>
                {profile.email && <div className="account-email">📧 {profile.email}</div>}
                {!profile.is_verified && <div className="account-verify-prompt"><span>💡 ยืนยันตัวตนเพื่อรับ Verified Badge และสร้างโพลได้</span></div>}
                <div className="account-follow-stats">
                  <span onClick={() => setActiveTab('followers')} style={{ cursor: 'pointer' }}><strong>{followCounts.followers}</strong> ผู้ติดตาม</span>
                  <span onClick={() => setActiveTab('following')} style={{ cursor: 'pointer' }}><strong>{followCounts.following}</strong> กำลังติดตาม</span>
                </div>
              </div>
            </div>
            <div className="account-stats">
              <div className="account-stat-card"><span className="account-stat-number">{profile.total_predictions || 0}</span><span className="account-stat-label">โหวตทั้งหมด</span></div>
              <div className="account-stat-card correct"><span className="account-stat-number">{profile.correct_predictions || 0}</span><span className="account-stat-label">ถูก</span></div>
              <div className="account-stat-card wrong"><span className="account-stat-number">{(profile.total_predictions || 0) - (profile.correct_predictions || 0)}</span><span className="account-stat-label">ผิด</span></div>
              <div className="account-stat-card rate"><span className="account-stat-number">{winRate}%</span><span className="account-stat-label">Win Rate</span></div>
            </div>
            <div className="account-streak">
              <div className="streak-item"><span className="streak-icon">🔥</span><span className="streak-value">{profile.current_streak || 0}</span><span className="streak-label">Current Streak</span></div>
              <div className="streak-item"><span className="streak-icon">⚡</span><span className="streak-value">{profile.max_streak || 0}</span><span className="streak-label">Best Streak</span></div>
            </div>
            {badges.length > 0 && <div className="account-badges"><h3 className="account-section-title">🏅 Badges</h3><div className="badges-grid">{badges.map(badge => <div key={badge.id} className="badge-item" title={badge.description}><span className="badge-icon">{badge.icon}</span><span className="badge-name">{badge.name}</span></div>)}</div></div>}
            <div className="account-tabs">
              <button className={`account-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>📊 สถิติ</button>
              <button className={`account-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📜 ประวัติ</button>
              <button className={`account-tab ${activeTab === 'polls' ? 'active' : ''}`} onClick={() => setActiveTab('polls')}>📝 โพล</button>
              <button className={`account-tab ${activeTab === 'followers' ? 'active' : ''}`} onClick={() => setActiveTab('followers')}>👥</button>
              <button className={`account-tab ${activeTab === 'following' ? 'active' : ''}`} onClick={() => setActiveTab('following')}>➡️</button>
            </div>
            <div className="account-content">
              {activeTab === 'stats' && <div className="stats-detail"><div className="stats-row"><span>สมาชิกตั้งแต่</span><span>{new Date(profile.created_at).toLocaleDateString('th-TH')}</span></div><div className="stats-row"><span>Point เริ่มต้น</span><span>1,000</span></div><div className="stats-row"><span>ได้/เสีย รวม</span><span style={{ color: profile.reputation >= 1000 ? 'var(--green)' : 'var(--red)' }}>{profile.reputation >= 1000 ? '+' : ''}{profile.reputation - 1000}</span></div></div>}
              {activeTab === 'history' && <div className="history-list">{voteHistory.length > 0 ? voteHistory.map(vote => <div key={vote.id} className={`history-item ${vote.is_correct === true ? 'correct' : vote.is_correct === false ? 'wrong' : ''}`}><div className="history-question">{vote.polls?.question || 'โพลถูกลบ'}</div><div className="history-answer"><span>เลือก: {vote.options?.text || '-'}</span>{vote.is_correct !== null && <span className={`history-result ${vote.is_correct ? 'correct' : 'wrong'}`}>{vote.is_correct ? '✅ ถูก' : '❌ ผิด'} ({vote.points_earned > 0 ? '+' : ''}{vote.points_earned})</span>}{vote.is_correct === null && vote.polls && <span className="history-pending">⏳ รอเฉลย</span>}</div></div>) : <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>ยังไม่มีประวัติการโหวต</div>}</div>}
              {activeTab === 'polls' && <div className="polls-list">{createdPolls.length > 0 ? createdPolls.map(poll => <div key={poll.id} className="created-poll-item"><div className="created-poll-question">{poll.resolved && '✅ '}{poll.question}</div><div className="created-poll-meta"><span>👥 {poll.options?.reduce((s, o) => s + o.votes, 0) || 0} โหวต</span><span>⏱️ {getDaysRemaining(poll.ends_at)}</span></div></div>) : <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>ยังไม่ได้สร้างโพล</div>}</div>}
              {activeTab === 'followers' && <div className="follow-list">{followers.length > 0 ? followers.map(f => <div key={f.id} className="follow-item"><div className="follow-avatar">{f.avatar_url ? <img src={f.avatar_url} alt={f.username} /> : f.username[0].toUpperCase()}</div><div className="follow-info"><span className="follow-name">{f.username}</span><span className="follow-rep">{getReputationLevel(f.reputation).badge} {f.reputation} pt</span></div></div>) : <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>ยังไม่มีผู้ติดตาม</div>}</div>}
              {activeTab === 'following' && <div className="follow-list">{following.length > 0 ? following.map(f => <div key={f.id} className="follow-item"><div className="follow-avatar">{f.avatar_url ? <img src={f.avatar_url} alt={f.username} /> : f.username[0].toUpperCase()}</div><div className="follow-info"><span className="follow-name">{f.username}</span><span className="follow-rep">{getReputationLevel(f.reputation).badge} {f.reputation} pt</span></div></div>) : <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>ยังไม่ได้ติดตามใคร</div>}</div>}
            </div>
          </>
        ) : <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>ไม่พบข้อมูล</div>}
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

  useEffect(() => { loadData() }, [activeTab])

  const loadData = async () => {
    setIsLoading(true)
    if (activeTab === 'pending') { const { data } = await getPendingPolls(); setPolls(data || []) }
    else if (activeTab === 'all') { const { data } = await getAllPollsAdmin(); setPolls(data || []) }
    else if (activeTab === 'users') { const { data } = await getAllUsers(); setUsers(data || []) }
    const statsData = await getAdminStats(); setStats(statsData)
    setIsLoading(false)
  }

  const handleResolvePoll = async (pollId, correctOptionId) => { 
    if (!confirm('ยืนยันการเฉลยโพลนี้?')) return
    const { error } = await resolvePoll(pollId, correctOptionId)
    if (!error) { alert('✅ เฉลยโพลสำเร็จ!'); loadData(); onRefresh(); setSelectedPollForResolve(null) }
  }
  
  const handleDeletePoll = async (pollId) => { 
    if (!confirm('ยืนยันการลบโพลนี้?')) return
    const { error } = await deletePoll(pollId)
    if (!error) { alert('🗑️ ลบโพลสำเร็จ!'); loadData(); onRefresh() }
  }
  
  const handleToggleFeatured = async (pollId, featured) => { await toggleFeatured(pollId, featured); loadData(); onRefresh() }
  const handleToggleBan = async (userId, isBanned) => { await toggleBanUser(userId, isBanned); loadData() }

  const expiredPolls = polls.filter(p => !p.resolved && isExpired(p.ends_at))
  const upcomingPolls = polls.filter(p => !p.resolved && !isExpired(p.ends_at))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal admin-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">🔧 Admin Panel</h2>
        <div className="admin-stats">
          <div className="stat-card"><span className="stat-number">{stats.totalPolls || 0}</span><span className="stat-label">โพลทั้งหมด</span></div>
          <div className="stat-card warning"><span className="stat-number">{stats.expiredUnresolved || 0}</span><span className="stat-label">รอเฉลย</span></div>
          <div className="stat-card success"><span className="stat-number">{stats.resolvedPolls || 0}</span><span className="stat-label">เฉลยแล้ว</span></div>
          <div className="stat-card"><span className="stat-number">{stats.totalUsers || 0}</span><span className="stat-label">Users</span></div>
        </div>
        <div className="admin-tabs">
          <button className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>📋 รอเฉลย {stats.expiredUnresolved > 0 && <span className="badge">{stats.expiredUnresolved}</span>}</button>
          <button className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>📊 โพลทั้งหมด</button>
          <button className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Users</button>
        </div>
        <div className="admin-content">
          {isLoading ? <div style={{ textAlign: 'center', padding: '2rem' }}>⏳ กำลังโหลด...</div> : activeTab === 'pending' ? (
            <>
              {expiredPolls.length > 0 && <div className="admin-section"><h3 className="admin-section-title">🔴 หมดเวลาแล้ว - รอเฉลย</h3>{expiredPolls.map(poll => (<div key={poll.id} className="admin-poll-item"><div className="admin-poll-info"><span className="admin-poll-question">{poll.question}</span><span className="admin-poll-meta">👥 {poll.options?.reduce((s, o) => s + o.votes, 0)} โหวต</span></div><div className="admin-poll-actions"><button className="btn btn-sm btn-success" onClick={() => setSelectedPollForResolve(poll)}>✅ เฉลย</button><button className="btn btn-sm btn-danger" onClick={() => handleDeletePoll(poll.id)}>🗑️</button></div></div>))}</div>}
              {upcomingPolls.length > 0 && <div className="admin-section"><h3 className="admin-section-title">🟢 ยังไม่หมดเวลา</h3>{upcomingPolls.slice(0, 5).map(poll => (<div key={poll.id} className="admin-poll-item"><div className="admin-poll-info"><span className="admin-poll-question">{poll.question}</span><span className="admin-poll-meta">⏱️ {getDaysRemaining(poll.ends_at)}</span></div></div>))}</div>}
              {expiredPolls.length === 0 && upcomingPolls.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>ไม่มีโพลรอเฉลย</div>}
            </>
          ) : activeTab === 'all' ? (
            <div className="admin-section">{polls.map(poll => (<div key={poll.id} className="admin-poll-item"><div className="admin-poll-info"><span className="admin-poll-question">{poll.featured && '⭐ '}{poll.resolved && '✅ '}{poll.question}</span><span className="admin-poll-meta">{categories.find(c => c.id === poll.category)?.icon} • 👥 {poll.options?.reduce((s, o) => s + o.votes, 0)}</span></div><div className="admin-poll-actions"><button className={`btn btn-sm ${poll.featured ? 'btn-warning' : 'btn-secondary'}`} onClick={() => handleToggleFeatured(poll.id, !poll.featured)}>{poll.featured ? '⭐' : '☆'}</button>{!poll.resolved && isExpired(poll.ends_at) && <button className="btn btn-sm btn-success" onClick={() => setSelectedPollForResolve(poll)}>✅</button>}<button className="btn btn-sm btn-danger" onClick={() => handleDeletePoll(poll.id)}>🗑️</button></div></div>))}</div>
          ) : (
            <div className="admin-section">{users.map((u, i) => (<div key={u.id} className="admin-user-item"><div className="admin-user-info"><span className="admin-user-rank">{i + 1}</span><span className="admin-user-name">{u.is_banned && '🚫 '}{u.is_admin && '👑 '}{u.username}</span><span className="admin-user-rep">{getReputationLevel(u.reputation).badge} {u.reputation} pt</span></div><div className="admin-user-actions">{!u.is_admin && <button className={`btn btn-sm ${u.is_banned ? 'btn-success' : 'btn-danger'}`} onClick={() => handleToggleBan(u.id, !u.is_banned)}>{u.is_banned ? '✅ ปลดแบน' : '🚫 แบน'}</button>}</div></div>))}</div>
          )}
        </div>
        {selectedPollForResolve && (
          <div className="resolve-modal-overlay" onClick={() => setSelectedPollForResolve(null)}>
            <div className="resolve-modal" onClick={e => e.stopPropagation()}>
              <h3>✅ เฉลยโพล</h3>
              <p className="resolve-question">{selectedPollForResolve.question}</p>
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>เลือกคำตอบที่ถูกต้อง:</p>
              <div className="resolve-options">{selectedPollForResolve.options?.map(opt => (<button key={opt.id} className="resolve-option" onClick={() => handleResolvePoll(selectedPollForResolve.id, opt.id)}>{opt.text}<span className="resolve-votes">({opt.votes} โหวต)</span></button>))}</div>
              <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setSelectedPollForResolve(null)}>ยกเลิก</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ===== Create Poll Modal (Verified Users Only) =====
function CreatePollModal({ onClose, user, onSuccess, darkMode }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [category, setCategory] = useState('other')
  const [pollMode, setPollMode] = useState('prediction')
  const [blindMode, setBlindMode] = useState(true)
  const [endsAt, setEndsAt] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [availableTags, setAvailableTags] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [pollLimit, setPollLimit] = useState({ canCreate: false, used: 0, limit: 3, remaining: 0, isVerified: false })
  const [similarPolls, setSimilarPolls] = useState([])
  const [showSimilarWarning, setShowSimilarWarning] = useState(false)
  const [similarCheckDone, setSimilarCheckDone] = useState(false)

  useEffect(() => { 
    loadTags()
    loadPollLimit()
    // Default to 7 days from now in Bangkok time
    const d = new Date()
    d.setDate(d.getDate() + 7)
    setEndsAt(d.toISOString().split('T')[0]) 
  }, [])

  useEffect(() => {
    if (pollMode === 'prediction') setBlindMode(true)
    else setBlindMode(false)
  }, [pollMode])

  const loadTags = async () => { const { data } = await getTags(); if (data) setAvailableTags(data) }
  const loadPollLimit = async () => { const limit = await getUserPollLimit(user.id); setPollLimit(limit) }

  // Check similar polls
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (question.trim().length > 10) {
        const { data } = await findSimilarPolls(question)
        setSimilarPolls(data || [])
      } else {
        setSimilarPolls([])
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [question])

  const addOption = () => { if (options.length < 6) setOptions([...options, '']) }
  const removeOption = (index) => { if (options.length > 2) setOptions(options.filter((_, i) => i !== index)) }
  const updateOption = (index, value) => { const n = [...options]; n[index] = value; setOptions(n) }
  
  const addTag = async () => {
    if (!tagInput.trim() || selectedTags.length >= 5) return
    let tag = availableTags.find(t => t.name.toLowerCase() === tagInput.toLowerCase().trim())
    if (!tag) { const { data } = await createTag(tagInput.trim()); if (data) { tag = data; setAvailableTags([...availableTags, data]) }}
    if (tag && !selectedTags.find(t => t.id === tag.id)) setSelectedTags([...selectedTags, tag])
    setTagInput('')
  }

  const validate = () => { 
    const e = {}
    if (!question.trim()) e.question = 'กรุณาใส่คำถาม'
    if (options.filter(o => o.trim()).length < 2) e.options = 'ต้องมีตัวเลือกอย่างน้อย 2 ตัว'
    if (!endsAt) e.endsAt = 'กรุณาเลือกวันหมดเวลา'
    setErrors(e)
    return Object.keys(e).length === 0 
  }

  const handleSubmit = async (e) => { 
    e.preventDefault()
    if (!validate()) return
    if (similarPolls.length > 0 && !similarCheckDone) { setShowSimilarWarning(true); return }
    setIsSubmitting(true)
    const { error } = await createPoll({ 
      question: question.trim(), 
      options: options.filter(o => o.trim()), 
      category, 
      tags: selectedTags.map(t => t.id), 
      blindMode, 
      endsAt: new Date(endsAt).toISOString(), 
      pollType: pollMode, 
      createdBy: user.id 
    })
    setIsSubmitting(false)
    if (error) { alert('เกิดข้อผิดพลาด') } 
    else { alert('🎉 สร้างโพลสำเร็จ!'); onSuccess(); onClose() }
  }

  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.find(t => t.id === tag.id)
  ).slice(0, 5)

  // Not verified - show prompt
  if (!pollLimit.isVerified && !user.is_admin) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className={`modal create-poll-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>✕</button>
          <div className="poll-limit-exceeded">
            <span className="limit-icon">🔐</span>
            <h2>ต้องยืนยันตัวตนก่อน</h2>
            <p>เฉพาะผู้ใช้ที่ยืนยันตัวตนแล้วเท่านั้น<br/>ที่สามารถสร้างโพลได้</p>
            <div className="verify-upsell">
              <p>✓ <strong>ยืนยันตัวตน</strong> เพื่อสร้างได้ 3 โพล/วัน!</p>
              <p>✓ รับ Verified Badge</p>
              <p>✓ เพิ่มความน่าเชื่อถือ</p>
            </div>
            <button className="btn btn-secondary" onClick={onClose}>ปิด</button>
          </div>
        </div>
      </div>
    )
  }

  // Verified but exceeded limit
  if (!pollLimit.canCreate && !user.is_admin) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className={`modal create-poll-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>✕</button>
          <div className="poll-limit-exceeded">
            <span className="limit-icon">⏰</span>
            <h2>ถึงขีดจำกัดแล้ว</h2>
            <p>คุณสร้างโพลครบ {pollLimit.limit} โพลแล้ววันนี้</p>
            <p className="limit-reset">กลับมาสร้างใหม่ได้พรุ่งนี้ 00:00 น.</p>
            <button className="btn btn-secondary" onClick={onClose}>ปิด</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal create-poll-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">➕ สร้างโพลใหม่</h2>
        
        {!user.is_admin && <div className="poll-limit-indicator"><span>📊 โควต้าวันนี้: {pollLimit.remaining}/{pollLimit.limit} โพล</span></div>}

        {showSimilarWarning && similarPolls.length > 0 ? (
          <div className="similar-polls-warning">
            <div className="warning-header"><span>⚠️</span><span>พบหัวข้อที่คล้ายกัน</span></div>
            <p className="warning-text">เราพบหัวข้อที่อาจซ้ำกับที่คุณกำลังสร้าง</p>
            <div className="similar-polls-list">
              {similarPolls.map(poll => (
                <div key={poll.id} className="similar-poll-item">
                  <div className="similar-poll-question">{poll.question}</div>
                  <div className="similar-poll-meta">
                    <span>👥 {poll.totalVotes?.toLocaleString() || 0} โหวต</span>
                    <span className="similarity-badge">{Math.round(poll.similarity * 100)}% คล้าย</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="warning-actions">
              <button className="btn btn-secondary" onClick={() => { setSimilarCheckDone(true); setShowSimilarWarning(false) }}>🆕 สร้างหัวข้อใหม่ต่อ</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>🎯 ประเภทโพล</label>
              <div className="poll-mode-selector">
                <button type="button" className={`poll-mode-btn ${pollMode === 'prediction' ? 'active' : ''}`} onClick={() => setPollMode('prediction')}>
                  <span className="mode-icon">🔮</span><span className="mode-title">ทำนายอนาคต</span><span className="mode-desc">มีคำตอบถูก-ผิด • Blind Mode</span>
                </button>
                <button type="button" className={`poll-mode-btn ${pollMode === 'opinion' ? 'active' : ''}`} onClick={() => setPollMode('opinion')}>
                  <span className="mode-icon">💭</span><span className="mode-title">คุณคิดว่า..</span><span className="mode-desc">ความชอบ/ความคิดเห็น</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>❓ คำถาม</label>
              <input type="text" className={`form-input ${errors.question ? 'error' : ''}`} placeholder={pollMode === 'prediction' ? 'เช่น ใครจะชนะเลือกตั้ง 2026?' : 'เช่น คุณชอบไปสวนสนุกที่ไหนมากกว่ากัน?'} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
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
                {categories.filter(c => !['home', 'live', 'timecapsule'].includes(c.id)).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>🏷️ แท็ก (สูงสุด 5)</label>
              <div className="tags-selected">{selectedTags.map(tag => <span key={tag.id} className="tag-chip">#{tag.name}<button type="button" onClick={() => setSelectedTags(selectedTags.filter(t => t.id !== tag.id))}>✕</button></span>)}</div>
              <div className="tag-input-wrapper">
                <input type="text" className="form-input" placeholder="พิมพ์แท็กแล้วกด Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() }}} />
                {tagInput && <button type="button" className="add-tag-btn" onClick={addTag}>เพิ่ม</button>}
              </div>
              {filteredTags.length > 0 && tagInput && <div className="tag-suggestions">{filteredTags.map(tag => <button key={tag.id} type="button" className="tag-suggestion" onClick={() => { if (selectedTags.length < 5) setSelectedTags([...selectedTags, tag]); setTagInput('') }}>#{tag.name}</button>)}</div>}
            </div>

            <div className="form-group">
              <label>📅 วันหมดเวลา</label>
              <input type="date" className={`form-input ${errors.endsAt ? 'error' : ''}`} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              {errors.endsAt && <span className="error-text">{errors.endsAt}</span>}
            </div>

            {pollMode === 'prediction' && (
              <div className="blind-mode-info">
                <span className="blind-icon">🔒</span>
                <div className="blind-text"><strong>Blind Mode เปิดอัตโนมัติ</strong><span>ผู้คนจะไม่สามารถเห็นผลโหวตได้จนกว่าจะเฉลย</span></div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? '⏳ กำลังสร้าง...' : '🚀 สร้างโพล'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ===== Create Live Battle Modal (Date+Time Picker with +7h fix) =====
function CreateLiveBattleModal({ onClose, user, onSuccess, darkMode }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [category, setCategory] = useState('other')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [availableTags, setAvailableTags] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => { 
    loadTags()
    // Default: tomorrow at 20:00
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setEndDate(tomorrow.toISOString().split('T')[0])
    setEndTime('20:00')
  }, [])

  const loadTags = async () => { const { data } = await getTags(); if (data) setAvailableTags(data) }
  const addOption = () => { if (options.length < 6) setOptions([...options, '']) }
  const removeOption = (index) => { if (options.length > 2) setOptions(options.filter((_, i) => i !== index)) }
  const updateOption = (index, value) => { const n = [...options]; n[index] = value; setOptions(n) }
  
  const addTag = async () => {
    if (!tagInput.trim() || selectedTags.length >= 5) return
    let tag = availableTags.find(t => t.name.toLowerCase() === tagInput.toLowerCase().trim())
    if (!tag) { const { data } = await createTag(tagInput.trim()); if (data) { tag = data; setAvailableTags([...availableTags, data]) }}
    if (tag && !selectedTags.find(t => t.id === tag.id)) setSelectedTags([...selectedTags, tag])
    setTagInput('')
  }

  const validate = () => { 
    const e = {}
    if (!question.trim()) e.question = 'กรุณาใส่คำถาม'
    if (options.filter(o => o.trim()).length < 2) e.options = 'ต้องมีตัวเลือกอย่างน้อย 2 ตัว'
    if (!endDate || !endTime) e.endDateTime = 'กรุณาเลือกวันและเวลาสิ้นสุด'
    setErrors(e)
    return Object.keys(e).length === 0 
  }

  const handleSubmit = async (e) => { 
    e.preventDefault()
    if (!validate()) return
    
    setIsSubmitting(true)
    
    // User input is Bangkok time - send directly (backend will add +7h)
    const { error } = await createLiveBattleV2({ 
      question: question.trim(), 
      options: options.filter(o => o.trim()), 
      category,
      tags: selectedTags.map(t => t.id),
      endDate,
      endTime,
      createdBy: user.id 
    })
    
    setIsSubmitting(false)
    if (error) alert('เกิดข้อผิดพลาด: ' + error.message)
    else { alert('⚡ สร้าง Live Battle สำเร็จ!'); onSuccess(); onClose() }
  }

  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.find(t => t.id === tag.id)
  ).slice(0, 5)

  // Calculate min date/time (now in Bangkok)
  const now = new Date()
  const minDate = now.toISOString().split('T')[0]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal create-poll-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">⚡ สร้าง Live Battle</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          โพลแบบ Real-time • เห็นผลโหวตทันที
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>❓ คำถาม</label>
            <input type="text" className={`form-input ${errors.question ? 'error' : ''}`} placeholder="เช่น ใครจะชนะแมตช์นี้?" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
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
              {categories.filter(c => !['home', 'live', 'timecapsule'].includes(c.id)).map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>📅 วันและเวลาสิ้นสุด (เวลาไทย)</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="date" className={`form-input ${errors.endDateTime ? 'error' : ''}`} value={endDate} onChange={(e) => setEndDate(e.target.value)} min={minDate} style={{ flex: 1 }} />
              <input type="time" className={`form-input ${errors.endDateTime ? 'error' : ''}`} value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ flex: 1 }} />
            </div>
            {errors.endDateTime && <span className="error-text">{errors.endDateTime}</span>}
            {endDate && endTime && (
              <p style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '0.5rem' }}>
                ⏰ สิ้นสุด: {new Date(endDate + 'T' + endTime).toLocaleString('th-TH', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            )}
          </div>

          <div className="form-group">
            <label>🏷️ แท็ก (สูงสุด 5)</label>
            <div className="tags-selected">{selectedTags.map(tag => <span key={tag.id} className="tag-chip">#{tag.name}<button type="button" onClick={() => setSelectedTags(selectedTags.filter(t => t.id !== tag.id))}>✕</button></span>)}</div>
            <div className="tag-input-wrapper">
              <input type="text" className="form-input" placeholder="พิมพ์แท็กแล้วกด Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() }}} />
              {tagInput && <button type="button" className="add-tag-btn" onClick={addTag}>เพิ่ม</button>}
            </div>
            {filteredTags.length > 0 && tagInput && <div className="tag-suggestions">{filteredTags.map(tag => <button key={tag.id} type="button" className="tag-suggestion" onClick={() => { if (selectedTags.length < 5) setSelectedTags([...selectedTags, tag]); setTagInput('') }}>#{tag.name}</button>)}</div>}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-live" disabled={isSubmitting}>
              {isSubmitting ? '⏳ กำลังสร้าง...' : '⚡ เริ่ม Live Battle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== Create Time Capsule Modal (Admin Only) =====
function CreateTimeCapsuleModal({ onClose, user, onSuccess, darkMode }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [years, setYears] = useState(1)
  const [selectedTags, setSelectedTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [availableTags, setAvailableTags] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => { loadTags() }, [])
  const loadTags = async () => { const { data } = await getTags(); if (data) setAvailableTags(data) }
  const addOption = () => { if (options.length < 6) setOptions([...options, '']) }
  const removeOption = (index) => { if (options.length > 2) setOptions(options.filter((_, i) => i !== index)) }
  const updateOption = (index, value) => { const n = [...options]; n[index] = value; setOptions(n) }
  
  const addTag = async () => {
    if (!tagInput.trim() || selectedTags.length >= 5) return
    let tag = availableTags.find(t => t.name.toLowerCase() === tagInput.toLowerCase().trim())
    if (!tag) { const { data } = await createTag(tagInput.trim()); if (data) { tag = data; setAvailableTags([...availableTags, data]) }}
    if (tag && !selectedTags.find(t => t.id === tag.id)) setSelectedTags([...selectedTags, tag])
    setTagInput('')
  }

  const validate = () => { 
    const e = {}
    if (!question.trim()) e.question = 'กรุณาใส่หัวข้อ'
    if (options.filter(o => o.trim()).length < 2) e.options = 'ต้องมีตัวเลือกอย่างน้อย 2 ตัว'
    setErrors(e)
    return Object.keys(e).length === 0 
  }

  const handleSubmit = async (e) => { 
    e.preventDefault()
    if (!validate()) return
    
    setIsSubmitting(true)
    const endsAt = new Date()
    endsAt.setFullYear(endsAt.getFullYear() + years)
    
    const { error } = await createTimeCapsule({ 
      question: question.trim(), 
      options: options.filter(o => o.trim()), 
      tags: selectedTags.map(t => t.id),
      endsAt: endsAt.toISOString(), 
      createdBy: user.id 
    })
    
    setIsSubmitting(false)
    if (error) alert('เกิดข้อผิดพลาด')
    else { alert('💊 สร้าง Time Capsule สำเร็จ!'); onSuccess(); onClose() }
  }

  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.find(t => t.id === tag.id)
  ).slice(0, 5)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal create-poll-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">💊 สร้าง Time Capsule</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          ทำนายอนาคตระยะยาว 1-10 ปี • Blind Mode อัตโนมัติ
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>❓ คำถามทำนายอนาคต</label>
            <input type="text" className={`form-input ${errors.question ? 'error' : ''}`} placeholder="เช่น AI จะแทนที่งานมนุษย์ 50% ภายในปี 2030 ไหม?" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
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
            <label>📅 เปิดแคปซูลใน (1-10 ปี)</label>
            <div className="years-selector">
              {[1, 2, 3, 5, 10].map(y => (
                <button key={y} type="button" className={`year-btn ${years === y ? 'active' : ''}`} onClick={() => setYears(y)}>
                  {y} ปี
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              📆 เปิดเผยวันที่: {new Date(new Date().setFullYear(new Date().getFullYear() + years)).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="form-group">
            <label>🏷️ แท็ก (สูงสุด 5)</label>
            <div className="tags-selected">{selectedTags.map(tag => <span key={tag.id} className="tag-chip">#{tag.name}<button type="button" onClick={() => setSelectedTags(selectedTags.filter(t => t.id !== tag.id))}>✕</button></span>)}</div>
            <div className="tag-input-wrapper">
              <input type="text" className="form-input" placeholder="พิมพ์แท็กแล้วกด Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() }}} />
              {tagInput && <button type="button" className="add-tag-btn" onClick={addTag}>เพิ่ม</button>}
            </div>
            {filteredTags.length > 0 && tagInput && <div className="tag-suggestions">{filteredTags.map(tag => <button key={tag.id} type="button" className="tag-suggestion" onClick={() => { if (selectedTags.length < 5) setSelectedTags([...selectedTags, tag]); setTagInput('') }}>#{tag.name}</button>)}</div>}
          </div>

          <div className="capsule-preview">
            <span>🔒</span> Blind Mode เปิดอัตโนมัติ - ไม่มีใครเห็นผลโหวตจนกว่าจะถึงวันเปิดแคปซูล
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
            <button type="submit" className="btn btn-capsule" disabled={isSubmitting}>
              {isSubmitting ? '⏳ กำลังสร้าง...' : '💊 สร้าง Time Capsule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== Verification Modal (PDPA) =====
function VerificationModal({ onClose, user, onSuccess, darkMode }) {
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [pdpaConsent, setPdpaConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const calculateAge = (dateString) => {
    if (!dateString) return null
    const today = new Date()
    const birth = new Date(dateString)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const age = calculateAge(birthDate)
  const maxDate = new Date()
  maxDate.setFullYear(maxDate.getFullYear() - 13)
  const maxDateStr = maxDate.toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!fullName.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return }
    if (!birthDate) { setError('กรุณาเลือกวันเกิด'); return }
    if (age < 13) { setError('ต้องมีอายุอย่างน้อย 13 ปี'); return }
    if (!pdpaConsent) { setError('กรุณายอมรับเงื่อนไขการใช้งาน'); return }
    setIsSubmitting(true)
    const { data, error: submitError } = await submitVerification(user.id, { fullName: fullName.trim(), birthDate, pdpaConsent, marketingConsent })
    setIsSubmitting(false)
    if (submitError) { setError(submitError.message) } 
    else { onSuccess({ ...user, is_verified: true, full_name: fullName }) }
  }

  const handleSkip = async () => { await skipVerification(user.id); onClose() }

  return (
    <div className="modal-overlay">
      <div className={`modal verification-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="verification-header">
          <span className="verification-icon">🔐</span>
          <h2>ยืนยันตัวตน</h2>
          <p>รับ Verified Badge และสิทธิ์สร้างโพล!</p>
        </div>
        <div className="verification-benefits">
          <div className="benefit-item"><span>✓</span><span>Verified Badge แสดงข้างชื่อ</span></div>
          <div className="benefit-item"><span>📊</span><span>สร้างโพลได้ 3 โพล/วัน</span></div>
          <div className="benefit-item"><span>⭐</span><span>เพิ่มความน่าเชื่อถือ</span></div>
        </div>
        {error && <div className="auth-error">❌ {error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>👤 ชื่อ-นามสกุล (จริง)</label>
            <input type="text" className="form-input" placeholder="เช่น สมทรง มั่งมี" value={fullName} onChange={e => setFullName(e.target.value)} maxLength={100} />
          </div>
          <div className="form-group">
            <label>🎂 วันเกิด</label>
            <input type="date" className="form-input" value={birthDate} onChange={e => setBirthDate(e.target.value)} max={maxDateStr} />
            {age !== null && age >= 13 && <span className="age-display">อายุ {age} ปี</span>}
          </div>
          <div className="consent-section">
            <label className="consent-item required">
              <input type="checkbox" checked={pdpaConsent} onChange={e => setPdpaConsent(e.target.checked)} />
              <span>ยอมรับ<a href="/terms" target="_blank">เงื่อนไขการใช้งาน</a>และ<a href="/privacy" target="_blank">นโยบายความเป็นส่วนตัว</a> (PDPA)<span className="required-mark">*</span></span>
            </label>
            <label className="consent-item optional">
              <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} />
              <span>ยินยอมรับข่าวสารและการแจ้งเตือนพิเศษ (ไม่บังคับ)</span>
            </label>
          </div>
          <div className="verification-note"><span>🔒</span><span>ข้อมูลของคุณจะถูกเก็บรักษาอย่างปลอดภัย</span></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleSkip}>ข้ามไปก่อน</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? '⏳ กำลังยืนยัน...' : '✅ ยืนยันตัวตน'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ===== User Profile Modal =====
function UserProfileModal({ userId, currentUser, onClose, darkMode }) {
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFollowingUser, setIsFollowingUser] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => { loadProfile() }, [userId])

  const loadProfile = async () => {
    setIsLoading(true)
    const { data } = await getUserPublicProfile(userId)
    if (data) setProfile(data)
    if (currentUser && currentUser.id !== userId) {
      const following = await isFollowing(currentUser.id, userId)
      setIsFollowingUser(following)
    }
    setIsLoading(false)
  }

  const handleFollow = async () => {
    if (!currentUser) return
    setIsProcessing(true)
    if (isFollowingUser) {
      await unfollowUser(currentUser.id, userId)
      setIsFollowingUser(false)
      setProfile(prev => ({ ...prev, followers: prev.followers - 1 }))
    } else {
      await followUser(currentUser.id, userId)
      setIsFollowingUser(true)
      setProfile(prev => ({ ...prev, followers: prev.followers + 1 }))
    }
    setIsProcessing(false)
  }

  const winRate = profile?.total_predictions > 0 ? Math.round((profile.correct_predictions / profile.total_predictions) * 100) : 0
  const level = profile ? getReputationLevel(profile.reputation) : reputationLevels[0]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal user-profile-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        {isLoading ? <div style={{ textAlign: 'center', padding: '3rem' }}>⏳ กำลังโหลด...</div> : profile ? (
          <>
            <div className="profile-header">
              <div className="profile-avatar">
                {profile.avatar_url ? <img src={profile.avatar_url} alt={profile.username} /> : <span>{profile.username[0].toUpperCase()}</span>}
              </div>
              <div className="profile-info">
                <h2 className="profile-username">
                  {profile.username}
                  {profile.is_verified && <span className="verified-badge" title="ยืนยันตัวตนแล้ว"><svg viewBox="0 0 24 24" className="verified-check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>}
                </h2>
                <div className="profile-level">{level.badge} {level.name}</div>
                <div className="profile-reputation">{profile.reputation.toLocaleString()} point</div>
              </div>
            </div>
            <div className="profile-follow-stats">
              <div className="follow-stat"><strong>{profile.followers}</strong><span>ผู้ติดตาม</span></div>
              <div className="follow-stat"><strong>{profile.following}</strong><span>กำลังติดตาม</span></div>
            </div>
            {currentUser && currentUser.id !== userId && (
              <button className={`btn ${isFollowingUser ? 'btn-secondary' : 'btn-primary'}`} style={{ width: '100%', marginBottom: '1rem' }} onClick={handleFollow} disabled={isProcessing}>
                {isProcessing ? '⏳' : isFollowingUser ? '✓ กำลังติดตาม' : '➕ ติดตาม'}
              </button>
            )}
            <div className="profile-stats-grid">
              <div className="profile-stat"><span className="stat-value">{profile.total_predictions || 0}</span><span className="stat-label">โหวตทั้งหมด</span></div>
              <div className="profile-stat"><span className="stat-value">{profile.correct_predictions || 0}</span><span className="stat-label">ถูก</span></div>
              <div className="profile-stat"><span className="stat-value">{winRate}%</span><span className="stat-label">Win Rate</span></div>
              <div className="profile-stat"><span className="stat-value">{profile.max_streak || 0}</span><span className="stat-label">Best Streak</span></div>
            </div>
            <div className="profile-meta"><span>🗓️ สมาชิกตั้งแต่ {new Date(profile.created_at).toLocaleDateString('th-TH')}</span></div>
          </>
        ) : <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>ไม่พบข้อมูล</div>}
      </div>
    </div>
  )
}

// ===== Trending Tags Section (Sidebar) =====
function TrendingTagsSection({ onTagClick, darkMode }) {
  const [tags, setTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadTrendingTags()
  }, [])

  const loadTrendingTags = async () => {
    setIsLoading(true)
    const { data } = await getTrendingTags(10)
    if (data) setTags(data)
    setIsLoading(false)
  }

  return (
    <div className="sidebar-card">
      <h3 className="sidebar-title">🔥 แท็กที่ได้รับความสนใจ</h3>
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>⏳</div>
      ) : tags.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          ยังไม่มีแท็กยอดนิยม
        </div>
      ) : (
        <div className="trending-tags-list">
          {tags.map((tag, i) => (
            <div 
              key={tag.id} 
              className="trending-tag-item"
              onClick={() => onTagClick(tag.name)}
            >
              <span className="tag-rank">#{i + 1}</span>
              <span className="tag-name">#{tag.name}</span>
              <span className="tag-count">{tag.poll_count} โพล</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== Notification Dropdown =====
function NotificationDropdown({ user, onClose }) {
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    setIsLoading(true)
    const { data } = await getUserNotifications(user.id, 20)
    if (data) setNotifications(data)
    setIsLoading(false)
  }

  const handleMarkAsRead = async (notifId) => {
    await markNotificationAsRead(notifId)
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n))
  }

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead(user.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  return (
    <div className="notification-dropdown" onClick={e => e.stopPropagation()}>
      <div className="notification-header">
        <h3>การแจ้งเตือน</h3>
        {notifications.some(n => !n.is_read) && (
          <button className="mark-all-read" onClick={handleMarkAllAsRead}>อ่านทั้งหมด</button>
        )}
      </div>
      <div className="notification-list">
        {isLoading ? (
          <div className="notification-loading">⏳ กำลังโหลด...</div>
        ) : notifications.length === 0 ? (
          <div className="notification-empty">ยังไม่มีการแจ้งเตือน</div>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id} 
              className={`notification-item ${!notif.is_read ? 'unread' : ''} ${notif.type === 'points_earned' ? 'success' : notif.type === 'points_lost' ? 'danger' : ''}`}
              onClick={() => handleMarkAsRead(notif.id)}
            >
              <div className="notification-message">{notif.message}</div>
              <div className="notification-time">{getTimeAgo(notif.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ===== Main Home Component =====
export default function Home() {
  const router = useRouter()
  const params = useParams()
  
  // Parse slug from URL: /sports → ['sports'], /tag/foo → ['tag', 'foo']
  const slug = params?.slug || []
  
  // Determine initial category and tag from URL
  const getInitialState = () => {
    if (slug.length === 0) return { category: 'home', tag: null }
    if (slug[0] === 'tag' && slug[1]) return { category: 'home', tag: decodeURIComponent(slug[1]) }
    if (categories.find(c => c.id === slug[0])) return { category: slug[0], tag: null }
    return { category: 'home', tag: null }
  }
  const initialState = getInitialState()
  
  // States
  const [darkMode, setDarkMode] = useState(false)
  const [activeCategory, setActiveCategory] = useState(initialState.category)
  const [activeTag, setActiveTag] = useState(initialState.tag)
  const [polls, setPolls] = useState([])
  const [userVotes, setUserVotes] = useState({})
  const [user, setUser] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPoll, setSelectedPoll] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedConfidence, setSelectedConfidence] = useState(50)
  const [selectedOption, setSelectedOption] = useState(null)
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [viewProfileUserId, setViewProfileUserId] = useState(null)
  const [liveBattles, setLiveBattles] = useState([])
  const [timeCapsules, setTimeCapsules] = useState([])
  const [showCreateLiveBattle, setShowCreateLiveBattle] = useState(false)
  const [showCreateTimeCapsule, setShowCreateTimeCapsule] = useState(false)
  const [showVerificationModal, setShowVerificationModal] = useState(false)

  // Info modals state
  const [showPostingGuidelines, setShowPostingGuidelines] = useState(false)
  const [showMemberPrivileges, setShowMemberPrivileges] = useState(false)
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false)
  const [showPWAInstall, setShowPWAInstall] = useState(false)

  // ===== Click Outside / Scroll to Close Dropdown =====
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMenu(false)
      }
    }
    
    const handleScroll = () => {
      if (showMenu) setShowMenu(false)
    }
    
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('scroll', handleScroll, true)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [showMenu])

  // More dropdown states
  const [showMoreDropdown, setShowMoreDropdown] = useState(false)
  const moreDropdownRef = useRef(null)
  const moreButtonRef = useRef(null)
  
  // Get visible and hidden categories
  const visibleCategories = categories.slice(0, VISIBLE_CATEGORIES)
  const hiddenCategories = categories.slice(VISIBLE_CATEGORIES)

  // Sync state with URL when slug changes
  useEffect(() => {
    const newState = getInitialState()
    setActiveCategory(newState.category)
    setActiveTag(newState.tag)
  }, [slug.join('/')])

  // Initial load
  useEffect(() => { 
    loadPolls()
    loadLiveBattles()
    loadTimeCapsules()
    checkAuthSession()
    const d = localStorage.getItem('kidwa-darkmode')
    if (d) setDarkMode(JSON.parse(d))
  }, [])

  // Auth session check
  const checkAuthSession = async () => {
    const { data: userData } = await getUserFromSession()
    if (userData) {
      setUser(userData)
      localStorage.setItem('kidwa-user', JSON.stringify(userData))
      const needsVerification = await checkNeedsVerification(userData.id)
      if (needsVerification) setShowVerificationModal(true)
    } else {
      const u = localStorage.getItem('kidwa-user')
      if (u) {
        const localUser = JSON.parse(u)
        if (!localUser.auth_id) setUser(localUser)
      }
    }
  }

  // Load user votes & notifications when user changes
  useEffect(() => { if (user) { loadUserVotes(); loadUnreadCount() }}, [user])
  
  // Dark mode persistence
  useEffect(() => { 
    localStorage.setItem('kidwa-darkmode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
    }
  }, [darkMode])

  // Poll selection effect
  useEffect(() => { 
    if (selectedPoll) { 
      const v = userVotes[selectedPoll.id]
      if (v) { setSelectedOption(v.optionId); setSelectedConfidence(v.confidence || 50) } 
      else { setSelectedOption(null); setSelectedConfidence(50) }
    }
  }, [selectedPoll, userVotes])
  
  // Auto-refresh Live Battles
  useEffect(() => {
    if (activeCategory === 'live' || activeCategory === 'home') {
      const interval = setInterval(() => loadLiveBattles(), 10000)
      return () => clearInterval(interval)
    }
  }, [activeCategory])

  // Click outside to close More dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMoreDropdown && 
          moreDropdownRef.current && 
          !moreDropdownRef.current.contains(e.target) &&
          moreButtonRef.current &&
          !moreButtonRef.current.contains(e.target)) {
        setShowMoreDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMoreDropdown])

  // Scroll to close More dropdown
  useEffect(() => {
    const handleScroll = () => {
      if (showMoreDropdown) setShowMoreDropdown(false)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showMoreDropdown])

  // Data loading functions
  const loadPolls = async () => { 
    setIsLoading(true)
    const { data } = await getPolls()
    if (data) setPolls(data.filter(p => p.poll_type !== 'time_capsule' && p.poll_type !== 'live_battle'))
    setIsLoading(false)
  }
  
  const loadLiveBattles = async () => { const { data } = await getLiveBattles(); if (data) setLiveBattles(data) }
  const loadTimeCapsules = async () => { const { data } = await getTimeCapsules(); if (data) setTimeCapsules(data) }
  const loadUserVotes = async () => { 
    if (!user) return
    const { data } = await getUserVotes(user.id)
    if (data) { 
      const m = {}
      data.forEach(v => { m[v.poll_id] = { optionId: v.option_id, confidence: v.confidence } })
      setUserVotes(m) 
    }
  }
  const loadUnreadCount = async () => { if (!user) return; const { count } = await getUnreadNotificationCount(user.id); setUnreadCount(count) }

  // Category change with URL update
  const handleCategoryChange = (catId) => {
    setActiveCategory(catId)
    setActiveTag(null)
    setShowMoreDropdown(false)
    
    // Update URL
    if (catId === 'home') {
      router.push('/', { scroll: false })
    } else {
      router.push(`/${catId}`, { scroll: false })
    }
  }

  // Tag click handler
  const handleTagClick = (tagName) => {
    setActiveTag(tagName)
    setActiveCategory('home')
    router.push(`/tag/${encodeURIComponent(tagName)}`, { scroll: false })
  }

  // Auth & Logout
  const handleLogout = async () => {
    await signOut()
    setUser(null)
    localStorage.removeItem('kidwa-user')
    setShowMenu(false)
  }

  // Vote handler
  const handleVote = async (pollId, optionId, confidence) => { 
    if (!user) { setShowAuthModal(true); return }
    const poll = polls.find(p => p.id === pollId) || liveBattles.find(p => p.id === pollId)
    if (poll && isExpired(poll.ends_at)) { alert('โพลนี้หมดเวลาแล้ว'); return }
    const { error } = await vote(user.id, pollId, optionId, confidence)
    if (!error) { 
      setUserVotes(prev => ({ ...prev, [pollId]: { optionId, confidence } }))
      await loadPolls()
      const totalVotes = (poll?.options?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0) + 1
      alert(`✅ บันทึกโหวตของคุณแล้ว\nตอนนี้มีผู้ร่วมโหวต ${totalVotes.toLocaleString()} คน`)
      await checkAndAwardCreatorPoints(pollId)
    }
  }

  const confirmVote = () => { 
    if (!selectedOption) { alert('กรุณาเลือกตัวเลือกก่อน'); return }
    handleVote(selectedPoll.id, selectedOption, selectedConfidence)
  }

  // Filter polls
  const filteredPolls = polls.filter(poll => { 
    // Tag filter
    if (activeTag) {
      const hasTag = poll.tags?.some(t => t.name.toLowerCase() === activeTag.toLowerCase())
      if (!hasTag) return false
    }
    // Category filter
    if (!activeTag && activeCategory !== 'home' && poll.category !== activeCategory) return false
    // Search filter
    if (searchQuery) { 
      const q = searchQuery.toLowerCase()
      const matchQuestion = poll.question.toLowerCase().includes(q)
      const matchTags = poll.tags?.some(t => t.name.toLowerCase().includes(q))
      const matchOptions = poll.options?.some(o => o.text.toLowerCase().includes(q))
      return matchQuestion || matchTags || matchOptions
    }
    return true 
  })
  
  const featuredPolls = filteredPolls.filter(p => p.featured).slice(0, 3)
  const latestPolls = [...filteredPolls].slice(0, 9)

  if (isLoading) return <div className={`loading-screen ${darkMode ? 'dark' : ''}`}><div className="loading-spinner" /><p>กำลังโหลด...</p></div>

  return (
    <div className={darkMode ? 'dark' : ''}>
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo" onClick={() => handleCategoryChange('home')}>คิดว่า..</div>
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="ค้นหา.." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="header-actions">
            {user ? (
              <>
                <button className="btn btn-create hide-mobile" onClick={() => { setShowCreatePoll(true); setShowMenu(false) }}>➕ สร้างโพล</button>
                <div className="notification-btn-wrapper hide-mobile">
                  <button className="notification-btn" onClick={() => { setShowNotifications(!showNotifications); setShowMenu(false) }}>
                    🔔
                    {unreadCount > 0 && <span className="notification-badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                  </button>
                  {showNotifications && <NotificationDropdown user={user} onClose={() => { setShowNotifications(false); loadUnreadCount() }} />}
                </div>
                <div className="user-badge hide-mobile" onClick={() => { setShowAccount(true); setShowMenu(false) }}>
                  {user.avatar_url ? <img src={user.avatar_url} alt={user.username} className="user-avatar-img" /> : <div className="user-avatar">{user.username[0].toUpperCase()}</div>}
                  <div>
                    <span style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {user.username}
                      {user.is_verified && <span className="verified-badge" title="ยืนยันตัวตนแล้ว"><svg viewBox="0 0 24 24" className="verified-check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{getReputationLevel(user.reputation).badge} {user.reputation} pt</div>
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
        
        {/* Mobile dropdown menu */}
        {showMenu && (
          <div className="dropdown-menu">
            {!user && (
              <>
                <button className="dropdown-item" onClick={() => { setShowAuthModal(true); setShowMenu(false) }}>เข้าสู่ระบบ</button>
                <button className="dropdown-item" onClick={() => { setShowAuthModal(true); setShowMenu(false) }}>สมัครสมาชิก</button>
                <div className="dropdown-divider"></div>
              </>
            )}
            {user && (
              <>
                <div className="dropdown-item user-info-mobile">
                  <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                  <div>
                    <span style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {user.username}
                      {user.is_verified && <span className="verified-badge"><svg viewBox="0 0 24 24" className="verified-check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{getReputationLevel(user.reputation).badge} {user.reputation} pt</div>
                  </div>
                </div>
                <button className="dropdown-item" onClick={() => { setShowNotifications(true); setShowMenu(false) }}>
                  การแจ้งเตือน {unreadCount > 0 && <span className="mobile-notif-badge">{unreadCount}</span>}
                </button>
                <button className="dropdown-item" onClick={() => { setShowAccount(true); setShowMenu(false) }}>บัญชีของฉัน</button>
                <button className="dropdown-item" onClick={() => { setShowCreatePoll(true); setShowMenu(false) }}>สร้างโพล</button>
                {user.is_admin && <button className="dropdown-item" onClick={() => { setShowAdminPanel(true); setShowMenu(false) }}>🔧 Admin Panel</button>}
                <div className="dropdown-divider"></div>
              </>
            )}
              <button className="dropdown-item" onClick={() => { setShowPostingGuidelines(true); setShowMenu(false) }}>คำแนะนำการโพสต์</button>
              <button className="dropdown-item" onClick={() => { setShowMemberPrivileges(true); setShowMenu(false) }}>สิทธิ์การใช้งานของสมาชิก</button>
              <button className="dropdown-item" onClick={() => { setShowPrivacyPolicy(true); setShowMenu(false) }}>นโยบายข้อมูลส่วนบุคคล</button>
              <button className="dropdown-item" onClick={() => { setShowPWAInstall(true); setShowMenu(false) }}>Download App คิดว่า..</button>
              <div className="dropdown-divider"></div>

            <button className="dropdown-item" onClick={() => { setDarkMode(!darkMode); setShowMenu(false) }}>{darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</button>
            {user && (
              <>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={handleLogout} style={{ color: 'var(--red)' }}>ออกจากระบบ</button>
              </>
            )}
          </div>
        )}
      </header>

      {/* Categories Navigation with More dropdown */}
      <nav className="categories">
        <div className="categories-content">
          {visibleCategories.map(cat => (
            <button 
              key={cat.id} 
              className={`category-btn ${activeCategory === cat.id && !activeTag ? 'active' : ''}`} 
              onClick={() => handleCategoryChange(cat.id)}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
          
          {/* More dropdown */}
          {hiddenCategories.length > 0 && (
            <div className="more-dropdown-container">
              <button 
                ref={moreButtonRef}
                className={`category-btn more-btn ${hiddenCategories.some(c => c.id === activeCategory) ? 'active' : ''}`}
                onClick={() => setShowMoreDropdown(!showMoreDropdown)}
              >
                {hiddenCategories.some(c => c.id === activeCategory) 
                  ? `${categories.find(c => c.id === activeCategory)?.icon} ${categories.find(c => c.id === activeCategory)?.name}` 
                  : '☰ เพิ่มเติม'
                }
                <span className="dropdown-arrow">{showMoreDropdown ? '▲' : '▼'}</span>
              </button>
              
              {showMoreDropdown && (
                <div ref={moreDropdownRef} className="more-dropdown">
                  {hiddenCategories.map(cat => (
                    <button 
                      key={cat.id} 
                      className={`more-dropdown-item ${activeCategory === cat.id ? 'active' : ''}`}
                      onClick={() => handleCategoryChange(cat.id)}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="main">
        {/* Sidebar - Trending Tags */}
        <aside className="sidebar">
          <TrendingTagsSection onTagClick={handleTagClick} darkMode={darkMode} />
        </aside>

        {/* Content */}
        <div className="content">
          {/* Tag filter indicator */}
          {activeTag && (
            <div className="tag-filter-indicator">
              <span>🏷️ แสดงโพลที่มีแท็ก: <strong>#{activeTag}</strong></span>
              <button onClick={() => { setActiveTag(null); router.push('/', { scroll: false }) }}>✕ ล้าง</button>
            </div>
          )}

          {/* Live Battle Section */}
          {activeCategory === 'live' ? (
            <section>
              <div className="section-header">
                <h2 className="section-title">⚡ Live Battle</h2>
                {user && (user.is_verified || user.is_admin) && (
                  <button className="btn btn-live-create" onClick={() => setShowCreateLiveBattle(true)}>⚡ สร้าง Live Battle</button>
                )}
              </div>
              {liveBattles.length > 0 ? (
                <div className="poll-grid">
                  {liveBattles.map(battle => (
                    <LiveBattleCard key={battle.id} poll={battle} onClick={() => setSelectedPoll(battle)} userVotes={userVotes} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">⚡</span>
                  <p>ยังไม่มี Live Battle ที่กำลังดำเนินอยู่</p>
                </div>
              )}
            </section>
          ) : activeCategory === 'timecapsule' ? (
            <section>
              <div className="section-header">
                <h2 className="section-title">💊 Time Capsule</h2>
                {user?.is_admin && <button className="btn btn-capsule-create" onClick={() => setShowCreateTimeCapsule(true)}>💊 สร้าง Time Capsule</button>}
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>ทำนายอนาคตระยะยาว 1-10 ปี</p>
              {timeCapsules.length > 0 ? (
                <div className="poll-grid">
                  {timeCapsules.map(capsule => (
                    <TimeCapsuleCard key={capsule.id} poll={capsule} onClick={() => setSelectedPoll(capsule)} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon">💊</span>
                  <p>ยังไม่มี Time Capsule</p>
                </div>
              )}
            </section>
          ) : filteredPolls.length > 0 ? (
            <>
              {/* Live Battle Preview on Home */}
              {activeCategory === 'home' && !activeTag && liveBattles.length > 0 && (
                <section>
                  <div className="section-header">
                    <h2 className="section-title">⚡ Live Battle กำลังดำเนินอยู่</h2>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleCategoryChange('live')}>ดูทั้งหมด →</button>
                  </div>
                  <div className="poll-grid">
                    {liveBattles.slice(0, 3).map(battle => (
                      <LiveBattleCard key={battle.id} poll={battle} onClick={() => setSelectedPoll(battle)} userVotes={userVotes} />
                    ))}
                  </div>
                </section>
              )}
              
              {/* Featured Polls */}
              {featuredPolls.length > 0 && !activeTag && (
                <section>
                  <h2 className="section-title">🌟 หัวข้อเด่น</h2>
                  <div className="poll-grid">
                    {featuredPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}
                  </div>
                </section>
              )}
              
              {/* Latest/Filtered Polls */}
              <section>
                <h2 className="section-title">
                  {activeTag 
                    ? `🏷️ #${activeTag}` 
                    : activeCategory === 'home' 
                      ? '🆕 ล่าสุด' 
                      : `${categories.find(c => c.id === activeCategory)?.icon} ${categories.find(c => c.id === activeCategory)?.name}`
                  }
                </h2>
                <div className="poll-grid">
                  {latestPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}
                </div>
              </section>
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <p>{activeTag ? `ไม่พบโพลที่มีแท็ก #${activeTag}` : 'ยังไม่มีโพลในหมวดนี้'}</p>
              {user && user.is_verified && <button className="btn btn-primary" onClick={() => setShowCreatePoll(true)}>➕ สร้างโพลแรก</button>}
            </div>
          )}
        </div>
      </main>

      {/* ===== MODALS ===== */}
      
      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={(userData) => { setUser(userData); localStorage.setItem('kidwa-user', JSON.stringify(userData)); setShowAuthModal(false) }} darkMode={darkMode} />}
      
      {/* Poll Detail Modal */}
      {selectedPoll && (
        <div className="modal-overlay" onClick={() => setSelectedPoll(null)}>
          <div className="modal" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPoll(null)}>✕</button>
            <div style={{ marginBottom: '1rem' }}>
              {selectedPoll.blind_mode && !isExpired(selectedPoll.ends_at) && <span className="blind-badge">🔒 Blind Mode</span>}
              {selectedPoll.poll_type === 'prediction' && <span className="prediction-badge" style={{ marginLeft: '0.5rem' }}>🎯 คิดว่าในอนาคต..</span>}
              {selectedPoll.poll_type === 'live_battle' && <span className="live-badge" style={{ marginLeft: '0.5rem' }}>⚡ Live</span>}
              {selectedPoll.resolved && <span className="resolved-badge" style={{ marginLeft: '0.5rem' }}>✅ เฉลยแล้ว</span>}
              {isExpired(selectedPoll.ends_at) && !selectedPoll.resolved && <span className="resolved-badge" style={{ marginLeft: '0.5rem' }}>⏰ รอเฉลย</span>}
            </div>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--text)' }}>{selectedPoll.question}</h2>
            <div style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              <span>👥 {selectedPoll.options?.reduce((sum, o) => sum + o.votes, 0).toLocaleString()} คนโหวต</span>
              <span style={{ marginLeft: '1rem' }}>⏱️ {getDaysRemaining(selectedPoll.ends_at)}</span>
            </div>
            
            {isExpired(selectedPoll.ends_at) && !selectedPoll.resolved && <div className="expired-notice">⏰ โพลนี้หมดเวลาแล้ว รอ Admin เฉลย</div>}
            {userVotes[selectedPoll.id] && <div className="voted-notice">✅ คุณโหวตแล้ว ({confidenceLevels.find(c => c.value === userVotes[selectedPoll.id].confidence)?.emoji} {confidenceLevels.find(c => c.value === userVotes[selectedPoll.id].confidence)?.label})</div>}
            
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
            
            {!userVotes[selectedPoll.id] && !isExpired(selectedPoll.ends_at) && user && selectedPoll.poll_type === 'prediction' && (
              <>
                <ConfidenceSelector selectedConfidence={selectedConfidence} onSelect={setSelectedConfidence} disabled={!selectedOption} user={user} stake={selectedConfidence} />
                <button className="btn btn-primary vote-cta" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }} onClick={confirmVote} disabled={!selectedOption}>
                  {selectedOption ? <>🎯 แสดงมุมมองนี้</> : <>👆 เลือกตัวเลือกก่อน</>}
                </button>
              </>
            )}
            
            {!userVotes[selectedPoll.id] && !isExpired(selectedPoll.ends_at) && user && (selectedPoll.poll_type === 'opinion' || selectedPoll.poll_type === 'live_battle') && (
              <button className="btn btn-primary vote-cta" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }} onClick={confirmVote} disabled={!selectedOption}>
                {selectedOption ? <>💬 โหวตเลย</> : <>👆 เลือกตัวเลือกก่อน</>}
              </button>
            )}
            
            {!user && !isExpired(selectedPoll.ends_at) && (
              <div onClick={() => { setSelectedPoll(null); setShowAuthModal(true) }} className="login-prompt">🔒 เข้าสู่ระบบเพื่อโหวต</div>
            )}
            
            <ShareButtons poll={selectedPoll} />
          </div>
        </div>
      )}
      
      {/* Create Poll Modal */}
      {showCreatePoll && <CreatePollModal onClose={() => setShowCreatePoll(false)} user={user} onSuccess={loadPolls} darkMode={darkMode} />}
      
      {/* Admin Panel */}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} darkMode={darkMode} onRefresh={loadPolls} />}
      
      {/* Account Modal */}
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} user={user} darkMode={darkMode} onUpdateUser={setUser} />}
      
      {/* Live Battle & Time Capsule Modals */}
      {showCreateLiveBattle && <CreateLiveBattleModal onClose={() => setShowCreateLiveBattle(false)} user={user} onSuccess={() => { loadLiveBattles(); handleCategoryChange('live') }} darkMode={darkMode} />}
      {showCreateTimeCapsule && <CreateTimeCapsuleModal onClose={() => setShowCreateTimeCapsule(false)} user={user} onSuccess={() => { loadTimeCapsules(); handleCategoryChange('timecapsule') }} darkMode={darkMode} />}
      
      {/* Verification Modal */}
      {showVerificationModal && user && (
        <VerificationModal
          onClose={() => setShowVerificationModal(false)}
          user={user}
          onSuccess={(updatedUser) => {
            setUser(updatedUser)
            localStorage.setItem('kidwa-user', JSON.stringify(updatedUser))
            setShowVerificationModal(false)
          }}
          darkMode={darkMode}
        />
      )}
      
      {/* User Profile Modal */}
      {viewProfileUserId && (
        <UserProfileModal 
          userId={viewProfileUserId} 
          currentUser={user} 
          onClose={() => setViewProfileUserId(null)} 
          darkMode={darkMode} 
        />
      )}
      
      {/* Mobile Notification Modal */}
      {showNotifications && (
        <div className="modal-overlay" onClick={() => { setShowNotifications(false); loadUnreadCount() }}>
          <div className={`modal notification-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setShowNotifications(false); loadUnreadCount() }}>✕</button>
            <NotificationDropdown user={user} onClose={() => { setShowNotifications(false); loadUnreadCount() }} />
          </div>
        </div>
      )}
    </div>
  )
}
