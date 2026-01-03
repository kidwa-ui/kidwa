'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
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
  createLiveBattle, getLiveBattles, endLiveBattle, subscribeLiveBattle, unsubscribeLiveBattle,
  signUpWithEmail, signInWithEmail, signInWithMagicLink, signOut, getSession, getUserFromSession, 
  resetPassword, updatePassword, onAuthStateChange, signInWithGoogle,
  submitVerification, skipVerification, checkNeedsVerification, getUserPollLimit, findSimilarPolls, checkAndAwardCreatorPoints,
  getPollsByCategory, getPollsByTag, getTrendingTags, getTagSuggestions, getLiveBattlesV2, createLiveBattleV2
} from '@/lib/supabase'

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

const getLiveTimeRemaining = (endDate) => {
  // Ensure proper date parsing - handle both ISO and other formats
  const end = new Date(endDate)
  const now = new Date()
  
  // Debug: Check if date is valid
  if (isNaN(end.getTime())) {
    console.warn('Invalid end date:', endDate)
    return { text: 'ไม่ทราบเวลา', expired: true, recentlyEnded: false }
  }
  
  const diffMs = end.getTime() - now.getTime()
  
  if (diffMs < 0) {
    // Poll has ended
    const minutesAgo = Math.abs(diffMs) / (1000 * 60)
    if (minutesAgo <= 5) {
      return { text: `จบไป ${Math.ceil(minutesAgo)} นาที`, expired: true, recentlyEnded: true }
    }
    if (minutesAgo <= 60) {
      return { text: `จบไป ${Math.ceil(minutesAgo)} นาที`, expired: true, recentlyEnded: false }
    }
    const hoursAgo = Math.floor(minutesAgo / 60)
    if (hoursAgo < 24) {
      return { text: `จบไป ${hoursAgo} ชม.`, expired: true, recentlyEnded: false }
    }
    return { text: 'จบแล้ว', expired: true, recentlyEnded: false }
  }
  
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  
  if (hours > 0) {
    return { 
      text: `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`, 
      expired: false 
    }
  }
  return { 
    text: `${mins}:${secs.toString().padStart(2, '0')}`, 
    expired: false 
  }
}

// ===== Info Modal Components =====

