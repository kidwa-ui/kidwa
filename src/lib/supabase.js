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

  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert([{
      username,
      email,
      auth_id: authData.user?.id,
      email_verified: false,
      reputation: 1000
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
  const { data, error } = await supabase
    .from('users')
    .insert([{ username, reputation: 1000, streak: 0, current_streak: 0, max_streak: 0, total_predictions: 0, correct_predictions: 0 }])
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



export async function vote(userId, pollId, optionId, confidence = 50) {
  const { data: existingVote } = await supabase
    .from('votes')
    .select('*')
    .eq('user_id', userId)
    .eq('poll_id', pollId)
    .single()

  if (existingVote) {
    await supabase.from('options').update({ votes: supabase.rpc('decrement') }).eq('id', existingVote.option_id)
    const { data, error } = await supabase
      .from('votes')
      .update({ option_id: optionId, confidence })
      .eq('id', existingVote.id)
      .select()
      .single()
    await supabase.from('options').update({ votes: supabase.rpc('increment') }).eq('id', optionId)
    return { data, error }
  } else {
    const { data, error } = await supabase
      .from('votes')
      .insert([{ user_id: userId, poll_id: pollId, option_id: optionId, confidence }])
      .select()
      .single()
    await supabase.from('options').update({ votes: supabase.rpc('increment') }).eq('id', optionId)
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

// ===== Leaderboard Functions =====

export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, reputation, email_verified, is_verified, avatar_url')
    .order('reputation', { ascending: false })
    .limit(limit)
  return { data, error }
}

export async function getWeeklyLeaderboard(limit = 10) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  
  const { data: votes, error } = await supabase
    .from('votes')
    .select('user_id, points_earned, users!inner(id, username, reputation, email_verified, is_verified, avatar_url)')
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

export async function getMonthlyLeaderboard(limit = 10) {
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  firstDayOfMonth.setHours(0, 0, 0, 0)
  
  const { data: votes, error } = await supabase
    .from('votes')
    .select('user_id, points_earned, users!inner(id, username, reputation, email_verified, is_verified, avatar_url)')
    .gte('created_at', firstDayOfMonth.toISOString())
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
        email_verified: vote.users.email_verified,
        is_verified: vote.users.is_verified,
        avatar_url: vote.users.avatar_url,
        monthlyPoints: 0
      }
    }
    userPoints[userId].monthlyPoints += vote.points_earned || 0
  })

  const sorted = Object.values(userPoints)
    .sort((a, b) => b.monthlyPoints - a.monthlyPoints)
    .slice(0, limit)

  return { data: sorted, error: null }
}

// ===== Tag Functions =====

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

// ===== Trending Tags Functions =====

