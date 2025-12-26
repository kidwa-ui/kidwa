import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, reputation')
    .order('reputation', { ascending: false })
    .limit(limit)
  return { data, error }
}

// ===== ฟังก์ชันสำหรับสร้างโพล =====

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

// ===== ฟังก์ชัน Admin =====

export async function getAllPollsAdmin() {
  const { data, error } = await supabase.from('polls').select('*, options(*), tags(*)').order('created_at', { ascending: false })
  return { data, error }
}

export async function getPendingPolls() {
  const { data, error } = await supabase.from('polls').select('*, options(*), tags(*)').eq('resolved', false).order('ends_at', { ascending: true })
  return { data, error }
}

export async function resolvePoll(pollId, correctOptionId) {
  try {
    const { error: pollError } = await supabase
      .from('polls')
      .update({ resolved: true, correct_option_id: correctOptionId, resolved_at: new Date().toISOString() })
      .eq('id', pollId)
    
    if (pollError) throw pollError

    const { data: votes } = await supabase.from('votes').select('id, user_id, option_id, confidence').eq('poll_id', pollId)

    for (const vote of votes || []) {
      const isCorrect = vote.option_id === correctOptionId
      const change = isCorrect ? vote.confidence : -vote.confidence
      
      const { data: userData } = await supabase
        .from('users')
        .select('reputation, current_streak, max_streak, total_predictions, correct_predictions')
        .eq('id', vote.user_id)
        .single()
      
      if (userData) {
        const newRep = Math.max(0, userData.reputation + change)
        const newTotal = (userData.total_predictions || 0) + 1
        const newCorrect = (userData.correct_predictions || 0) + (isCorrect ? 1 : 0)
        const newCurrentStreak = isCorrect ? (userData.current_streak || 0) + 1 : 0
        const newMaxStreak = Math.max(userData.max_streak || 0, newCurrentStreak)
        
        await supabase.from('users').update({ 
          reputation: newRep, total_predictions: newTotal, correct_predictions: newCorrect,
          current_streak: newCurrentStreak, max_streak: newMaxStreak
        }).eq('id', vote.user_id)
      }

      await supabase.from('votes').update({ is_correct: isCorrect, points_earned: change }).eq('id', vote.id)
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

// ===== ฟังก์ชัน Account =====

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
  if (user.current_streak >= 5) badges.push({ id: 'onfire', name: 'ไฟลุก', icon: '🔥', description: 'ทายถูกติดต่อกัน 5 ครั้ง' })
  if (user.max_streak >= 10) badges.push({ id: 'unstoppable', name: 'ไม่หยุด', icon: '⚡', description: 'เคยทายถูกติดต่อกัน 10 ครั้ง' })
  if (user.reputation >= 10000) badges.push({ id: 'legend', name: 'ตำนาน', icon: '👑', description: '10,000+ point' })
  else if (user.reputation >= 5000) badges.push({ id: 'master', name: 'ปรมาจารย์', icon: '🏆', description: '5,000+ point' })
  else if (user.reputation >= 3000) badges.push({ id: 'expert', name: 'ผู้เชี่ยวชาญ', icon: '⭐', description: '3,000+ point' })
  if (user.total_predictions >= 50) badges.push({ id: 'analyst', name: 'นักวิเคราะห์', icon: '📊', description: 'ทายครบ 50 ครั้ง' })
  else if (user.total_predictions >= 10) badges.push({ id: 'rising', name: 'ดาวรุ่ง', icon: '🌟', description: 'ทายครบ 10 ครั้ง' })
  
  return badges
}
