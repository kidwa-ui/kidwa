import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
)

// =====================================================
// THAILAND TIMEZONE HELPERS (UTC+7)
// =====================================================

// Get current time in Thailand
export function getThailandNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
}

// Get current season identifier (YYYY-MM in Thailand time)
export function getThailandSeason() {
  const thai = getThailandNow()
  const year = thai.getFullYear()
  const month = String(thai.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

// Convert UTC date to Thailand display
export function toThailandTime(utcDate) {
  if (!utcDate) return null
  const date = new Date(utcDate)
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }))
}

// Format date for Thai display
export function formatThaiDate(date, options = {}) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('th-TH', {
    timeZone: 'Asia/Bangkok',
    ...options
  })
}

// Format time for Thai display
export function formatThaiTime(date) {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// ===== Auth Functions =====

export async function signUpWithEmail(email, password, username) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single()
  
  if (existingUser) {
    return { data: null, error: { message: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' } }
  }

  const { data: existingEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()
  
  if (existingEmail) {
    return { data: null, error: { message: 'อีเมลนี้ถูกใช้แล้ว' } }
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  })

  if (authError) return { data: null, error: authError }

  const currentSeason = getThailandSeason()

  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert([{
      username,
      email,
      auth_id: authData.user?.id,
      email_verified: false,
      reputation: 1000,
      seasonal_reputation: 0,
      current_season: currentSeason
    }])
    .select()
    .single()

  if (userError) return { data: null, error: userError }

  return { data: { auth: authData, user: userData }, error: null }
}

export async function signInWithEmail(email, password) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (authError) return { data: null, error: authError }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authData.user?.id)
    .single()

  if (userError || !userData) {
    return { data: null, error: { message: 'ไม่พบข้อมูลผู้ใช้' } }
  }

  return { data: { auth: authData, user: userData }, error: null }
}

export async function signInWithMagicLink(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  })

  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

export async function getUserFromSession() {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) return { data: null, error: null }

  const { data: userData, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', session.user.id)
    .single()

  if (userData && session.user.email_confirmed_at && !userData.email_verified) {
    await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', userData.id)
    userData.email_verified = true
  }

  // Check and reset seasonal reputation if new month
  if (userData) {
    const currentSeason = getThailandSeason()
    if (userData.current_season !== currentSeason) {
      await supabase
        .from('users')
        .update({ 
          seasonal_reputation: 0,
          current_season: currentSeason
        })
        .eq('id', userData.id)
      userData.seasonal_reputation = 0
      userData.current_season = currentSeason
    }
  }

  return { data: userData, error }
}

