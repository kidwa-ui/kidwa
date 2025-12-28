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
    .select('id, username, reputation, email_verified, is_verified')
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
    .select('user_id, points_earned, users!inner(id, username, reputation, email_verified, is_verified)')
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
    .select('user_id, points_earned, users!inner(id, username, reputation, email_verified, is_verified)')
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
  const { data, error } = await supabase.from('polls').select('*, options(*), tags(*)').order('created_at', { ascending: false })
  return { data, error }
}

export async function getPendingPolls() {
  const { data, error } = await supabase.from('polls').select('*, options(*), tags(*)').eq('resolved', false).order('ends_at', { ascending: true })
  return { data, error }
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

        // สร้าง Notification สำหรับผู้โหวต
        const notifMessage = isCorrect 
          ? `🎉 ทายถูก! "${pollData?.question?.substring(0, 50)}..." คำตอบคือ "${correctOption?.text}" (+${vote.confidence} pt)`
          : `😢 ทายผิด "${pollData?.question?.substring(0, 50)}..." คำตอบคือ "${correctOption?.text}" (${change} pt)`
        
        await createNotification({
          userId: vote.user_id,
          type: isCorrect ? 'points_earned' : 'points_lost',
          message: notifMessage,
          pollId: pollId,
          pointsChange: change
        })
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
    .select('id, username, reputation, avatar_url, current_streak, max_streak, total_predictions, correct_predictions, created_at')
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
    // ใช้ timestamp แบบ milliseconds เพื่อความแม่นยำ
    const nowMs = Date.now()
    const endsAtMs = nowMs + (durationMinutes * 60 * 1000)
    
    // แปลงเป็น ISO string (จะเป็น UTC โดยอัตโนมัติ)
    const nowISO = new Date(nowMs).toISOString()
    const endsAtISO = new Date(endsAtMs).toISOString()
    
    console.log('Creating Live Battle:', {
      durationMinutes,
      nowISO,
      endsAtISO,
      diffMinutes: (endsAtMs - nowMs) / 60000
    })
    
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ 
        question, 
        category,
        blind_mode: false,
        poll_type: 'live_battle',
        ends_at: endsAtISO,
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
  const now = new Date().toISOString()
  
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*), users:created_by(username, avatar_url)')
    .eq('poll_type', 'live_battle')
    .eq('is_live', true)
    .gt('ends_at', now) // ยังไม่หมดเวลา
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

// Subscribe to live battle updates (real-time)
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
    .select('is_verified')
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

// ===== Similar Poll Detection =====

export async function findSimilarPolls(question, limit = 5) {
  // ทำให้เป็น lowercase และ trim
  const searchQuery = question.toLowerCase().trim()
  
  // แยกคำสำคัญ (ตัดคำที่สั้นเกินไป)
  const keywords = searchQuery
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 5) // ใช้แค่ 5 คำแรก

  if (keywords.length === 0) {
    return { data: [], error: null }
  }

  // สร้าง search pattern สำหรับ ilike
  // ค้นหาโพลที่มีคำคล้ายกัน
  const { data: polls, error } = await supabase
    .from('polls')
    .select('id, question, ends_at, resolved, options(votes)')
    .or(keywords.map(k => `question.ilike.%${k}%`).join(','))
    .eq('resolved', false)
    .gt('ends_at', new Date().toISOString()) // ยังไม่หมดอายุ
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error }

  // คำนวณ similarity score
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
  }).filter(p => p.similarity >= 0.4) // แสดงเฉพาะที่คล้ายกัน 40% ขึ้นไป
    .sort((a, b) => b.similarity - a.similarity)

  return { data: scoredPolls || [], error: null }
}

// ===== Creator Engagement Points =====

export async function checkAndAwardCreatorPoints(pollId) {
  // ดึงข้อมูล poll
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
    .select('id, max_votes_reached, options(votes)')
    .eq('created_by', userId)
  
  let maxPollVotes = 0
  if (polls) {
    for (const poll of polls) {
      const totalVotes = poll.options?.reduce((sum, o) => sum + (o.votes || 0), 0) || 0
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
