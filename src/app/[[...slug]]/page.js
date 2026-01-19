'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
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
  submitDemographics, skipVerification, checkNeedsVerification, getUserPollLimit, findSimilarPolls, checkAndAwardCreatorPoints,
  checkAndGrantVerified, getVerifiedProgress, getUserVoteCount,
  getTrendingTags, getPollsByTag,
  getVoteDetails, getVoteStatistics, logAdminAction, getAdminAuditLogs,
  enrollMFA, verifyMFAEnrollment, challengeMFA, verifyMFA, getMFAStatus, listMFAFactors, unenrollMFA
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
  { min: 0, max: 500, name: 'นักศึกษา', badge: '🌱', key: 'newbie' },
  { min: 501, max: 1500, name: 'ผู้เริ่มต้น', badge: '🎯', key: 'learner' },
  { min: 1501, max: 3000, name: 'นักวิเคราะห์', badge: '🔮', key: 'thinker' },
  { min: 3001, max: 5000, name: 'ผู้เชี่ยวชาญ', badge: '⭐', key: 'analyst' },
  { min: 5001, max: 10000, name: 'ปรมาจารย์', badge: '🏆', key: 'expert' },
  { min: 10001, max: Infinity, name: 'ตำนาน', badge: '👑', key: 'master' }
]

// Get level key for KidwaBean
const getLevelKey = (rep) => {
  const level = reputationLevels.find(l => rep >= l.min && rep <= l.max)
  return level?.key || 'newbie'
}

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

// สำหรับ ถ่ายทอดสด - real-time countdown
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
            <p>โพลประเภท "คิดว่าในอนาคต.." จะเปิด Blind Mode อัตโนมัติ หมายความว่าผู้ใช้จะไม่เห็นผลโหวตจนกว่าจะถึงเวลาเฉลย เพื่อป้องกันพฤติกรรมตามฝูง</p>
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
          <p>เปรียบเทียบสิทธิ์ระหว่างสมาชิกทั่วไปและสมาชิกที่ยืนยันข้อมูลแล้ว</p>
        </div>
        <div className="info-modal-content">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>ฟีเจอร์</th>
                <th>สมาชิกทั่วไป</th>
                <th>ยืนยันข้อมูลแล้ว</th>
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
                <td><span className="cross-mark">✗</span></td>
                <td><span className="check-mark">✓</span> 3 โพล/วัน</td>
              </tr>
              <tr>
                <td className="feature-name">สร้าง ถ่ายทอดสด</td>
                <td><span className="cross-mark">✗</span></td>
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
            </tbody>
          </table>
          
          <div className="info-card">
            <h4>📝 วิธียืนยันข้อมูล</h4>
            <p>ไปที่ "บัญชีของฉัน" แล้วกดปุ่ม "ยืนยันข้อมูลเพื่อสร้างโพลได้"</p>
          </div>
          
          <div className="info-card verified-info-card">
            <h4>✓ Verified Badge</h4>
            <p>Badge ✓ ได้จากการมีส่วนร่วมอย่างสม่ำเสมอในระบบ</p>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem', fontSize: '0.9rem' }}>
              <li>เข้าสู่ระบบมาแล้วอย่างน้อย 14 วัน</li>
              <li>โหวตแล้วอย่างน้อย 20 โพล</li>
              <li>ยืนยันอีเมลแล้ว</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