export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`
  })

  return { data, error }
}

export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  })

  return { data, error }
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  })

  return { data, error }
}

export async function getUserByUsername(username) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single()
  return { data, error }
}

export async function createUser(username) {
  const currentSeason = getThailandSeason()
  const { data, error } = await supabase
    .from('users')
    .insert([{ 
      username, 
      reputation: 1000, 
      seasonal_reputation: 0,
      current_season: currentSeason,
      streak: 0, 
      current_streak: 0, 
      max_streak: 0, 
      total_predictions: 0, 
      correct_predictions: 0 
    }])
    .select()
    .single()
  return { data, error }
}

export async function getPolls() {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*)')
    .order('created_at', { ascending: false })
    .limit(50)
  return { data, error }
}

// =====================================================
// TRIGGER-BASED VOTE FUNCTION
// =====================================================

export async function vote(userId, pollId, optionId, confidence = 50) {
  const { data: existingVote } = await supabase
    .from('votes')
    .select('id, option_id')
    .eq('user_id', userId)
    .eq('poll_id', pollId)
    .single()

  if (existingVote) {
    const { data, error } = await supabase
      .from('votes')
      .update({ 
        option_id: optionId, 
        confidence,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingVote.id)
      .select()
      .single()
    
    return { data, error }
  } else {
    const { data, error } = await supabase
      .from('votes')
      .insert([{ 
        user_id: userId, 
        poll_id: pollId, 
        option_id: optionId, 
        confidence 
      }])
      .select()
      .single()
    
    return { data, error }
  }
}

export async function getUserVotes(userId) {
  const { data, error } = await supabase
    .from('votes')
    .select('*')
    .eq('user_id', userId)
  return { data, error }
}

// =====================================================
// LEADERBOARD FUNCTIONS (Seasonal + Lifetime)
// =====================================================

// Seasonal Leaderboard (default) - current month in Thailand time
export async function getSeasonalLeaderboard(limit = 10) {
  const currentSeason = getThailandSeason()
  
  const { data, error } = await supabase
    .from('users')
    .select('id, username, reputation, seasonal_reputation, current_season, avatar_url, is_verified, email_verified')
    .eq('current_season', currentSeason)
    .order('seasonal_reputation', { ascending: false })
    .limit(limit)
  
  return { data, error }
}

// Lifetime Leaderboard (prestige)
export async function getLifetimeLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, reputation, seasonal_reputation, avatar_url, is_verified, email_verified')
    .order('reputation', { ascending: false })
    .limit(limit)
  return { data, error }
}

// Legacy function - now defaults to seasonal
export async function getLeaderboard(limit = 10) {
  return getSeasonalLeaderboard(limit)
}

// Weekly leaderboard (within current week, Thailand time)
export async function getWeeklyLeaderboard(limit = 10) {
  // Get Monday of current week in Thailand time
  const thai = getThailandNow()
  const dayOfWeek = thai.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(thai)
  monday.setDate(thai.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  
  const { data: votes, error } = await supabase
    .from('votes')
    .select('user_id, points_earned, users!inner(id, username, reputation, seasonal_reputation, email_verified, is_verified, avatar_url)')
    .gte('created_at', monday.toISOString())
    .not('points_earned', 'is', null)

  if (error) return { data: null, error }

  const userPoints = {}
  votes?.forEach(vote => {
    const userId = vote.user_id
    if (!userPoints[userId]) {
      userPoints[userId] = {
        id: userId,
        username: vote.users.username,
        reputation: vote.users.reputation,
        seasonal_reputation: vote.users.seasonal_reputation,
        email_verified: vote.users.email_verified,
        is_verified: vote.users.is_verified,
        avatar_url: vote.users.avatar_url,
        weeklyPoints: 0
      }
    }
    userPoints[userId].weeklyPoints += vote.points_earned || 0
  })

  const sorted = Object.values(userPoints)
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
    .slice(0, limit)

  return { data: sorted, error: null }
}

// Monthly leaderboard (same as seasonal for this month)
export async function getMonthlyLeaderboard(limit = 10) {
  return getSeasonalLeaderboard(limit)
}

// =====================================================
// SILENT THINKER TRACKING
// =====================================================

// Mark user as having viewed leaderboard
export async function markLeaderboardViewed(userId) {
  const { error } = await supabase
    .from('users')
    .update({ has_viewed_leaderboard: true })
    .eq('id', userId)
  return { error }
}

// Mark user as having viewed profile insights
export async function markProfileInsightsViewed(userId) {
  const { error } = await supabase
    .from('users')
    .update({ has_viewed_profile_insights: true })
    .eq('id', userId)
  return { error }
}

// Check if user is a "silent thinker" (hasn't engaged with competitive features)
export function isSilentThinker(user) {
  if (!user) return true
  return !user.has_viewed_leaderboard && !user.has_viewed_profile_insights
}

// ===== Poll Creation Functions =====

export async function getTags() {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true })
  return { data, error }
}

export async function createTag(name) {
  const { data: existing } = await supabase
    .from('tags')
    .select('*')
    .eq('name', name.toLowerCase().trim())
    .single()
  
  if (existing) return { data: existing, error: null }
  
  const { data, error } = await supabase
    .from('tags')
    .insert([{ name: name.toLowerCase().trim() }])
    .select()
    .single()
  return { data, error }
}

export async function createPoll({ question, options, category, tags, blindMode, endsAt, pollType, createdBy }) {
  try {
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ question, category, blind_mode: blindMode, poll_type: pollType || 'prediction', ends_at: endsAt, created_by: createdBy, featured: false, resolved: false }])
      .select()
      .single()
    
    if (pollError) throw pollError

    const optionsData = options.map(opt => ({ poll_id: poll.id, text: opt, votes: 0 }))
    const { error: optionsError } = await supabase.from('options').insert(optionsData)
    if (optionsError) throw optionsError

    if (tags && tags.length > 0) {
      const tagLinks = tags.map(tagId => ({ poll_id: poll.id, tag_id: tagId }))
      await supabase.from('poll_tags').insert(tagLinks)
    }

    return { data: poll, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ===== Admin Functions =====

export async function getAllPollsAdmin() {
  const { data, error } = await supabase.from('polls').select('*, options(*), tags(*)').order('created_at', { ascending: false })
  return { data, error }
}

export async function getPendingPolls() {
  const { data, error } = await supabase.from('polls').select('*, options(*), tags(*)').eq('resolved', false).order('ends_at', { ascending: true })
  return { data, error }
}

// === Reputation Formula ===
const REPUTATION_CONFIG = {
  penalty_multiplier: 1.15,
  conviction: { 20: 0.8, 50: 1.0, 100: 1.3 },
  daily_rep_cap: 50,
  daily_loss_cap: 100,
  experience_threshold: 100
}

function getConvictionMultiplier(confidence) {
  return REPUTATION_CONFIG.conviction[confidence] || 1.0
}

function getExperienceModifier(predictionCount) {
  if (predictionCount < 15) return 0.2
  if (predictionCount < 50) return 0.3 + 0.3 * (predictionCount - 15) / 35
  if (predictionCount < 100) return 0.6 + 0.4 * (predictionCount - 50) / 50
  return Math.min(1.3, 1.0 + 0.3 * Math.log(predictionCount / 100))
}

function calculateReputationChange(stake, confidence, isCorrect, predictionCount) {
  const S = Math.sqrt(stake)
  const C = getConvictionMultiplier(confidence)
  const E = getExperienceModifier(predictionCount)
  
  if (isCorrect) {
    return Math.round(S * C * E)
  } else {
    return -Math.round(S * C * REPUTATION_CONFIG.penalty_multiplier)
  }
}

export async function resolvePoll(pollId, correctOptionId) {
  try {
    const { data: pollData } = await supabase
      .from('polls')
      .select('question, poll_type')
      .eq('id', pollId)
      .single()

    const isPrediction = pollData?.poll_type === 'prediction'

    const { error: pollError } = await supabase
      .from('polls')
      .update({ resolved: true, correct_option_id: correctOptionId, resolved_at: new Date().toISOString() })
      .eq('id', pollId)
    
    if (pollError) throw pollError

    const { data: correctOption } = await supabase
      .from('options')
      .select('text')
      .eq('id', correctOptionId)
      .single()

    const { data: votes } = await supabase.from('votes').select('id, user_id, option_id, confidence').eq('poll_id', pollId)

    const currentSeason = getThailandSeason()

    for (const vote of votes || []) {
      const isCorrect = vote.option_id === correctOptionId
      
      const { data: userData } = await supabase
        .from('users')
        .select('reputation, seasonal_reputation, current_season, current_streak, max_streak, total_predictions, correct_predictions, is_admin, has_viewed_leaderboard')
        .eq('id', vote.user_id)
        .single()
      
      if (userData) {
        const isAdmin = userData.is_admin === true
        
        let repChange = 0
        if (isPrediction && !isAdmin) {
          const stake = vote.confidence || 50
          repChange = calculateReputationChange(
            stake, 
            vote.confidence, 
            isCorrect, 
            userData.total_predictions || 0
          )
        }
        
        const newRep = Math.max(0, userData.reputation + repChange)
        const newTotal = (userData.total_predictions || 0) + 1
        const newCorrect = (userData.correct_predictions || 0) + (isCorrect ? 1 : 0)
        const newCurrentStreak = isCorrect ? (userData.current_streak || 0) + 1 : 0
        const newMaxStreak = Math.max(userData.max_streak || 0, newCurrentStreak)
        
        // Handle seasonal reputation with season rollover
        let newSeasonalRep = userData.seasonal_reputation || 0
        let userSeason = userData.current_season
        
        if (userSeason !== currentSeason) {
          // New season - reset seasonal rep
          newSeasonalRep = Math.max(0, repChange)
          userSeason = currentSeason
        } else {
          // Same season - accumulate
          newSeasonalRep = Math.max(0, newSeasonalRep + repChange)
        }
        
        await supabase.from('users').update({ 
          reputation: newRep, 
          seasonal_reputation: newSeasonalRep,
          current_season: userSeason,
          total_predictions: newTotal, 
          correct_predictions: newCorrect,
          current_streak: newCurrentStreak, 
          max_streak: newMaxStreak
        }).eq('id', vote.user_id)

        // Notification message - neutral for silent thinkers
        let notifMessage
        const isSilent = !userData.has_viewed_leaderboard
        
        if (isPrediction) {
          if (isSilent) {
            // Neutral message for silent thinkers
            notifMessage = isCorrect 
              ? `✓ "${pollData?.question?.substring(0, 50)}..." - มุมมองของคุณตรงกับผลลัพธ์`
              : `✗ "${pollData?.question?.substring(0, 50)}..." - มุมมองของคุณไม่ตรงกับผลลัพธ์`
          } else {
            // Full message for engaged users
            notifMessage = isCorrect 
              ? `🎯 มุมมองนี้แม่น! "${pollData?.question?.substring(0, 40)}..." (+${repChange} Reputation)`
              : `❌ มุมมองนี้คลาด "${pollData?.question?.substring(0, 40)}..." (${repChange} Reputation)`
          }
        } else {
          notifMessage = `📊 โพลสิ้นสุด "${pollData?.question?.substring(0, 40)}..." ตัวเลือกยอดนิยมคือ "${correctOption?.text}"`
        }
        
        await createNotification({
          userId: vote.user_id,
          type: isCorrect ? 'points_earned' : 'points_lost',
          message: notifMessage,
          pollId: pollId,
          pointsChange: isSilent ? null : repChange // Don't show points for silent thinkers
        })
      }

      await supabase.from('votes').update({ 
        is_correct: isCorrect, 
        points_earned: isPrediction ? calculateReputationChange(vote.confidence || 50, vote.confidence, isCorrect, 0) : 0
      }).eq('id', vote.id)
    }

    return { error: null }
  } catch (error) {
    return { error }
  }
}

export async function deletePoll(pollId) {
  try {
    await supabase.from('votes').delete().eq('poll_id', pollId)
    await supabase.from('poll_tags').delete().eq('poll_id', pollId)
    await supabase.from('options').delete().eq('poll_id', pollId)
    await supabase.from('notifications').delete().eq('poll_id', pollId)
    const { error } = await supabase.from('polls').delete().eq('id', pollId)
    return { error }
  } catch (error) {
    return { error }
  }
}

export async function getAllUsers() {
  const { data, error } = await supabase.from('users').select('*').order('reputation', { ascending: false })
  return { data, error }
}

export async function toggleBanUser(userId, isBanned) {
  const { error } = await supabase.from('users').update({ is_banned: isBanned }).eq('id', userId)
  return { error }
}

export async function toggleFeatured(pollId, featured) {
  const { error } = await supabase.from('polls').update({ featured }).eq('id', pollId)
  return { error }
}

export async function getAdminStats() {
  const { data: polls } = await supabase.from('polls').select('id, resolved, ends_at')
  const { data: users } = await supabase.from('users').select('id')
  const { data: votes } = await supabase.from('votes').select('id')

  const now = new Date()
  const expiredUnresolved = polls?.filter(p => !p.resolved && new Date(p.ends_at) < now).length || 0
  const activePolls = polls?.filter(p => !p.resolved && new Date(p.ends_at) >= now).length || 0
  const resolvedPolls = polls?.filter(p => p.resolved).length || 0

  return { totalPolls: polls?.length || 0, activePolls, expiredUnresolved, resolvedPolls, totalUsers: users?.length || 0, totalVotes: votes?.length || 0 }
}

// ===== Account Functions =====

export async function getUserProfile(userId) {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()
  return { data, error }
}

export async function getUserVoteHistory(userId, limit = 20) {
  const { data, error } = await supabase
    .from('votes')
    .select(`*, polls:poll_id (id, question, category, resolved, correct_option_id, ends_at), options:option_id (id, text)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data, error }
}

