'use client'

import { useState, useEffect } from 'react'
import { 
  supabase, getPolls, createUser, getUserByUsername, vote, getUserVotes, 
  createPoll, getTags, createTag, getAllPollsAdmin, getPendingPolls, resolvePoll, 
  deletePoll, getAllUsers, toggleBanUser, toggleFeatured, getAdminStats,
  getUserProfile, getUserVoteHistory, getUserCreatedPolls, calculateBadges,
  getSeasonalLeaderboard, getLifetimeLeaderboard, getWeeklyLeaderboard,
  getUserNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead,
  followUser, unfollowUser, isFollowing, getFollowers, getFollowing, getFollowCounts,
  uploadAvatar, getUserPublicProfile, searchUsers,
  createTimeCapsule, getTimeCapsules,
  createLiveBattle, getLiveBattles, endLiveBattle, subscribeLiveBattle, unsubscribeLiveBattle,
  signUpWithEmail, signInWithEmail, signInWithMagicLink, signOut, getSession, getUserFromSession, 
  resetPassword, updatePassword, onAuthStateChange, signInWithGoogle,
  submitVerification, skipVerification, checkNeedsVerification, getUserPollLimit, findSimilarPolls, checkAndAwardCreatorPoints,
  markLeaderboardViewed, markProfileInsightsViewed, isSilentThinker,
  getThailandNow, toThailandTime, formatThaiDate, formatThaiTime, getThailandSeason
} from '@/lib/supabase'

