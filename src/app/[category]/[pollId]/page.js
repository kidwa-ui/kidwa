'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase, getUserFromSession } from '@/lib/supabase'

// ===== Helper Functions =====
const getDaysRemaining = (endDate) => {
  const end = new Date(endDate)
  const now = new Date()
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'หมดเวลาแล้ว'
  if (diff === 0) return 'วันสุดท้าย!'
  return `เหลืออีก ${diff} วัน`
}

const isExpired = (endDate) => new Date() > new Date(endDate)

const getLiveTimeRemaining = (endDate) => {
  const end = new Date(endDate)
  const now = new Date()
  const diffMs = end.getTime() - now.getTime()
  
  if (diffMs < 0) return { text: 'จบแล้ว', expired: true }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000)
  
  if (hours > 0) return { text: `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`, expired: false }
  return { text: `${mins}:${secs.toString().padStart(2, '0')}`, expired: false }
}

const confidenceLevels = [
  { value: 20, label: 'ไม่ค่อยมั่นใจ', emoji: '🥶', color: '#22c55e' },
  { value: 50, label: 'โหวตเลย', emoji: '🥺', color: '#f59e0b' },
  { value: 100, label: 'มั่นใจมาก', emoji: '😎', color: '#ef4444' }
]

const categories = {
  home: { name: 'หน้าแรก', icon: '🏠' },
  live: { name: 'Live Battle', icon: '⚡' },
  sports: { name: 'กีฬา', icon: '⚽' },
  entertainment: { name: 'บันเทิง', icon: '🎬' },
  politics: { name: 'การเมือง', icon: '🏛️' },
  tech: { name: 'เทคโนโลยี', icon: '💻' },
  business: { name: 'ธุรกิจ', icon: '💰' },
  world: { name: 'โลก', icon: '🌍' },
  auto: { name: 'ยานยนต์', icon: '🚗' },
  food: { name: 'อาหาร', icon: '🍜' },
  travel: { name: 'ท่องเที่ยว', icon: '✈️' },
  health: { name: 'สุขภาพ', icon: '💪' },
  relationship: { name: 'ความสัมพันธ์', icon: '❤️' },
  education: { name: 'การศึกษา', icon: '📚' },
  pets: { name: 'สัตว์เลี้ยง', icon: '🐱' },
  housing: { name: 'บ้าน', icon: '🏡' },
  other: { name: 'อื่นๆ', icon: '🎭' },
  timecapsule: { name: 'Time Capsule', icon: '💊' }
}