export async function getUserCreatedPolls(userId, limit = 20) {
  const { data, error } = await supabase.from('polls').select('*, options(*)').eq('created_by', userId).order('created_at', { ascending: false }).limit(limit)
  return { data, error }
}

export function calculateBadges(user) {
  const badges = []
  const winRate = user.total_predictions > 0 ? (user.correct_predictions / user.total_predictions) * 100 : 0
  
  if (user.total_predictions >= 10 && winRate >= 70) badges.push({ id: 'accurate', name: 'แม่นยำ', icon: '🎯', description: 'Win Rate > 70%' })
  if (user.current_streak >= 5) badges.push({ id: 'onfire', name: 'ไฟลุก', icon: '🔥', description: 'โหวตดีถูกติดต่อกัน 5 ครั้ง' })
  if (user.max_streak >= 10) badges.push({ id: 'unstoppable', name: 'ไม่หยุด', icon: '⚡', description: 'เคยโหวตดีติดต่อกัน 10 ครั้ง' })
  if (user.reputation >= 10000) badges.push({ id: 'legend', name: 'ตำนาน', icon: '👑', description: '10,000+ point' })
  else if (user.reputation >= 5000) badges.push({ id: 'master', name: 'ปรมาจารย์', icon: '🏆', description: '5,000+ point' })
  else if (user.reputation >= 3000) badges.push({ id: 'expert', name: 'ผู้เชี่ยวชาญ', icon: '⭐', description: '3,000+ point' })
  if (user.total_predictions >= 50) badges.push({ id: 'analyst', name: 'นักวิเคราะห์', icon: '📊', description: 'โหวตครบ 50 ครั้ง' })
  else if (user.total_predictions >= 10) badges.push({ id: 'rising', name: 'ดาวรุ่ง', icon: '🌟', description: 'โหวตครบ 10 ครั้ง' })
  
  return badges
}

