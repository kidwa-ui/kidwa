import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ===== Auth Functions =====

// สมัครสมาชิกด้วย Email + Password
export async function signUpWithEmail(email, password, username) {
  // ตรวจสอบว่า username ซ้ำไหม
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single()
  
  if (existingUser) {
    return { data: null, error: { message: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' } }
  }

  // ตรวจสอบว่า email ซ้ำไหม
  const { data: existingEmail } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single()
  
  if (existingEmail) {
    return { data: null, error: { message: 'อีเมลนี้ถูกใช้แล้ว' } }
  }

  // สมัครกับ Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username }
    }
  })

  if (authError) return { data: null, error: authError }

  // สร้าง user ใน users table
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

// เข้าสู่ระบบด้วย Email + Password
export async function signInWithEmail(email, password) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (authError) return { data: null, error: authError }

  // ดึงข้อมูล user จาก users table
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

// เข้าสู่ระบบด้วย Magic Link
export async function signInWithMagicLink(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`
    }
  })

  return { data, error }
}

// ออกจากระบบ
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// ดึง session ปัจจุบัน
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  return { session, error }
}

// ดึงข้อมูล user จาก auth session
export async function getUserFromSession() {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user) return { data: null, error: null }

  const { data: userData, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', session.user.id)
    .single()

  // อัพเดท email_verified ถ้ายืนยันแล้ว
  if (userData && session.user.email_confirmed_at && !userData.email_verified) {
    await supabase
      .from('users')
      .update({ email_verified: true })
      .eq('id', userData.id)
    userData.email_verified = true
  }

  return { data: userData, error }
}

// ลืมรหัสผ่าน
export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`
  })

  return { data, error }
}

// เปลี่ยนรหัสผ่าน
export async function updatePassword(newPassword) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  })

  return { data, error }
}

// Subscribe to auth state changes
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

// Sign in with Google
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
  // Fetch polls ก่อน
  const { data: pollsData, error } = await supabase
    .from('polls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  
  if (error || !pollsData) return { data: [], error }
  
  // Fetch options แยก
  const pollIds = pollsData.map(p => p.id)
  const { data: optionsData } = await supabase
    .from('poll_options')
    .select('*')
    .in('poll_id', pollIds.length > 0 ? pollIds : ['00000000-0000-0000-0000-000000000000'])
  
  // Map options เข้ากับ polls
  const optionsMap = {}
  optionsData?.forEach(opt => {
    if (!optionsMap[opt.poll_id]) optionsMap[opt.poll_id] = []
    optionsMap[opt.poll_id].push(opt)
  })
  
  const pollsWithOptions = pollsData.map(poll => ({
    ...poll,
    options: optionsMap[poll.id] || []
  }))
  
  return { data: pollsWithOptions, error: null }
}