function PostingGuidelinesModal({ onClose, darkMode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal info-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="info-modal-header">
          <h2>📝 คำแนะนำการโพสต์</h2>
          <p>วิธีสร้างโพลที่มีคุณภาพ</p>
        </div>
        <div className="info-modal-content">
          <div className="do-dont-grid">
            <div className="do-section">
              <h3>✅ ควรทำ</h3>
              <ul>
                <li>ตั้งคำถามที่ชัดเจน ตอบได้จริง</li>
                <li>ระบุช่วงเวลาที่จะรู้คำตอบ</li>
                <li>ใส่ตัวเลือกที่ครอบคลุม</li>
                <li>ใช้แท็กที่เกี่ยวข้อง</li>
                <li>เลือกหมวดหมู่ที่ถูกต้อง</li>
                <li>ตรวจสอบว่าไม่ซ้ำกับโพลที่มีอยู่</li>
              </ul>
            </div>
            <div className="dont-section">
              <h3>❌ ไม่ควรทำ</h3>
              <ul>
                <li>สร้างโพลที่ไม่มีทางตรวจสอบได้</li>
                <li>ใช้คำถามที่ก้าวร้าวหรือหยาบคาย</li>
                <li>สร้างโพลซ้ำเพื่อเพิ่มคะแนน</li>
                <li>โพสต์เนื้อหาผิดกฎหมาย</li>
                <li>โฆษณาหรือขายสินค้า</li>
                <li>ละเมิดความเป็นส่วนตัวผู้อื่น</li>
              </ul>
            </div>
          </div>
          
          <div className="info-card">
            <h4>💡 เคล็ดลับสร้างโพลที่ดี</h4>
            <p>โพลที่ดีควรมีคำตอบที่สามารถตรวจสอบได้ในอนาคต เช่น "ใครจะชนะเลือกตั้งผู้ว่า กทม. 2027" ดีกว่า "นักการเมืองคนไหนเก่งที่สุด" เพราะโพลแรกมีคำตอบที่ชัดเจน</p>
          </div>
          
          <div className="info-card">
            <h4>🔒 Blind Mode คืออะไร?</h4>
            <p>โพลประเภท "ทำนายอนาคต" จะเปิด Blind Mode อัตโนมัติ หมายความว่าผู้ใช้จะไม่เห็นผลโหวตจนกว่าจะถึงเวลาเฉลย เพื่อป้องกันพฤติกรรมตามฝูง</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MemberPrivilegesModal({ onClose, darkMode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal info-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="info-modal-header">
          <h2>⭐ สิทธิ์การใช้งานของสมาชิก</h2>
          <p>เปรียบเทียบสิทธิ์ระหว่างสมาชิกทั่วไปและสมาชิกยืนยันตัวตน</p>
        </div>
        <div className="info-modal-content">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>ฟีเจอร์</th>
                <th>สมาชิกทั่วไป</th>
                <th>ยืนยันตัวตนแล้ว ✓</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="feature-name">โหวตโพล</td>
                <td><span className="check-mark">✓</span> ไม่จำกัด</td>
                <td><span className="check-mark">✓</span> ไม่จำกัด</td>
              </tr>
              <tr>
                <td className="feature-name">สร้างโพลต่อวัน</td>
                <td>1 โพล/วัน</td>
                <td><span className="check-mark">✓</span> 3 โพล/วัน</td>
              </tr>
              <tr>
                <td className="feature-name">Verified Badge</td>
                <td><span className="cross-mark">✗</span></td>
                <td><span className="check-mark">✓</span> แสดงข้างชื่อ</td>
              </tr>
              <tr>
                <td className="feature-name">สร้าง Live Battle</td>
                <td><span className="check-mark">✓</span></td>
                <td><span className="check-mark">✓</span></td>
              </tr>
              <tr>
                <td className="feature-name">ติดตามผู้ใช้อื่น</td>
                <td><span className="check-mark">✓</span></td>
                <td><span className="check-mark">✓</span></td>
              </tr>
              <tr>
                <td className="feature-name">รับการแจ้งเตือน</td>
                <td><span className="check-mark">✓</span></td>
                <td><span className="check-mark">✓</span></td>
              </tr>
              <tr>
                <td className="feature-name">อัพโหลดรูปโปรไฟล์</td>
                <td><span className="check-mark">✓</span></td>
                <td><span className="check-mark">✓</span></td>
              </tr>
              <tr>
                <td className="feature-name">สิทธิ์พิเศษในอนาคต</td>
                <td><span className="cross-mark">✗</span></td>
                <td><span className="check-mark">✓</span> รับก่อน</td>
              </tr>
            </tbody>
          </table>
          
          <div className="info-card">
            <h4>🔐 วิธียืนยันตัวตน</h4>
            <p>ไปที่ "บัญชีของฉัน" แล้วกดปุ่ม "ยืนยันตัวตน" กรอกข้อมูลชื่อจริงและวันเกิด ยอมรับเงื่อนไข PDPA แล้วรอการอนุมัติ</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PrivacyPolicyModal({ onClose, darkMode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal info-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="info-modal-header">
          <h2>🔒 นโยบายข้อมูลส่วนบุคคล</h2>
          <p>ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
        </div>
        <div className="info-modal-content">
          <div className="privacy-section">
            <h3>📋 ข้อมูลที่เราเก็บ</h3>
            <ul className="privacy-list">
              <li>ชื่อผู้ใช้ อีเมล และรหัสผ่าน (เข้ารหัส)</li>
              <li>ข้อมูลการยืนยันตัวตน (ชื่อจริง วันเกิด - เฉพาะผู้ที่ยืนยัน)</li>
              <li>ประวัติการโหวตและการสร้างโพล</li>
              <li>ข้อมูลการใช้งาน (เวลาเข้าใช้, อุปกรณ์)</li>
            </ul>
          </div>
          
          <div className="privacy-section">
            <h3>🎯 วัตถุประสงค์การใช้ข้อมูล</h3>
            <ul className="privacy-list">
              <li>ให้บริการแพลตฟอร์ม "คิดว่า.."</li>
              <li>คำนวณคะแนน Reputation และ Leaderboard</li>
              <li>ยืนยันตัวตนและป้องกันการใช้งานผิดประเภท</li>
              <li>ปรับปรุงประสบการณ์ผู้ใช้</li>
              <li>ส่งการแจ้งเตือนที่เกี่ยวข้อง (ถ้ายินยอม)</li>
            </ul>
          </div>
          
          <div className="privacy-section">
            <h3>🛡️ การคุ้มครองข้อมูล</h3>
            <ul className="privacy-list">
              <li>ข้อมูลถูกเก็บในระบบที่มีการเข้ารหัส</li>
              <li>ไม่ขายหรือแบ่งปันข้อมูลส่วนตัวให้บุคคลที่สาม</li>
              <li>จำกัดการเข้าถึงข้อมูลเฉพาะพนักงานที่จำเป็น</li>
              <li>ตรวจสอบและอัปเดตมาตรการความปลอดภัยอย่างสม่ำเสมอ</li>
            </ul>
          </div>
          
          <div className="privacy-section">
            <h3>⚖️ สิทธิ์ของคุณ</h3>
            <ul className="privacy-list">
              <li>เข้าถึงและขอสำเนาข้อมูลของตนเอง</li>
              <li>แก้ไขข้อมูลให้ถูกต้อง</li>
              <li>ลบบัญชีและข้อมูลทั้งหมด</li>
              <li>คัดค้านการประมวลผลข้อมูล</li>
              <li>ถอนความยินยอมได้ทุกเมื่อ</li>
            </ul>
          </div>
          
          <div className="contact-info">
            <p><strong>📧 ติดต่อเรื่องข้อมูลส่วนบุคคล:</strong></p>
            <p>อีเมล: privacy@kidwa.com</p>
            <p>หรือติดต่อผ่านทางเมนู "ติดต่อเรา" ในแอป</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PWAInstallModal({ onClose, darkMode, deferredPrompt, onInstall }) {
  const [activeDevice, setActiveDevice] = useState('iphone')
  
  const instructions = {
    iphone: [
      { title: 'เปิด Safari', desc: 'เปิดเว็บไซต์ คิดว่า.. ใน Safari (ไม่ใช่ Chrome หรือ browser อื่น)' },
      { title: 'กดปุ่ม Share', desc: 'กดไอคอน Share (กล่องมีลูกศรชี้ขึ้น) ที่แถบด้านล่าง' },
      { title: 'เลือก "Add to Home Screen"', desc: 'เลื่อนลงและกด "Add to Home Screen" หรือ "เพิ่มไปยังหน้าจอโฮม"' },
      { title: 'กด "Add"', desc: 'ตั้งชื่อแอป (หรือใช้ "คิดว่า.." ที่ตั้งไว้) แล้วกด Add' }
    ],
    android: [
      { title: 'เปิด Chrome', desc: 'เปิดเว็บไซต์ คิดว่า.. ใน Chrome' },
      { title: 'กดเมนู 3 จุด', desc: 'กดไอคอนจุดสามจุด (⋮) ที่มุมขวาบน' },
      { title: 'เลือก "Install app" หรือ "Add to Home screen"', desc: 'กดตัวเลือก "Install app" หรือ "เพิ่มไปยังหน้าจอโฮม"' },
      { title: 'กด "Install"', desc: 'ยืนยันการติดตั้งแล้วแอปจะปรากฏบนหน้าจอโฮม' }
    ],
    desktop: [
      { title: 'เปิด Chrome หรือ Edge', desc: 'เปิดเว็บไซต์ คิดว่า.. ใน Chrome หรือ Microsoft Edge' },
      { title: 'คลิกไอคอนติดตั้ง', desc: 'มองหาไอคอน "+" หรือ "Install" ที่แถบ URL (ด้านขวา)' },
      { title: 'กด "Install"', desc: 'กดปุ่ม Install ในป๊อปอัปที่ปรากฏ' },
      { title: 'เปิดใช้งาน', desc: 'แอปจะติดตั้งและสามารถเปิดได้จาก Start Menu หรือ Desktop' }
    ]
  }
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal info-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="info-modal-header">
          <h2>📱 ติดตั้งแอป คิดว่า..</h2>
          <p>ใช้งานได้สะดวกขึ้นโดยไม่ต้องเปิด browser</p>
        </div>
        <div className="info-modal-content pwa-guide">
          <div className="pwa-device-tabs">
            <button 
              className={`pwa-tab ${activeDevice === 'iphone' ? 'active' : ''}`}
              onClick={() => setActiveDevice('iphone')}
            >
              🍎 iPhone
            </button>
            <button 
              className={`pwa-tab ${activeDevice === 'android' ? 'active' : ''}`}
              onClick={() => setActiveDevice('android')}
            >
              🤖 Android
            </button>
            <button 
              className={`pwa-tab ${activeDevice === 'desktop' ? 'active' : ''}`}
              onClick={() => setActiveDevice('desktop')}
            >
              💻 Desktop
            </button>
          </div>
          
          <div className="pwa-instructions">
            {instructions[activeDevice].map((step, index) => (
              <div key={index} className="pwa-step">
                <div className="step-number">{index + 1}</div>
                <div className="step-content">
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          
          {deferredPrompt && activeDevice !== 'iphone' && (
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={onInstall}
            >
              📲 ติดตั้งตอนนี้
            </button>
          )}
          
          <div className="pwa-note">
            <span>💡</span>
            <p>หลังติดตั้งแล้ว แอปจะทำงานเร็วขึ้น สามารถรับการแจ้งเตือน และใช้งานได้แม้ไม่มีอินเทอร์เน็ต (สำหรับบางฟีเจอร์)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Trending Tags Section =====

function TrendingTagsSection({ onTagClick, darkMode }) {
  const [trendingTags, setTrendingTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  
  const loadTrendingTags = useCallback(async () => {
    setIsLoading(true)
    const { data } = await getTrendingTags(8, 7)
    setTrendingTags(data || [])
    setLastRefresh(new Date())
    setIsLoading(false)
  }, [])
  
  useEffect(() => {
    loadTrendingTags()
    // Refresh every 10 minutes
    const interval = setInterval(loadTrendingTags, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadTrendingTags])
  
  const getRankClass = (index) => {
    if (index === 0) return 'rank-1'
    if (index === 1) return 'rank-2'
    if (index === 2) return 'rank-3'
    return ''
  }
  
  return (
    <div className="sidebar-card trending-tags-section">
      <div className="trending-tags-header">
        <h3>🔥 แท็กที่ได้รับความสนใจ</h3>
        <button 
          className="refresh-btn" 
          onClick={loadTrendingTags}
          title="รีเฟรช"
        >
          🔄
        </button>
      </div>
      {isLoading ? (
        <div className="trending-loading">กำลังโหลด...</div>
      ) : trendingTags.length === 0 ? (
        <div className="trending-loading">ยังไม่มีแท็กที่กำลังฮิต</div>
      ) : (
        <div className="trending-tags-list">
          {trendingTags.map((tag, index) => (
            <button 
              key={tag.id}
              className={`trending-tag ${getRankClass(index)}`}
              onClick={() => onTagClick(tag.name)}
            >
              <span className="tag-rank">#{index + 1}</span>
              <span className="tag-name">{tag.name}</span>
              <span className="tag-count">{tag.pollCount} โพล</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== Tag Suggestions Component =====

function TagSuggestionsSection({ question, category, selectedTags, onSelectTag }) {
  const [suggestions, setSuggestions] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  
  useEffect(() => {
    const loadSuggestions = async () => {
      if (question.length < 10) {
        setSuggestions([])
        return
      }
      
      setIsLoading(true)
      const { data } = await getTagSuggestions(question, category, 5)
      // Filter out already selected tags
      const filteredSuggestions = (data || []).filter(
        s => !selectedTags.find(t => t.id === s.id)
      )
      setSuggestions(filteredSuggestions)
      setIsLoading(false)
    }
    
    const timer = setTimeout(loadSuggestions, 500)
    return () => clearTimeout(timer)
  }, [question, category, selectedTags])
  
  if (isLoading) {
    return (
      <div className="tag-suggestions-section">
        <span className="suggestions-loading">🔍 กำลังหาแท็กที่แนะนำ...</span>
      </div>
    )
  }
  
  if (suggestions.length === 0) return null
  
  return (
    <div className="tag-suggestions-section">
      <div className="tag-suggestions-label">
        <span>💡</span>
        <span>แท็กที่แนะนำ (กดเพื่อเพิ่ม)</span>
      </div>
      <div className="suggested-tags">
        {suggestions.map(tag => (
          <button
            key={tag.id}
            type="button"
            className="suggested-tag"
            onClick={() => onSelectTag(tag)}
          >
            <span className="plus-icon">+</span>
            <span>#{tag.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ===== Similar Polls Warning =====

function SimilarPollsWarning({ similarPolls, onContinue, onViewPoll }) {
  if (!similarPolls || similarPolls.length === 0) return null

  return (
    <div className="similar-polls-warning">
      <div className="warning-header">
        <span>⚠️</span>
        <span>พบหัวข้อที่คล้ายกัน</span>
      </div>
      <p className="warning-text">เราพบหัวข้อที่อาจซ้ำกับที่คุณกำลังสร้าง ลองดูหัวข้อเหล่านี้ก่อนไหม?</p>
      
      <div className="similar-polls-list">
        {similarPolls.map(poll => (
          <div key={poll.id} className="similar-poll-item" onClick={() => onViewPoll(poll)}>
            <div className="similar-poll-question">{poll.question}</div>
            <div className="similar-poll-meta">
              <span>👥 {poll.totalVotes.toLocaleString()} โหวต</span>
              <span className="similarity-badge">{Math.round(poll.similarity * 100)}% คล้ายกัน</span>
            </div>
          </div>
        ))}
      </div>

      <div className="warning-actions">
        <button className="btn btn-secondary" onClick={onContinue}>
          🆕 สร้างหัวข้อใหม่ต่อ
        </button>
      </div>
    </div>
  )
}

// ===== Poll Card =====

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
        <span className="live-badge">{timeLeft.expired ? '🏁 จบแล้ว' : '⚡ LIVE'}</span>
        <span className={`live-timer ${timeLeft.expired ? 'expired' : ''}`}>
          ⏱️ {timeLeft.text}
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
          {!timeLeft.expired && <span className="live-pulse"></span>}
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
          <span>👥 {totalVotes.toLocaleString()} คนทาย</span>
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
  const baseUrl = 'https://kidwa.vercel.app'
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

// ===== Create Live Battle Modal (Updated with Similar Polls) =====

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
  const [similarPolls, setSimilarPolls] = useState([])
  const [showSimilarWarning, setShowSimilarWarning] = useState(false)
  const [similarCheckDone, setSimilarCheckDone] = useState(false)
  const [isCheckingSimilar, setIsCheckingSimilar] = useState(false)

  useEffect(() => { loadTags() }, [])
  const loadTags = async () => { const { data } = await getTags(); if (data) setAvailableTags(data) }
  const addOption = () => { if (options.length < 6) setOptions([...options, '']) }
  const removeOption = (index) => { if (options.length > 2) setOptions(options.filter((_, i) => i !== index)) }
  const updateOption = (index, value) => { const n = [...options]; n[index] = value; setOptions(n) }
  
  // Check similar polls when question changes
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
  
  const addTag = async () => {
    if (!tagInput.trim() || selectedTags.length >= 5) return
    let tag = availableTags.find(t => t.name.toLowerCase() === tagInput.toLowerCase().trim())
    if (!tag) { const { data } = await createTag(tagInput.trim()); if (data) { tag = data; setAvailableTags([...availableTags, data]) }}
    if (tag && !selectedTags.find(t => t.id === tag.id)) setSelectedTags([...selectedTags, tag])
    setTagInput('')
  }
  
  const handleSelectSuggestedTag = (tag) => {
    if (selectedTags.length < 5 && !selectedTags.find(t => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const validate = () => { 
    const e = {}
    if (!question.trim()) e.question = 'กรุณาใส่คำถาม'
    if (options.filter(o => o.trim()).length < 2) e.options = 'ต้องมีตัวเลือกอย่างน้อย 2 ตัว'
    setErrors(e)
    return Object.keys(e).length === 0 
  }

  const handleSubmit = async (e) => { 
    e.preventDefault()
    if (!validate()) return
    
    // Check similar polls warning first
    if (similarPolls.length > 0 && !similarCheckDone) {
      setShowSimilarWarning(true)
      return
    }
    
    setIsSubmitting(true)
    const { error } = await createLiveBattleV2({ 
      question: question.trim(), 
      options: options.filter(o => o.trim()), 
      category,
      tags: selectedTags.map(t => t.id),
      durationMinutes: duration,
      createdBy: user.id 
    })
    
    setIsSubmitting(false)
    if (error) alert('เกิดข้อผิดพลาด')
    else { alert('⚡ สร้าง Live Battle สำเร็จ!'); onSuccess(); onClose() }
  }
  
  const handleContinueAfterWarning = () => {
    setSimilarCheckDone(true)
    setShowSimilarWarning(false)
  }

  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.find(t => t.id === tag.id)
  ).slice(0, 5)

  const durationOptions = [
  <div className="form-group">
  <label>📅 วันที่สิ้นสุด</label>
  <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
</div>
<div className="form-group">
  <label>⏰ เวลาสิ้นสุด</label>
  <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} />
</div>
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal create-poll-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2 className="modal-title">⚡ สร้าง Live Battle</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          โพลแบบ Real-time • เห็นผลโหวตทันที • จำกัดเวลา
        </p>
        
        {/* Similar Polls Warning */}
        {showSimilarWarning && (
          <SimilarPollsWarning 
            similarPolls={similarPolls}
            onContinue={handleContinueAfterWarning}
            onViewPoll={(poll) => {
              onClose()
            }}
          />
        )}
        
        {!showSimilarWarning && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>❓ คำถาม</label>
              <input type="text" className={`form-input ${errors.question ? 'error' : ''}`} placeholder="เช่น ใครจะชนะแมตช์นี้?" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
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
              <label>⏱️ ระยะเวลา</label>
              <div className="duration-selector">
                {durationOptions.map(opt => (
                  <button key={opt.value} type="button" className={`duration-btn ${duration === opt.value ? 'active' : ''}`} onClick={() => setDuration(opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>🏷️ แท็ก (สูงสุด 5)</label>
              <div className="tags-selected">{selectedTags.map(tag => <span key={tag.id} className="tag-chip">#{tag.name}<button type="button" onClick={() => setSelectedTags(selectedTags.filter(t => t.id !== tag.id))}>✕</button></span>)}</div>
              <div className="tag-input-wrapper">
                <input type="text" className="form-input" placeholder="พิมพ์แท็กแล้วกด Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() }}} />
                {tagInput && <button type="button" className="add-tag-btn" onClick={addTag}>เพิ่ม</button>}
              </div>
              {filteredTags.length > 0 && tagInput && <div className="tag-suggestions">{filteredTags.map(tag => <button key={tag.id} type="button" className="tag-suggestion" onClick={() => { if (selectedTags.length < 5) setSelectedTags([...selectedTags, tag]); setTagInput('') }}>#{tag.name}</button>)}</div>}
              
              {/* Tag Suggestions */}
              <TagSuggestionsSection 
                question={question} 
                category={category} 
                selectedTags={selectedTags}
                onSelectTag={handleSelectSuggestedTag}
              />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>ยกเลิก</button>
              <button type="submit" className="btn btn-live" disabled={isSubmitting}>
                {isSubmitting ? '⏳ กำลังสร้าง...' : '⚡ เริ่ม Live Battle'}
              </button>
            </div>
          </form>
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
    const d = new Date()
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
  
  const handleSelectSuggestedTag = (tag) => {
    if (selectedTags.length < 5 && !selectedTags.find(t => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag])
    }
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
          <SimilarPollsWarning 
            similarPolls={similarPolls}
            onContinue={handleContinueAfterWarning}
            onViewPoll={(poll) => {
              onClose()
            }}
          />
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
                  <span className="mode-desc">มีคำตอบถูก-ผิด • Blind Mode</span>
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
              
              {/* Tag Suggestions */}
              <TagSuggestionsSection 
                question={question} 
                category={category} 
                selectedTags={selectedTags}
                onSelectTag={handleSelectSuggestedTag}
              />
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
                {isSubmitting ? '⏳ กำลังสร้าง...' : '🚀 สร้างโพล'}
              </button>
            </div>
          </form>
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

// ===== Main Home Component =====

export default function Home() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const dropdownRef = useRef(null)
  
  const [darkMode, setDarkMode] = useState(false)
  const [activeCategory, setActiveCategory] = useState('home')
  const [activeTag, setActiveTag] = useState(null)
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
  const [liveBattles, setLiveBattles] = useState([])
  const [timeCapsules, setTimeCapsules] = useState([])
  const [showCreateLiveBattle, setShowCreateLiveBattle] = useState(false)
  const [showCreateTimeCapsule, setShowCreateTimeCapsule] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  
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

  // ===== Read Category from URL on Mount =====
  useEffect(() => {
    const cat = searchParams.get('cat')
    const tag = searchParams.get('tag')
    
    if (tag) {
      handleTagClick(tag)
    } else if (cat && categories.find(c => c.id === cat)) {
      handleCategoryChange(cat, false) // false = don't update URL again
    }
  }, [])

  useEffect(() => { 
    loadPolls()
    loadLiveBattles()
    loadTimeCapsules()
    checkAuthSession()
    const d = localStorage.getItem('kidwa-darkmode')
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
    localStorage.setItem('kidwa-darkmode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
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
  
  // Auto-refresh Live Battles
  useEffect(() => {
    if (activeCategory === 'live' || activeCategory === 'home') {
      const interval = setInterval(() => {
        loadLiveBattles()
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [activeCategory])

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallApp = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowPWAInstall(false)
  }

  const loadPolls = async () => { 
    setIsLoading(true)
    const { data } = await getPolls()
    if (data) setPolls(data.filter(p => p.poll_type !== 'time_capsule' && p.poll_type !== 'live_battle'))
    setIsLoading(false) 
  }
  
  const loadLiveBattles = async () => { 
    const { data } = await getLiveBattlesV2()
    if (data) setLiveBattles(data) 
  }
  
  const loadTimeCapsules = async () => { 
    const { data } = await getTimeCapsules()
    if (data) setTimeCapsules(data) 
  }
  
  const loadUserVotes = async () => { 
    if (!user) return
    const { data } = await getUserVotes(user.id)
    if (data) { 
      const m = {}
      data.forEach(v => { m[v.poll_id] = { optionId: v.option_id, confidence: v.confidence } })
      setUserVotes(m) 
    }
  }
  
  const loadUnreadCount = async () => { 
    if (!user) return
    const { count } = await getUnreadNotificationCount(user.id)
    setUnreadCount(count) 
  }

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
      alert(`✅ บันทึกมุมมองของคุณแล้ว\nตอนนี้มีผู้ร่วมวิเคราะห์ ${totalVotes.toLocaleString()} คน`)
      await checkAndAwardCreatorPoints(pollId)
    }
  }

  const confirmVote = () => { 
    if (!selectedOption) { alert('กรุณาเลือกตัวเลือกก่อน'); return }
    handleVote(selectedPoll.id, selectedOption, selectedConfidence) 
  }
  
  const handleTagClick = async (tagName, updateUrl = true) => {
    setActiveTag(tagName)
    setActiveCategory('home')
    setIsLoading(true)
    
    // Update URL
    if (updateUrl) {
      router.push(`/?tag=${encodeURIComponent(tagName)}`, { scroll: false })
    }
    
    const { data } = await getPollsByTag(tagName)
    if (data) setPolls(data)
    setIsLoading(false)
  }
  
  const handleCategoryChange = async (catId, updateUrl = true) => {
    setActiveTag(null)
    setActiveCategory(catId)
    
    // Update URL
    if (updateUrl) {
      if (catId === 'home') {
        router.push('/', { scroll: false })
      } else {
        router.push(`/?cat=${catId}`, { scroll: false })
      }
    }
    
    if (catId === 'home') {
      loadPolls()
    } else if (catId === 'live') {
      loadLiveBattles()
    } else if (catId === 'timecapsule') {
      loadTimeCapsules()
    } else {
      setIsLoading(true)
      const { data } = await getPollsByCategory(catId)
      if (data) setPolls(data.filter(p => p.poll_type !== 'time_capsule' && p.poll_type !== 'live_battle'))
      setIsLoading(false)
    }
  }

  const filteredPolls = polls.filter(poll => { 
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

  if (isLoading) return (
    <div className={`loading-screen ${darkMode ? 'dark' : ''}`}>
      <div className="loading-spinner" />
      <p>กำลังโหลด...</p>
    </div>
  )

  return (
    <div className={darkMode ? 'dark' : ''}>
      {/* Sticky Header + Categories Block */}
      <div className="sticky-header-block">
        <header className="header">
          <div className="header-content">
            <div className="logo" onClick={() => handleCategoryChange('home')}>คิดว่า..</div>
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="ค้นหา.." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
              />
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
                <>
                  <button className="btn btn-secondary hide-mobile" onClick={() => setShowAuthModal(true)}>เข้าสู่ระบบ</button>
                  <button className="btn btn-primary hide-mobile" onClick={() => setShowAuthModal(true)}>สมัครสมาชิก</button>
                </>
              )}
              <button className="menu-btn" onClick={() => setShowMenu(!showMenu)}>☰</button>
            </div>
          </div>
          
          {/* Dropdown Menu */}
          {showMenu && (
            <div className="dropdown-menu" ref={dropdownRef}>
              {!user && (
                <>
                  <button className="dropdown-item" onClick={() => { setShowAuthModal(true); setShowMenu(false) }}>🔑 เข้าสู่ระบบ</button>
                  <button className="dropdown-item" onClick={() => { setShowAuthModal(true); setShowMenu(false) }}>✨ สมัครสมาชิก</button>
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
                  <button className="dropdown-item" onClick={() => { setShowNotifications(true); setShowMenu(false) }}>การแจ้งเตือน {unreadCount > 0 && <span className="mobile-notif-badge">{unreadCount}</span>}</button>
                  <button className="dropdown-item" onClick={() => { setShowAccount(true); setShowMenu(false) }}>บัญชีของฉัน</button>
                  <button className="dropdown-item" onClick={() => { setShowCreatePoll(true); setShowMenu(false) }}>สร้างโพล</button>
                  {user.is_admin && <button className="dropdown-item" onClick={() => { setShowAdminPanel(true); setShowMenu(false) }}>🔧 Admin Panel</button>}
                  <div className="dropdown-divider"></div>
                </>
              )}
              
              {/* New Menu Items */}
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

        <nav className="categories">
          <div className="categories-content">
            {categories.map(cat => (
              <button 
                key={cat.id} 
                className={`category-btn ${activeCategory === cat.id && !activeTag ? 'active' : ''}`} 
                onClick={() => handleCategoryChange(cat.id)}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Pantip-style Layout with Margin/Border */}
      <div className="page-wrapper">
        <div className="main-container">
          <main className="main">
            <aside className="sidebar">
              {/* Trending Tags instead of Leaderboard */}
              <TrendingTagsSection onTagClick={handleTagClick} darkMode={darkMode} />
            </aside>

            <div className="content">
              {/* Tag View Header */}
              {activeTag && (
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => { setActiveTag(null); handleCategoryChange('home') }}
                  >
                    ← กลับ
                  </button>
                  <h2 className="section-title" style={{ margin: 0 }}>🏷️ #{activeTag}</h2>
                </div>
              )}
              
              {/* Live Battle Section */}
              {activeCategory === 'live' ? (
                <section>
                  <div className="section-header">
                    <h2 className="section-title">⚡ ถ่ายทอดสด</h2>
                    {user && <button className="btn btn-live-create" onClick={() => setShowCreateLiveBattle(true)}>⚡ สร้าง Live Battle</button>}
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
                  {user && <button className="btn btn-primary" onClick={() => setShowCreateLiveBattle(true)}>⚡ สร้าง Live Battle แรก</button>}
                </div>
              )}
            </section>
          ) : activeCategory === 'timecapsule' ? (
            <section>
              <div className="section-header">
                <h2 className="section-title">💊 Time Capsule</h2>
                {user?.is_admin && <button className="btn btn-capsule-create" onClick={() => setShowCreateTimeCapsule(true)}>💊 สร้าง Time Capsule</button>}
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
              
              {featuredPolls.length > 0 && !activeTag && (
                <section>
                  <h2 className="section-title">🌟 หัวข้อเด่น</h2>
                  <div className="poll-grid">
                    {featuredPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}
                  </div>
                </section>
              )}
              
              <section>
                <h2 className="section-title">
                  {activeTag ? `🏷️ #${activeTag}` : activeCategory === 'home' ? '🆕 ล่าสุด' : `${categories.find(c => c.id === activeCategory)?.icon} ${categories.find(c => c.id === activeCategory)?.name}`}
                </h2>
                <div className="poll-grid">
                  {latestPolls.map(poll => <PollCard key={poll.id} poll={poll} onClick={() => setSelectedPoll(poll)} userVotes={userVotes} />)}
                </div>
              </section>
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
        </div>
      </div>

      {/* Modals */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={(userData) => { setUser(userData); localStorage.setItem('kidwa-user', JSON.stringify(userData)); setShowAuthModal(false) }} darkMode={darkMode} />}
      
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
            
            {!userVotes[selectedPoll.id] && !isExpired(selectedPoll.ends_at) && user && selectedPoll.poll_type !== 'prediction' && (
              <button className="btn btn-primary vote-cta" style={{ width: '100%', marginTop: '1rem', padding: '1rem' }} onClick={confirmVote} disabled={!selectedOption}>
                {selectedOption ? <>💬 แสดงความคิดเห็น</> : <>👆 เลือกตัวเลือกก่อน</>}
              </button>
            )}
            
            {!user && !isExpired(selectedPoll.ends_at) && (
              <div onClick={() => { setSelectedPoll(null); setShowAuthModal(true) }} className="login-prompt">🔒 เข้าสู่ระบบเพื่อโหวต</div>
            )}
            
            <ShareButtons poll={selectedPoll} />
          </div>
        </div>
      )}

      {showCreatePoll && <CreatePollModal onClose={() => setShowCreatePoll(false)} user={user} onSuccess={loadPolls} darkMode={darkMode} />}
      {showCreateLiveBattle && <CreateLiveBattleModal onClose={() => setShowCreateLiveBattle(false)} user={user} onSuccess={() => { loadLiveBattles(); handleCategoryChange('live') }} darkMode={darkMode} />}
      
      {/* Info Modals */}
      {showPostingGuidelines && <PostingGuidelinesModal onClose={() => setShowPostingGuidelines(false)} darkMode={darkMode} />}
      {showMemberPrivileges && <MemberPrivilegesModal onClose={() => setShowMemberPrivileges(false)} darkMode={darkMode} />}
      {showPrivacyPolicy && <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} darkMode={darkMode} />}
      {showPWAInstall && <PWAInstallModal onClose={() => setShowPWAInstall(false)} darkMode={darkMode} deferredPrompt={deferredPrompt} onInstall={handleInstallApp} />}
      
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