// ===== Leaderboard Component with Tabs =====
function LeaderboardSection({ darkMode, currentUser, onViewProfile }) {
  const [activeTab, setActiveTab] = useState('all')
  const [leaderboard, setLeaderboard] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadLeaderboard()
  }, [activeTab])

  const loadLeaderboard = async () => {
    setIsLoading(true)
    let data = []
    
    if (activeTab === 'week') {
      const result = await getWeeklyLeaderboard(10)
      data = result.data || []
    } else if (activeTab === 'month') {
      const result = await getMonthlyLeaderboard(10)
      data = result.data || []
    } else {
      const result = await getLeaderboard(10)
      data = result.data || []
    }
    
    setLeaderboard(data)
    setIsLoading(false)
  }

  const getRankEmoji = (index) => ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][index] || `#${index + 1}`

  const getPointsDisplay = (item) => {
    if (activeTab === 'week') return `${item.weeklyPoints >= 0 ? '+' : ''}${item.weeklyPoints} pt`
    if (activeTab === 'month') return `${item.monthlyPoints >= 0 ? '+' : ''}${item.monthlyPoints} pt`
    return `${item.reputation} pt`
  }

  return (
    <div className="sidebar-card">
      <h3 className="sidebar-title">Leaderboard</h3>
      <div className="leaderboard-tabs">
        <button className={`lb-tab ${activeTab === 'week' ? 'active' : ''}`} onClick={() => setActiveTab('week')}>สัปดาห์</button>
        <button className={`lb-tab ${activeTab === 'month' ? 'active' : ''}`} onClick={() => setActiveTab('month')}>เดือน</button>
        <button className={`lb-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>ตลอดกาล</button>
      </div>
      <div className="leaderboard-list">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>⏳</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {activeTab === 'week' ? 'ยังไม่มีข้อมูลสัปดาห์นี้' : activeTab === 'month' ? 'ยังไม่มีข้อมูลเดือนนี้' : 'ยังไม่มีข้อมูล'}
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
              <span className={`lb-points ${activeTab !== 'all' ? (activeTab === 'week' ? (item.weeklyPoints >= 0 ? 'positive' : 'negative') : (item.monthlyPoints >= 0 ? 'positive' : 'negative')) : ''}`}>
                {getPointsDisplay(item)}
              </span>
            </div>
          ))
        )}
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
          <h2>นโยบายข้อมูลส่วนบุคคล</h2>
          <p>ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
        </div>
        <div className="info-modal-content">
          <div className="privacy-section">
            <h3>ข้อมูลที่เราเก็บ</h3>
            <ul className="privacy-list">
              <li>ชื่อผู้ใช้ อีเมล และรหัสผ่าน (เข้ารหัส)</li>
              <li>ข้อมูลการยืนยันตัวตน (ชื่อจริง วันเกิด - เฉพาะผู้ที่ยืนยัน)</li>
              <li>ประวัติการโหวตและการสร้างโพล</li>
              <li>ข้อมูลการใช้งาน (เวลาเข้าใช้, อุปกรณ์)</li>
            </ul>
          </div>
          
          <div className="privacy-section">
            <h3>วัตถุประสงค์การใช้ข้อมูล</h3>
            <ul className="privacy-list">
              <li>ให้บริการแพลตฟอร์ม "คิดว่า.."</li>
              <li>คำนวณคะแนน Reputation และ Leaderboard</li>
              <li>ยืนยันตัวตนและป้องกันการใช้งานผิดประเภท</li>
              <li>ปรับปรุงประสบการณ์ผู้ใช้</li>
              <li>ส่งการแจ้งเตือนที่เกี่ยวข้อง (ถ้ายินยอม)</li>
            </ul>
          </div>
          
          <div className="privacy-section">
            <h3>การคุ้มครองข้อมูล</h3>
            <ul className="privacy-list">
              <li>ข้อมูลถูกเก็บในระบบที่มีการเข้ารหัส</li>
              <li>ไม่ขายหรือแบ่งปันข้อมูลส่วนตัวให้บุคคลที่สาม</li>
              <li>จำกัดการเข้าถึงข้อมูลเฉพาะพนักงานที่จำเป็น</li>
              <li>ตรวจสอบและอัปเดตมาตรการความปลอดภัยอย่างสม่ำเสมอ</li>
            </ul>
          </div>
          
          <div className="privacy-section">
            <h3>สิทธิ์ของคุณ</h3>
            <ul className="privacy-list">
              <li>เข้าถึงและขอสำเนาข้อมูลของตนเอง</li>
              <li>แก้ไขข้อมูลให้ถูกต้อง</li>
              <li>ลบบัญชีและข้อมูลทั้งหมด</li>
              <li>คัดค้านการประมวลผลข้อมูล</li>
              <li>ถอนความยินยอมได้ทุกเมื่อ</li>
            </ul>
          </div>
          
          <div className="contact-info">
            <p><strong>ติดต่อเรื่องข้อมูลส่วนบุคคล:</strong></p>
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
              iPhone
            </button>
            <button 
              className={`pwa-tab ${activeDevice === 'android' ? 'active' : ''}`}
              onClick={() => setActiveDevice('android')}
            >
              Android
            </button>
            <button 
              className={`pwa-tab ${activeDevice === 'desktop' ? 'active' : ''}`}
              onClick={() => setActiveDevice('desktop')}
            >
              Desktop
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
              ติดตั้งตอนนี้
            </button>
          )}
          
          <div className="pwa-note">
            <span>💡</span>
            <p>ขอขอบคุณที่ให้ความสนใจในคิดว่า..</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== Leaderboard Modal (แยกจาก sidebar) =====
function LeaderboardModal({ onClose, darkMode, currentUser, onViewProfile }) {
  const [activeTab, setActiveTab] = useState('weekly')
  const [leaderboard, setLeaderboard] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => { loadLeaderboard() }, [activeTab])

  const loadLeaderboard = async () => {
    setIsLoading(true)
    let data = []
    if (activeTab === 'weekly') {
      const result = await getWeeklyLeaderboard(20)
      data = result.data || []
    } else if (activeTab === 'monthly') {
      const result = await getMonthlyLeaderboard(20)
      data = result.data || []
    } else {
      const result = await getLeaderboard(20)
      data = result.data || []
    }
    setLeaderboard(data)
    setIsLoading(false)
  }

  const getRankIcon = (index) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `${index + 1}`
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal leaderboard-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="leaderboard-modal-header">
          <h2>🏆 อันดับ Leaderboard</h2>
          <p>ผู้ใช้ที่มี Reputation สูงสุด</p>
        </div>
        
        <div className="leaderboard-tabs-full">
          <button className={`lb-tab ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => setActiveTab('weekly')}>
            ประจำสัปดาห์
          </button>
          <button className={`lb-tab ${activeTab === 'monthly' ? 'active' : ''}`} onClick={() => setActiveTab('monthly')}>
            รายเดือน
          </button>
          <button className={`lb-tab ${activeTab === 'alltime' ? 'active' : ''}`} onClick={() => setActiveTab('alltime')}>
            ตลอดกาล
          </button>
        </div>
        
        <div className="leaderboard-period-info">
          {activeTab === 'weekly' && <span>คะแนนล่าสุด · นับใหม่ทุกวันจันทร์</span>}
          {activeTab === 'monthly' && <span>ความสม่ำเสมอ · นับใหม่ทุกต้นเดือน</span>}
          {activeTab === 'alltime' && <span>ชื่อเสียงสะสม · ตั้งแต่เริ่มใช้งาน</span>}
        </div>
        
        <div className="leaderboard-list-full">
          {isLoading ? (
            <div className="leaderboard-loading">⏳ กำลังโหลด...</div>
          ) : leaderboard.length === 0 ? (
            <div className="leaderboard-empty">ยังไม่มีข้อมูล</div>
          ) : (
            leaderboard.map((item, i) => (
              <div 
                key={item.id} 
                className={`leaderboard-item-full ${currentUser?.id === item.id ? 'current-user' : ''}`}
                onClick={() => { onViewProfile(item.id); onClose() }}
              >
                <div className="lb-rank">{getRankIcon(i)}</div>
                <div className="lb-avatar">
                  {item.avatar_url ? (
                    <img src={item.avatar_url} alt={item.username} />
                  ) : (
                    item.username[0].toUpperCase()
                  )}
                </div>
                <div className="lb-info">
                  <span className="lb-username">
                    {item.username}
                    {item.is_verified && <span className="verified-badge"><svg viewBox="0 0 24 24" className="verified-check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>}
                  </span>
                  <span className="lb-stats">{item.correct_predictions || 0}/{item.total_predictions || 0} แม่น</span>
                </div>
                <div className="lb-points">
                  <span className="lb-badge">{getReputationLevel(item.reputation).badge}</span>
                  <span className="lb-rep">
                    {activeTab === 'weekly' && item.weeklyPoints ? `+${item.weeklyPoints}` : 
                     activeTab === 'monthly' && item.monthlyPoints ? `+${item.monthlyPoints}` :
                     item.reputation?.toLocaleString()} pt
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ===== Kidwa Bean Character =====
function KidwaBean({ level = 'newbie', size = 80 }) {
  // Level-based character colors and accessories
  const characters = {
    newbie: { body: '#a8e6cf', bodyDark: '#88d4ab', eyes: '#2d3436', accessory: 'seedling' },
    learner: { body: '#74b9ff', bodyDark: '#0984e3', eyes: '#2d3436', accessory: 'target' },
    thinker: { body: '#a29bfe', bodyDark: '#6c5ce7', eyes: '#6c5ce7', accessory: 'glasses' },
    analyst: { body: '#fdcb6e', bodyDark: '#f39c12', eyes: '#2d3436', accessory: 'star' },
    expert: { body: '#fd79a8', bodyDark: '#e84393', eyes: '#e84393', accessory: 'trophy' },
    master: { body: '#ff6b9d', bodyDark: '#e91e63', eyes: '#e91e63', accessory: 'crown' }
  }
  
  const char = characters[level] || characters.newbie
  const scale = size / 100
  
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 100 130" className="kidwa-bean">
      {/* Body */}
      <ellipse cx="50" cy="75" rx="35" ry="45" fill={char.body}/>
      <ellipse cx="50" cy="75" rx="30" ry="40" fill={char.bodyDark}/>
      {/* Face */}
      <ellipse cx="50" cy="55" rx="25" ry="22" fill="#ffeaa7"/>
      {/* Eyes */}
      <ellipse cx="42" cy="52" rx="6" ry="7" fill="white"/>
      <ellipse cx="58" cy="52" rx="6" ry="7" fill="white"/>
      <circle cx="43" cy="53" r="3" fill={char.eyes}/>
      <circle cx="59" cy="53" r="3" fill={char.eyes}/>
      {/* Blush */}
      <ellipse cx="35" cy="60" rx="5" ry="3" fill="#ffb6c1" opacity="0.6"/>
      <ellipse cx="65" cy="60" rx="5" ry="3" fill="#ffb6c1" opacity="0.6"/>
      {/* Smile */}
      <path d="M 43 65 Q 50 72 57 65" stroke="#2d3436" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Arms */}
      <ellipse cx="20" cy="80" rx="8" ry="12" fill={char.body}/>
      <ellipse cx="80" cy="80" rx="8" ry="12" fill={char.body}/>
      {/* Legs */}
      <ellipse cx="38" cy="115" rx="10" ry="12" fill={char.body}/>
      <ellipse cx="62" cy="115" rx="10" ry="12" fill={char.body}/>
      {/* Accessory based on level */}
      {char.accessory === 'seedling' && (
        <>
          <path d="M 50 33 Q 45 20 50 15 Q 55 20 50 33" fill="#56ab2f"/>
          <circle cx="50" cy="12" r="4" fill="#56ab2f"/>
        </>
      )}
      {char.accessory === 'crown' && (
        <>
          <path d="M 30 32 L 35 15 L 42 28 L 50 8 L 58 28 L 65 15 L 70 32 Z" fill="#ffd700" stroke="#f39c12" strokeWidth="1"/>
          <ellipse cx="50" cy="35" rx="22" ry="5" fill="#ffd700"/>
        </>
      )}
      {char.accessory === 'star' && (
        <text x="42" y="28" fontSize="20" fill="#ffd700">⭐</text>
      )}
      {char.accessory === 'trophy' && (
        <text x="40" y="28" fontSize="18" fill="#ffd700">🏆</text>
      )}
      {char.accessory === 'glasses' && (
        <>
          <circle cx="42" cy="52" r="10" fill="none" stroke="#2d3436" strokeWidth="2"/>
          <circle cx="58" cy="52" r="10" fill="none" stroke="#2d3436" strokeWidth="2"/>
          <path d="M 52 52 L 48 52" stroke="#2d3436" strokeWidth="2"/>
        </>
      )}
      {char.accessory === 'target' && (
        <>
          <ellipse cx="50" cy="28" rx="12" ry="10" fill="#e74c3c"/>
          <circle cx="50" cy="28" r="5" fill="white"/>
          <circle cx="50" cy="28" r="2" fill="#e74c3c"/>
        </>
      )}
    </svg>
  )
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
      
      {/* ===== NEW BLIND MODE UI ===== */}
      {isBlind ? (
        <div className="blind-minimal">
          <div className="blind-status">
            <span className="blind-icon">🔒</span>
            <span className="blind-label">รอเฉลย</span>
          </div>
          <div className="blind-right">
            {hasVoted && (
              <span className="blind-voted">
                ✓ โหวตแล้ว {confidenceLevels.find(c => c.value === hasVoted.confidence)?.emoji || '🤩'}
              </span>
            )}
            <span className="blind-info-btn" title="ระบบซ่อนผลโหวตเพื่อป้องกัน Selection Bias โดยจะเฉลยเมื่อครบกำหนด">
              <span className="blind-info-icon">?</span>
              <span className="blind-tooltip">ระบบซ่อนผลโหวตเพื่อป้องกัน Selection Bias โดยจะเฉลยเมื่อครบกำหนด</span>
            </span>
          </div>
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

// ===== ถ่ายทอดสด Card =====
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
function AuthModal({ onClose, onSuccess, darkMode, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode)
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
                <div className="form-group"><label>อีเมล</label><input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div className="form-group"><label>รหัสผ่าน</label><input type="password" className="form-input" placeholder="รหัสผ่าน" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                <button type="button" className="auth-link" onClick={() => setMode('forgot')}>ลืมรหัสผ่าน?</button>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>{isLoading ? '⏳ กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</button>
              </form>
            )}
            {mode === 'register' && (
              <form onSubmit={handleRegister}>
                <div className="form-group"><label>ชื่อผู้ใช้</label><input type="text" className="form-input" placeholder="ชื่อที่แสดงในเว็บ" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={20} /></div>
                <div className="form-group"><label>อีเมล</label><input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <div className="form-group"><label>รหัสผ่าน</label><input type="password" className="form-input" placeholder="อย่างน้อย 8 ตัวอักษร" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></div>
                <div className="form-group"><label>ยืนยันรหัสผ่าน</label><input type="password" className="form-input" placeholder="พิมพ์รหัสผ่านอีกครั้ง" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /></div>
                <p className="auth-bonus">สมัครใหม่ได้ 1,000 Point เริ่มต้น!</p>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>{isLoading ? '⏳ กำลังสมัคร...' : 'สมัครสมาชิก'}</button>
              </form>
            )}
            {mode === 'magic' && (
              <form onSubmit={handleMagicLink}>
                <div className="form-group"><label>อีเมล</label><input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <p className="auth-hint">เราจะส่งลิงก์สำหรับเข้าสู่ระบบไปยังอีเมลของคุณ</p>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>{isLoading ? '⏳ กำลังส่ง...' : 'ส่ง Magic Link'}</button>
              </form>
            )}
            {mode === 'forgot' && (
              <form onSubmit={handleForgotPassword}>
                <div className="form-group"><label>อีเมล</label><input type="email" className="form-input" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                <button type="submit" className="btn btn-primary btn-full" disabled={isLoading}>{isLoading ? '⏳ กำลังส่ง...' : 'รีเซ็ตรหัสผ่าน'}</button>
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
function AccountModal({ onClose, user, darkMode, onUpdateUser, onOpenVerification }) {
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
    if (file.size > 1 * 1024 * 1024) { alert('ไฟล์ใหญ่เกินไป (สูงสุด 1MB)'); return }
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
 // v2: Calculate category accuracy
  const getCategoryAccuracy = () => {
    if (!voteHistory || voteHistory.length === 0) return []
    
    const categoryStats = {}
    voteHistory.forEach(vote => {
      const category = vote.polls?.category || 'other'
      if (!categoryStats[category]) {
        categoryStats[category] = { total: 0, correct: 0 }
      }
      categoryStats[category].total++
      if (vote.is_correct) categoryStats[category].correct++
    })
    
    return Object.entries(categoryStats)
      .map(([cat, stats]) => ({
        category: cat,
        accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        total: stats.total,
        correct: stats.correct
      }))
      .filter(c => c.total >= 3) // ต้องมีอย่างน้อย 3 votes
      .sort((a, b) => b.accuracy - a.accuracy)
  }
  
  // v2: Get voting time pattern
  const getVotingTimePattern = () => {
    if (!voteHistory || voteHistory.length === 0) return null
    
    const timeStats = { morning: 0, afternoon: 0, evening: 0, night: 0 }
    const correctByTime = { morning: 0, afternoon: 0, evening: 0, night: 0 }
    
    voteHistory.forEach(vote => {
      const hour = new Date(vote.created_at).getHours()
      let period = 'night'
      if (hour >= 6 && hour < 12) period = 'morning'
      else if (hour >= 12 && hour < 17) period = 'afternoon'
      else if (hour >= 17 && hour < 21) period = 'evening'
      
      timeStats[period]++
      if (vote.is_correct) correctByTime[period]++
    })
    
    // หาช่วงเวลาที่แม่นที่สุด
    let bestPeriod = null
    let bestAccuracy = 0
    Object.entries(timeStats).forEach(([period, total]) => {
      if (total >= 3) {
        const accuracy = correctByTime[period] / total
        if (accuracy > bestAccuracy) {
          bestAccuracy = accuracy
          bestPeriod = period
        }
      }
    })
    
    const periodNames = { morning: 'ช่วงเช้า', afternoon: 'ช่วงบ่าย', evening: 'ช่วงเย็น', night: 'ช่วงกลางคืน' }
    return bestPeriod ? { period: periodNames[bestPeriod], accuracy: Math.round(bestAccuracy * 100) } : null
  }
  
  // v2: Get conviction style
  const getConvictionStyle = () => {
    if (!voteHistory || voteHistory.length === 0) return null
    
    const avgConfidence = voteHistory.reduce((sum, v) => sum + (v.confidence || 50), 0) / voteHistory.length
    
    if (avgConfidence <= 30) return { style: 'ระมัดระวัง', desc: 'มักใช้ความมั่นใจต่ำ' }
    if (avgConfidence >= 80) return { style: 'กล้าได้กล้าเสีย', desc: 'มักใช้ความมั่นใจสูง' }
    return { style: 'รอบคอบ', desc: 'ใช้ความมั่นใจระดับกลาง' }
  }
  
  const categoryAccuracy = getCategoryAccuracy()
  const timePattern = getVotingTimePattern()
  const convictionStyle = getConvictionStyle()
  
  const categoryIcons = {
    sports: '⚽', entertainment: '🎬', politics: '🏛️', tech: '💻', business: '💰', world: '🌍', auto: '🚗', food: '🍜', travel: '✈️', health: '💪', relationship: '❤️', education: '📚', pets: '🐱', housing: '🏡', other: '🎭'

  }
  const categoryNames = {
    sports: 'กีฬา', entertainment: 'บันเทิง', politics: 'การเมือง', tech: 'เทคโนโลยี', business: 'ธุรกิจ', world: 'โลก', auto: 'ยานยนต์', food: 'อาหาร', travel: 'ท่องเที่ยว', health: 'สุขภาพ', relationship: 'ความสัมพันธ์', education: 'การศึกษา', pets: 'สัตว์เลี้ยง', housing: 'บ้าน', other: 'อื่นๆ'

  }
  
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
                  {profile.is_verified && (
                    <span className="verified-badge" title="Verified: สมาชิกที่มีส่วนร่วมอย่างต่อเนื่อง">
                      <svg viewBox="0 0 24 24" className="verified-check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
                    </span>
                  )}
                </h2>
                <div className="account-level"><span className="level-badge">{level.badge}</span><span className="level-name">{level.name}</span></div>
                <div className="account-reputation">{profile.reputation.toLocaleString()} point</div>
                {profile.email && <div className="account-email">📧 {profile.email}</div>}
                
                {/* Verified Status Section */}
                {profile.is_verified ? (
                  <div className="verified-status-section verified">
                    <div className="verified-status-badge">✓ Verified</div>
                    <p className="verified-status-desc">คุณเป็นสมาชิกที่มีส่วนร่วมอย่างต่อเนื่อง และความคิดเห็นของคุณมีน้ำหนักเต็มในระบบ</p>
                  </div>
                ) : (
                  <div className="verified-status-section not-verified">
                    <div className="verified-status-badge pending">ยังไม่ได้รับสถานะ Verified</div>
                    <p className="verified-status-desc">สถานะ Verified คือสัญญาณของความน่าเชื่อถือ ซึ่งได้จากการมีส่วนร่วมอย่างสม่ำเสมอและพฤติกรรมที่ดีในระบบ</p>
                    <p className="verified-status-cta">🌱 เริ่มสร้างความน่าเชื่อถือของคุณด้วยการโหวตและมีส่วนร่วม</p>
                  </div>
                )}
                
                {/* Profile Completion Prompt (for poll creation) */}
                {!profile.full_name && (
                  <button className="verify-prompt-btn" onClick={() => { onClose(); onOpenVerification() }}>
                    <span>📝</span>
                    <span>ยืนยันข้อมูลเพื่อสร้างโพลได้</span>
                    <span className="verify-arrow">→</span>
                  </button>
                )}
                
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
              <button className={`account-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>สถิติ</button>
              <button className={`account-tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>ประวัติ</button>
              <button className={`account-tab ${activeTab === 'polls' ? 'active' : ''}`} onClick={() => setActiveTab('polls')}>โพล</button>
              <button className={`account-tab ${activeTab === 'insight' ? 'active' : ''}`} onClick={() => setActiveTab('insight')}>Insight</button>
              <button className={`account-tab ${activeTab === 'followers' ? 'active' : ''}`} onClick={() => setActiveTab('followers')}>ผู้ติดตาม</button>
              <button className={`account-tab ${activeTab === 'following' ? 'active' : ''}`} onClick={() => setActiveTab('following')}>กำลังติดตาม</button>
            </div>
              <div className="account-content">
                              {/* v2: Profile Insight */}
              {activeTab === 'insight' && (
                <div className="insight-content">
                  <div className="insight-section">
                    <h4 className="insight-title">คุณมักคิดได้ดีในเรื่อง</h4>
                    {categoryAccuracy.length > 0 ? (
                      <div className="category-accuracy-list">
                        {categoryAccuracy.slice(0, 3).map((cat, i) => (
                          <div key={cat.category} className="category-accuracy-item">
                            <span className="category-icon">{categoryIcons[cat.category] || '📌'}</span>
                            <span className="category-name">{categoryNames[cat.category] || cat.category}</span>
                            <span className="category-percent">(แม่น {cat.accuracy}%)</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="insight-empty">ยังไม่มีข้อมูลเพียงพอ (ต้องมีอย่างน้อย 3 votes ต่อหมวด)</p>
                    )}
                  </div>
                  
                  <div className="insight-section">
                    <h4 className="insight-title">ช่วงเวลาที่คุณมักคิดได้ดี</h4>
                    {timePattern ? (
                      <p className="insight-value">{timePattern.period} (แม่น {timePattern.accuracy}%)</p>
                    ) : (
                      <p className="insight-empty">ยังไม่มีข้อมูลเพียงพอ</p>
                    )}
                  </div>
                  
                  <div className="insight-section">
                    <h4 className="insight-title">💭 สไตล์การคิดว่า..</h4>
                    {convictionStyle ? (
                      <div className="style-badge">
                        <span className="style-name">{convictionStyle.style}</span>
                        <span className="style-desc">{convictionStyle.desc}</span>
                      </div>
                    ) : (
                      <p className="insight-empty">ยังไม่มีข้อมูลเพียงพอ</p>
                    )}
                  </div>
                  
                  <div className="insight-note">
                    <span className="note-icon">📌</span>
                    <span className="note-text">
                      Insight นี้มาจากพฤติกรรมการใช้งาน<br/>
                      ไม่มีผลต่อ Reputation และไม่มีการเปิดเผยต่อผู้อื่น
                    </span>
                  </div>
                </div>
              )}
            
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

// ============================================================
// KIDWA: Admin Panel with MFA Section
// แทนที่ function AdminPanel เดิม (บรรทัด 1365-1479)
// ============================================================

// ===== Admin Panel =====
function AdminPanel({ onClose, darkMode, onRefresh, user }) {
  const [activeTab, setActiveTab] = useState('pending')
  const [polls, setPolls] = useState([])
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({})
  const [auditLogs, setAuditLogs] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedPollForResolve, setSelectedPollForResolve] = useState(null)

  useEffect(() => { loadData() }, [activeTab])

  const loadData = async () => {
    setIsLoading(true)
    if (activeTab === 'pending') { const { data } = await getPendingPolls(); setPolls(data || []) }
    else if (activeTab === 'all') { const { data } = await getAllPollsAdmin(); setPolls(data || []) }
    else if (activeTab === 'users') { const { data } = await getAllUsers(); setUsers(data || []) }
    else if (activeTab === 'logs') { const { data } = await getAdminAuditLogs(50); setAuditLogs(data || []) }
    // Tab 'mfa' ไม่ต้อง load data เพิ่ม - AdminMFASection จะ load เอง
    const statsData = await getAdminStats(); setStats(statsData)
    setIsLoading(false)
  }

  const handleResolvePoll = async (pollId, correctOptionId) => { 
    if (!confirm('ยืนยันการเฉลยโพลนี้?')) return
    const { error } = await resolvePoll(pollId, correctOptionId, user?.id)
    if (!error) { alert('✅ เฉลยโพลสำเร็จ!'); loadData(); onRefresh(); setSelectedPollForResolve(null) }
  }
  
  const handleDeletePoll = async (pollId) => { 
    if (!confirm('ยืนยันการลบโพลนี้?')) return
    const { error } = await deletePoll(pollId, user?.id)
    if (!error) { alert('🗑️ ลบโพลสำเร็จ!'); loadData(); onRefresh() }
  }
  
  const handleToggleFeatured = async (pollId, featured) => { await toggleFeatured(pollId, featured, user?.id); loadData(); onRefresh() }
  const handleToggleBan = async (userId, isBanned) => { await toggleBanUser(userId, isBanned, user?.id); loadData() }

  const expiredPolls = polls.filter(p => !p.resolved && isExpired(p.ends_at))
  const upcomingPolls = polls.filter(p => !p.resolved && !isExpired(p.ends_at))

  const formatLogTime = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
  }

  const getActionLabel = (action) => {
    const labels = {
      'resolve_poll': '✅ เฉลยโพล',
      'delete_poll': '🗑️ ลบโพล',
      'toggle_featured': '⭐ เปลี่ยน Featured',
      'ban_user': '🚫 แบน User',
      'unban_user': '✅ ปลดแบน User'
    }
    return labels[action] || action
  }

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
          <button className={`admin-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>📊 โพล</button>
          <button className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>👥 Users</button>
          <button className={`admin-tab ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>📜 Logs</button>
          <button className={`admin-tab ${activeTab === 'mfa' ? 'active' : ''}`} onClick={() => setActiveTab('mfa')}>🔐 2FA</button>
        </div>
        <div className="admin-content">
          {isLoading && activeTab !== 'mfa' ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>⏳ กำลังโหลด...</div>
          ) : activeTab === 'pending' ? (
            <>
              {expiredPolls.length > 0 && <div className="admin-section"><h3 className="admin-section-title">🔴 หมดเวลาแล้ว - รอเฉลย</h3>{expiredPolls.map(poll => (<div key={poll.id} className="admin-poll-item"><div className="admin-poll-info"><span className="admin-poll-question">{poll.question}</span><span className="admin-poll-meta">👥 {poll.options?.reduce((s, o) => s + o.votes, 0)} โหวต</span></div><div className="admin-poll-actions"><button className="btn btn-sm btn-success" onClick={() => setSelectedPollForResolve(poll)}>✅ เฉลย</button><button className="btn btn-sm btn-danger" onClick={() => handleDeletePoll(poll.id)}>🗑️</button></div></div>))}</div>}
              {upcomingPolls.length > 0 && <div className="admin-section"><h3 className="admin-section-title">🟢 ยังไม่หมดเวลา</h3>{upcomingPolls.slice(0, 5).map(poll => (<div key={poll.id} className="admin-poll-item"><div className="admin-poll-info"><span className="admin-poll-question">{poll.question}</span><span className="admin-poll-meta">⏱️ {getDaysRemaining(poll.ends_at)}</span></div></div>))}</div>}
              {expiredPolls.length === 0 && upcomingPolls.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>ไม่มีโพลรอเฉลย</div>}
            </>
          ) : activeTab === 'all' ? (
            <div className="admin-section">{polls.map(poll => (<div key={poll.id} className="admin-poll-item"><div className="admin-poll-info"><span className="admin-poll-question">{poll.featured && '⭐ '}{poll.resolved && '✅ '}{poll.question}</span><span className="admin-poll-meta">{categories.find(c => c.id === poll.category)?.icon} • 👥 {poll.options?.reduce((s, o) => s + o.votes, 0)}</span></div><div className="admin-poll-actions"><button className={`btn btn-sm ${poll.featured ? 'btn-warning' : 'btn-secondary'}`} onClick={() => handleToggleFeatured(poll.id, !poll.featured)}>{poll.featured ? '⭐' : '☆'}</button>{!poll.resolved && isExpired(poll.ends_at) && <button className="btn btn-sm btn-success" onClick={() => setSelectedPollForResolve(poll)}>✅</button>}<button className="btn btn-sm btn-danger" onClick={() => handleDeletePoll(poll.id)}>🗑️</button></div></div>))}</div>
          ) : activeTab === 'users' ? (
            <div className="admin-section">{users.map((u, i) => (<div key={u.id} className="admin-user-item"><div className="admin-user-info"><span className="admin-user-rank">{i + 1}</span><span className="admin-user-name">{u.is_banned && '🚫 '}{u.is_admin && '👑 '}{u.username}</span><span className="admin-user-rep">{getReputationLevel(u.reputation).badge} {u.reputation} pt</span></div><div className="admin-user-actions">{!u.is_admin && <button className={`btn btn-sm ${u.is_banned ? 'btn-success' : 'btn-danger'}`} onClick={() => handleToggleBan(u.id, !u.is_banned)}>{u.is_banned ? '✅ ปลดแบน' : '🚫 แบน'}</button>}</div></div>))}</div>
          ) : activeTab === 'logs' ? (
            <div className="admin-section audit-logs-section">
              {auditLogs.length > 0 ? auditLogs.map(log => (
                <div key={log.id} className="audit-log-item">
                  <div className="audit-log-action">{getActionLabel(log.action_type)}</div>
                  <div className="audit-log-details">
                    <span className="audit-log-admin">👤 {log.users?.username || 'Unknown'}</span>
                    <span className="audit-log-time">🕐 {formatLogTime(log.created_at)}</span>
                  </div>
                  {log.details?.question && <div className="audit-log-target">📌 {log.details.question}</div>}
                  {log.details?.username && <div className="audit-log-target">👤 {log.details.username}</div>}
                </div>
              )) : <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>ยังไม่มี Audit Logs</div>}
            </div>
          ) : activeTab === 'mfa' ? (
            /* ===== MFA Tab Content ===== */
            <AdminMFASection darkMode={darkMode} />
          ) : null}
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
  const [pollLimit, setPollLimit] = useState({ canCreate: false, used: 0, limit: 3, remaining: 0, hasCompletedProfile: false })
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
    const { data: newPoll, error } = await createPoll({ 
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
    else { 
      // Show poll link
      const pollUrl = `${window.location.origin}/${category}/${newPoll.id}`
      const shareMessage = `🎉 สร้างโพลสำเร็จ!\n\n"${question.trim()}"\n\n🔗 ${pollUrl}\n\nกดตกลงเพื่อคัดลอก link`
      if (confirm(shareMessage)) {
        navigator.clipboard.writeText(pollUrl).then(() => {
          alert('✅ คัดลอก link แล้ว!')
        }).catch(() => {
          prompt('คัดลอก link นี้:', pollUrl)
        })
      }
      onSuccess()
      onClose() 
    }
  }

  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(tagInput.toLowerCase()) && !selectedTags.find(t => t.id === tag.id)
  ).slice(0, 5)

  // Profile not completed - show prompt
  if (!pollLimit.hasCompletedProfile && !user.is_admin) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className={`modal create-poll-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>✕</button>
          <div className="poll-limit-exceeded">
            <span className="limit-icon">📝</span>
            <h2>ยืนยันข้อมูลเพิ่มเติม</h2>
            <p>กรุณายืนยันข้อมูลพื้นฐาน<br/>เพื่อปลดล็อกสิทธิ์สร้างโพล</p>
            <div className="verify-upsell">
              <p>📊 สร้างโพลได้ 3 โพล/วัน</p>
              <p>📈 ช่วยให้เราเข้าใจภาพรวมผู้ใช้</p>
            </div>
            <button className="btn btn-secondary" onClick={onClose}>ปิด</button>
          </div>
        </div>
      </div>
    )
  }

  // Profile completed but exceeded limit
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
                  <span className="mode-icon">🔮</span><span className="mode-title">คิดว่าในอนาคต..</span><span className="mode-desc">มีคำตอบถูก-ผิด • Blind Mode</span>
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

// ===== Create ถ่ายทอดสด Modal (Date+Time Picker with +7h fix) =====
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
    else { alert('⚡ สร้าง ถ่ายทอดสด สำเร็จ!'); onSuccess(); onClose() }
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
        <h2 className="modal-title">⚡ สร้าง ถ่ายทอดสด</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          โพลแบบ Real-time • เห็นผลโหวตทันที
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>❓ คำถาม</label>
            <input type="text" className={`form-input ${errors.question ? 'error' : ''}`} placeholder="เช่น ใครจะชนะ Miss Universe คืนนี้?" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />
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
              {isSubmitting ? '⏳ กำลังสร้าง...' : '⚡ เริ่ม ถ่ายทอดสด'}
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
          คิดว่าในอนาคตระยะยาว 1-10 ปี • Blind Mode อัตโนมัติ
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>❓ คำถามคิดว่าในอนาคต..</label>
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

// ===== Demographics Modal (Profile Completion) =====
// Note: This modal collects user demographics for analytics.
// Completing this allows creating polls (3/day).
// Verified badge ✓ is earned separately through participation.

const GENDER_OPTIONS = [
  { value: '', label: '-- เลือกเพศ (ไม่บังคับ) --' },
  { value: 'male', label: 'ชาย' },
  { value: 'female', label: 'หญิง' },
  { value: 'transgender', label: 'Transgender' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'อื่นๆ' },
  { value: 'prefer_not_to_say', label: 'ไม่ต้องการระบุ' },
]

function DemographicsModal({ onClose, user, onSuccess, darkMode }) {
  const [fullName, setFullName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState('')
  const [pdpaConsent, setPdpaConsent] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

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
    const { data, error: submitError } = await submitDemographics(user.id, { 
      fullName: fullName.trim(), 
      birthDate, 
      gender: gender || null,
      pdpaConsent, 
      marketingConsent 
    })
    setIsSubmitting(false)
    if (submitError) { setError(submitError.message) } 
    else { onSuccess({ ...user, full_name: fullName, birth_date: birthDate, gender }) }
  }

  const handleSkip = async () => { await skipVerification(user.id); onClose() }

  // Terms Modal Content
  if (showTerms) {
    return (
      <div className="modal-overlay">
        <div className={`modal info-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowTerms(false)}>✕</button>
          <div className="info-modal-header">
            <h2>📜 เงื่อนไขการใช้งาน</h2>
          </div>
          <div className="info-modal-content" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <h4>1. การยอมรับเงื่อนไข</h4>
            <p>การใช้งานเว็บไซต์ คิดว่า.. (i-kidwa.com) ถือว่าคุณยอมรับเงื่อนไขการใช้งานทั้งหมด</p>
            
            <h4>2. การใช้งานที่เหมาะสม</h4>
            <p>• ห้ามโพสต์เนื้อหาที่ผิดกฎหมาย หยาบคาย หรือสร้างความเกลียดชัง</p>
            <p>• ห้ามสร้างโพลที่มีจุดประสงค์หลอกลวงหรือสแปม</p>
            <p>• ห้ามใช้บอทหรือระบบอัตโนมัติในการโหวต</p>
            
            <h4>3. ระบบ Reputation</h4>
            <p>• คะแนน Reputation จะเปลี่ยนแปลงตามความถูกต้องของการโหวต</p>
            <p>• Admin มีสิทธิ์ปรับคะแนนหรือระงับบัญชีหากพบการกระทำผิด</p>
            
            <h4>4. ความรับผิดชอบ</h4>
            <p>• เนื้อหาที่ผู้ใช้สร้างเป็นความรับผิดชอบของผู้ใช้เอง</p>
            <p>• ทีมงานไม่รับผิดชอบต่อความเสียหายที่เกิดจากการใช้งาน</p>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setShowTerms(false)}>ปิด</button>
        </div>
      </div>
    )
  }

  // Privacy Modal Content
  if (showPrivacy) {
    return (
      <div className="modal-overlay">
        <div className={`modal info-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
          <button className="modal-close" onClick={() => setShowPrivacy(false)}>✕</button>
          <div className="info-modal-header">
            <h2>🔒 นโยบายความเป็นส่วนตัว (PDPA)</h2>
          </div>
          <div className="info-modal-content" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <h4>1. ข้อมูลที่เราเก็บ</h4>
            <p>• ข้อมูลบัญชี: อีเมล, ชื่อผู้ใช้, รูปโปรไฟล์</p>
            <p>• ข้อมูลเพิ่มเติม: ชื่อจริง, วันเกิด, เพศ (เก็บเป็นความลับ)</p>
            <p>• ข้อมูลการใช้งาน: ประวัติการโหวต, โพลที่สร้าง</p>
            
            <h4>2. การใช้ข้อมูล</h4>
            <p>• เพื่อให้บริการและปรับปรุงประสบการณ์ผู้ใช้</p>
            <p>• เพื่อวิเคราะห์ภาพรวมผู้ใช้และปรับการแสดงผล</p>
            <p>• เพื่อส่งการแจ้งเตือนที่เกี่ยวข้อง (ถ้าคุณยินยอม)</p>
            
            <h4>3. การเปิดเผยข้อมูล</h4>
            <p>• เราจะไม่ขายหรือแบ่งปันข้อมูลส่วนบุคคลกับบุคคลที่สาม</p>
            <p>• ข้อมูลชื่อจริง วันเกิด และเพศจะไม่แสดงต่อสาธารณะ</p>
            
            <h4>4. สิทธิ์ของคุณ</h4>
            <p>• คุณสามารถขอดู แก้ไข หรือลบข้อมูลของคุณได้ตลอดเวลา</p>
            <p>• ติดต่อทีมงานผ่านอีเมลเพื่อใช้สิทธิ์ตาม PDPA</p>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={() => setShowPrivacy(false)}>ปิด</button>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay">
      <div className={`modal verification-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <div className="verification-header">
          <span className="verification-icon">📝</span>
          <h2>ยืนยันข้อมูลเพิ่มเติม</h2>
          <p>เพื่อปลดล็อกสิทธิ์สร้างโพล</p>
        </div>
        <div className="verification-benefits">
          <div className="benefit-item"><span>📊</span><span>สร้างโพลได้ 3 โพล/วัน</span></div>
          <div className="benefit-item"><span>📈</span><span>ช่วยให้เราเข้าใจภาพรวมของผู้ใช้</span></div>
        </div>
        <div className="demographics-note">
          <span>ℹ️</span>
          <span>เราใช้อีเมลเพื่อยืนยันว่าคุณเป็นเจ้าของบัญชีนี้จริง ข้อมูลนี้ช่วยให้เราเข้าใจภาพรวมของผู้ใช้และปรับการแสดงผลให้เหมาะสมยิ่งขึ้น</span>
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
          <div className="form-group">
            <label>🏳️‍🌈 เพศ <span className="optional-label">(ไม่บังคับ - สำหรับวิเคราะห์ภาพรวมเท่านั้น)</span></label>
            <select className="form-input" value={gender} onChange={e => setGender(e.target.value)}>
              {GENDER_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="consent-section">
            <label className="consent-item required">
              <input type="checkbox" checked={pdpaConsent} onChange={e => setPdpaConsent(e.target.checked)} />
              <span>ยอมรับ<a href="#" onClick={(e) => { e.preventDefault(); setShowTerms(true) }}>เงื่อนไขการใช้งาน</a>และ<a href="#" onClick={(e) => { e.preventDefault(); setShowPrivacy(true) }}>นโยบายความเป็นส่วนตัว</a> (PDPA)<span className="required-mark">*</span></span>
            </label>
            <label className="consent-item optional">
              <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)} />
              <span>ยินยอมรับข่าวสารและการแจ้งเตือนพิเศษ (ไม่บังคับ)</span>
            </label>
          </div>
          <div className="verification-note"><span>🔒</span><span>ข้อมูลของคุณจะถูกเก็บรักษาอย่างปลอดภัยและไม่แสดงต่อสาธารณะ</span></div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleSkip}>ข้ามไปก่อน</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? '⏳ กำลังบันทึก...' : '✅ บันทึกข้อมูล'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Alias for backward compatibility
const VerificationModal = DemographicsModal

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
                  {profile.is_verified && <span className="verified-badge" title="Verified: สมาชิกที่มีส่วนร่วมอย่างต่อเนื่อง"><svg viewBox="0 0 24 24" className="verified-check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>}
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
              <span className="tag-count">{tag.vote_count || tag.poll_count} โหวต</span>
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
      <button className="notification-close-btn" onClick={onClose}>✕</button>
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
  const searchParams = useSearchParams()
  
  // Parse slug from URL: /sports → ['sports'], /tag/foo → ['tag', 'foo']
  const slug = params?.slug || []
  
  // Determine initial category and tag from URL (supports both /tag/xxx and /?tag=xxx)
  const getInitialState = () => {
    // Check query string first: /?tag=xxx
    const queryTag = searchParams?.get('tag')
    if (queryTag) return { category: 'home', tag: decodeURIComponent(queryTag) }
    
    // Then check path: /tag/xxx
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
  const [showAuthModal, setShowAuthModal] = useState(null) // null, 'login', or 'register'
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
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false)
  const [showAboutUs, setShowAboutUs] = useState(false)

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
  const dropdownRef = useRef(null)
  const categoriesMobileRef = useRef(null)
  
  // Get visible and hidden categories
  const visibleCategories = categories.slice(0, VISIBLE_CATEGORIES)
  const hiddenCategories = categories.slice(VISIBLE_CATEGORIES)

  // Sync state with URL when slug or search params changes
  useEffect(() => {
    const newState = getInitialState()
    setActiveCategory(newState.category)
    setActiveTag(newState.tag)
  }, [slug.join('/'), searchParams?.get('tag')])

  // Initial load
  useEffect(() => { 
    loadPolls()
    loadLiveBattles()
    loadTimeCapsules()
    checkAuthSession()
    const d = localStorage.getItem('kidwa-darkmode')
    if (d) setDarkMode(JSON.parse(d))
    
    // Realtime subscription for vote count updates
    // Note: Blind mode polls are filtered out to maintain integrity
    const optionsChannel = supabase
      .channel('options-realtime')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'options' }, 
        (payload) => {
          console.log('REALTIME:', payload)
          // Update polls state with new vote count
          // Skip blind mode polls that aren't resolved
          setPolls(prev => prev.map(poll => {
            // Blind mode integrity: Don't update vote counts until resolved
            if (poll.blind_mode && !poll.resolved) return poll
            return {
              ...poll,
              options: poll.options?.map(opt => 
                opt.id === payload.new.id 
                  ? { ...opt, votes: payload.new.votes }
                  : opt
              )
            }
          }))
          // ถ่ายทอดสดs are never blind mode, always update
          setLiveBattles(prev => prev.map(poll => ({
            ...poll,
            options: poll.options?.map(opt => 
              opt.id === payload.new.id 
                ? { ...opt, votes: payload.new.votes }
                : opt
            )
          })))
        }
      )
      .subscribe((status) => {
        console.log('Realtime status:', status)
      })
    
    return () => {
      supabase.removeChannel(optionsChannel)
    }
  }, [])

  // Reset categories mobile scroll to start
  useEffect(() => {
    if (categoriesMobileRef.current) {
      categoriesMobileRef.current.scrollLeft = 0
    }
  }, [])

  // Auth session check
  const checkAuthSession = async () => {
    const { data: userData } = await getUserFromSession()
    if (userData) {
      // Check and auto-grant verified status if eligible
      const { granted } = await checkAndGrantVerified(userData.id)
      if (granted) {
        // Refresh user data to get updated is_verified status
        const { data: updatedUser } = await getUserFromSession()
        if (updatedUser) {
          setUser(updatedUser)
          localStorage.setItem('kidwa-user', JSON.stringify(updatedUser))
        }
      } else {
        setUser(userData)
        localStorage.setItem('kidwa-user', JSON.stringify(userData))
      }
      
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
  
  // Auto-refresh ถ่ายทอดสดs
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
    router.push(`/?tag=${encodeURIComponent(tagName)}`, { scroll: false })
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
    if (!user) { setShowAuthModal('login'); return }
    const poll = polls.find(p => p.id === pollId) || liveBattles.find(p => p.id === pollId)
    if (poll && isExpired(poll.ends_at)) { alert('โพลนี้หมดเวลาแล้ว'); return }
    const { error } = await vote(user.id, pollId, optionId, confidence)
    if (error) {
      // Show server-side validation error
      alert(`❌ ${error.message || 'เกิดข้อผิดพลาด'}`)
      return
    }
    setUserVotes(prev => ({ ...prev, [pollId]: { optionId, confidence } }))
    await loadPolls()
    const totalVotes = (poll?.options?.reduce((sum, opt) => sum + (opt.votes || 0), 0) || 0) + 1
    alert(`✅ บันทึกโหวตของคุณแล้ว\nตอนนี้มีผู้ร่วมโหวต ${totalVotes.toLocaleString()} คน`)
    await checkAndAwardCreatorPoints(pollId)
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
      {/* Sticky Header + Categories Block */}
      <div className="sticky-header-block">
        {/* Header */}
        <header className="header">
          <div className="header-content">
            <div className="logo" onClick={() => handleCategoryChange('home')}>
              <span className="logo-text">คิดว่า..</span>
            </div>
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="ค้นหา.." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="header-actions">
            <button className="menu-btn show-mobile-only" onClick={() => setShowMenu(!showMenu)}>☰</button>
            {user ? (
              <>
                <button className="btn btn-create hide-mobile" onClick={() => { setShowCreatePoll(true); setShowMenu(false) }}>➕ สร้างโพล</button>
                <div className="notification-btn-wrapper hide-mobile">
                  <button className="notification-btn" onClick={() => { setShowNotifications(!showNotifications); setShowMenu(false) }}>
                    🔔
                    {unreadCount > 0 && <span className="notification-badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                  </button>
                </div>
                <div className="user-badge hide-mobile" onClick={() => { setShowAccount(true); setShowMenu(false) }}>
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="user-avatar-img" />
                  ) : (
                    <KidwaBean level={getLevelKey(user.reputation)} size={36} />
                  )}
                  <div>
                    <span style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {user.username}
                      {user.is_verified && <span className="verified-badge" title="Verified: สมาชิกที่มีส่วนร่วมอย่างต่อเนื่อง"><svg viewBox="0 0 24 24" className="verified-check"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>}
                    </span>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{getReputationLevel(user.reputation).badge} {user.reputation} pt</div>
                  </div>
                </div>
                <button className="menu-btn hide-mobile" onClick={() => setShowMenu(!showMenu)}>☰</button>
              </>
            ) : (
              <>
                <button className="btn btn-secondary hide-mobile" onClick={() => setShowAuthModal('login')}>เข้าสู่ระบบ</button>
                <button className="btn btn-primary hide-mobile" onClick={() => setShowAuthModal('register')}>สมัครสมาชิก</button>
                <button className="menu-btn hide-mobile" onClick={() => setShowMenu(!showMenu)}>☰</button>
              </>
            )}
          </div>
        </div>
        
        {/* Mobile dropdown menu */}
        {showMenu && (
          <div className="dropdown-menu" ref={dropdownRef}>
            {!user && (
              <>
                <button className="dropdown-item" onClick={() => { setShowAuthModal('login'); setShowMenu(false) }}>เข้าสู่ระบบ</button>
                <button className="dropdown-item" onClick={() => { setShowAuthModal('register'); setShowMenu(false) }}>สมัครสมาชิก</button>
                <button className="dropdown-item" onClick={() => { setDarkMode(!darkMode); setShowMenu(false) }}>{darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</button>
                <div className="dropdown-divider"></div>
              </>
            )}
            {user && (
              <>
                <div className="dropdown-item user-info-mobile">
                  <div className="user-avatar-mobile">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} className="user-avatar-img-mobile" />
                    ) : (
                      <KidwaBean level={getLevelKey(user.reputation)} size={40} />
                    )}
                  </div>
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
                {user.is_admin && <button className="dropdown-item" onClick={() => { setShowAdminPanel(true); setShowMenu(false) }}>Admin Panel</button>}
                <button className="dropdown-item" onClick={() => { setDarkMode(!darkMode); setShowMenu(false) }}>{darkMode ? 'โหมดสว่าง' : 'โหมดมืด'}</button>
                <div className="dropdown-divider"></div>
              </>
            )}
              <button className="dropdown-item" onClick={() => { setShowLeaderboardModal(true); setShowMenu(false) }}>อันดับ Leaderboard</button>
              <button className="dropdown-item" onClick={() => { setShowAboutUs(true); setShowMenu(false) }}>เกี่ยวกับ คิดว่า..</button>
              <button className="dropdown-item" onClick={() => { setShowPostingGuidelines(true); setShowMenu(false) }}>คำแนะนำการโพสต์</button>
              <button className="dropdown-item" onClick={() => { setShowMemberPrivileges(true); setShowMenu(false) }}>สิทธิ์การใช้งานของสมาชิก</button>
              <button className="dropdown-item" onClick={() => { setShowPrivacyPolicy(true); setShowMenu(false) }}>นโยบายข้อมูลส่วนบุคคล</button>
              <button className="dropdown-item" onClick={() => { setShowPWAInstall(true); setShowMenu(false) }}>Download App คิดว่า..</button>
            {user && (
              <>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item" onClick={handleLogout} style={{ color: 'var(--red)' }}>ออกจากระบบ</button>
              </>
            )}
          </div>
        )}
      </header>

      {/* Categories Navigation - Mobile: slide, Desktop: with More */}
      <nav className="categories">
        <div className="categories-content categories-desktop">
          {visibleCategories.map(cat => (
            <button 
              key={cat.id} 
              className={`category-btn ${activeCategory === cat.id && !activeTag ? 'active' : ''}`} 
              onClick={() => handleCategoryChange(cat.id)}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
          
          {/* More dropdown - Desktop only */}
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
        
        {/* Mobile: Horizontal scroll all categories */}
        <div className="categories-content categories-mobile" ref={categoriesMobileRef}>
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
      {/* End Sticky Block */}

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

          {/* ถ่ายทอดสด Section */}
          {activeCategory === 'live' ? (
            <section>
              <div className="section-header">
                <h2 className="section-title">⚡ ถ่ายทอดสด</h2>
                {user && (user.full_name || user.is_admin) && (
                  <button className="btn btn-live-create" onClick={() => setShowCreateLiveBattle(true)}>⚡ สร้าง ถ่ายทอดสด</button>
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
                  <p>ยังไม่มี ถ่ายทอดสด ที่กำลังดำเนินอยู่</p>
                </div>
              )}
            </section>
          ) : activeCategory === 'timecapsule' ? (
            <section>
              <div className="section-header">
                <h2 className="section-title">💊 Time Capsule</h2>
                {user?.is_admin && <button className="btn btn-capsule-create" onClick={() => setShowCreateTimeCapsule(true)}>💊 สร้าง Time Capsule</button>}
              </div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>คิดว่าในอนาคตระยะยาว 1-10 ปี</p>
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
              {/* ถ่ายทอดสด Preview on Home */}
              {activeCategory === 'home' && !activeTag && liveBattles.length > 0 && (
                <section>
                  <div className="section-header">
                    <h2 className="section-title">⚡ ถ่ายทอดสด กำลังดำเนินอยู่</h2>
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
              {user && user.full_name && <button className="btn btn-primary" onClick={() => setShowCreatePoll(true)}>➕ สร้างโพลแรก</button>}
            </div>
          )}
        </div>
      </main>

      {/* ===== MODALS ===== */}
      
      {/* Auth Modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(null)} onSuccess={(userData) => { setUser(userData); localStorage.setItem('kidwa-user', JSON.stringify(userData)); setShowAuthModal(null) }} darkMode={darkMode} initialMode={showAuthModal} />}
      
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
            
            {isExpired(selectedPoll.ends_at) && !selectedPoll.resolved && <div className="expired-notice">⏰ โพลนี้หมดเวลาแล้ว รอเฉลย</div>}
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
              <div onClick={() => { setSelectedPoll(null); setShowAuthModal('login') }} className="login-prompt">🔒 เข้าสู่ระบบเพื่อโหวต</div>
            )}
            
            {/* Tags */}
            {selectedPoll.tags && selectedPoll.tags.length > 0 && (
              <div className="poll-detail-tags">
                {selectedPoll.tags.map(tag => (
                  <button 
                    key={tag.id} 
                    className="poll-detail-tag"
                    onClick={() => { setSelectedPoll(null); setActiveTag(tag.name); router.push(`/?tag=${encodeURIComponent(tag.name)}`, { scroll: false }) }}
                  >
                    #{tag.name}
                  </button>
                ))}
              </div>
           )}
            
            {/* Vote History Button - สำหรับโพลที่เฉลยแล้ว */}
            {selectedPoll.resolved && (
              <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                <VoteHistoryButton pollId={selectedPoll.id} darkMode={darkMode} />
              </div>
            )}
            
            <ShareButtons poll={selectedPoll} />
          </div>
        </div>
      )}
      
      {/* Create Poll Modal */}
      {showCreatePoll && <CreatePollModal onClose={() => setShowCreatePoll(false)} user={user} onSuccess={loadPolls} darkMode={darkMode} />}
      
      {/* Admin Panel */}
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} darkMode={darkMode} onRefresh={loadPolls} user={user} />}
      
      {/* Account Modal */}
      {showAccount && <AccountModal onClose={() => setShowAccount(false)} user={user} darkMode={darkMode} onUpdateUser={setUser} onOpenVerification={() => setShowVerificationModal(true)} />}
      
      {/* ถ่ายทอดสด & Time Capsule Modals */}
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
      
      {/* Global Notification Dropdown */}
      {showNotifications && (
        <>
          <div className="notification-backdrop" onClick={() => { setShowNotifications(false); loadUnreadCount() }}></div>
          <div className="notification-dropdown-global">
            <NotificationDropdown user={user} onClose={() => { setShowNotifications(false); loadUnreadCount() }} />
          </div>
        </>
      )}
      
      {/* Policy Modals */}
      {showPostingGuidelines && <PostingGuidelinesModal onClose={() => setShowPostingGuidelines(false)} darkMode={darkMode} />}
      {showMemberPrivileges && <MemberPrivilegesModal onClose={() => setShowMemberPrivileges(false)} darkMode={darkMode} />}
      {showPrivacyPolicy && <PrivacyPolicyModal onClose={() => setShowPrivacyPolicy(false)} darkMode={darkMode} />}
      {showPWAInstall && <PWAInstallModal onClose={() => setShowPWAInstall(false)} darkMode={darkMode} />}
      
      {/* Leaderboard Modal */}
      {showLeaderboardModal && <LeaderboardModal onClose={() => setShowLeaderboardModal(false)} darkMode={darkMode} currentUser={user} onViewProfile={setViewProfileUserId} />}
      {showAboutUs && <AboutUsModal onClose={() => setShowAboutUs(false)} darkMode={darkMode} />}
    </div>
  )
}
// ============================================================
// KIDWA: Opinion Poll & Admin Extension UI Components
// Add these components to app/page.js
// ============================================================

// ===== IMPORT ADDITIONS =====
// Add to imports at top of page.js:
/*
import {
  createOpinionPoll,
  suggestShadowOption,
  voteForShadowOption,
  getShadowOptions,
  voteOthersWithShadow,
  extendPollTime,
  getPollExtensionHistory,
  getOpinionPolls,
  checkSuggestionValidity,
  getCleanupHealth,
  safeResolvePoll,
  closeOpinionPoll
} from '@/lib/supabase'
*/

// ===== SHADOW OPTIONS MODAL =====
// Shows when user clicks "อื่นๆ" option

function OthersOptionsModal({ poll, currentUser, darkMode, onClose, onVote }) {
  const [shadowOptions, setShadowOptions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showSuggestionForm, setShowSuggestionForm] = useState(false)
  const [suggestionText, setSuggestionText] = useState('')
  const [suggestionError, setSuggestionError] = useState('')
  const [similarShadow, setSimilarShadow] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadShadowOptions()
  }, [poll.id])

  const loadShadowOptions = async () => {
    setIsLoading(true)
    const { data } = await getShadowOptions(poll.id)
    setShadowOptions(data || [])
    setIsLoading(false)
  }

  const handleSuggestionChange = async (text) => {
    setSuggestionText(text)
    setSuggestionError('')
    setSimilarShadow(null)
    
    if (text.length >= 2) {
      // Check validity as user types
      const validation = await checkSuggestionValidity(poll.id, text, currentUser?.id)
      if (!validation.valid) {
        setSuggestionError(validation.error)
        if (validation.similarShadow) {
          setSimilarShadow(validation.similarShadow)
        }
      }
    }
  }

  const handleSubmitSuggestion = async () => {
    if (!currentUser?.is_verified) {
      setSuggestionError('ต้องเป็น Verified user เพื่อเสนอตัวเลือก')
      return
    }

    setIsSubmitting(true)
    const { data, error, similarShadow: foundSimilar, canSupport } = await suggestShadowOption(
      poll.id, 
      suggestionText, 
      currentUser.id
    )

    if (error) {
      setSuggestionError(error.message)
      if (foundSimilar && canSupport) {
        setSimilarShadow(foundSimilar)
      }
    } else {
      setSuggestionText('')
      setShowSuggestionForm(false)
      await loadShadowOptions()
    }
    setIsSubmitting(false)
  }

  const handleVoteShadow = async (shadowId) => {
    if (!currentUser) return
    
    const { data, error, promoted, promotionMessage } = await voteForShadowOption(shadowId, currentUser.id)
    
    if (error) {
      alert(error.message)
    } else {
      await loadShadowOptions()
      if (promoted) {
        alert(promotionMessage)
        onClose() // Close modal and refresh poll
      }
    }
  }

  const handleVoteOthersWithShadow = async (shadowId) => {
    if (!currentUser) return
    
    const { data, error } = await voteOthersWithShadow(currentUser.id, poll.id, shadowId, 50)
    
    if (error) {
      alert(error.message)
    } else {
      onVote && onVote()
      onClose()
    }
  }

  const handleSupportSimilar = async () => {
    if (similarShadow) {
      await handleVoteShadow(similarShadow.id)
      setSimilarShadow(null)
      setSuggestionText('')
    }
  }

  const getProgressPercentage = (shadow) => {
    // Dynamic threshold based on poll size
    const threshold = Math.max(3, Math.ceil(poll.totalVotes * 0.1))
    return Math.min(100, Math.round((shadow.unique_voters / threshold) * 100))
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal others-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <div className="others-modal-header">
          <h2>💡 คำตอบที่ชุมชนกำลังพิจารณา</h2>
          <p className="others-modal-subtitle">โหวตสนับสนุนตัวเลือกที่คุณเห็นด้วย หรือเสนอตัวเลือกใหม่</p>
        </div>

        <div className="others-modal-content">
          {isLoading ? (
            <div className="loading-spinner">กำลังโหลด...</div>
          ) : shadowOptions.length === 0 ? (
            <div className="no-shadows">
              <p>ยังไม่มีตัวเลือกเพิ่มเติมในขณะนี้</p>
              <p className="no-shadows-hint">คุณเป็นคนแรกที่เสนอตัวเลือกใหม่!</p>
            </div>
          ) : (
            <div className="shadow-options-list">
              {shadowOptions.map((shadow) => (
                <div key={shadow.id} className="shadow-option-card">
                  <div className="shadow-option-text">{shadow.text}</div>
                  <div className="shadow-option-status">
                    <span className="shadow-status-label">กำลังถูกพิจารณาโดยชุมชน</span>
                    <div className="shadow-progress-bar">
                      <div 
                        className="shadow-progress-fill" 
                        style={{ width: `${getProgressPercentage(shadow)}%` }}
                      />
                    </div>
                    <span className="shadow-progress-text">
                      {shadow.unique_voters}/{Math.max(3, Math.ceil((poll.totalVotes || 0) * 0.1))} คนสนับสนุน
                    </span>
                  </div>
                  <div className="shadow-option-actions">
                    <button 
                      className="btn-support-shadow"
                      onClick={() => handleVoteShadow(shadow.id)}
                      disabled={!currentUser?.email_verified}
                    >
                      👍 สนับสนุน
                    </button>
                    <button 
                      className="btn-vote-shadow"
                      onClick={() => handleVoteOthersWithShadow(shadow.id)}
                      disabled={!currentUser}
                    >
                      ✓ โหวตเลือกนี้
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="suggestion-section">
            {!showSuggestionForm ? (
              <button 
                className="btn-show-suggestion"
                onClick={() => setShowSuggestionForm(true)}
                disabled={!currentUser?.is_verified}
              >
                💡 เสนอตัวเลือกเพิ่มเติม
              </button>
            ) : (
              <div className="suggestion-form">
                <label>เสนอตัวเลือกของคุณ:</label>
                <input
                  type="text"
                  value={suggestionText}
                  onChange={(e) => handleSuggestionChange(e.target.value)}
                  placeholder="พิมพ์คำตอบที่คุณต้องการเสนอ..."
                  maxLength={100}
                  className={suggestionError ? 'input-error' : ''}
                />
                
                {suggestionError && (
                  <div className="suggestion-error">
                    <span>⚠️ {suggestionError}</span>
                    {similarShadow && (
                      <div className="similar-shadow-suggestion">
                        <p>มีคนเสนอคำตอบคล้ายกันไว้แล้ว:</p>
                        <div className="similar-shadow-card">
                          <span>"{similarShadow.text}"</span>
                          <span className="similar-shadow-progress">
                            ({similarShadow.unique_voters}/3 คนสนับสนุน)
                          </span>
                        </div>
                        <button 
                          className="btn-support-similar"
                          onClick={handleSupportSimilar}
                        >
                          สนับสนุนอันนี้แทน
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="suggestion-form-actions">
                  <button 
                    className="btn-cancel"
                    onClick={() => {
                      setShowSuggestionForm(false)
                      setSuggestionText('')
                      setSuggestionError('')
                      setSimilarShadow(null)
                    }}
                  >
                    ยกเลิก
                  </button>
                  <button 
                    className="btn-submit-suggestion"
                    onClick={handleSubmitSuggestion}
                    disabled={isSubmitting || !!suggestionError || suggestionText.length < 2}
                  >
                    {isSubmitting ? 'กำลังส่ง...' : 'ยืนยัน'}
                  </button>
                </div>
              </div>
            )}
            
            {!currentUser?.is_verified && (
              <p className="suggestion-requirement">
                ยืนยันตัวตนเพื่อเสนอตัวเลือกอื่น
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== POLL EXTENSION INDICATOR =====
// Shows on polls that have been extended

function PollExtensionIndicator({ poll, darkMode }) {
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])

  const loadHistory = async () => {
    const { data } = await getPollExtensionHistory(poll.id)
    setHistory(data || [])
  }

  if (!poll.extended_at) return null

  return (
    <div className={`extension-indicator ${darkMode ? 'dark' : ''}`}>
      <div 
        className="extension-badge"
        onClick={() => {
          loadHistory()
          setShowHistory(!showHistory)
        }}
      >
        <span className="extension-icon">⏰</span>
        <span className="extension-text">ขยายเวลาแล้ว</span>
        <span className="extension-count">({poll.extension_count || 1}x)</span>
      </div>
      
      {showHistory && history.length > 0 && (
        <div className="extension-history-popup">
          <h4>ประวัติการขยายเวลา</h4>
          {history.map((ext, idx) => (
            <div key={ext.id} className="extension-history-item">
              <div className="ext-history-date">
                {new Date(ext.extended_at).toLocaleDateString('th-TH', { 
                  day: 'numeric', 
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
              <div className="ext-history-reason">
                <strong>เหตุผล:</strong> {ext.reason}
              </div>
              <div className="ext-history-by">
                โดย: @{ext.users?.username || 'admin'}
              </div>
              {ext.was_expired && (
                <span className="ext-was-expired">ขยายหลังหมดเวลา</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== ADMIN: POLL EXTENSION MODAL =====

function AdminExtendPollModal({ poll, adminId, darkMode, onClose, onExtended }) {
  const [newEndDate, setNewEndDate] = useState('')
  const [newEndTime, setNewEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Set default to tomorrow
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 7)
    setNewEndDate(tomorrow.toISOString().split('T')[0])
    setNewEndTime('20:00')
  }, [])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('กรุณาระบุเหตุผลในการขยายเวลา')
      return
    }
    
    if (!newEndDate || !newEndTime) {
      setError('กรุณาระบุวันเวลาสิ้นสุดใหม่')
      return
    }

    setIsSubmitting(true)
    setError('')

    const newEndsAt = new Date(`${newEndDate}T${newEndTime}:00`)
    
    const { data, error: extError, notifiedCount } = await extendPollTime(
      poll.id,
      newEndsAt.toISOString(),
      reason,
      adminId
    )

    if (extError) {
      setError(extError.message)
      setIsSubmitting(false)
    } else {
      alert(`ขยายเวลาสำเร็จ! แจ้งเตือนผู้โหวต ${notifiedCount} คน`)
      onExtended && onExtended(data)
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal admin-extend-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        <div className="admin-extend-header">
          <h2>⏰ ขยายเวลาโพล</h2>
          <p className="admin-extend-poll-question">"{poll.question}"</p>
        </div>

        <div className="admin-extend-content">
          {/* Current status */}
          <div className="extend-current-status">
            <div className="status-row">
              <span className="status-label">เวลาสิ้นสุดปัจจุบัน:</span>
              <span className="status-value">
                {new Date(poll.ends_at).toLocaleDateString('th-TH', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
            {poll.original_ends_at && (
              <div className="status-row">
                <span className="status-label">เวลาสิ้นสุดเดิม:</span>
                <span className="status-value original">
                  {new Date(poll.original_ends_at).toLocaleDateString('th-TH', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
            )}
            <div className="status-row">
              <span className="status-label">ขยายแล้ว:</span>
              <span className="status-value">{poll.extension_count || 0} ครั้ง</span>
            </div>
            <div className="status-row">
              <span className="status-label">สถานะ:</span>
              <span className={`status-value ${new Date(poll.ends_at) < new Date() ? 'expired' : 'active'}`}>
                {new Date(poll.ends_at) < new Date() ? '❌ หมดเวลาแล้ว' : '✓ ยังเปิดอยู่'}
              </span>
            </div>
          </div>

          {/* Warning for non-prediction polls */}
          {poll.poll_type !== 'prediction' && (
            <div className="extend-warning">
              ⚠️ เฉพาะ Prediction polls เท่านั้นที่ขยายเวลาได้
            </div>
          )}

          {/* New end time inputs */}
          <div className="extend-form">
            <div className="form-group">
              <label>วันสิ้นสุดใหม่:</label>
              <input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="form-group">
              <label>เวลาสิ้นสุดใหม่:</label>
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label>เหตุผลในการขยายเวลา: *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="เช่น: รอผลการประกาศอย่างเป็นทางการ, เหตุการณ์ถูกเลื่อน..."
                rows={3}
              />
              <p className="form-hint">
                เหตุผลนี้จะแสดงให้ผู้ใช้ทุกคนเห็น และบันทึกใน audit log
              </p>
            </div>
          </div>

          {error && (
            <div className="extend-error">
              ⚠️ {error}
            </div>
          )}

          {/* Preview of notification */}
          <div className="extend-preview">
            <h4>ตัวอย่างการแจ้งเตือน:</h4>
            <div className="notification-preview">
              ⏰ โพล "{poll.question?.substring(0, 40)}..." ถูกขยายเวลา เหตุผล: {reason || '[เหตุผลของคุณ]'}
            </div>
          </div>
        </div>

        <div className="admin-extend-actions">
          <button className="btn-cancel" onClick={onClose}>
            ยกเลิก
          </button>
          <button 
            className="btn-extend"
            onClick={handleSubmit}
            disabled={isSubmitting || poll.poll_type !== 'prediction' || !reason.trim()}
          >
            {isSubmitting ? 'กำลังขยาย...' : '⏰ ขยายเวลา'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ===== OPINION POLL CARD COMPONENT =====
// Modified PollCard that handles "อื่นๆ" specially

function OpinionPollOption({ option, poll, isSelected, onVote, currentUser, darkMode }) {
  const [showOthersModal, setShowOthersModal] = useState(false)
  const isOthersOption = option.is_system && option.option_key === 'others'
  
  const totalVotes = poll.options?.reduce((sum, o) => sum + o.votes, 0) || 0
  const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0

  const handleClick = () => {
    if (isOthersOption) {
      setShowOthersModal(true)
    } else {
      onVote(option.id)
    }
  }

  return (
    <>
      <div 
        className={`poll-option opinion-option ${isSelected ? 'selected' : ''} ${isOthersOption ? 'others-option' : ''}`}
        onClick={handleClick}
      >
        <div className="option-content">
          <span className="option-text">
            {isOthersOption && '💡 '}
            {option.text}
            {isOthersOption && poll.pendingShadowCount > 0 && (
              <span className="shadow-count-badge">
                {poll.pendingShadowCount} ตัวเลือกรอพิจารณา
              </span>
            )}
          </span>
          {!poll.blind_mode && (
            <span className="option-percentage">{percentage}%</span>
          )}
        </div>
        {!poll.blind_mode && (
          <div className="option-bar">
            <div 
              className="option-bar-fill" 
              style={{ width: `${percentage}%` }}
            />
          </div>
        )}
        {isOthersOption && (
          <span className="others-hint">คลิกเพื่อดูหรือเสนอตัวเลือกเพิ่มเติม</span>
        )}
      </div>

      {showOthersModal && (
        <OthersOptionsModal
          poll={{ ...poll, totalVotes }}
          currentUser={currentUser}
          darkMode={darkMode}
          onClose={() => setShowOthersModal(false)}
          onVote={() => {
            setShowOthersModal(false)
            // Refresh poll data
          }}
        />
      )}
    </>
  )
}

// ===== CREATE OPINION POLL MODAL ADDITION =====
// Add poll_type selector to CreatePollModal

function PollTypeSelector({ selectedType, onSelect, darkMode }) {
  const pollTypes = [
    { 
      id: 'prediction', 
      name: 'คิดว่าในอนาคต..', 
      icon: '🔮', 
      description: 'ทายผลเหตุการณ์ที่จะเกิดขึ้น มีคำตอบถูก/ผิด',
      features: ['มีผลต่อ Reputation', 'Blind Mode อัตโนมัติ', 'ตัวเลือกตายตัว']
    },
    { 
      id: 'opinion', 
      name: 'ความคิดเห็น', 
      icon: '💬', 
      description: 'สำรวจความคิดเห็น ไม่มีคำตอบถูก/ผิด',
      features: ['ไม่มีผลต่อ Reputation', 'เสนอตัวเลือกเพิ่มได้', 'เห็นผลทันที']
    }
  ]

  return (
    <div className={`poll-type-selector ${darkMode ? 'dark' : ''}`}>
      <label>ประเภทโพล:</label>
      <div className="poll-types-grid">
        {pollTypes.map(type => (
          <div 
            key={type.id}
            className={`poll-type-card ${selectedType === type.id ? 'selected' : ''}`}
            onClick={() => onSelect(type.id)}
          >
            <div className="poll-type-header">
              <span className="poll-type-icon">{type.icon}</span>
              <span className="poll-type-name">{type.name}</span>
            </div>
            <p className="poll-type-description">{type.description}</p>
            <ul className="poll-type-features">
              {type.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== EXPORT ALL NEW COMPONENTS =====
// Add these exports to the end of page.js:
/*
export {
  OthersOptionsModal,
  PollExtensionIndicator,
  AdminExtendPollModal,
  OpinionPollOption,
  PollTypeSelector,
  CleanupHealthIndicator
}
*/

// ===== ADMIN: CLEANUP HEALTH INDICATOR =====
// Shows in Admin Dashboard - CRITICAL for ops monitoring

function CleanupHealthIndicator({ darkMode }) {
  const [health, setHealth] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    loadHealth()
    // Refresh every 5 minutes
    const interval = setInterval(loadHealth, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const loadHealth = async () => {
    setIsLoading(true)
    const data = await getCleanupHealth()
    setHealth(data)
    setIsLoading(false)
  }

  if (isLoading) {
    return (
      <div className={`health-indicator loading ${darkMode ? 'dark' : ''}`}>
        <span>⏳ Checking...</span>
      </div>
    )
  }

  const statusClass = health?.status === 'critical' ? 'critical' 
    : health?.status === 'warning' ? 'warning' 
    : 'ok'

  return (
    <div className={`health-indicator ${statusClass} ${darkMode ? 'dark' : ''}`}>
      <div 
        className="health-summary"
        onClick={() => setShowDetails(!showDetails)}
      >
        <span className="health-icon">
          {health?.status === 'critical' ? '🚨' : health?.status === 'warning' ? '⚠️' : '✅'}
        </span>
        <span className="health-label">Shadow Cleanup</span>
        <span className="health-status">{health?.message}</span>
      </div>

      {showDetails && (
        <div className="health-details">
          <div className="health-row">
            <span>Last successful run:</span>
            <span>
              {health?.lastSuccessfulRun 
                ? new Date(health.lastSuccessfulRun).toLocaleString('th-TH')
                : 'Never'}
            </span>
          </div>
          <div className="health-row">
            <span>Hours since last run:</span>
            <span className={health?.hoursSinceLastRun > 24 ? 'text-red' : ''}>
              {health?.hoursSinceLastRun || '∞'} ชม.
            </span>
          </div>
          <div className="health-row">
            <span>Pending shadows:</span>
            <span>{health?.pendingShadowCount || 0}</span>
          </div>
          <div className="health-row">
            <span>Last cleaned:</span>
            <span>{health?.lastCleanedCount || 0} items</span>
          </div>
          {health?.lastFailedRun && (
            <div className="health-row warning">
              <span>⚠️ Last failure:</span>
              <span>{new Date(health.lastFailedRun).toLocaleString('th-TH')}</span>
            </div>
          )}
          <button 
            className="btn-refresh-health"
            onClick={(e) => { e.stopPropagation(); loadHealth(); }}
          >
            🔄 Refresh
          </button>
        </div>
      )}
    </div>
  )
}

// ===== ADMIN DASHBOARD SECTION =====
// Add this to AdminPanel component

function AdminSystemHealth({ darkMode }) {
  return (
    <div className={`admin-system-health ${darkMode ? 'dark' : ''}`}>
      <h3>🖥️ System Health</h3>
      <div className="health-grid">
        <CleanupHealthIndicator darkMode={darkMode} />
        {/* Add more health indicators here as needed */}
      </div>
    </div>
  )
}

// ===== About Us Modal =====
function AboutUsModal({ onClose, darkMode }) {
  const [activeSection, setActiveSection] = useState('philosophy')
  
  const sections = [
    { id: 'philosophy', icon: '💭', label: 'ปรัชญา' },
    { id: 'how', icon: '⚙️', label: 'วิธีวัด' },
    { id: 'polls', icon: '📊', label: 'ประเภทโพล' },
    { id: 'levels', icon: '🏆', label: 'ระดับ' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal about-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        
        {/* Hero Section */}
        <div className="about-hero">
          <div className="about-logo">
            <span className="about-logo-text">คิดว่า</span>
            <span className="about-logo-dots">..</span>
          </div>
          <p className="about-tagline">ไม่ใช่แค่โหวต แต่คือการวัดคุณภาพของความคิด</p>
        </div>

        {/* Tab Navigation */}
        <div className="about-tabs">
          {sections.map(s => (
            <button 
              key={s.id}
              className={`about-tab ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              <span className="about-tab-icon">{s.icon}</span>
              <span className="about-tab-label">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Content Sections */}
        <div className="about-content">
          
          {/* Section: Philosophy */}
          {activeSection === 'philosophy' && (
            <div className="about-section animate-fade">
              <div className="about-card highlight philosophy-card">
                <div className="philosophy-statement">
                  <h3>คิดว่า.. ไม่ใช่เว็บโหวต</h3>
                  <h3>และไม่ใช่เกมทายผล</h3>
                </div>
                <p className="philosophy-intro">
                  ที่นี่ เราให้คุณ <strong>คิด</strong> — และทุกความคิดมีผลต่อ <strong>ชื่อเสียง</strong> ของคุณ
                </p>
              </div>
              
              <div className="about-card">
                <h4>เราใช้คณิตศาสตร์วัดคุณภาพการตัดสินใจ</h4>
                <p className="philosophy-desc">
                  ไม่ใช่แค่ว่าคุณเลือกข้างไหน "ถูก" หรือ "ผิด"<br/>
                  แต่คุณ <strong>คิดอย่างไร</strong> และ <strong>คิดภายใต้ความไม่แน่นอนแค่ไหน</strong>
                </p>
              </div>

              <div className="philosophy-principles">
                <h4>สิ่งที่เราไม่แนะนำ</h4>
                <div className="principle-items warning">
                  <div className="principle-item">
                    <span className="principle-icon">🎲</span>
                    <span>โหวตแบบสุ่ม</span>
                  </div>
                  <div className="principle-item">
                    <span className="principle-icon">😎</span>
                    <span>เลือก "มั่นใจสูง" ทุกโพล</span>
                  </div>
                  <div className="principle-item">
                    <span className="principle-icon">👥</span>
                    <span>โหวตตามเสียงส่วนใหญ่</span>
                  </div>
                </div>
              </div>

              <div className="philosophy-values">
                <h4>เพราะที่นี่...</h4>
                <div className="value-items">
                  <div className="value-item">
                    <span className="value-icon">💎</span>
                    <div className="value-content">
                      <strong>เสียงส่วนน้อยที่คิดถูก มีคุณค่า</strong>
                      <p>คนที่กล้าคิดต่าง และถูกต้อง ได้รับ Underdog Bonus</p>
                    </div>
                  </div>
                  <div className="value-item">
                    <span className="value-icon">📊</span>
                    <div className="value-content">
                      <strong>ความสม่ำเสมอ สร้างวินัย</strong>
                      <p>ไม่ใช่แค่โหวตถูกครั้งเดียว แต่คิดถูกอย่างต่อเนื่อง</p>
                    </div>
                  </div>
                  <div className="value-item">
                    <span className="value-icon">⏰</span>
                    <div className="value-content">
                      <strong>คนที่คิดก่อน ย่อมเสี่ยงมากกว่า</strong>
                      <p>โหวตเร็วเมื่อยังไม่มีข้อมูลมาก = กล้าหาญกว่า</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="about-card highlight-soft">
                <p className="philosophy-conclusion">
                  แม้คุณจะสมัครมาทีหลัง คุณยังสามารถ <strong>แซงคนอื่นได้</strong><br/>
                  ถ้าคุณมองเห็นอนาคตได้ดีกว่า
                </p>
                <div className="philosophy-final">
                  <span className="final-icon">🧠</span>
                  <p><strong>คิดว่า..</strong> ไม่ได้วัดว่าคุณ "รู้มากแค่ไหน"<br/>แต่วัดว่า <strong>คุณคิดดีแค่ไหน</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* Section: How We Measure */}
          {activeSection === 'how' && (
            <div className="about-section animate-fade">
              <div className="about-card">
                <h3>เราวัดอะไรบ้าง?</h3>
                <p className="about-card-desc">ระบบ Reputation ใช้หลายปัจจัยในการประเมิน ไม่ใช่แค่ "ถูก/ผิด"</p>
              </div>

              <div className="measure-factors">
                <div className="measure-factor">
                  <div className="factor-header">
                    <span className="factor-icon">🎯</span>
                    <h4>ความแม่นยำ (Accuracy)</h4>
                  </div>
                  <p>โหวตถูกหรือผิด — แต่ไม่ใช่ปัจจัยเดียว</p>
                  <div className="factor-weight">น้ำหนัก: สูง</div>
                </div>

                <div className="measure-factor">
                  <div className="factor-header">
                    <span className="factor-icon">💪</span>
                    <h4>ความมั่นใจ (Conviction)</h4>
                  </div>
                  <p>คุณมั่นใจแค่ไหน? ความมั่นใจสูง = ผลกระทบสูง ทั้งบวกและลบ</p>
                  <div className="factor-levels">
                    <span className="fl low">🥶 ×0.8</span>
                    <span className="fl med">🥺 ×1.0</span>
                    <span className="fl high">😎 ×1.3</span>
                  </div>
                </div>

                <div className="measure-factor">
                  <div className="factor-header">
                    <span className="factor-icon">🦁</span>
                    <h4>ความกล้า (Underdog Bonus)</h4>
                  </div>
                  <p>โหวตฝั่งที่มีคนเลือกน้อย (&lt;30%) แล้วถูก = ได้ bonus พิเศษ</p>
                  <div className="factor-weight highlight">Bonus: +20-50%</div>
                </div>

                <div className="measure-factor">
                  <div className="factor-header">
                    <span className="factor-icon">📈</span>
                    <h4>ความสม่ำเสมอ (Consistency)</h4>
                  </div>
                  <p>โหวตถูกบ่อยๆ อย่างต่อเนื่อง ดีกว่าโหวตถูกครั้งใหญ่ครั้งเดียว</p>
                  <div className="factor-weight">สะท้อนใน: Monthly Ranking</div>
                </div>
              </div>

              <div className="about-card highlight-soft">
                <h4>สูตรคำนวณ Reputation</h4>
                <div className="formula-display">
                  <code>Rep = √(Stake × Conviction × Accuracy) × Experience + Underdog − Penalty</code>
                </div>
                <p className="formula-note">* สูตรนี้ทำให้การ "เดามั่ว" ไม่คุ้มค่า และการ "คิดดี" ได้รับรางวัล</p>
              </div>
            </div>
          )}

          {/* Section: Poll Types */}
          {activeSection === 'polls' && (
            <div className="about-section animate-fade">
              <div className="poll-types-showcase">
                
                <div className="poll-type-showcase-card prediction">
                  <div className="ptc-header">
                    <span className="ptc-icon">🔮</span>
                    <h4>Prediction</h4>
                    <span className="ptc-badge rep">มีผล Rep</span>
                  </div>
                  <p>คิดว่า.. เหตุการณ์ในอนาคตจะเป็นอย่างไร</p>
                  <div className="ptc-features">
                    <span>✓ ต้องมีคำตอบที่ตรวจสอบได้</span>
                    <span>✓ Blind Mode ป้องกันการตามฝูง</span>
                    <span>✓ นับ Reputation เมื่อเฉลย</span>
                  </div>
                </div>

                <div className="poll-type-showcase-card opinion">
                  <div className="ptc-header">
                    <span className="ptc-icon">💬</span>
                    <h4>Opinion</h4>
                    <span className="ptc-badge no-rep">ไม่มีผล Rep</span>
                  </div>
                  <p>สำรวจความคิดเห็น ไม่มีถูก/ผิด</p>
                  <div className="ptc-features">
                    <span>✓ เสนอตัวเลือกใหม่ได้</span>
                    <span>✓ เห็นผลทันที</span>
                    <span>✓ ไม่กระทบ Reputation</span>
                  </div>
                </div>

                <div className="poll-type-showcase-card live">
                  <div className="ptc-header">
                    <span className="ptc-icon">⚡</span>
                    <h4>Live Battle</h4>
                    <span className="ptc-badge live-badge">Real-time</span>
                  </div>
                  <p>โหวตสดๆ ดูผลเปลี่ยนแบบ real-time</p>
                  <div className="ptc-features">
                    <span>✓ Countdown timer</span>
                    <span>✓ ตื่นเต้น ลุ้นสด</span>
                    <span>✓ ระยะสั้น นาที-ชั่วโมง</span>
                  </div>
                </div>

                <div className="poll-type-showcase-card capsule">
                  <div className="ptc-header">
                    <span className="ptc-icon">💊</span>
                    <h4>Time Capsule</h4>
                    <span className="ptc-badge capsule-badge">Long-term</span>
                  </div>
                  <p>ทำนายอนาคตระยะยาว 1+ ปี</p>
                  <div className="ptc-features">
                    <span>✓ Blind จนกว่าจะถึงเวลา</span>
                    <span>✓ ทดสอบวิสัยทัศน์</span>
                    <span>✓ สำหรับคนที่คิดไกล</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Section: Levels & Rankings */}
          {activeSection === 'levels' && (
            <div className="about-section animate-fade">
              <div className="about-card">
                <h3>ระดับชื่อเสียง</h3>
                <p className="about-card-desc">เริ่มต้นที่ 1,000 pt — ไต่ขึ้นด้วยการคิดที่ดี</p>
              </div>

              <div className="rep-levels">
                <div className="level-ladder">
                  <div className="level-item legendary"><span>👑</span> ตำนาน <span className="level-pts">10,000+</span></div>
                  <div className="level-item master"><span>🏆</span> ปรมาจารย์ <span className="level-pts">5,001+</span></div>
                  <div className="level-item expert"><span>⭐</span> ผู้เชี่ยวชาญ <span className="level-pts">3,001+</span></div>
                  <div className="level-item analyst"><span>🔮</span> นักวิเคราะห์ <span className="level-pts">1,501+</span></div>
                  <div className="level-item beginner"><span>🎯</span> ผู้เริ่มต้น <span className="level-pts">501+</span></div>
                  <div className="level-item student"><span>🌱</span> นักศึกษา <span className="level-pts">0+</span></div>
                </div>
              </div>

              <div className="about-card">
                <h3>Leaderboard</h3>
                <p className="about-card-desc">ไม่มี Season Reset — ทุกอันดับเป็น Rolling Window</p>
                
                <div className="rank-types-compact">
                  <div className="rank-compact">
                    <span className="rank-icon">⚡</span>
                    <div>
                      <strong>Weekly</strong>
                      <p>7 วันล่าสุด — ความคมชัดปัจจุบัน</p>
                    </div>
                  </div>
                  <div className="rank-compact">
                    <span className="rank-icon">📅</span>
                    <div>
                      <strong>Monthly</strong>
                      <p>30 วันล่าสุด — ความสม่ำเสมอ</p>
                    </div>
                  </div>
                  <div className="rank-compact featured">
                    <span className="rank-icon">👑</span>
                    <div>
                      <strong>All-time</strong>
                      <p>ตั้งแต่เริ่มใช้งาน — ชื่อเสียงสะสม</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="about-card highlight-soft">
                <h4>🔓 Verified Badge</h4>
                <p>ได้รับเมื่อ: เป็นสมาชิก 14+ วัน, โหวต 20+ โพล, ยืนยันอีเมล</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="about-footer">
          <span className="about-version">แล้วคุณล่ะ</span>
          <span className="about-separator">·</span>
          <span className="about-tagline-small">คิดว่า..?</span>
        </div>
      </div>
    </div>
  )
}
// ============================================================
// KIDWA: Admin 2FA UI Components
// Add these components to app/page.js
// ============================================================

// ===== IMPORTS =====
// Add to imports at top of page.js:
/*
import {
  enrollMFA,
  verifyMFAEnrollment,
  challengeMFA,
  verifyMFA,
  getMFAStatus,
  listMFAFactors,
  unenrollMFA,
  requireMFA
} from '@/lib/supabase'
*/

// ===== MFA SETUP MODAL =====
// แสดงเมื่อ Admin ยังไม่ได้ตั้งค่า 2FA

function MFASetupModal({ onComplete, onClose, darkMode }) {
  const [step, setStep] = useState('intro') // intro, generating, scan, verify, done
  const [qrCode, setQrCode] = useState(null)
  const [secret, setSecret] = useState(null)
  const [factorId, setFactorId] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showSecret, setShowSecret] = useState(false)

  const handleStartSetup = async () => {
    setStep('generating')
    setIsLoading(true)
    setError(null)
    
    const result = await enrollMFA()
    
    if (result.error) {
      setError(result.error.message || 'ไม่สามารถสร้าง QR Code ได้')
      setStep('intro')
    } else {
      setQrCode(result.qrCode)
      setSecret(result.secret)
      setFactorId(result.factorId)
      setStep('scan')
    }
    setIsLoading(false)
  }

  const handleVerify = async () => {
    if (code.length !== 6) return
    
    setIsLoading(true)
    setError(null)
    
    const result = await verifyMFAEnrollment(factorId, code)
    
    if (result.error || !result.success) {
      setError('รหัสไม่ถูกต้อง กรุณาลองใหม่')
      setCode('')
    } else {
      setStep('done')
      setTimeout(() => {
        onComplete?.()
      }, 2000)
    }
    setIsLoading(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal mfa-setup-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        {step !== 'done' && <button className="modal-close" onClick={onClose}>✕</button>}
        
        {/* Step: Intro */}
        {step === 'intro' && (
          <div className="mfa-step-content">
            <div className="mfa-icon">🔐</div>
            <h2>ตั้งค่า Two-Factor Authentication</h2>
            <p className="mfa-description">
              เพื่อความปลอดภัยของ Admin Panel กรุณาเปิดใช้งาน 2FA 
              คุณจะต้องใช้แอป Authenticator เช่น Google Authenticator, Authy, หรือ 1Password
            </p>
            
            <div className="mfa-requirements">
              <h4>สิ่งที่ต้องเตรียม:</h4>
              <ul>
                <li>📱 มือถือพร้อมแอป Authenticator</li>
                <li>⏱️ ใช้เวลาประมาณ 2 นาที</li>
              </ul>
            </div>
            
            <button 
              className="btn-primary mfa-btn-start"
              onClick={handleStartSetup}
              disabled={isLoading}
            >
              {isLoading ? '⏳ กำลังเตรียม...' : '🚀 เริ่มตั้งค่า'}
            </button>
          </div>
        )}

        {/* Step: Generating */}
        {step === 'generating' && (
          <div className="mfa-step-content">
            <div className="mfa-loading">
              <div className="mfa-spinner"></div>
              <p>กำลังสร้าง QR Code...</p>
            </div>
          </div>
        )}

        {/* Step: Scan QR */}
        {step === 'scan' && (
          <div className="mfa-step-content">
            <h2>สแกน QR Code</h2>
            <p className="mfa-description">
              เปิดแอป Authenticator แล้วสแกน QR Code นี้
            </p>
            
            <div className="mfa-qr-container">
              {qrCode && <img src={qrCode} alt="MFA QR Code" className="mfa-qr-image" />}
            </div>
            
            <div className="mfa-secret-section">
              <button 
                className="btn-text"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? '🔒 ซ่อน Key' : '🔑 แสดง Key (กรอกเอง)'}
              </button>
              
              {showSecret && (
                <div className="mfa-secret-box">
                  <code>{secret}</code>
                  <button 
                    className="btn-copy"
                    onClick={() => navigator.clipboard.writeText(secret)}
                  >
                    📋
                  </button>
                </div>
              )}
            </div>
            
            <div className="mfa-verify-section">
              <h4>ใส่รหัส 6 หลักจากแอป:</h4>
              <div className="mfa-code-input-group">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyPress={handleKeyPress}
                  maxLength={6}
                  className="mfa-code-input"
                  autoFocus
                />
                <button 
                  className="btn-primary"
                  onClick={handleVerify}
                  disabled={code.length !== 6 || isLoading}
                >
                  {isLoading ? '⏳' : '✓ ยืนยัน'}
                </button>
              </div>
              
              {error && <p className="mfa-error">{error}</p>}
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && (
          <div className="mfa-step-content mfa-success">
            <div className="mfa-success-icon">✅</div>
            <h2>ตั้งค่าสำเร็จ!</h2>
            <p>2FA เปิดใช้งานแล้ว บัญชีของคุณปลอดภัยยิ่งขึ้น</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ===== MFA CHALLENGE MODAL =====
// แสดงเมื่อต้องยืนยัน 2FA ก่อนทำ action

function MFAChallengeModal({ onSuccess, onCancel, darkMode, actionName = 'ดำเนินการ' }) {
  const [factorId, setFactorId] = useState(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    loadFactors()
  }, [])

  const loadFactors = async () => {
    const { factors } = await listMFAFactors()
    if (factors.length > 0) {
      setFactorId(factors[0].id)
    }
    setIsLoading(false)
  }

  const handleVerify = async () => {
    if (code.length !== 6 || !factorId) return
    
    setIsLoading(true)
    setError(null)
    
    // Create challenge
    const { challengeId, error: challengeError } = await challengeMFA(factorId)
    if (challengeError) {
      setError('ไม่สามารถสร้าง challenge ได้')
      setIsLoading(false)
      return
    }
    
    // Verify code
    const { success, error: verifyError } = await verifyMFA(factorId, challengeId, code)
    
    if (verifyError || !success) {
      setAttempts(prev => prev + 1)
      setError(`รหัสไม่ถูกต้อง (${attempts + 1}/5)`)
      setCode('')
      
      if (attempts >= 4) {
        setError('ลองผิดเกินกำหนด กรุณารอสักครู่')
        setTimeout(() => onCancel?.(), 2000)
      }
    } else {
      onSuccess?.()
    }
    setIsLoading(false)
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify()
    }
  }

  if (isLoading && !factorId) {
    return (
      <div className="modal-overlay">
        <div className={`modal mfa-challenge-modal ${darkMode ? 'dark' : ''}`}>
          <div className="mfa-loading">
            <div className="mfa-spinner"></div>
            <p>กำลังโหลด...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className={`modal mfa-challenge-modal ${darkMode ? 'dark' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onCancel}>✕</button>
        
        <div className="mfa-challenge-content">
          <div className="mfa-icon">🔐</div>
          <h2>ยืนยันตัวตน</h2>
          <p className="mfa-description">
            ใส่รหัส 6 หลักจากแอป Authenticator เพื่อ{actionName}
          </p>
          
          <div className="mfa-code-input-group">
            <input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyPress={handleKeyPress}
              maxLength={6}
              className="mfa-code-input large"
              autoFocus
              disabled={isLoading || attempts >= 5}
            />
          </div>
          
          {error && <p className="mfa-error">{error}</p>}
          
          <div className="mfa-actions">
            <button 
              className="btn-secondary"
              onClick={onCancel}
            >
              ยกเลิก
            </button>
            <button 
              className="btn-primary"
              onClick={handleVerify}
              disabled={code.length !== 6 || isLoading || attempts >= 5}
            >
              {isLoading ? '⏳ กำลังตรวจสอบ...' : '✓ ยืนยัน'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== MFA STATUS INDICATOR =====
// แสดงใน Admin Panel

function MFAStatusIndicator({ darkMode, onSetup }) {
  const [status, setStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    const mfaStatus = await getMFAStatus()
    const { factors } = await listMFAFactors()
    
    setStatus({
      ...mfaStatus,
      hasFactors: factors.length > 0
    })
    setIsLoading(false)
  }

  if (isLoading) {
    return <div className="mfa-status loading">⏳</div>
  }

  if (status?.hasMFA) {
    return (
      <div className={`mfa-status verified ${darkMode ? 'dark' : ''}`}>
        <span className="mfa-status-icon">🔒</span>
        <span className="mfa-status-text">2FA Active</span>
      </div>
    )
  }

  if (status?.hasFactors && !status?.hasMFA) {
    return (
      <div className={`mfa-status pending ${darkMode ? 'dark' : ''}`}>
        <span className="mfa-status-icon">⚠️</span>
        <span className="mfa-status-text">2FA ต้องยืนยัน</span>
      </div>
    )
  }

  return (
    <div className={`mfa-status not-setup ${darkMode ? 'dark' : ''}`}>
      <span className="mfa-status-icon">🔓</span>
      <span className="mfa-status-text">2FA ไม่ได้เปิด</span>
      <button className="btn-small" onClick={onSetup}>ตั้งค่า</button>
    </div>
  )
}

// ===== ADMIN PANEL MFA SECTION =====
// เพิ่มใน Admin Panel

function AdminMFASection({ darkMode }) {
  const [showSetup, setShowSetup] = useState(false)
  const [mfaStatus, setMfaStatus] = useState(null)
  const [factors, setFactors] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadMFAData()
  }, [])

  const loadMFAData = async () => {
    const status = await getMFAStatus()
    const { factors: factorList } = await listMFAFactors()
    
    setMfaStatus(status)
    setFactors(factorList)
    setIsLoading(false)
  }

  const handleRemoveMFA = async (factorId) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบ 2FA? คุณจะต้องตั้งค่าใหม่')) return
    
    const { success } = await unenrollMFA(factorId)
    if (success) {
      loadMFAData()
    }
  }

  return (
    <div className={`admin-mfa-section ${darkMode ? 'dark' : ''}`}>
      <h3>🔐 Two-Factor Authentication</h3>
      
      {isLoading ? (
        <div className="mfa-loading-inline">⏳ กำลังโหลด...</div>
      ) : (
        <>
          <div className="mfa-status-card">
            <div className="mfa-status-row">
              <span>สถานะ:</span>
              <span className={`mfa-badge ${mfaStatus?.hasMFA ? 'active' : 'inactive'}`}>
                {mfaStatus?.hasMFA ? '✅ เปิดใช้งานแล้ว' : '❌ ยังไม่ได้เปิด'}
              </span>
            </div>
            
            <div className="mfa-status-row">
              <span>Security Level:</span>
              <span className="mfa-level">
                {mfaStatus?.currentLevel === 'aal2' ? '🛡️ AAL2 (สูงสุด)' : '🔓 AAL1 (พื้นฐาน)'}
              </span>
            </div>
          </div>
          
          {factors.length > 0 ? (
            <div className="mfa-factors-list">
              <h4>อุปกรณ์ที่ลงทะเบียน:</h4>
              {factors.map(factor => (
                <div key={factor.id} className="mfa-factor-item">
                  <span className="factor-icon">📱</span>
                  <span className="factor-name">{factor.friendly_name || 'Authenticator'}</span>
                  <span className="factor-date">
                    เพิ่มเมื่อ {new Date(factor.created_at).toLocaleDateString('th-TH')}
                  </span>
                  <button 
                    className="btn-danger-small"
                    onClick={() => handleRemoveMFA(factor.id)}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mfa-no-factors">
              <p>ยังไม่ได้ตั้งค่า 2FA</p>
              <button 
                className="btn-primary"
                onClick={() => setShowSetup(true)}
              >
                🔐 ตั้งค่า 2FA เลย
              </button>
            </div>
          )}
        </>
      )}
      
      {showSetup && (
        <MFASetupModal 
          darkMode={darkMode}
          onComplete={() => {
            setShowSetup(false)
            loadMFAData()
          }}
          onClose={() => setShowSetup(false)}
        />
      )}
    </div>
  )
}

// ===== HOOK: useMFAProtectedAction =====
// ใช้ wrap admin actions ที่ต้องการ MFA

function useMFAProtectedAction() {
  const [showChallenge, setShowChallenge] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const executeWithMFA = async (action, actionName = 'ดำเนินการ') => {
    // Check if MFA is already verified
    const { hasMFA } = await getMFAStatus()
    
    if (hasMFA) {
      // Already verified, execute directly
      return await action()
    }
    
    // Need MFA verification
    return new Promise((resolve, reject) => {
      setPendingAction({ action, resolve, reject, actionName })
      setShowChallenge(true)
    })
  }

  const MFAChallengeWrapper = ({ darkMode }) => {
    if (!showChallenge || !pendingAction) return null

    return (
      <MFAChallengeModal
        darkMode={darkMode}
        actionName={pendingAction.actionName}
        onSuccess={async () => {
          setShowChallenge(false)
          try {
            const result = await pendingAction.action()
            pendingAction.resolve(result)
          } catch (err) {
            pendingAction.reject(err)
          }
          setPendingAction(null)
        }}
        onCancel={() => {
          setShowChallenge(false)
          pendingAction.reject(new Error('MFA cancelled'))
          setPendingAction(null)
        }}
      />
    )
  }

  return { executeWithMFA, MFAChallengeWrapper }
}

// ===== USAGE EXAMPLE =====
/*

// ใน Admin Panel component:
function AdminPanel({ darkMode }) {
  const { executeWithMFA, MFAChallengeWrapper } = useMFAProtectedAction()

  const handleResolvePoll = async (pollId, correctOptionId) => {
    try {
      await executeWithMFA(
        () => resolvePoll(pollId, correctOptionId),
        'resolve โพล'
      )
      // Success!
    } catch (err) {
      if (err.message === 'MFA cancelled') {
        // User cancelled
      } else {
        // Other error
      }
    }
  }

  return (
    <>
      <AdminMFASection darkMode={darkMode} />
      
      {// ... other admin content ...}
      
      <MFAChallengeWrapper darkMode={darkMode} />
    </>
  )
}

*/
// ============================================================
// KIDWA: Vote History Chart Component
// Add to app/page.js
// ============================================================

// ===== IMPORTS NEEDED =====
/*
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts'
import html2canvas from 'html2canvas'

// Add to lib/supabase.js imports:
import { getVoteHistory, getChartColor, getChartColorLight } from '@/lib/supabase'

// Install html2canvas:
// npm install html2canvas
*/

// ===== VOTE HISTORY CHART COMPONENT =====

function VoteHistoryChart({ pollId, darkMode, onClose }) {
  const [chartData, setChartData] = useState([])
  const [options, setOptions] = useState([])
  const [question, setQuestion] = useState('')
  const [resolution, setResolution] = useState('daily')
  const [availableRes, setAvailableRes] = useState({ has6h: false, hasDaily: false, hasMonthly: false })
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  const [showLegend, setShowLegend] = useState(true)
  const chartRef = useRef(null)

  useEffect(() => {
    loadData()
    loadAvailableResolutions()
  }, [pollId])

  useEffect(() => {
    loadData()
  }, [resolution])

  const loadAvailableResolutions = async () => {
    const { data } = await getAvailableResolutions(pollId)
    if (data) {
      setAvailableRes(data)
      // Auto-select best resolution
      if (data.hasDaily) setResolution('daily')
      else if (data.has6h) setResolution('6h')
      else if (data.hasMonthly) setResolution('monthly')
    }
  }

  const loadData = async () => {
    setIsLoading(true)
    const { data, error } = await getVoteHistory(pollId, resolution)
    
    if (data && !error) {
      setChartData(data.chartData)
      setOptions(data.options)
      setQuestion(data.question)
    }
    setIsLoading(false)
  }

  // Format time based on resolution
  const formatTime = (time) => {
    const date = new Date(time)
    if (resolution === '6h') {
      return date.toLocaleDateString('th-TH', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit'
      })
    } else if (resolution === 'daily') {
      return date.toLocaleDateString('th-TH', { 
        day: 'numeric', 
        month: 'short' 
      })
    } else {
      return date.toLocaleDateString('th-TH', { 
        month: 'short', 
        year: '2-digit' 
      })
    }
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null
    
    const totalVotes = payload[0]?.payload?.totalVotes || 0
    
    return (
      <div className={`vote-chart-tooltip ${darkMode ? 'dark' : ''}`}>
        <p className="tooltip-time">{formatTime(label)}</p>
        <p className="tooltip-total">รวม {totalVotes.toLocaleString()} โหวต</p>
        <div className="tooltip-items">
          {payload.map((entry, index) => {
            const opt = options.find(o => o.id === entry.dataKey)
            if (!opt) return null
            
            const count = entry.payload[`${entry.dataKey}_count`] || 0
            
            return (
              <div key={entry.dataKey} className="tooltip-item">
                <span 
                  className="tooltip-dot" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="tooltip-label">
                  {opt.text}
                  {opt.isCorrect && <span className="correct-badge">✓</span>}
                </span>
                <span className="tooltip-value">
                  {entry.value?.toFixed(1)}% ({count})
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Export chart as image
  const exportAsImage = async () => {
    if (!chartRef.current) return
    
    setIsExporting(true)
    
    try {
      // Create canvas from chart
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: darkMode ? '#0f0f1a' : '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true
      })
      
      // Add watermark
      const ctx = canvas.getContext('2d')
      ctx.font = 'bold 24px sans-serif'
      ctx.fillStyle = darkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'
      ctx.textAlign = 'center'
      
      // Multiple watermarks
      const text = 'คิดว่า..'
      for (let y = 50; y < canvas.height; y += 150) {
        for (let x = 100; x < canvas.width; x += 200) {
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(-Math.PI / 12) // -15 degrees
          ctx.fillText(text, 0, 0)
          ctx.restore()
        }
      }
      
      // Add bottom watermark
      ctx.font = 'bold 16px sans-serif'
      ctx.fillStyle = darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'
      ctx.textAlign = 'right'
      ctx.fillText('คิดว่า.. | kidwa.com', canvas.width - 20, canvas.height - 15)
      
      // Download
      const link = document.createElement('a')
      link.download = `kidwa-poll-${pollId.slice(0, 8)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      
    } catch (err) {
      console.error('Export error:', err)
      alert('ไม่สามารถ export รูปภาพได้')
    }
    
    setIsExporting(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal vote-history-modal ${darkMode ? 'dark' : ''}`} 
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>✕</button>
        
        {/* Header */}
        <div className="vote-history-header">
          <h2>📊 ประวัติการโหวต</h2>
          <p className="vote-history-question">{question}</p>
        </div>

        {/* Controls */}
        <div className="vote-history-controls">
          {/* Resolution Tabs */}
          <div className="resolution-tabs">
            {availableRes.has6h && (
              <button 
                className={`res-tab ${resolution === '6h' ? 'active' : ''}`}
                onClick={() => setResolution('6h')}
              >
                6H
              </button>
            )}
            {availableRes.hasDaily && (
              <button 
                className={`res-tab ${resolution === 'daily' ? 'active' : ''}`}
                onClick={() => setResolution('daily')}
              >
                1D
              </button>
            )}
            {availableRes.hasMonthly && (
              <button 
                className={`res-tab ${resolution === 'monthly' ? 'active' : ''}`}
                onClick={() => setResolution('monthly')}
              >
                1M
              </button>
            )}
          </div>
          
          {/* Chart Options */}
          <div className="chart-options">
            <label className="chart-option">
              <input 
                type="checkbox" 
                checked={showGrid} 
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              <span>Grid</span>
            </label>
            <label className="chart-option">
              <input 
                type="checkbox" 
                checked={showLegend} 
                onChange={(e) => setShowLegend(e.target.checked)}
              />
              <span>Legend</span>
            </label>
          </div>
          
          {/* Export Button */}
          <button 
            className="btn-export"
            onClick={exportAsImage}
            disabled={isExporting || isLoading}
          >
            {isExporting ? '⏳' : '📷'} Export
          </button>
        </div>

        {/* Chart Container */}
        <div className="vote-history-chart-container" ref={chartRef}>
          {/* Watermark Background */}
          <div className="chart-watermark">คิดว่า..</div>
          
          {isLoading ? (
            <div className="chart-loading">
              <div className="chart-spinner"></div>
              <p>กำลังโหลดข้อมูล...</p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="chart-empty">
              <p>ไม่มีข้อมูลสำหรับช่วงเวลานี้</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
              >
                {showGrid && (
                  <CartesianGrid 
                    strokeDasharray="3 3" 
                    stroke={darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} 
                    horizontal={true}
                    vertical={false}
                  />
                )}
                
                <XAxis 
                  dataKey="time" 
                  tickFormatter={formatTime}
                  stroke={darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  fontSize={12}
                  tickMargin={10}
                />
                
                <YAxis 
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  stroke={darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                  fontSize={12}
                  width={45}
                />
                
                <Tooltip content={<CustomTooltip />} />
                
                {showLegend && (
                  <Legend 
                    formatter={(value) => {
                      const opt = options.find(o => o.id === value)
                      if (!opt) return value
                      return (
                        <span>
                          {opt.text.length > 20 ? opt.text.slice(0, 20) + '...' : opt.text}
                          {opt.isCorrect && ' ✓'}
                        </span>
                      )
                    }}
                    wrapperStyle={{ 
                      paddingTop: '10px',
                      fontSize: '12px'
                    }}
                  />
                )}
                
                {/* Lines for each option */}
                {options.map((opt, index) => (
                  <Line
                    key={opt.id}
                    type="monotone"
                    dataKey={opt.id}
                    name={opt.id}
                    stroke={getChartColor(index)}
                    strokeWidth={opt.isCorrect ? 3 : 2}
                    dot={false}
                    activeDot={{ 
                      r: 6, 
                      stroke: opt.isCorrect ? '#22c55e' : getChartColor(index),
                      strokeWidth: opt.isCorrect ? 3 : 2
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          
          {/* Bottom Watermark */}
          <div className="chart-watermark-bottom">
            คิดว่า.. | kidwa.com
          </div>
        </div>

        {/* Stats Summary */}
        {!isLoading && chartData.length > 0 && (
          <div className="vote-history-stats">
            <div className="stat-item">
              <span className="stat-label">โหวตทั้งหมด</span>
              <span className="stat-value">
                {chartData[chartData.length - 1]?.totalVotes?.toLocaleString() || 0}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">ช่วงเวลา</span>
              <span className="stat-value">
                {chartData.length > 0 && (
                  <>
                    {formatTime(chartData[0].time)} - {formatTime(chartData[chartData.length - 1].time)}
                  </>
                )}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">จุดข้อมูล</span>
              <span className="stat-value">{chartData.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ===== BUTTON TO OPEN CHART =====
// Add this button in resolved poll card

function VoteHistoryButton({ pollId, darkMode }) {
  const [showChart, setShowChart] = useState(false)
  
  return (
    <>
      <button 
        className="btn-vote-history"
        onClick={() => setShowChart(true)}
        title="ดูประวัติการโหวต"
      >
        📊 ดูกราฟ
      </button>
      
      {showChart && (
        <VoteHistoryChart 
          pollId={pollId} 
          darkMode={darkMode} 
          onClose={() => setShowChart(false)} 
        />
      )}
    </>
  )
}

// ===== INTEGRATION EXAMPLE =====
/*
// In PollCard component, add this for resolved polls:

{poll.status === 'resolved' && (
  <div className="poll-actions-resolved">
    <VoteHistoryButton pollId={poll.id} darkMode={darkMode} />
  </div>
)}
*/