const categories = [
  { id: 'home', name: 'หน้าแรก', icon: '🏠' },
  { id: 'live', name: 'Live Battle', icon: '⚡' },
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

const reputationLevels = [
  { min: 0, max: 500, name: 'นักศึกษา', badge: '🌱' },
  { min: 501, max: 1500, name: 'ผู้เริ่มต้น', badge: '🎯' },
  { min: 1501, max: 3000, name: 'นักวิเคราะห์', badge: '🔮' },
  { min: 3001, max: 5000, name: 'ผู้เชี่ยวชาญ', badge: '⭐' },
  { min: 5001, max: 10000, name: 'ปรมาจารย์', badge: '🏆' },
  { min: 10001, max: Infinity, name: 'ตำนาน', badge: '👑' }
]

const confidenceLevels = [
  { value: 20, label: 'ไม่ค่อยมั่นใจ', emoji: '🥶', color: '#22c55e', description: 'ผลกระทบต่ำ', conviction: 'low' },
  { value: 50, label: 'โหวตเลย', emoji: '🥺', color: '#f59e0b', description: 'ผลกระทบปานกลาง', conviction: 'medium' },
  { value: 100, label: 'มั่นใจมาก', emoji: '😎', color: '#ef4444', description: 'ผลกระทบสูง', conviction: 'high' }
]

const getReputationLevel = (rep) => reputationLevels.find(l => rep >= l.min && rep <= l.max) || reputationLevels[0]

// =====================================================
// TIME FUNCTIONS - ALL USE THAILAND TIME (UTC+7)
// =====================================================

const getDaysRemaining = (endDate) => {
  const end = toThailandTime(endDate)
  const now = getThailandNow()
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'หมดเวลาแล้ว'
  if (diff === 0) return 'วันสุดท้าย!'
  return `เหลืออีก ${diff} วัน`
}

const isExpired = (endDate) => getThailandNow() > toThailandTime(endDate)

const getTopTwo = (options) => {
  if (!options || options.length === 0) return [null, null]
  const sorted = [...options].sort((a, b) => b.votes - a.votes)
  return [sorted[0], sorted[1] || sorted[0]]
}

const getTimeAgo = (date) => {
  const now = getThailandNow()
  const past = toThailandTime(date)
  const diffMs = now - past
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return 'เมื่อสักครู่'
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`
  return formatThaiDate(past)
}

// สำหรับ Time Capsule - แสดงเวลาเป็นปี/เดือน (Thailand time)
const getYearsRemaining = (endDate) => {
  const end = toThailandTime(endDate)
  const now = getThailandNow()
  const diffMs = end - now
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)
  
  if (diffDays < 0) return 'เปิดแล้ว!'
  if (diffYears >= 1) return `เปิดใน ${diffYears} ปี ${diffMonths % 12} เดือน`
  if (diffMonths >= 1) return `เปิดใน ${diffMonths} เดือน`
  return `เปิดใน ${diffDays} วัน`
}

// สำหรับ Live Battle - แสดงเวลาเป็นนาที/วินาที (Thailand time)
const getLiveTimeRemaining = (endDate) => {
  const end = toThailandTime(endDate)
  const now = getThailandNow()
  const diffMs = end - now
  
  if (diffMs < 0) return { text: 'จบแล้ว', expired: true }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000)
  
  if (hours > 0) return { text: `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`, expired: false }
  return { text: `${mins}:${secs.toString().padStart(2, '0')}`, expired: false }
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

function ShareButtons({ poll }) {
  const [copied, setCopied] = useState(false)
  const baseUrl = 'https://i-kidwa.com'
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

// ===== Live Battle Card with Thailand Time =====
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
  const isOpened = isExpired(poll.ends_at)

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
          <span>👥 {totalVotes.toLocaleString()} คนทาย</span>
          <span>📅 หมดเขต {formatThaiDate(poll.ends_at, { year: 'numeric', month: 'long' })}</span>
        </div>
      </div>
    </div>
  )
}

// ===== Leaderboard Component - Default Seasonal with Toggle =====
function LeaderboardSection({ darkMode, currentUser, onViewProfile }) {
  const [activeTab, setActiveTab] = useState('season') // Default to seasonal
  const [leaderboard, setLeaderboard] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [activeTab])

  // Track leaderboard view for silent thinker detection
  useEffect(() => {
    if (currentUser && !currentUser.has_viewed_leaderboard) {
      markLeaderboardViewed(currentUser.id)
    }
  }, [currentUser])

  const loadLeaderboard = async () => {
    setIsLoading(true)
    let data = []
    
    if (activeTab === 'season') {
      const result = await getSeasonalLeaderboard(10)
      data = result.data || []
    } else if (activeTab === 'week') {
      const result = await getWeeklyLeaderboard(10)
      data = result.data || []
    } else {
      // lifetime
      const result = await getLifetimeLeaderboard(10)
      data = result.data || []
    }
    
    setLeaderboard(data)
    setIsLoading(false)
  }

  const getRankEmoji = (index) => ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][index] || `#${index + 1}`

  const getPointsDisplay = (item) => {
    if (activeTab === 'season') {
      const pts = item.seasonal_reputation || 0
      return `${pts >= 0 ? '+' : ''}${pts}`
    }
    if (activeTab === 'week') {
      const pts = item.weeklyPoints || 0
      return `${pts >= 0 ? '+' : ''}${pts}`
    }
    return `${item.reputation}`
  }

  // Get current season label
  const currentSeason = getThailandSeason()
  const [year, month] = currentSeason.split('-')
  const thaiMonths = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const seasonLabel = `${thaiMonths[parseInt(month)]} ${parseInt(year) + 543}`

  return (
    <div className="sidebar-card">
      <h3 className="sidebar-title">🏆 Leaderboard</h3>
      <div className="leaderboard-tabs">
        <button className={`lb-tab ${activeTab === 'season' ? 'active' : ''}`} onClick={() => setActiveTab('season')}>
          เดือนนี้
        </button>
        <button className={`lb-tab ${activeTab === 'week' ? 'active' : ''}`} onClick={() => setActiveTab('week')}>
          สัปดาห์
        </button>
        <button className={`lb-tab ${activeTab === 'lifetime' ? 'active' : ''}`} onClick={() => setActiveTab('lifetime')}>
          ตลอดกาล
        </button>
      </div>
      
      {activeTab === 'season' && (
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '0.5rem' }}>
          ซีซั่น: {seasonLabel}
        </div>
      )}
      
      <div className="leaderboard-list">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>⏳</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {activeTab === 'season' ? 'ยังไม่มีข้อมูลเดือนนี้' : activeTab === 'week' ? 'ยังไม่มีข้อมูลสัปดาห์นี้' : 'ยังไม่มีข้อมูล'}
          </div>
        ) : (
          leaderboard.map((item, i) => (
            <div 
              key={item.id} 
              className="leaderboard-item"
              onClick={() => onViewProfile && onViewProfile(item.id)}
              style={{ cursor: 'pointer' }}
            >
              <span className="lb-rank">{getRankEmoji(i)}</span>
              <span className="lb-name">
                {item.username}
                {item.is_verified && <span className="verified-badge"><svg viewBox="0 0 24 24" className="verified-check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>}
              </span>
              <span className={`lb-points ${activeTab !== 'lifetime' ? ((activeTab === 'season' ? (item.seasonal_reputation || 0) : (item.weeklyPoints || 0)) >= 0 ? 'positive' : 'negative') : ''}`}>
                {getPointsDisplay(item)}
              </span>
            </div>
          ))
        )}
      </div>
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

    if (password !== confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน')
      return
    }

    if (password.length < 8) {
      setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
      return
    }

    if (username.length < 3) {
      setError('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร')
      return
    }

    setIsLoading(true)

    const { data, error } = await signUpWithEmail(email, password, username)
    
    if (error) {
      setError(error.message)
    } else {
      setSuccess('✅ สำเร็จ! กรุณาตรวจสอบอีเมลเพื่อยืนยันบัญชี')
    }
    
    setIsLoading(false)
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { error } = await signInWithMagicLink(email)
    
    if (error) {
      setError(error.message)
    } else {
      setSuccess('✅ ส่งลิงก์ไปยังอีเมลแล้ว! กรุณาตรวจสอบอีเมลของคุณ')
    }
    
    setIsLoading(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const { error } = await resetPassword(email)
    
    if (error) {
      setError(error.message)
    } else {
      setSuccess('✅ ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว!')
    }
    
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
                <div className="form-group">
                  <label>📧 อีเมล</label>
                  <input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>🔒 รหัสผ่าน</label>
                  <input type="password" className="form-input" placeholder="รหัสผ่าน" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <button type="button" className="auth-link" onClick={() => setMode('forgot')}>ลืมรหัสผ่าน?</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                  {isLoading ? '⏳ กำลังเข้าสู่ระบบ...' : '🚀 เข้าสู่ระบบ'}
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label>👤 ชื่อผู้ใช้</label>
                  <input type="text" className="form-input" placeholder="ชื่อที่แสดงในเว็บ" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={20} />
                </div>
                <div className="form-group">
                  <label>📧 อีเมล</label>
                  <input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>🔒 รหัสผ่าน</label>
                  <input type="password" className="form-input" placeholder="อย่างน้อย 8 ตัวอักษร" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
                </div>
                <div className="form-group">
                  <label>🔒 ยืนยันรหัสผ่าน</label>
                  <input type="password" className="form-input" placeholder="พิมพ์รหัสผ่านอีกครั้ง" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                </div>
                
                <p className="auth-bonus">🎁 สมัครใหม่ได้ 1,000 Point เริ่มต้น!</p>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                  {isLoading ? '⏳ กำลังสมัคร...' : '✨ สมัครสมาชิก'}
                </button>
              </form>
            )}

            {mode === 'magic' && (
              <form onSubmit={handleMagicLink}>
                <div className="form-group">
                  <label>📧 อีเมล</label>
                  <input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <p className="auth-hint">เราจะส่งลิงก์สำหรับเข้าสู่ระบบไปยังอีเมลของคุณ ไม่ต้องจำรหัสผ่าน!</p>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                  {isLoading ? '⏳ กำลังส่ง...' : '📨 ส่ง Magic Link'}
                </button>
              </form>
            )}

            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword}>
                <div className="form-group">
                  <label>📧 อีเมล</label>
                  <input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>
                  {isLoading ? '⏳ กำลังส่ง...' : '🔑 รีเซ็ตรหัสผ่าน'}
                </button>
              </form>
            )}

            <div className="auth-divider"><span>หรือ</span></div>

            {mode !== 'magic' && (
              <button type="button" className="btn btn-magic btn-full" onClick={() => { setMode('magic'); setError(''); setSuccess('') }}>
                ✨ เข้าสู่ระบบด้วย Magic Link
              </button>
            )}

            <button type="button" className="btn btn-google btn-full" onClick={async () => {
              setIsLoading(true)
              const { error } = await signInWithGoogle()
              if (error) {
                setError(error.message)
                setIsLoading(false)
              }
            }} disabled={isLoading}>
              <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: '8px' }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
            </button>

            <div className="auth-switch">
              {mode === 'login' && <p>ยังไม่มีบัญชี? <button type="button" onClick={() => { setMode('register'); setError(''); setSuccess('') }}>สมัครสมาชิก</button></p>}
              {mode === 'register' && <p>มีบัญชีแล้ว? <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>เข้าสู่ระบบ</button></p>}
              {(mode === 'magic' || mode === 'forgot') && <p><button type="button" onClick={() => { setMode('login'); setError(''); setSuccess('') }}>← กลับไปหน้าเข้าสู่ระบบ</button></p>}
            </div>
          </>
        )}

        {success && (
          <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>
            ปิด
          </button>
        )}
      </div>
    </div>
  )
}