export async function vote(userId, pollId, optionId, confidence = 50) {
  const { data: existingVote } = await supabase
    .from('votes')
    .select('*')
    .eq('user_id', userId)
    .eq('poll_id', pollId)
    .single()

  if (existingVote) {
    // ลด vote จาก option เดิม
    const { data: oldOption } = await supabase
      .from('poll_options')
      .select('votes')
      .eq('id', existingVote.option_id)
      .single()
    
    if (oldOption) {
      await supabase
        .from('poll_options')
        .update({ votes: Math.max((oldOption.votes || 1) - 1, 0) })
        .eq('id', existingVote.option_id)
    }
    
    const { data, error } = await supabase
      .from('votes')
      .update({ option_id: optionId, confidence })
      .eq('id', existingVote.id)
      .select()
      .single()
    
    // เพิ่ม vote ให้ option ใหม่
    const { data: newOption } = await supabase
      .from('poll_options')
      .select('votes')
      .eq('id', optionId)
      .single()
    
    if (newOption) {
      await supabase
        .from('poll_options')
        .update({ votes: (newOption.votes || 0) + 1 })
        .eq('id', optionId)
    }
    
    return { data, error }
  } else {
    const { data, error } = await supabase
      .from('votes')
      .insert([{ user_id: userId, poll_id: pollId, option_id: optionId, confidence }])
      .select()
      .single()
    
    // เพิ่ม vote
    const { data: option } = await supabase
      .from('poll_options')
      .select('votes')
      .eq('id', optionId)
      .single()
    
    if (option) {
      await supabase
        .from('poll_options')
        .update({ votes: (option.votes || 0) + 1 })
        .eq('id', optionId)
    }
    
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
    .select('id, username, reputation, email_verified, is_verified, avatar_url, selected_skin')
    .order('reputation', { ascending: false })
    .limit(limit)
  return { data, error }
}

// Leaderboard รายสัปดาห์ - ตัดรอบจันทร์-อาทิตย์
export async function getWeeklyLeaderboard(limit = 10) {
  // หาวันจันทร์ของสัปดาห์นี้
  const now = new Date()
  const dayOfWeek = now.getDay() // 0 = อาทิตย์, 1 = จันทร์, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  
  const { data: votes, error } = await supabase
    .from('votes')
    .select('user_id, points_earned, users!inner(id, username, reputation, email_verified, is_verified, avatar_url, selected_skin)')
    .gte('created_at', monday.toISOString())
    .not('points_earned', 'is', null)

  if (error) return { data: null, error }

  // รวมคะแนนตาม user
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
        selected_skin: vote.users.selected_skin,
        weeklyPoints: 0
      }
    }
    userPoints[userId].weeklyPoints += vote.points_earned || 0
  })

  // เรียงลำดับและ return
  const sorted = Object.values(userPoints)
    .sort((a, b) => b.weeklyPoints - a.weeklyPoints)
    .slice(0, limit)

  return { data: sorted, error: null }
}

// Leaderboard รายเดือน - ตัดรอบตามเดือนปฏิทิน (วันที่ 1 - สิ้นเดือน)
export async function getMonthlyLeaderboard(limit = 10) {
  // หาวันที่ 1 ของเดือนนี้
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  firstDayOfMonth.setHours(0, 0, 0, 0)
  
  const { data: votes, error } = await supabase
    .from('votes')
    .select('user_id, points_earned, users!inner(id, username, reputation, email_verified, is_verified, avatar_url, selected_skin)')
    .gte('created_at', firstDayOfMonth.toISOString())
    .not('points_earned', 'is', null)

  if (error) return { data: null, error }

  // รวมคะแนนตาม user
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
        selected_skin: vote.users.selected_skin,
        monthlyPoints: 0
      }
    }
    userPoints[userId].monthlyPoints += vote.points_earned || 0
  })

  // เรียงลำดับและ return
  const sorted = Object.values(userPoints)
    .sort((a, b) => b.monthlyPoints - a.monthlyPoints)
    .slice(0, limit)

  return { data: sorted, error: null }
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
  const { data: pollsData, error } = await supabase.from('polls').select('*').order('created_at', { ascending: false })
  if (error || !pollsData) return { data: [], error }
  
  const pollIds = pollsData.map(p => p.id)
  const { data: optionsData } = await supabase.from('poll_options').select('*').in('poll_id', pollIds.length > 0 ? pollIds : ['00000000-0000-0000-0000-000000000000'])
  
  const optionsMap = {}
  optionsData?.forEach(opt => {
    if (!optionsMap[opt.poll_id]) optionsMap[opt.poll_id] = []
    optionsMap[opt.poll_id].push(opt)
  })
  
  const pollsWithOptions = pollsData.map(poll => ({ ...poll, options: optionsMap[poll.id] || [] }))
  return { data: pollsWithOptions, error: null }
}

export async function getPendingPolls() {
  const { data: pollsData, error } = await supabase.from('polls').select('*').eq('resolved', false).order('ends_at', { ascending: true })
  if (error || !pollsData) return { data: [], error }
  
  const pollIds = pollsData.map(p => p.id)
  const { data: optionsData } = await supabase.from('poll_options').select('*').in('poll_id', pollIds.length > 0 ? pollIds : ['00000000-0000-0000-0000-000000000000'])
  
  const optionsMap = {}
  optionsData?.forEach(opt => {
    if (!optionsMap[opt.poll_id]) optionsMap[opt.poll_id] = []
    optionsMap[opt.poll_id].push(opt)
  })
  
  const pollsWithOptions = pollsData.map(poll => ({ ...poll, options: optionsMap[poll.id] || [] }))
  return { data: pollsWithOptions, error: null }
}