// ===== Notification Functions =====

export async function createNotification({ userId, type, message, pollId = null, pointsChange = null }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{
      user_id: userId,
      type,
      message,
      poll_id: pollId,
      points_change: pointsChange,
      is_read: false
    }])
    .select()
    .single()
  return { data, error }
}

export async function getUserNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data, error }
}

export async function getUnreadNotificationCount(userId) {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  return { count: count || 0, error }
}

export async function markNotificationAsRead(notificationId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
  return { error }
}

export async function markAllNotificationsAsRead(userId) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  return { error }
}

// ===== Follow System Functions =====

export async function followUser(followerId, followingId) {
  const { data: existing } = await supabase
    .from('follows')
    .select('*')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single()
  
  if (existing) return { data: existing, error: null, alreadyFollowing: true }
  
  const { data, error } = await supabase
    .from('follows')
    .insert([{ follower_id: followerId, following_id: followingId }])
    .select()
    .single()
  
  return { data, error, alreadyFollowing: false }
}

export async function unfollowUser(followerId, followingId) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  
  return { error }
}

export async function isFollowing(followerId, followingId) {
  const { data } = await supabase
    .from('follows')
    .select('*')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single()
  
  return !!data
}

export async function getFollowers(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select('follower_id, users!follows_follower_id_fkey(id, username, reputation, avatar_url)')
    .eq('following_id', userId)
  
  return { data: data?.map(d => d.users) || [], error }
}