// Get trending tags based on vote activity with anti-spam guardrails
export async function getTrendingTags(limit = 10, timeframeDays = 7) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays)

  // Get all votes within timeframe with poll and tag info
  const { data: votes, error } = await supabase
    .from('votes')
    .select(`
      id,
      created_at,
      poll_id,
      polls!inner(
        id,
        poll_tags(
          tag_id,
          tags(id, name)
        )
      )
    `)
    .gte('created_at', cutoffDate.toISOString())

  if (error) return { data: [], error }

  // Calculate tag scores with guardrails
  const tagScores = {}
  const pollContributions = {} // Track per-poll contributions to each tag

  votes?.forEach(vote => {
    const voteAge = (Date.now() - new Date(vote.created_at).getTime()) / (1000 * 60 * 60 * 24)
    const timeDecay = Math.exp(-0.1 * voteAge) // Decay factor

    vote.polls?.poll_tags?.forEach(pt => {
      const tag = pt.tags
      if (!tag) return

      const tagId = tag.id
      const pollId = vote.poll_id

      if (!tagScores[tagId]) {
        tagScores[tagId] = {
          id: tagId,
          name: tag.name,
          score: 0,
          pollCount: new Set(),
          voteCount: 0
        }
      }

      if (!pollContributions[tagId]) {
        pollContributions[tagId] = {}
      }

      if (!pollContributions[tagId][pollId]) {
        pollContributions[tagId][pollId] = 0
      }

      // Cap per-poll contribution at 30% of total
      const MAX_POLL_CONTRIBUTION = 0.3
      const currentPollContribution = pollContributions[tagId][pollId]
      const totalScoreSoFar = tagScores[tagId].score || 1
      
      if (currentPollContribution / totalScoreSoFar < MAX_POLL_CONTRIBUTION || tagScores[tagId].pollCount.size < 2) {
        const voteWeight = 1 * timeDecay
        tagScores[tagId].score += voteWeight
        pollContributions[tagId][pollId] += voteWeight
        tagScores[tagId].pollCount.add(pollId)
        tagScores[tagId].voteCount++
      }
    })
  })

  // Filter and sort tags
  // Must have >= 2 polls and >= 5 votes to be considered trending
  const trendingTags = Object.values(tagScores)
    .filter(tag => tag.pollCount.size >= 2 && tag.voteCount >= 5)
    .map(tag => ({
      id: tag.id,
      name: tag.name,
      score: Math.round(tag.score * 100) / 100,
      pollCount: tag.pollCount.size,
      voteCount: tag.voteCount
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return { data: trendingTags, error: null }
}


// ===== Poll Functions =====

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

// === v9 Reputation Formula (v1.1 with conviction-scaled penalty) ===
const REPUTATION_CONFIG = {
  conviction: { 20: 0.8, 50: 1.0, 100: 1.3 },
  penalty: { 20: 0.9, 50: 1.15, 100: 1.35 }, // NEW: scaled penalty by conviction
  daily_rep_cap: 75,   // relaxed from 50
  daily_loss_cap: 150, // relaxed from 100
  experience_threshold: 100
}

// Red Flag Thresholds (from hybrid test simulation)
const RED_FLAG_THRESHOLDS = {
  vote: {
    maxGain: 21,
    maxLoss: 27,
    avgChangeFloor: -8
  },
  daily: {
    maxGainPerUser: 105,
    maxLossPerUser: 135,
    maxVotesPerUser: 20
  },
  system: {
    zeroRepUserRatio: 0.15,
    maxRepInSystem: 5000,
    repStdDevMax: 600
  }
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
    // v1.1: Use conviction-scaled penalty instead of flat multiplier
    const P = REPUTATION_CONFIG.penalty[confidence] || 1.15
    return -Math.round(S * C * P)
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

    for (const vote of votes || []) {
      const isCorrect = vote.option_id === correctOptionId
      
      const { data: userData } = await supabase
        .from('users')
        .select('reputation, current_streak, max_streak, total_predictions, correct_predictions, is_admin')
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
        
        await supabase.from('users').update({ 
          reputation: newRep, total_predictions: newTotal, correct_predictions: newCorrect,
          current_streak: newCurrentStreak, max_streak: newMaxStreak
        }).eq('id', vote.user_id)

        let notifMessage
        if (isPrediction) {
          notifMessage = isCorrect 
            ? `🎯 มุมมองนี้แม่น! "${pollData?.question?.substring(0, 40)}..." (+${repChange} Reputation)`
            : `❌ มุมมองนี้คลาด "${pollData?.question?.substring(0, 40)}..." (${repChange} Reputation)`
        } else {
          notifMessage = `📊 โพลสิ้นสุด "${pollData?.question?.substring(0, 40)}..." ตัวเลือกยอดนิยมคือ "${correctOption?.text}"`
        }
        
        await createNotification({
          userId: vote.user_id,
          type: isCorrect ? 'points_earned' : 'points_lost',
          message: notifMessage,
          pollId: pollId,
          pointsChange: repChange
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
    .select('id, username, reputation, avatar_url, current_streak, max_streak, total_predictions, correct_predictions, created_at, is_verified')
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
        category: 'timecapsule',
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

// Helper function to create Thailand timezone ISO string
function toThailandISOString(date) {
  // Thailand is UTC+7
  const tzOffset = 7 * 60 // minutes
  const localTime = new Date(date.getTime() + tzOffset * 60 * 1000)
  return localTime.toISOString().replace('Z', '+07:00')
}

export async function createLiveBattle({ question, options, category, tags, endsAt, createdBy }) {
  try {
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ 
        question, 
        category,
        blind_mode: false,
        poll_type: 'live_battle',
        ends_at: endsAt,
        created_by: createdBy, 
        featured: false,
        resolved: false,
        is_live: true,
        live_started_at: new Date().toISOString()
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
  const now = new Date()
  // Show battles that ended within 5 minutes as well
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*), users:created_by(username, avatar_url)')
    .eq('poll_type', 'live_battle')
    .eq('is_live', true)
    .gt('ends_at', fiveMinutesAgo.toISOString())
    .order('ends_at', { ascending: true })

  if (error) return { data: null, error }

  // Sort: active (closest to ending) first, then recently ended, then older ended
  const sortedData = (data || []).sort((a, b) => {
    const aEnds = new Date(a.ends_at)
    const bEnds = new Date(b.ends_at)
    const aActive = aEnds > now
    const bActive = bEnds > now

    // Both active: sort by closest to ending
    if (aActive && bActive) {
      return aEnds - bEnds
    }
    // Active comes before ended
    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1
    // Both ended: sort by most recently ended
    return bEnds - aEnds
  })
  
  return { data: sortedData, error: null }
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

  const dailyLimit = (user?.is_verified || user?.is_admin) ? 3 : 1
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('polls')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId)
    .gte('created_at', today.toISOString())

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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('polls')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId)
    .gte('created_at', today.toISOString())

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

// ===== Category & Tag Routes =====

export async function getPollsByCategory(category, limit = 50) {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*), users:created_by(username, avatar_url)')
    .eq('category', category)
    .order('ends_at', { ascending: true })
    .limit(limit)
  
  return { data, error }
}

export async function getPollsByTag(tagName, limit = 50) {
  // First find the tag
  const { data: tag } = await supabase
    .from('tags')
    .select('id')
    .eq('name', tagName.toLowerCase())
    .single()
  
  if (!tag) return { data: [], error: null }
  
  // Get poll IDs with this tag
  const { data: pollTags } = await supabase
    .from('poll_tags')
    .select('poll_id')
    .eq('tag_id', tag.id)
  
  if (!pollTags || pollTags.length === 0) return { data: [], error: null }
  
  const pollIds = pollTags.map(pt => pt.poll_id)
  
  // Get the polls
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*), users:created_by(username, avatar_url)')
    .in('id', pollIds)
    .order('ends_at', { ascending: true })
    .limit(limit)
  
  return { data, error }
}

// ===== Tag Suggestions =====

export async function getTagSuggestions(question, category, limit = 5) {
  const keywords = question
    .toLowerCase()
    .replace(/[^\u0E00-\u0E7Fa-z0-9\s]/g, '') // Keep Thai, alphanumeric, spaces
    .split(/\s+/)
    .filter(word => word.length > 2)
  
  if (keywords.length === 0) {
    return { data: [], error: null }
  }
  
  // Get popular tags from same category
  const { data: categoryPolls } = await supabase
    .from('polls')
    .select('id')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(50)
  
  const categoryPollIds = categoryPolls?.map(p => p.id) || []
  
  // Get tags used in these polls
  let tagCounts = {}
  
  if (categoryPollIds.length > 0) {
    const { data: pollTags } = await supabase
      .from('poll_tags')
      .select('tag_id, tags(id, name)')
      .in('poll_id', categoryPollIds)
    
    pollTags?.forEach(pt => {
      if (pt.tags) {
        const tagId = pt.tags.id
        if (!tagCounts[tagId]) {
          tagCounts[tagId] = { id: tagId, name: pt.tags.name, count: 0, matchScore: 0 }
        }
        tagCounts[tagId].count += 1
      }
    })
  }
  
  // Also search all tags matching keywords
  const { data: matchingTags } = await supabase
    .from('tags')
    .select('id, name')
    .or(keywords.map(k => `name.ilike.%${k}%`).join(','))
    .limit(20)
  
  matchingTags?.forEach(tag => {
    if (!tagCounts[tag.id]) {
      tagCounts[tag.id] = { id: tag.id, name: tag.name, count: 0, matchScore: 0 }
    }
    // Calculate match score
    let matchCount = 0
    keywords.forEach(keyword => {
      if (tag.name.toLowerCase().includes(keyword)) matchCount++
    })
    tagCounts[tag.id].matchScore = matchCount / keywords.length
  })
  
  // Sort by combined score (category usage + keyword match)
  const suggestions = Object.values(tagCounts)
    .map(tag => ({
      ...tag,
      totalScore: tag.count * 0.5 + tag.matchScore * 10
    }))
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, limit)
  
  return { data: suggestions, error: null }
}

// ===== Updated Live Battle Functions =====

export async function createLiveBattleV2({ question, options, category, tags, endsAt, createdBy }) {
  try {
    // Use local time with explicit timezone
    const now = new Date()
    const endsAt = new Date(now.getTime() + endsAt * 60 * 1000)
    
    // Format as ISO string with timezone
    const formatWithTimezone = (date) => {
      const offset = -date.getTimezoneOffset()
      const sign = offset >= 0 ? '+' : '-'
      const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
      const minutes = String(Math.abs(offset) % 60).padStart(2, '0')
      return date.toISOString().replace('Z', `${sign}${hours}:${minutes}`)
    }
    
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
        live_duration_minutes: endsAt
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

export async function getLiveBattlesV2() {
  const now = new Date()
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
  
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*), users:created_by(username, avatar_url)')
    .eq('poll_type', 'live_battle')
    .eq('is_live', true)
    .order('ends_at', { ascending: true })
  
  if (error || !data) return { data: [], error }
  
  // Custom sorting:
  // 1. Active polls (closest to ending first)
  // 2. Recently ended polls (within 5 minutes)
  // 3. Expired polls
  const sortedData = data.sort((a, b) => {
    const aEnd = new Date(a.ends_at)
    const bEnd = new Date(b.ends_at)
    
    const aActive = aEnd > now
    const bActive = bEnd > now
    const aRecentlyEnded = !aActive && aEnd > fiveMinutesAgo
    const bRecentlyEnded = !bActive && bEnd > fiveMinutesAgo
    
    // Active polls first
    if (aActive && !bActive) return -1
    if (!aActive && bActive) return 1
    
    // Both active: closest to ending first
    if (aActive && bActive) return aEnd - bEnd
    
    // Recently ended polls next
    if (aRecentlyEnded && !bRecentlyEnded) return -1
    if (!aRecentlyEnded && bRecentlyEnded) return 1
    
    // Both expired: most recent first
    return bEnd - aEnd
  })
  
  return { data: sortedData, error: null }
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
      .select('reputation')
      .eq('id', poll.created_by)
      .single()

    if (creator) {
      await supabase
        .from('users')
        .update({ reputation: creator.reputation + pointsToAward })
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