// ===== Create Poll Modal =====
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
  const [pollLimit, setPollLimit] = useState({ canCreate: true, used: 0, limit: 1, remaining: 1 })
  const [similarPolls, setSimilarPolls] = useState([])
  const [showSimilarWarning, setShowSimilarWarning] = useState(false)
  const [isCheckingSimilar, setIsCheckingSimilar] = useState(false)
  const [similarCheckDone, setSimilarCheckDone] = useState(false)

  useEffect(() => { 
    loadTags()
    loadPollLimit()
    const d = getThailandNow()
    d.setDate(d.getDate() + 7)
    setEndsAt(d.toISOString().split('T')[0]) 
  }, [])

  useEffect(() => {
    if (pollMode === 'prediction') {
      setBlindMode(true)
    } else {
      setBlindMode(false)
    }
  }, [pollMode])

  const loadTags = async () => { 
    const { data } = await getTags()
    if (data) setAvailableTags(data) 
  }

  const loadPollLimit = async () => {
    const limit = await getUserPollLimit(user.id)
    setPollLimit(limit)
  }

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (question.trim().length > 10) {
        setIsCheckingSimilar(true)
        const { data } = await findSimilarPolls(question)
        setSimilarPolls(data || [])
        setIsCheckingSimilar(false)
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
    if (!tag) { 
      const { data } = await createTag(tagInput.trim())
      if (data) { tag = data; setAvailableTags([...availableTags, data]) }
    }
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

    if (similarPolls.length > 0 && !similarCheckDone) {
      setShowSimilarWarning(true)
      return
    }

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
    if (error) {
      alert('เกิดข้อผิดพลาด')
    } else { 
      alert('🎉 สร้างโพลสำเร็จ!') 
      onSuccess()
      onClose()
    }
  }

  const handleContinueAfterWarning = () => {
    setSimilarCheckDone(true)
    setShowSimilarWarning(false)
  }

  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.find(t => t.id === tag.id)
  ).slice(0, 5)

  if (!pollLimit.canCreate) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className={`modal create-poll-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>✕</button>
          <div className="poll-limit-exceeded">
            <span className="limit-icon">⏰</span>
            <h2>ถึงขีดจำกัดแล้ว</h2>
            <p>คุณสร้างโพลครบ {pollLimit.limit} โพลแล้ววันนี้</p>
            <p className="limit-reset">กลับมาสร้างใหม่ได้พรุ่งนี้ 00:00 น.</p>
            
            {!pollLimit.isVerified && (
              <div className="verify-upsell">
                <p>✓ <strong>ยืนยันตัวตน</strong> เพื่อสร้างได้ 3 โพล/วัน!</p>
              </div>
            )}
            
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
        
        <div className="poll-limit-indicator">
          <span>📊 โควต้าวันนี้: {pollLimit.remaining}/{pollLimit.limit} โพล</span>
          {!pollLimit.isVerified && <span className="verify-hint">✓ ยืนยันตัวตนเพื่อได้ 3 โพล/วัน</span>}
        </div>

        {showSimilarWarning && (
          <div className="similar-polls-warning">
            <div className="warning-header">
              <span>⚠️</span>
              <span>พบหัวข้อที่คล้ายกัน</span>
            </div>
            <p className="warning-text">เราพบหัวข้อที่อาจซ้ำกับที่คุณกำลังสร้าง</p>
            <div className="warning-actions">
              <button className="btn btn-secondary" onClick={handleContinueAfterWarning}>
                🆕 สร้างหัวข้อใหม่ต่อ
              </button>
            </div>
          </div>
        )}

        {!showSimilarWarning && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>🎯 ประเภทโพล</label>
              <div className="poll-mode-selector">
                <button 
                  type="button" 
                  className={`poll-mode-btn ${pollMode === 'prediction' ? 'active' : ''}`}
                  onClick={() => setPollMode('prediction')}
                >
                  <span className="mode-icon">🔮</span>
                  <span className="mode-title">ทำนายอนาคต</span>
                  <span className="mode-desc">มีคำตอบถูกเพียงคำตอบเดียว • Blind Mode</span>
                </button>
                <button 
                  type="button" 
                  className={`poll-mode-btn ${pollMode === 'opinion' ? 'active' : ''}`}
                  onClick={() => setPollMode('opinion')}
                >
                  <span className="mode-icon">💭</span>
                  <span className="mode-title">คุณคิดว่า..</span>
                  <span className="mode-desc">ความชอบ/ความคิดเห็น</span>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>❓ คำถาม</label>
              <input 
                type="text" 
                className={`form-input ${errors.question ? 'error' : ''}`} 
                placeholder={pollMode === 'prediction' ? 'เช่น ใครจะชนะเลือกตั้ง 2026?' : 'เช่น คุณชอบไปสวนสนุกที่ไหนมากกว่ากัน?'} 
                value={question} 
                onChange={(e) => setQuestion(e.target.value)} 
                maxLength={200} 
              />
              {errors.question && <span className="error-text">{errors.question}</span>}
              <span className="char-count">{question.length}/200</span>
              
              {isCheckingSimilar && <span className="checking-similar">🔍 กำลังตรวจสอบ...</span>}
              {!isCheckingSimilar && similarPolls.length > 0 && !similarCheckDone && (
                <div className="similar-preview">
                  <span className="similar-icon">⚠️</span>
                  <span>พบ {similarPolls.length} โพลที่คล้ายกัน</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>📋 ตัวเลือก (2-6 ตัว)</label>
              {options.map((opt, index) => (
                <div key={index} className="option-input-row">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder={`ตัวเลือกที่ ${index + 1}`} 
                    value={opt} 
                    onChange={(e) => updateOption(index, e.target.value)} 
                    maxLength={100} 
                  />
                  {options.length > 2 && (
                    <button type="button" className="remove-option-btn" onClick={() => removeOption(index)}>✕</button>
                  )}
                </div>
              ))}
              {errors.options && <span className="error-text">{errors.options}</span>}
              {options.length < 6 && (
                <button type="button" className="add-option-btn" onClick={addOption}>+ เพิ่มตัวเลือก</button>
              )}
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
              <div className="tags-selected">
                {selectedTags.map(tag => (
                  <span key={tag.id} className="tag-chip">
                    #{tag.name}
                    <button type="button" onClick={() => setSelectedTags(selectedTags.filter(t => t.id !== tag.id))}>✕</button>
                  </span>
                ))}
              </div>
              <div className="tag-input-wrapper">
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="พิมพ์แท็กแล้วกด Enter" 
                  value={tagInput} 
                  onChange={(e) => setTagInput(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() }}} 
                />
                {tagInput && <button type="button" className="add-tag-btn" onClick={addTag}>เพิ่ม</button>}
              </div>
              {filteredTags.length > 0 && tagInput && (
                <div className="tag-suggestions">
                  {filteredTags.map(tag => (
                    <button 
                      key={tag.id} 
                      type="button" 
                      className="tag-suggestion" 
                      onClick={() => { 
                        if (selectedTags.length < 5 && !selectedTags.find(t => t.id === tag.id)) 
                          setSelectedTags([...selectedTags, tag]) 
                      }}
                    >
                      #{tag.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label>📅 วันหมดเวลา</label>
              <input 
                type="date" 
                className={`form-input ${errors.endsAt ? 'error' : ''}`} 
                value={endsAt} 
                onChange={(e) => setEndsAt(e.target.value)} 
                min={new Date().toISOString().split('T')[0]} 
              />
              {errors.endsAt && <span className="error-text">{errors.endsAt}</span>}
            </div>

            {pollMode === 'prediction' && (
              <div className="blind-mode-info">
                <span className="blind-icon">🔒</span>
                <div className="blind-text">
                  <strong>Blind Mode เปิดอัตโนมัติ</strong>
                  <span>ผู้คนจะไม่สามารถเห็นผลโหวตได้จนกว่าจะเฉลย</span>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? '⏳ กำลังสร้าง...' : 'สร้างโพล'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ===== Main App =====
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
  const [selectedConfidence, setSelectedConfidence] = useState(50)
  const [selectedOption, setSelectedOption] = useState(null)
  const [showCreatePoll, setShowCreatePoll] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [liveBattles, setLiveBattles] = useState([])
  const [timeCapsules, setTimeCapsules] = useState([])
  const [viewProfileUserId, setViewProfileUserId] = useState(null)

  useEffect(() => { 
    loadPolls(); 
    loadLiveBattles(); 
    loadTimeCapsules(); 
    checkAuthSession();
    const d = localStorage.getItem('kidwa-darkmode'); 
    if (d) setDarkMode(JSON.parse(d)) 
    
    const optionsChannel = supabase
      .channel('options-changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'options' }, 
        (payload) => {
          setPolls(prev => prev.map(poll => ({
            ...poll,
            options: poll.options?.map(opt => 
              opt.id === payload.new.id 
                ? { ...opt, votes: payload.new.votes }
                : opt
            )
          })))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(optionsChannel)
    }
  }, [])

  const checkAuthSession = async () => {
    const { data: userData } = await getUserFromSession()
    if (userData) {
      setUser(userData)
      localStorage.setItem('kidwa-user', JSON.stringify(userData))
    } else {
      const u = localStorage.getItem('kidwa-user')
      if (u) {
        const localUser = JSON.parse(u)
        if (!localUser.auth_id) {
          setUser(localUser)
        }
      }
    }
  }

  useEffect(() => { if (user) { loadUserVotes(); loadUnreadCount() }}, [user])
  useEffect(() => { 
    localStorage.setItem('kidwa-darkmode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [darkMode])

  useEffect(() => { 
    if (selectedPoll) { 
      const v = userVotes[selectedPoll.id]
      if (v) { 
        setSelectedOption(v.optionId)
        setSelectedConfidence(v.confidence || 50) 
      } else { 
        setSelectedOption(null)
        setSelectedConfidence(50) 
      }
    }
  }, [selectedPoll, userVotes])
  
  useEffect(() => {
    if (activeCategory === 'live' || activeCategory === 'home') {
      const interval = setInterval(() => {
        loadLiveBattles()
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [activeCategory])

  const loadPolls = async () => { setIsLoading(true); const { data } = await getPolls(); if (data) setPolls(data.filter(p => p.poll_type !== 'time_capsule' && p.poll_type !== 'live_battle')); setIsLoading(false) }
  const loadLiveBattles = async () => { const { data } = await getLiveBattles(); if (data) setLiveBattles(data) }
  const loadTimeCapsules = async () => { const { data } = await getTimeCapsules(); if (data) setTimeCapsules(data) }
  const loadUserVotes = async () => { if (!user) return; const { data } = await getUserVotes(user.id); if (data) { const m = {}; data.forEach(v => { m[v.poll_id] = { optionId: v.option_id, confidence: v.confidence } }); setUserVotes(m) }}
  const loadUnreadCount = async () => { if (!user) return; const { count } = await getUnreadNotificationCount(user.id); setUnreadCount(count) }

  const handleLogout = async () => {
    await signOut()
    setUser(null)
    localStorage.removeItem('kidwa-user')
    setShowMenu(false)
  }

  const handleVote = async (pollId, optionId, confidence) => { 
    if (!user) { setShowAuthModal(true); return }
    const poll = polls.find(p => p.id === pollId)
    if (poll && isExpired(poll.ends_at)) { alert('โพลนี้หมดเวลาแล้ว'); return }
    const { error } = await vote(user.id, pollId, optionId, confidence)
    if (!error) { 
      setUserVotes(prev => ({ ...prev, [pollId]: { optionId, confidence } }))
      await loadPolls()
      
      const updatedPoll = polls.find(p => p.id === pollId)
      const totalVotes = (updatedPoll?.options?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0) + 1
      
      // Silent thinker: neutral confirmation without scores
      if (isSilentThinker(user)) {
        alert(`✓ บันทึกโหวตของคุณแล้ว`)
      } else {
        alert(`✅ บันทึกการโหวตของคุณแล้ว\nตอนนี้มีผู้ร่วมโหวต ${totalVotes.toLocaleString()} คน`)
      }
      
      await checkAndAwardCreatorPoints(pollId)
    }
  }

  const confirmVote = () => { 
    if (!selectedOption) { alert('กรุณาเลือกตัวเลือกก่อน'); return }
    handleVote(selectedPoll.id, selectedOption, selectedConfidence) 
  }

  const filteredPolls = polls.filter(poll => { 
    if (activeCategory !== 'home' && poll.category !== activeCategory) return false; 
    if (searchQuery) { 
      const q = searchQuery.toLowerCase(); 
      const matchQuestion = poll.question.toLowerCase().includes(q);
      const matchTags = poll.tags?.some(t => t.name.toLowerCase().includes(q));
      const matchOptions = poll.options?.some(o => o.text.toLowerCase().includes(q));
      return matchQuestion || matchTags || matchOptions;
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
          <div className="search-box"><span className="search-icon">🔍</span><input type="text" placeholder="ค้นหา.." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
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
                <div className="user-badge hide-mobile" onClick={() => setShowMenu(false)}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="user-avatar-img" />
                  ) : (
                    <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                  )}
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
              <><button className="btn btn-secondary hide-mobile" onClick={() => setShowAuthModal(true)}>เข้าสู่ระบบ</button><button className="btn btn-primary hide-mobile" onClick={() => setShowAuthModal(true)}>สมัครสมาชิก</button></>
            )}
            <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>☰</button>
          </div>
        </div>
        {showMenu && (
          <div className="dropdown-menu">
            {!user && <><button className="dropdown-item" onClick={() => { setShowAuthModal(true); setShowMenu(false) }}>เข้าสู่ระบบ</button><button className="dropdown-item" onClick={() => { setShowAuthModal(true); setShowMenu(false) }}>สมัครสมาชิก</button><div className="dropdown-divider"></div></>}
            {user && <>
              <div className="dropdown-item user-info-mobile">
                <div className="user-avatar">{user.username[0].toUpperCase()}</div>
                <div>
                  <span style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px' }}>{user.username}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{getReputationLevel(user.reputation).badge} {user.reputation} pt</div>
                </div>
              </div>
              <button className="dropdown-item" onClick={() => { setShowNotifications(true); setShowMenu(false) }}>การแจ้งเตือน {unreadCount > 0 && <span className="mobile-notif-badge">{unreadCount}</span>}</button>
              <button className="dropdown-item" onClick={() => { setShowCreatePoll(true); setShowMenu(false) }}>สร้างโพล</button>
              <div className="dropdown-divider"></div>
            </>}
            <button className="dropdown-item" onClick={() => { setDarkMode(!darkMode); setShowMenu(false) }}>{darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</button>
            {user && <><div className="dropdown-divider"></div><button className="dropdown-item" onClick={handleLogout} style={{ color: 'var(--red)' }}>ออกจากระบบ</button></>}
          </div>
        )}
      </header>

      <nav className="categories"><div className="categories-content">{categories.map(cat => <button key={cat.id} className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`} onClick={() => setActiveCategory(cat.id)}>{cat.icon} {cat.name}</button>)}</div></nav>

      <main className="main">
        <aside className="sidebar">
          <LeaderboardSection darkMode={darkMode} currentUser={user} onViewProfile={(userId) => setViewProfileUserId(userId)} />
        </aside>

        <div className="content">
          {activeCategory === 'live' ? (
            <section>
              <div className="section-header">
                <h2 className="section-title">⚡ Live Battle</h2>
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
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>ทำนายอนาคตระยะยาว 1-10 ปี • Blind Mode จนกว่าจะถึงวันเปิด</p>
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
              {activeCategory === 'home' && liveBattles.length > 0 && (
                <section>
                  <div className="section-header">
                    <h2 className="section-title">⚡ Live Battle กำลังดำเนินอยู่</h2>
                    <button className="btn btn-sm btn-secondary" onClick={() => setActiveCategory('live')}>ดูทั้งหมด →</button>
                  </div>
                  <div className="poll-grid">
                    {liveBattles.slice(0, 3).map(battle => (
                      <LiveBattleCard key={battle.id} poll={battle} onClick={() => setSelectedPoll(battle)} userVotes={userVotes} />
                    ))}
                  </div>
                </section>
              )}
              {featuredPolls.length > 0 && <section><h2 className="section-title">🔥 หัวข้อเด่น</h2><div className="poll-grid">{featuredPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}</div></section>}
              <section><h2 className="section-title">{activeCategory === 'home' ? '🆕 ล่าสุด' : `${categories.find(c => c.id === activeCategory)?.icon} ${categories.find(c => c.id === activeCategory)?.name}`}</h2><div className="poll-grid">{latestPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}</div></section>
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">🔍</span>
              <p>ยังไม่มีโพลในหมวดนี้</p>
              {user && <button className="btn btn-primary" onClick={() => setShowCreatePoll(true)}>➕ สร้างโพลแรก</button>}
            </div>
          )}
        </div>
      </main>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={(userData) => { setUser(userData); localStorage.setItem('kidwa-user', JSON.stringify(userData)); setShowAuthModal(false) }} darkMode={darkMode} />}

      {selectedPoll && (
        <div className="modal-overlay" onClick={() => setSelectedPoll(null)}>
          <div className="modal" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedPoll(null)}>✕</button>
            <div style={{ marginBottom: '1rem' }}>
              {selectedPoll.blind_mode && !isExpired(selectedPoll.ends_at) && <span className="blind-badge">🔒 Blind Mode</span>}
              {selectedPoll.poll_type === 'prediction' && <span className="prediction-badge" style={{ marginLeft: '0.5rem' }}>🎯 โหวต</span>}
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
                  {selectedOption ? <>🎯 แสดงโหวตนี้</> : <>👆 เลือกตัวเลือกก่อน</>}
                </button>
              </>
            )}
            {!userVotes[selectedPoll.id] && !isExpired(selectedPoll.ends_at) && user && selectedPoll.poll_type !== 'prediction' && (
              <button className="btn btn-primary vote-cta" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }} onClick={confirmVote} disabled={!selectedOption}>
                {selectedOption ? <>💬 แสดงความคิดเห็น</> : <>👆 เลือกตัวเลือกก่อน</>}
              </button>
            )}
            {!user && !isExpired(selectedPoll.ends_at) && <div onClick={() => { setSelectedPoll(null); setShowAuthModal(true) }} className="login-prompt">🔒 เข้าสู่ระบบเพื่อโหวต</div>}
            
            <ShareButtons poll={selectedPoll} />
          </div>
        </div>
      )}

      {showCreatePoll && <CreatePollModal onClose={() => setShowCreatePoll(false)} user={user} onSuccess={loadPolls} darkMode={darkMode} />}
      
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