export async function getFollowing(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, users!follows_following_id_fkey(id, username, reputation, avatar_url)')
    .eq('follower_id', userId)
  
  return { data: data?.map(d => d.users) || [], error }
}

export async function getFollowCounts(userId) {
  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId)
  
  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId)
  
  return { followers: followersCount || 0, following: followingCount || 0 }
}

// ===== Avatar Upload Functions =====

export async function uploadAvatar(userId, file) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `avatars/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) return { error: uploadError }

  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)

  if (updateError) return { error: updateError }

  return { data: { url: publicUrl }, error: null }
}

export async function getUserPublicProfile(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, reputation, seasonal_reputation, avatar_url, current_streak, max_streak, total_predictions, correct_predictions, created_at, is_verified')
    .eq('id', userId)
    .single()
  
  if (error) return { data: null, error }
  
  const { followers, following } = await getFollowCounts(userId)
  
  return { 
    data: { ...user, followers, following }, 
    error: null 
  }
}

export async function searchUsers(query, limit = 10) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, reputation, avatar_url')
    .ilike('username', `%${query}%`)
    .order('reputation', { ascending: false })
    .limit(limit)
  
  return { data, error }
}

// ===== Time Capsule Functions =====

export async function createTimeCapsule({ question, options, tags, endsAt, createdBy }) {
  try {
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ 
        question, 
        category: 'time_capsule',
        blind_mode: true,
        poll_type: 'time_capsule',
        ends_at: endsAt, 
        created_by: createdBy, 
        featured: true,
        resolved: false 
      }])
      .select()
      .single()
    
    if (pollError) throw pollError

    const optionsData = options.map(opt => ({ poll_id: poll.id, text: opt, votes: 0 }))
    const { error: optionsError } = await supabase.from('options').insert(optionsData)
    if (optionsError) throw optionsError

    if (tags && tags.length > 0) {
      const tagLinks = tags.map(tagId => ({ poll_id: poll.id, tag_id: tagId }))
      await supabase.from('poll_tags').insert(tagLinks)
    }

    return { data: poll, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getTimeCapsules(limit = 20) {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*)')
    .eq('poll_type', 'time_capsule')
    .order('ends_at', { ascending: true })
    .limit(limit)
  
  return { data, error }
}

// ===== Live Battle Functions =====

export async function createLiveBattle({ question, options, category, tags, durationMinutes, createdBy }) {
  try {
    // Use Thailand time for Live Battle
    const now = getThailandNow()
    const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000)
    
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ 
        question, 
        category,
        blind_mode: false,
        poll_type: 'live_battle',
        ends_at: endsAt.toISOString(),
        created_by: createdBy, 
        featured: false,
        resolved: false,
        is_live: true,
        live_started_at: now.toISOString(),
        live_duration_minutes: durationMinutes
      }])
      .select()
      .single()
    
    if (pollError) throw pollError

    const optionsData = options.map(opt => ({ poll_id: poll.id, text: opt, votes: 0 }))
    const { error: optionsError } = await supabase.from('options').insert(optionsData)
    if (optionsError) throw optionsError

    if (tags && tags.length > 0) {
      const tagLinks = tags.map(tagId => ({ poll_id: poll.id, tag_id: tagId }))
      await supabase.from('poll_tags').insert(tagLinks)
    }

    return { data: poll, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export async function getLiveBattles() {
  const now = new Date().toISOString()
  
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*), users:created_by(username, avatar_url)')
    .eq('poll_type', 'live_battle')
    .eq('is_live', true)
    .gt('ends_at', now)
    .order('created_at', { ascending: false })
  
  return { data, error }
}

export async function endLiveBattle(pollId) {
  const { error } = await supabase
    .from('polls')
    .update({ is_live: false })
    .eq('id', pollId)
  
  return { error }
}

export function subscribeLiveBattle(pollId, callback) {
  const subscription = supabase
    .channel(`live_battle_${pollId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'options',
      filter: `poll_id=eq.${pollId}`
    }, callback)
    .subscribe()
  
  return subscription
}