// ===== Main Component =====
export default function PollDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { category, pollId } = params || {}
  
  const [poll, setPoll] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [userVote, setUserVote] = useState(null)
  const [selectedOption, setSelectedOption] = useState(null)
  const [selectedConfidence, setSelectedConfidence] = useState(50)
  const [isVoting, setIsVoting] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [liveTimeLeft, setLiveTimeLeft] = useState(null)

  // Load initial data
  useEffect(() => {
    const d = localStorage.getItem('kidwa-darkmode')
    if (d) setDarkMode(JSON.parse(d))
    
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark')
    }
    
    loadUser()
    if (pollId) loadPoll()
  }, [pollId])

  // Load user vote when user is available
  useEffect(() => {
    if (user && pollId) loadUserVote()
  }, [user, pollId])

  // Live Battle timer
  useEffect(() => {
    if (poll?.poll_type === 'live_battle') {
      setLiveTimeLeft(getLiveTimeRemaining(poll.ends_at))
      const timer = setInterval(() => {
        setLiveTimeLeft(getLiveTimeRemaining(poll.ends_at))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [poll])

  // Realtime subscription for vote updates
  useEffect(() => {
    if (!poll) return
    
    const channel = supabase
      .channel(`poll-${pollId}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'options', filter: `poll_id=eq.${pollId}` },
        (payload) => {
          setPoll(prev => ({
            ...prev,
            options: prev.options?.map(opt =>
              opt.id === payload.new.id ? { ...opt, votes: payload.new.votes } : opt
            )
          }))
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [poll, pollId])

  const loadUser = async () => {
    const { data } = await getUserFromSession()
    if (data) {
      setUser(data)
    } else {
      const u = localStorage.getItem('kidwa-user')
      if (u) setUser(JSON.parse(u))
    }
  }

  const loadPoll = async () => {
    setIsLoading(true)
    setError(null)
    
    const { data, error: fetchError } = await supabase
      .from('polls')
      .select('*, options(*), tags(*), users:created_by(username, avatar_url)')
      .eq('id', pollId)
      .single()
    
    if (fetchError || !data) {
      setError('ไม่พบโพลนี้')
    } else {
      setPoll(data)
    }
    setIsLoading(false)
  }

  const loadUserVote = async () => {
    const { data } = await supabase
      .from('votes')
      .select('*')
      .eq('user_id', user.id)
      .eq('poll_id', pollId)
      .single()
    
    if (data) {
      setUserVote(data)
      setSelectedOption(data.option_id)
      setSelectedConfidence(data.confidence || 50)
    }
  }

  const handleVote = async () => {
    if (!user) {
      router.push('/?login=true')
      return
    }
    
    if (!selectedOption) {
      alert('กรุณาเลือกตัวเลือกก่อน')
      return
    }
    
    if (poll && isExpired(poll.ends_at)) {
      alert('โพลนี้หมดเวลาแล้ว')
      return
    }
    
    setIsVoting(true)
    
    // Insert vote
    const { error: voteError } = await supabase
      .from('votes')
      .insert([{ 
        user_id: user.id, 
        poll_id: pollId, 
        option_id: selectedOption, 
        confidence: selectedConfidence 
      }])
    
    if (!voteError) {
      // Increment vote count
      await supabase.rpc('increment_vote', { option_id: selectedOption })
      
      const totalVotes = (poll.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0) + 1
      alert(`✅ บันทึกมุมมองของคุณแล้ว\nตอนนี้มีผู้ร่วมวิเคราะห์ ${totalVotes.toLocaleString()} คน`)
      
      await loadPoll()
      await loadUserVote()
    } else {
      if (voteError.code === '23505') {
        alert('คุณโหวตโพลนี้ไปแล้ว')
        await loadUserVote()
      } else {
        alert('เกิดข้อผิดพลาด: ' + voteError.message)
      }
    }
    
    setIsVoting(false)
  }

  const goHome = () => router.push('/')
  const goCategory = () => router.push(`/?cat=${category}`)

  // ===== Render =====
  if (isLoading) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="poll-page-loading">
          <div className="loading-spinner"></div>
          <p>กำลังโหลด...</p>
        </div>
      </div>
    )
  }

  if (error || !poll) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="poll-page-error">
          <span className="error-icon">😕</span>
          <h2>ไม่พบโพลนี้</h2>
          <p>โพลอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง</p>
          <button className="btn btn-primary" onClick={goHome}>
            🏠 กลับหน้าหลัก
          </button>
        </div>
      </div>
    )
  }

  const totalVotes = poll.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0
  const expired = isExpired(poll.ends_at)
  const isBlind = poll.blind_mode && !poll.resolved && !expired
  const hasVoted = !!userVote
  const isLiveBattle = poll.poll_type === 'live_battle'
  const categoryInfo = categories[poll.category] || categories.other

  return (
    <div className={darkMode ? 'dark' : ''}>
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo" onClick={goHome}>คิดว่า..</div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={goCategory}>
              {categoryInfo.icon} {categoryInfo.name}
            </button>
            <button className="btn btn-secondary" onClick={goHome}>
              🏠 หน้าหลัก
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="poll-detail-main">
        <div className="poll-detail-card">
          {/* Badges */}
          <div className="poll-card-header">
            {poll.blind_mode && !expired && <span className="blind-badge">🔒 Blind</span>}
            {poll.poll_type === 'prediction' && <span className="prediction-badge">🎯 ทายผล</span>}
            {isLiveBattle && (
              <span className="live-badge">
                ⚡ LIVE {liveTimeLeft && !liveTimeLeft.expired && `• ${liveTimeLeft.text}`}
              </span>
            )}
            {poll.resolved && <span className="resolved-badge">✅ เฉลยแล้ว</span>}
            {expired && !poll.resolved && <span className="resolved-badge">⏰ รอเฉลย</span>}
          </div>

          {/* Question */}
          <h1 className="poll-question" style={{ fontSize: '1.4rem', marginBottom: '1rem' }}>
            {poll.question}
          </h1>

          {/* Meta */}
          <div className="poll-meta" style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <span>👥 {totalVotes.toLocaleString()} คนโหวต</span>
            <span style={{ marginLeft: '1rem' }}>
              ⏱️ {isLiveBattle && liveTimeLeft ? (liveTimeLeft.expired ? 'จบแล้ว' : liveTimeLeft.text) : getDaysRemaining(poll.ends_at)}
            </span>
            {poll.users && (
              <span style={{ marginLeft: '1rem' }}>โดย @{poll.users.username}</span>
            )}
          </div>

          {/* Expired Notice */}
          {expired && !poll.resolved && (
            <div className="expired-notice">⏰ โพลนี้หมดเวลาแล้ว รอ Admin เฉลย</div>
          )}

          {/* Voted Notice */}
          {hasVoted && (
            <div className="voted-notice">
              ✅ คุณโหวตแล้ว ({confidenceLevels.find(c => c.value === userVote.confidence)?.emoji} {confidenceLevels.find(c => c.value === userVote.confidence)?.label})
            </div>
          )}

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {poll.options?.map(option => {
              const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0
              const isVoted = userVote?.option_id === option.id
              const isSelected = selectedOption === option.id
              const isCorrect = poll.correct_option_id === option.id

              return (
                <button
                  key={option.id}
                  onClick={() => !expired && !hasVoted && setSelectedOption(option.id)}
                  disabled={expired || hasVoted}
                  className={`option-btn ${isVoted ? 'voted' : ''} ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${expired || hasVoted ? 'disabled' : ''}`}
                >
                  {!isBlind && <div className="option-bar" style={{ width: `${percent}%` }} />}
                  <div className="option-content">
                    <span>
                      {isCorrect && '✅ '}
                      {isVoted && '✓ '}
                      {option.text}
                    </span>
                    {!isBlind && <span style={{ fontWeight: 600 }}>{percent}%</span>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Confidence Selector */}
          {!hasVoted && !expired && user && poll.poll_type === 'prediction' && (
            <div className="confidence-selector">
              <label className="confidence-label">🎯 ระดับความมั่นใจ</label>
              <div className="confidence-options">
                {confidenceLevels.map(level => (
                  <button
                    key={level.value}
                    type="button"
                    className={`confidence-btn ${selectedConfidence === level.value ? 'active' : ''}`}
                    style={{ '--confidence-color': level.color }}
                    onClick={() => setSelectedConfidence(level.value)}
                  >
                    <span className="confidence-emoji">{level.emoji}</span>
                    <span className="confidence-text">{level.label}</span>
                  </button>
                ))}
              </div>
              
              {/* High Conviction Warning */}
              {selectedConfidence === 100 && (
                <div className="conviction-warning">
                  <span className="warning-icon">⚠️</span>
                  <span className="warning-text">
                    <strong>การโหวตของคุณมีผลกระทบสูงต่อชื่อเสียง</strong><br/>
                    ถ้าโหวตนี้คลาดเคลื่อน อาจจะเสีย Reputation มากขึ้น
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Vote Button */}
          {!hasVoted && !expired && user && (
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '1rem', fontSize: '1rem', marginTop: '1rem' }}
              onClick={handleVote}
              disabled={!selectedOption || isVoting}
            >
              {isVoting ? '⏳ กำลังบันทึก...' : selectedOption ? '🎯 แสดงมุมมองนี้' : '👆 เลือกตัวเลือกก่อน'}
            </button>
          )}

          {/* Login Prompt */}
          {!user && !expired && (
            <div className="login-prompt" onClick={() => router.push('/?login=true')}>
              🔒 เข้าสู่ระบบเพื่อโหวต
            </div>
          )}

          {/* Tags */}
          {poll.tags && poll.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              {poll.tags.map(tag => (
                <span 
                  key={tag.id} 
                  className="tag-chip"
                  style={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/?tag=${tag.name}`)}
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Share Buttons */}
          <ShareButtons poll={poll} category={category} />

          {/* Future: Comments Section */}
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text)', marginBottom: '1rem' }}>
              💬 ความคิดเห็น
            </h3>
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', background: 'var(--bg)', borderRadius: '12px' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🚧</span>
              <p>ระบบ Comments กำลังจะมาเร็วๆ นี้!</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ===== Share Buttons Component =====
function ShareButtons({ poll, category }) {
  const [copied, setCopied] = useState(false)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://i-kidwa.com'
  const pollUrl = `${baseUrl}/${category}/${poll.id}`
  const totalVotes = poll.options?.reduce((sum, o) => sum + o.votes, 0) || 0
  
  const shareText = `🎯 ${poll.question}\n\n👥 ${totalVotes.toLocaleString()} คนโหวตแล้ว\n\nแล้วคุณล่ะ คิดว่า..\n${pollUrl}`
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pollUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = pollUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  
  const handleShareFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pollUrl)}`, '_blank', 'width=600,height=400')
  }
  
  const handleShareX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank', 'width=600,height=400')
  }
  
  return (
    <div className="share-buttons">
      <span className="share-label">แชร์:</span>
      <button className="share-btn copy" onClick={handleCopy} title="คัดลอกลิงก์">
        {copied ? '✓' : '🔗'}
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