export async function resolvePoll(pollId, correctOptionId) {
  try {
    // ดึงข้อมูล poll ก่อน
    const { data: pollData } = await supabase
      .from('polls')
      .select('question')
      .eq('id', pollId)
      .single()

    const { error: pollError } = await supabase
      .from('polls')
      .update({ resolved: true, correct_option_id: correctOptionId, resolved_at: new Date().toISOString() })
      .eq('id', pollId)
    
    if (pollError) throw pollError

    // ดึงข้อมูล correct option
    const { data: correctOption } = await supabase
      .from('options')
      .select('text')
      .eq('id', correctOptionId)
      .single()

    const { data: votes } = await supabase.from('votes').select('id, user_id, option_id, confidence').eq('poll_id', pollId)

    for (const vote of votes || []) {
      const isCorrect = vote.option_id === correctOptionId
      const change = isCorrect ? vote.confidence : -vote.confidence
      
      const { data: userData } = await supabase
        .from('users')
        .select('reputation, current_streak, max_streak, total_predictions, correct_predictions, is_admin')
        .eq('id', vote.user_id)
        .single()
      
      if (userData) {
        // Admin ไม่นับคะแนน (reputation ไม่เปลี่ยน)
        const isAdmin = userData.is_admin === true
        const newRep = isAdmin ? userData.reputation : Math.max(0, userData.reputation + change)
        const newTotal = (userData.total_predictions || 0) + 1
        const newCorrect = (userData.correct_predictions || 0) + (isCorrect ? 1 : 0)
        const newCurrentStreak = isCorrect ? (userData.current_streak || 0) + 1 : 0
        const newMaxStreak = Math.max(userData.max_streak || 0, newCurrentStreak)
        
        await supabase.from('users').update({ 
          reputation: newRep, total_predictions: newTotal, correct_predictions: newCorrect,
          current_streak: newCurrentStreak, max_streak: newMaxStreak
        }).eq('id', vote.user_id)

        // สร้าง Notification สำหรับผู้โหวต
        let notifMessage
        if (isAdmin) {
          notifMessage = isCorrect 
            ? `🎉 ทายถูก! "${pollData?.question?.substring(0, 50)}..." คำตอบคือ "${correctOption?.text}" (Admin - ไม่นับคะแนน)`
            : `😢 ทายผิด "${pollData?.question?.substring(0, 50)}..." คำตอบคือ "${correctOption?.text}" (Admin - ไม่นับคะแนน)`
        } else {
          notifMessage = isCorrect 
            ? `🎉 ทายถูก! "${pollData?.question?.substring(0, 50)}..." คำตอบคือ "${correctOption?.text}" (+${vote.confidence} pt)`
            : `😢 ทายผิด "${pollData?.question?.substring(0, 50)}..." คำตอบคือ "${correctOption?.text}" (${change} pt)`
        }
        
        await createNotification({
          userId: vote.user_id,
          type: isCorrect ? 'points_earned' : 'points_lost',
          message: notifMessage,
          pollId: pollId,
          pointsChange: isAdmin ? 0 : change
        })
      }

      // บันทึกผลโหวต (Admin ก็ได้ 0 points)
      const { data: voterData } = await supabase.from('users').select('is_admin').eq('id', vote.user_id).single()
      const pointsToRecord = voterData?.is_admin ? 0 : change
      await supabase.from('votes').update({ is_correct: isCorrect, points_earned: pointsToRecord }).eq('id', vote.id)
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
  const { data: pollsData, error } = await supabase.from('polls').select('*').eq('created_by', userId).order('created_at', { ascending: false }).limit(limit)
  if (error || !pollsData) return { data: [], error }
  
  const pollIds = pollsData.map(p => p.id)
  const { data: optionsData } = await supabase.from('poll_options').select('*').in('poll_id', pollIds.length > 0 ? pollIds : ['00000000-0000-0000-0000-000000000000'])
  
  const optionsMap = {}
  optionsData?.forEach(opt => {
    if (!optionsMap[opt.poll_id]) optionsMap[opt.poll_id] = []
    optionsMap[opt.poll_id].push(opt)
  })
  
  const pollsWithOptions = pollsData.map(poll => ({ ...poll, options: optionsMap[poll.id] || [] }))
  return { data: pollsWithOptions, error: null }
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

// ===== ฟังก์ชัน Notification =====

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

// ===== ฟังก์ชัน Follow System =====

export async function followUser(followerId, followingId) {
  // ตรวจสอบว่าติดตามอยู่แล้วหรือไม่
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
    .select('follower_id, users!follows_follower_id_fkey(id, username, reputation, avatar_url, is_verified, selected_skin)')
    .eq('following_id', userId)
  
  return { data: data?.map(d => d.users) || [], error }
}

export async function getFollowing(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id, users!follows_following_id_fkey(id, username, reputation, avatar_url, is_verified, selected_skin)')
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

// ===== ฟังก์ชัน Avatar Upload =====

export async function uploadAvatar(userId, file) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `avatars/${fileName}`

  // อัพโหลดไฟล์ไปยัง Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) return { error: uploadError }

  // รับ public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  // อัพเดท avatar_url ใน users table
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
    .select('id, username, reputation, avatar_url, is_verified, selected_skin, current_streak, max_streak, total_predictions, correct_predictions, created_at')
    .eq('id', userId)
    .single()
  
  if (error) return { data: null, error }
  
  const { followers } = await getFollowCounts(userId)
  
  return { 
    data: { ...user, followers }, 
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

// Search users for @mention autocomplete (prioritize following)
export async function searchUsersForMention(query, currentUserId, limit = 8) {
  // ถ้าไม่มี query ให้แสดงคนที่ติดตามก่อน
  if (!query || query.length === 0) {
    if (currentUserId) {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id, users!follows_following_id_fkey(id, username, reputation, avatar_url, is_verified, selected_skin)')
        .eq('follower_id', currentUserId)
        .limit(limit)
      
      return { data: following?.map(f => f.users).filter(Boolean) || [], error: null }
    }
    return { data: [], error: null }
  }
  
  // ค้นหา users ที่ match
  const { data: allUsers, error } = await supabase
    .from('users')
    .select('id, username, reputation, avatar_url, is_verified, selected_skin')
    .ilike('username', `${query}%`)
    .order('reputation', { ascending: false })
    .limit(20)
  
  if (error || !allUsers) return { data: [], error }
  
  // ถ้า login อยู่ ให้เรียงคนที่ติดตามขึ้นก่อน
  if (currentUserId) {
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
    
    const followingIds = new Set(followingData?.map(f => f.following_id) || [])
    
    // แยกเป็น 2 กลุ่ม: คนที่ติดตาม vs คนอื่น
    const following = allUsers.filter(u => followingIds.has(u.id))
    const others = allUsers.filter(u => !followingIds.has(u.id))
    
    return { data: [...following, ...others].slice(0, limit), error: null }
  }
  
  return { data: allUsers.slice(0, limit), error: null }
}

// ===== Time Capsule Functions =====

export async function createTimeCapsule({ question, options, tags, endsAt, createdBy }) {
  try {
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ 
        question, 
        category: 'time_capsule',
        blind_mode: true, // Time Capsule บังคับ Blind Mode
        poll_type: 'time_capsule',
        ends_at: endsAt, 
        created_by: createdBy, 
        featured: true, // Time Capsule แสดงเด่นเสมอ
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
  const { data: pollsData, error } = await supabase
    .from('polls')
    .select('*')
    .eq('poll_type', 'time_capsule')
    .order('ends_at', { ascending: true })
    .limit(limit)
  
  if (error || !pollsData) return { data: [], error }
  
  const pollIds = pollsData.map(p => p.id)
  const { data: optionsData } = await supabase.from('poll_options').select('*').in('poll_id', pollIds.length > 0 ? pollIds : ['00000000-0000-0000-0000-000000000000'])
  
  const optionsMap = {}
  optionsData?.forEach(opt => {
    if (!optionsMap[opt.poll_id]) optionsMap[opt.poll_id] = []
    optionsMap[opt.poll_id].push(opt)
  })
  
  const pollsWithOptions = pollsData.map(poll => ({ ...poll, options: optionsMap[poll.id] || [] }))
  return { data: pollsWithOptions, error: null }
}

// ===== Live Battle Functions =====

export async function createLiveBattle({ question, options, category, tags, endsAt, createdBy }) {
  try {
    const nowISO = new Date().toISOString()
    
    // คำนวณ duration เป็นนาที (สำหรับ reference)
    const durationMs = new Date(endsAt).getTime() - Date.now()
    const durationMinutes = Math.round(durationMs / 60000)
    
    console.log('Creating Live Battle:', {
      endsAt,
      durationMinutes,
      nowISO
    })
    
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
        live_started_at: nowISO,
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
    console.error('Error creating Live Battle:', error)
    return { data: null, error }
  }
}

export async function getLiveBattles() {
  const { data: pollsData, error } = await supabase
    .from('polls')
    .select('*')
    .eq('poll_type', 'live_battle')
    .eq('is_live', true)
    .order('created_at', { ascending: false })
  
  if (error || !pollsData) return { data: [], error }
  
  const pollIds = pollsData.map(p => p.id)
  const { data: optionsData } = await supabase.from('poll_options').select('*').in('poll_id', pollIds.length > 0 ? pollIds : ['00000000-0000-0000-0000-000000000000'])
  
  const optionsMap = {}
  optionsData?.forEach(opt => {
    if (!optionsMap[opt.poll_id]) optionsMap[opt.poll_id] = []
    optionsMap[opt.poll_id].push(opt)
  })
  
  const pollsWithOptions = pollsData.map(poll => ({ ...poll, options: optionsMap[poll.id] || [] }))
  return { data: pollsWithOptions, error: null }
}

export async function endLiveBattle(pollId) {
  const { error } = await supabase
    .from('polls')
    .update({ is_live: false })
    .eq('id', pollId)
  
  return { error }
}

// Subscribe to live battle updates (real-time)
export function subscribeLiveBattle(pollId, callback) {
  const subscription = supabase
    .channel(`live_battle_${pollId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'poll_options',
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
  // คำนวณอายุ
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  // ตรวจสอบอายุขั้นต่ำ (13 ปี)
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
  // ข้ามการ verify แต่ยังใช้งานได้ (ไม่ได้ verified badge)
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

  // ต้องแสดง popup ถ้า: email verified แล้ว + ยังไม่ verify ตัวตน + ยังไม่ skip
  return data.email_verified && !data.is_verified && !data.verification_skipped
}

// ===== Poll Limit Functions =====

export async function checkPollLimit(userId) {
  // ดึงข้อมูล user เพื่อเช็คว่า verified หรือไม่
  const { data: user } = await supabase
    .from('users')
    .select('is_verified, reputation')
    .eq('id', userId)
    .single()

  // กำหนดโควต้า: verified = 3 โพล/วัน, ไม่ verified = 1 โพล/วัน
  const dailyLimit = user?.is_verified ? 3 : 1

  // นับโพลที่สร้างวันนี้
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
    .select('is_verified, is_admin')
    .eq('id', userId)
    .single()

  // Admin = ไม่จำกัด (Unlimited)
  if (user?.is_admin) {
    return {
      canCreate: true,
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      isVerified: true,
      isAdmin: true
    }
  }

  // กำหนดโควต้า: verified = 3 โพล/วัน, ไม่ verified = 1 โพล/วัน
  const dailyLimit = user?.is_verified ? 3 : 1

  // นับโพลที่สร้างวันนี้
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
    isVerified: user?.is_verified || false,
    isAdmin: false
  }
}

// ===== Similar Poll Detection =====

export async function findSimilarPolls(question, limit = 5) {
  // ลบ space, ตัวเลข, สัญลักษณ์ ออกก่อนเปรียบเทียบ
  const cleanText = (text) => text.toLowerCase().replace(/[\s\d\.\,\?\!\:\;\-\_\(\)\/\\]/g, '').trim()
  
  const searchQuery = cleanText(question)
  
  if (searchQuery.length < 4) {
    return { data: [], error: null }
  }

  // สำหรับภาษาไทย: ใช้ sliding window สร้าง chunks
  const chunks = new Set()
  const chunkSizes = [4, 5, 6, 7, 8]
  
  for (const size of chunkSizes) {
    for (let i = 0; i <= searchQuery.length - size; i++) {
      const chunk = searchQuery.substring(i, i + size)
      if (chunk.length >= 4) {
        chunks.add(chunk)
      }
    }
  }
  
  const uniqueChunks = [...chunks].slice(0, 15)
  
  if (uniqueChunks.length === 0) {
    return { data: [], error: null }
  }

  // ค้นหาโพลทั้งหมดที่ยังไม่หมดอายุ
  const { data: polls, error } = await supabase
    .from('polls')
    .select('id, question, ends_at, resolved')
    .eq('resolved', false)
    .gt('ends_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error || !polls) return { data: [], error }
  
  // Fetch options แยก
  const pollIds = polls.map(p => p.id)
  const { data: optionsData } = await supabase
    .from('poll_options')
    .select('poll_id, votes')
    .in('poll_id', pollIds.length > 0 ? pollIds : ['00000000-0000-0000-0000-000000000000'])
  
  // คำนวณ total votes per poll
  const votesMap = {}
  optionsData?.forEach(opt => {
    if (!votesMap[opt.poll_id]) votesMap[opt.poll_id] = 0
    votesMap[opt.poll_id] += opt.votes || 0
  })

  // คำนวณ similarity score
  const scoredPolls = polls?.map(poll => {
    const pollClean = cleanText(poll.question)
    let matchCount = 0
    
    uniqueChunks.forEach(chunk => {
      if (pollClean.includes(chunk)) {
        matchCount++
      }
    })
    
    // คำนวณ score
    const chunkScore = uniqueChunks.length > 0 ? matchCount / uniqueChunks.length : 0
    
    // เช็ค substring ตรงๆ (คำถามใหม่อยู่ในเก่า หรือกลับกัน)
    const directMatch = pollClean.includes(searchQuery) || searchQuery.includes(pollClean)
    const containsScore = directMatch ? 0.5 : 0
    
    // รวม score
    const similarity = Math.min(chunkScore + containsScore, 1)
    const totalVotes = votesMap[poll.id] || 0
    
    return {
      id: poll.id,
      question: poll.question,
      ends_at: poll.ends_at,
      similarity,
      totalVotes
    }
  }).filter(p => p.similarity >= 0.25) // ลด threshold เป็น 25%
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return { data: scoredPolls || [], error: null }
}

// ===== Creator Engagement Points =====

export async function checkAndAwardCreatorPoints(pollId) {
  // ดึงข้อมูล poll
  const { data: poll } = await supabase
    .from('polls')
    .select('id, created_by, creator_points_100, creator_points_1000, creator_points_10000')
    .eq('id', pollId)
    .single()

  if (!poll) return { awarded: false }

  // Fetch options แยก
  const { data: optionsData } = await supabase
    .from('poll_options')
    .select('votes')
    .eq('poll_id', pollId)
  
  const totalVotes = optionsData?.reduce((sum, o) => sum + (o.votes || 0), 0) || 0
  let pointsToAward = 0
  let milestone = null
  const updates = {}

  // ตรวจสอบ milestones
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
    // อัพเดท poll flags
    await supabase.from('polls').update(updates).eq('id', pollId)

    // เพิ่มคะแนนให้ผู้สร้าง
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

      // สร้าง notification
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

// ===== Character System Functions =====

// อัพเดท skin ที่เลือก
export async function updateSelectedSkin(userId, skinId) {
  const { data, error } = await supabase
    .from('users')
    .update({ selected_skin: skinId })
    .eq('id', userId)
    .select()
    .single()
  
  return { data, error }
}

// ดึงข้อมูล user stats สำหรับ character system
export async function getUserCharacterStats(userId) {
  // ดึงยอดโหวตสูงสุดของ poll ที่ user สร้าง
  const { data: polls } = await supabase
    .from('polls')
    .select('id, max_votes_reached')
    .eq('created_by', userId)
  
  let maxPollVotes = 0
  if (polls && polls.length > 0) {
    // Fetch options แยก
    const pollIds = polls.map(p => p.id)
    const { data: optionsData } = await supabase
      .from('poll_options')
      .select('poll_id, votes')
      .in('poll_id', pollIds)
    
    // คำนวณ total votes per poll
    const votesMap = {}
    optionsData?.forEach(opt => {
      if (!votesMap[opt.poll_id]) votesMap[opt.poll_id] = 0
      votesMap[opt.poll_id] += opt.votes || 0
    })
    
    for (const poll of polls) {
      const totalVotes = votesMap[poll.id] || 0
      const maxReached = poll.max_votes_reached || totalVotes
      if (maxReached > maxPollVotes) {
        maxPollVotes = maxReached
      }
    }
  }
  
  // ดึง night_votes จาก user
  const { data: user } = await supabase
    .from('users')
    .select('night_votes, created_at, max_streak, is_verified')
    .eq('id', userId)
    .single()
  
  return {
    maxPollVotes,
    nightVotes: user?.night_votes || 0,
    memberSince: user?.created_at,
    maxStreak: user?.max_streak || 0,
    isVerified: user?.is_verified || false
  }
}

// Track night vote (22:00 - 06:00)
export async function trackVoteTime(userId) {
  const hour = new Date().getHours()
  const isNightTime = hour >= 22 || hour < 6
  
  if (isNightTime) {
    await supabase.rpc('increment_night_votes', { user_uuid: userId })
  }
  
  return { isNightTime }
}

// อัพโหลด avatar (สำหรับ verified users เท่านั้น, จำกัด 1MB)
export async function uploadAvatarVerified(userId, file, isVerified) {
  // ตรวจสอบว่า verified หรือไม่
  if (!isVerified) {
    return { data: null, error: { message: 'ต้องยืนยันตัวตนก่อนจึงจะอัพโหลดรูปได้' } }
  }
  
  // ตรวจสอบขนาดไฟล์ (max 1MB)
  if (file.size > 1 * 1024 * 1024) {
    return { data: null, error: { message: 'ไฟล์ใหญ่เกินไป (สูงสุด 1MB)' } }
  }
  
  // ตรวจสอบประเภทไฟล์
  if (!file.type.startsWith('image/')) {
    return { data: null, error: { message: 'กรุณาเลือกไฟล์รูปภาพ' } }
  }

  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `avatars/${fileName}`

  // อัพโหลดไฟล์
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true })

  if (uploadError) return { data: null, error: uploadError }

  // ดึง public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  // อัพเดท user
  const { error: updateError } = await supabase
    .from('users')
    .update({ avatar_url: publicUrl })
    .eq('id', userId)

  if (updateError) return { data: null, error: updateError }

  return { data: { url: publicUrl }, error: null }
}

// ===== COMMENTS =====
export async function getComments(pollId, sortBy = 'newest') {
  // Fetch comments
  const { data: commentsData, error } = await supabase
    .from('comments')
    .select('id, content, created_at, user_id, parent_id, likes_count')
    .eq('poll_id', pollId)
    .order(sortBy === 'popular' ? 'likes_count' : 'created_at', { ascending: sortBy === 'oldest' })
  
  if (error || !commentsData) return { data: [], error }
  
  // Fetch users
  const userIds = [...new Set(commentsData.map(c => c.user_id))]
  const { data: usersData } = await supabase
    .from('users')
    .select('id, username, avatar_url, is_verified, reputation, selected_skin')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
  
  // Map users
  const usersMap = {}
  usersData?.forEach(u => { usersMap[u.id] = u })
  
  // Build nested comments structure
  const commentsWithUsers = commentsData.map(c => ({
    ...c,
    users: usersMap[c.user_id] || null,
    replies: []
  }))
  
  // Organize into parent-child structure
  const commentMap = {}
  const rootComments = []
  
  commentsWithUsers.forEach(c => { commentMap[c.id] = c })
  commentsWithUsers.forEach(c => {
    if (c.parent_id && commentMap[c.parent_id]) {
      commentMap[c.parent_id].replies.push(c)
    } else if (!c.parent_id) {
      rootComments.push(c)
    }
  })
  
  return { data: rootComments, error: null }
}

export async function createComment(userId, pollId, content, parentId = null) {
  // Insert comment
  const insertData = { user_id: userId, poll_id: pollId, content, likes_count: 0 }
  if (parentId) insertData.parent_id = parentId
  
  const { data: insertedData, error: insertError } = await supabase
    .from('comments')
    .insert([insertData])
    .select('id, content, created_at, user_id, parent_id, likes_count')
    .single()
  
  if (insertError) return { data: null, error: insertError }
  
  // Fetch user data
  const { data: userData } = await supabase
    .from('users')
    .select('id, username, avatar_url, is_verified, reputation, selected_skin')
    .eq('id', userId)
    .single()
  
  // ตรวจจับ @mentions และสร้าง notifications
  const mentions = content.match(/@(\w+)/g)
  if (mentions) {
    const usernames = mentions.map(m => m.substring(1))
    const { data: mentionedUsers } = await supabase
      .from('users')
      .select('id, username')
      .in('username', usernames)
    
    // สร้าง notification สำหรับแต่ละคนที่ถูก mention
    if (mentionedUsers) {
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser.id !== userId) { // ไม่ notify ตัวเอง
          await supabase.from('notifications').insert([{
            user_id: mentionedUser.id,
            type: 'mention',
            title: 'มีคนแท็กคุณ',
            message: `${userData?.username || 'Someone'} แท็กคุณในความคิดเห็น`,
            data: { poll_id: pollId, comment_id: insertedData.id }
          }])
        }
      }
    }
  }
  
  return { 
    data: {
      ...insertedData,
      users: userData,
      replies: []
    }, 
    error: null 
  }
}

export async function deleteComment(commentId, userId) {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId)
  
  return { error }
}

export async function likeComment(commentId, userId) {
  // Check if already liked
  const { data: existing } = await supabase
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', userId)
    .single()
  
  if (existing) {
    return { data: null, error: null, alreadyLiked: true }
  }
  
  // Insert like
  const { error: likeError } = await supabase
    .from('comment_likes')
    .insert([{ comment_id: commentId, user_id: userId }])
  
  if (likeError) return { data: null, error: likeError }
  
  // Update likes_count
  await supabase.rpc('increment_comment_likes', { comment_uuid: commentId })
  
  return { data: { liked: true }, error: null }
}

export async function unlikeComment(commentId, userId) {
  const { error: deleteError } = await supabase
    .from('comment_likes')
    .delete()
    .eq('comment_id', commentId)
    .eq('user_id', userId)
  
  if (deleteError) return { error: deleteError }
  
  // Update likes_count
  await supabase.rpc('decrement_comment_likes', { comment_uuid: commentId })
  
  return { error: null }
}

export async function getCommentLikeStatus(commentIds, userId) {
  if (!commentIds.length || !userId) return {}
  
  const { data } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .in('comment_id', commentIds)
    .eq('user_id', userId)
  
  const likedMap = {}
  data?.forEach(d => { likedMap[d.comment_id] = true })
  return likedMap
}

// ===== GET POLLS BY CREATOR =====
export async function getPollsByCreator(userId) {
  const { data: pollsData, error } = await supabase
    .from('polls')
    .select('id, question, category, ends_at, resolved, featured, created_at')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
  
  if (error || !pollsData) return { data: [], error }
  
  // Fetch options แยก
  const pollIds = pollsData.map(p => p.id)
  const { data: optionsData } = await supabase
    .from('poll_options')
    .select('*')
    .in('poll_id', pollIds.length > 0 ? pollIds : ['00000000-0000-0000-0000-000000000000'])
  
  const optionsMap = {}
  optionsData?.forEach(opt => {
    if (!optionsMap[opt.poll_id]) optionsMap[opt.poll_id] = []
    optionsMap[opt.poll_id].push(opt)
  })
  
  const pollsWithOptions = pollsData.map(poll => ({
    ...poll,
    options: optionsMap[poll.id] || []
  }))
  
  return { data: pollsWithOptions, error: null }
}