export function unsubscribeLiveBattle(subscription) {
  supabase.removeChannel(subscription)
}

// ===== Verification + PDPA Functions =====

export async function submitVerification(userId, { fullName, birthDate, pdpaConsent, marketingConsent }) {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  if (age < 13) {
    return { data: null, error: { message: 'ต้องมีอายุอย่างน้อย 13 ปี' } }
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      full_name: fullName,
      birth_date: birthDate,
      pdpa_consent: pdpaConsent,
      pdpa_consent_at: pdpaConsent ? new Date().toISOString() : null,
      marketing_consent: marketingConsent,
      is_verified: true,
      verified_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  return { data, error }
}

export async function skipVerification(userId) {
  const { data, error } = await supabase
    .from('users')
    .update({ verification_skipped: true })
    .eq('id', userId)
    .select()
    .single()

  return { data, error }
}

export async function checkNeedsVerification(userId) {
  const { data } = await supabase
    .from('users')
    .select('email_verified, is_verified, verification_skipped')
    .eq('id', userId)
    .single()

  if (!data) return false

  return data.email_verified && !data.is_verified && !data.verification_skipped
}

// ===== Poll Limit Functions =====

export async function checkPollLimit(userId) {
  const { data: user } = await supabase
    .from('users')
    .select('is_verified, reputation')
    .eq('id', userId)
    .single()

  const dailyLimit = user?.is_verified ? 3 : 1

  // Use Thailand midnight for daily reset
  const thai = getThailandNow()
  thai.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('polls')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId)
    .gte('created_at', thai.toISOString())

  const used = count || 0
  const remaining = Math.max(0, dailyLimit - used)

  return {
    canCreate: remaining > 0,
    used,
    limit: dailyLimit,
    remaining,
    isVerified: user?.is_verified || false
  }
}

export async function getUserPollLimit(userId) {
  const { data: user } = await supabase
    .from('users')
    .select('is_verified')
    .eq('id', userId)
    .single()

  const dailyLimit = user?.is_verified ? 3 : 1

  // Use Thailand midnight for daily reset
  const thai = getThailandNow()
  thai.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('polls')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId)
    .gte('created_at', thai.toISOString())

  const used = count || 0
  const remaining = Math.max(0, dailyLimit - used)

  return {
    canCreate: remaining > 0,
    used,
    limit: dailyLimit,
    remaining,
    isVerified: user?.is_verified || false
  }
}

// ===== Similar Poll Detection =====

export async function findSimilarPolls(question, limit = 5) {
  const searchQuery = question.toLowerCase().trim()
  
  const keywords = searchQuery
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 5)

  if (keywords.length === 0) {
    return { data: [], error: null }
  }

  const { data: polls, error } = await supabase
    .from('polls')
    .select('id, question, ends_at, resolved, options(votes)')
    .or(keywords.map(k => `question.ilike.%${k}%`).join(','))
    .eq('resolved', false)
    .gt('ends_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error }

  const scoredPolls = polls?.map(poll => {
    const pollQuestion = poll.question.toLowerCase()
    let matchCount = 0
    keywords.forEach(keyword => {
      if (pollQuestion.includes(keyword)) matchCount++
    })
    const similarity = matchCount / keywords.length
    const totalVotes = poll.options?.reduce((sum, o) => sum + o.votes, 0) || 0
    
    return {
      ...poll,
      similarity,
      totalVotes
    }
  }).filter(p => p.similarity >= 0.4)
    .sort((a, b) => b.similarity - a.similarity)

  return { data: scoredPolls || [], error: null }
}

// ===== Creator Engagement Points =====

export async function checkAndAwardCreatorPoints(pollId) {
  const { data: poll } = await supabase
    .from('polls')
    .select('id, created_by, creator_points_100, creator_points_1000, creator_points_10000, options(votes)')
    .eq('id', pollId)
    .single()

  if (!poll) return { awarded: false }

  const totalVotes = poll.options?.reduce((sum, o) => sum + o.votes, 0) || 0
  let pointsToAward = 0
  let milestone = null
  const updates = {}

  if (totalVotes >= 10000 && !poll.creator_points_10000) {
    pointsToAward = 200
    milestone = '10000'
    updates.creator_points_10000 = true
  } else if (totalVotes >= 1000 && !poll.creator_points_1000) {
    pointsToAward = 50
    milestone = '1000'
    updates.creator_points_1000 = true
  } else if (totalVotes >= 100 && !poll.creator_points_100) {
    pointsToAward = 20
    milestone = '100'
    updates.creator_points_100 = true
  }

  if (pointsToAward > 0 && poll.created_by) {
    await supabase.from('polls').update(updates).eq('id', pollId)

    const { data: creator } = await supabase
      .from('users')
      .select('reputation, seasonal_reputation, current_season')
      .eq('id', poll.created_by)
      .single()

    if (creator) {
      const currentSeason = getThailandSeason()
      let newSeasonalRep = creator.seasonal_reputation || 0
      
      if (creator.current_season === currentSeason) {
        newSeasonalRep += pointsToAward
      } else {
        newSeasonalRep = pointsToAward
      }
      
      await supabase
        .from('users')
        .update({ 
          reputation: creator.reputation + pointsToAward,
          seasonal_reputation: newSeasonalRep,
          current_season: currentSeason
        })
        .eq('id', poll.created_by)

      await createNotification({
        userId: poll.created_by,
        type: 'creator_bonus',
        message: `🎉 โพลของคุณมีคนโหวตครบ ${milestone} คน! ได้รับ +${pointsToAward} คะแนน`,
        pollId: pollId,
        pointsChange: pointsToAward
      })
    }

    return { awarded: true, points: pointsToAward, milestone }
  }

  return { awarded: false }
}
