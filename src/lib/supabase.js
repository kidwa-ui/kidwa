import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } }
})

// ===== TIMEZONE HELPERS =====
// Database stores UTC. User sees Bangkok time (UTC+7)
const BANGKOK_OFFSET_HOURS = 7

// Convert Bangkok datetime string to UTC for database storage
const bangkokToUTC = (dateStr, timeStr) => {
  // User inputs Bangkok time, we subtract 7 hours to get UTC
  const bangkokDateTime = new Date(`${dateStr}T${timeStr}:00`)
  const utcDateTime = new Date(bangkokDateTime.getTime() - (BANGKOK_OFFSET_HOURS * 60 * 60 * 1000))
  return utcDateTime.toISOString()
}

// Get current time in Bangkok
const getBangkokNow = () => {
  return new Date(Date.now() + (BANGKOK_OFFSET_HOURS * 60 * 60 * 1000))
}

// Get start of today in Bangkok (for daily limits)
const getBangkokTodayStart = () => {
  const now = getBangkokNow()
  now.setUTCHours(0, 0, 0, 0)
  // Convert back to UTC for database query
  return new Date(now.getTime() - (BANGKOK_OFFSET_HOURS * 60 * 60 * 1000)).toISOString()
}

// Get start of this week (Monday) in Bangkok
const getBangkokWeekStart = () => {
  const now = getBangkokNow()
  const dayOfWeek = now.getUTCDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + mondayOffset)
  monday.setUTCHours(0, 0, 0, 0)
  return new Date(monday.getTime() - (BANGKOK_OFFSET_HOURS * 60 * 60 * 1000)).toISOString()
}

// Get start of this month in Bangkok
const getBangkokMonthStart = () => {
  const now = getBangkokNow()
  const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  return new Date(firstDay.getTime() - (BANGKOK_OFFSET_HOURS * 60 * 60 * 1000)).toISOString()
}

// ===== AUTH FUNCTIONS =====

export async function signUpWithEmail(email, password, username) {
  const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).single()
  if (existingUser) return { data: null, error: { message: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' } }
  
  const { data: existingEmail } = await supabase.from('users').select('id').eq('email', email).single()
  if (existingEmail) return { data: null, error: { message: 'อีเมลนี้ถูกใช้แล้ว' } }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email, password, options: { data: { username } }
  })
  if (authError) return { data: null, error: authError }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .insert([{ username, email, auth_id: authData.user?.id, email_verified: false, reputation: 1000 }])
    .select().single()
  if (userError) return { data: null, error: userError }

  return { data: { auth: authData, user: userData }, error: null }
}

export async function signInWithEmail(email, password) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) return { data: null, error: authError }

  const { data: userData, error: userError } = await supabase
    .from('users').select('*').eq('auth_id', authData.user?.id).single()
  if (userError || !userData) return { data: null, error: { message: 'ไม่พบข้อมูลผู้ใช้' } }

  return { data: { auth: authData, user: userData }, error: null }
}

export async function signInWithMagicLink(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
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
    .from('users').select('*').eq('auth_id', session.user.id).single()

  if (userData && session.user.email_confirmed_at && !userData.email_verified) {
    await supabase.from('users').update({ email_verified: true }).eq('id', userData.id)
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
  const { data, error } = await supabase.auth.updateUser({ password: newPassword })
  return { data, error }
}

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback)
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  })
  return { data, error }
}

// ===== USER FUNCTIONS =====

export async function getUserByUsername(username) {
  const { data, error } = await supabase.from('users').select('*').eq('username', username).single()
  return { data, error }
}

export async function createUser(username) {
  const { data, error } = await supabase
    .from('users')
    .insert([{ username, reputation: 1000, streak: 0, current_streak: 0, max_streak: 0, total_predictions: 0, correct_predictions: 0 }])
    .select().single()
  return { data, error }
}

export async function getUserProfile(userId) {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()
  return { data, error }
}

export async function getUserPublicProfile(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('id, username, reputation, avatar_url, current_streak, max_streak, total_predictions, correct_predictions, created_at, is_verified')
    .eq('id', userId).single()
  if (error) return { data: null, error }
  const { followers, following } = await getFollowCounts(userId)
  return { data: { ...user, followers, following }, error: null }
}

export async function searchUsers(query, limit = 10) {
  const { data, error } = await supabase
    .from('users').select('id, username, reputation, avatar_url')
    .ilike('username', `%${query}%`)
    .order('reputation', { ascending: false }).limit(limit)
  return { data, error }
}

// ===== POLL FUNCTIONS =====

export async function getPolls() {
  const { data: polls, error } = await supabase
    .from('polls')
    .select('*, options(*)')
    .order('created_at', { ascending: false })
    .limit(50)
  
  if (error || !polls) return { data: polls, error }
  
  // Fetch tags for all polls via poll_tags junction table
  const pollIds = polls.map(p => p.id)
  const { data: pollTags } = await supabase
    .from('poll_tags')
    .select('poll_id, tags(id, name)')
    .in('poll_id', pollIds)
  
  // Map tags to polls
  const pollTagsMap = {}
  pollTags?.forEach(pt => {
    if (!pollTagsMap[pt.poll_id]) pollTagsMap[pt.poll_id] = []
    if (pt.tags) pollTagsMap[pt.poll_id].push(pt.tags)
  })
  
  const pollsWithTags = polls.map(poll => ({
    ...poll,
    tags: pollTagsMap[poll.id] || []
  }))
  
  return { data: pollsWithTags, error: null }
}

export async function vote(userId, pollId, optionId, confidence = 50) {
  // Server-side validation: Check poll validity
  const { data: poll } = await supabase
    .from('polls')
    .select('ends_at, resolved, blind_mode')
    .eq('id', pollId)
    .single()
  
  if (!poll) return { data: null, error: { message: 'ไม่พบโพลนี้' } }
  if (new Date() > new Date(poll.ends_at)) return { data: null, error: { message: 'โพลนี้หมดเวลาแล้ว' } }
  if (poll.resolved) return { data: null, error: { message: 'โพลนี้ถูกเฉลยแล้ว' } }

  const { data: existingVote } = await supabase
    .from('votes').select('*').eq('user_id', userId).eq('poll_id', pollId).single()

  if (existingVote) {
    // Update existing vote - DB trigger handles count adjustment
    const { data, error } = await supabase
      .from('votes').update({ option_id: optionId, confidence, updated_at: new Date().toISOString() }).eq('id', existingVote.id).select().single()
    return { data, error, isUpdate: true, oldOptionId: existingVote.option_id }
  } else {
    // Insert new vote - DB trigger handles count increment
    const { data, error } = await supabase
      .from('votes').insert([{ user_id: userId, poll_id: pollId, option_id: optionId, confidence }]).select().single()
    return { data, error, isUpdate: false }
  }
}

export async function getUserVotes(userId) {
  const { data, error } = await supabase.from('votes').select('*').eq('user_id', userId)
  return { data, error }
}

export async function getUserVoteHistory(userId, limit = 20) {
  const { data, error } = await supabase
    .from('votes')
    .select(`*, polls:poll_id (id, question, category, resolved, correct_option_id, ends_at), options:option_id (id, text)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(limit)
  return { data, error }
}

export async function getUserCreatedPolls(userId, limit = 20) {
  const { data, error } = await supabase
    .from('polls').select('*, options(*)').eq('created_by', userId)
    .order('created_at', { ascending: false }).limit(limit)
  return { data, error }
}

// ===== TAGS =====

export async function getTags() {
  const { data, error } = await supabase.from('tags').select('*').order('name', { ascending: true })
  return { data, error }
}

export async function createTag(name) {
  const { data: existing } = await supabase.from('tags').select('*').eq('name', name.toLowerCase().trim()).single()
  if (existing) return { data: existing, error: null }
  const { data, error } = await supabase.from('tags').insert([{ name: name.toLowerCase().trim() }]).select().single()
  return { data, error }
}

export async function getTrendingTags(limit = 10, daysWindow = 7) {
  try {
    // Calculate time window start
    const windowStart = new Date()
    windowStart.setDate(windowStart.getDate() - daysWindow)
    
    // Step 1: Get active polls within time window
    const { data: polls, error: pollError } = await supabase
      .from('polls')
      .select('id')
      .gte('created_at', windowStart.toISOString())
      .eq('status', 'active')
    
    if (pollError || !polls?.length) return { data: [], error: pollError }
    
    const pollIds = polls.map(p => p.id)
    
    // Step 2: Get vote counts per poll
    const { data: votes, error: voteError } = await supabase
      .from('votes')
      .select('poll_id')
      .in('poll_id', pollIds)
    
    if (voteError) return { data: [], error: voteError }
    
    // Count votes per poll
    const pollVoteCounts = {}
    votes?.forEach(v => {
      pollVoteCounts[v.poll_id] = (pollVoteCounts[v.poll_id] || 0) + 1
    })
    
    // Step 3: Get tags for these polls
    const { data: pollTags, error: tagError } = await supabase
      .from('poll_tags')
      .select('poll_id, tags(id, name)')
      .in('poll_id', pollIds)
    
    if (tagError) return { data: [], error: tagError }
    
    // Step 4: Aggregate vote counts per tag
    const tagVotes = {}
    pollTags?.forEach(pt => {
      if (pt.tags) {
        const tagId = pt.tags.id
        const voteCount = pollVoteCounts[pt.poll_id] || 0
        
        if (!tagVotes[tagId]) {
          tagVotes[tagId] = { 
            id: tagId, 
            name: pt.tags.name, 
            vote_count: 0,  // จำนวนคนโหวต
            poll_count: 0   // จำนวนโพล
          }
        }
        tagVotes[tagId].vote_count += voteCount
        tagVotes[tagId].poll_count++
      }
    })
    
    // Step 5: Sort by vote count and return top N
    const sorted = Object.values(tagVotes)
      .filter(t => t.vote_count > 0)  // เฉพาะ tags ที่มีคนโหวต
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, limit)
    
    return { data: sorted, error: null }
  } catch (err) {
    console.error('[Trending Tags] Error:', err)
    return { data: [], error: err }
  }
}

export async function getPollsByTag(tagName, limit = 20) {
  const { data: tag } = await supabase.from('tags').select('id').eq('name', tagName.toLowerCase()).single()
  if (!tag) return { data: [], error: null }
  
  const { data: pollTagsData } = await supabase.from('poll_tags').select('poll_id').eq('tag_id', tag.id)
  if (!pollTagsData || pollTagsData.length === 0) return { data: [], error: null }
  
  const pollIds = pollTagsData.map(pt => pt.poll_id)
  const { data: polls, error } = await supabase
    .from('polls')
    .select('*, options(*)')
    .in('id', pollIds)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error || !polls) return { data: polls, error }
  
  // Fetch tags for these polls
  const { data: allPollTags } = await supabase
    .from('poll_tags')
    .select('poll_id, tags(id, name)')
    .in('poll_id', pollIds)
  
  const pollTagsMap = {}
  allPollTags?.forEach(pt => {
    if (!pollTagsMap[pt.poll_id]) pollTagsMap[pt.poll_id] = []
    if (pt.tags) pollTagsMap[pt.poll_id].push(pt.tags)
  })
  
  const pollsWithTags = polls.map(poll => ({
    ...poll,
    tags: pollTagsMap[poll.id] || []
  }))
  
  return { data: pollsWithTags, error: null }
}

// ===== CREATE POLL (VERIFIED USERS ONLY - 3/day) =====

export async function createPoll({ question, options, category, tags, blindMode, endsAt, pollType, createdBy }) {
  try {
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ 
        question, category, blind_mode: blindMode, poll_type: pollType || 'prediction', 
        ends_at: endsAt, created_by: createdBy, featured: false, resolved: false 
      }])
      .select().single()
    
    if (pollError) throw pollError

const optionsData = options.map(opt => ({   poll_id: poll.id,   text: opt,   votes: 0,  is_system: false,  option_key: null}))

// Auto-add "อื่นๆ" for Opinion polls (ถ้ายังไม่มี)
    if (pollType === 'opinion') {  const hasOthers = options.some(opt =>     opt.toLowerCase().includes('อื่นๆ') ||     opt.toLowerCase().includes('อื่น ๆ') ||    opt.toLowerCase() === 'other' ||
    opt.toLowerCase() === 'others'  )
    if (!hasOthers) {    optionsData.push({      poll_id: poll.id,      text: 'อื่นๆ',      votes: 0,      is_system: true,      option_key: 'others'    })  }}
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

// Poll limit: Verified users only, 3 polls/day
export async function getUserPollLimit(userId) {
  const { data: user } = await supabase.from('users').select('full_name, birth_date, is_admin').eq('id', userId).single()
  
  // Admin has unlimited
  if (user?.is_admin) {
    return { canCreate: true, used: 0, limit: 999, remaining: 999, hasCompletedProfile: true }
  }
  
  // Must complete profile (fullName + birthDate) to create polls
  const hasCompletedProfile = !!(user?.full_name && user?.birth_date)
  if (!hasCompletedProfile) {
    return { canCreate: false, used: 0, limit: 0, remaining: 0, hasCompletedProfile: false }
  }
  
  // Users with completed profile get 3 polls/day
  const dailyLimit = 3
  const todayStart = getBangkokTodayStart()
  
  const { count } = await supabase
    .from('polls')
    .select('*', { count: 'exact', head: true })
    .eq('created_by', userId)
    .gte('created_at', todayStart)
  
  const used = count || 0
  const remaining = Math.max(0, dailyLimit - used)
  
  return { canCreate: remaining > 0, used, limit: dailyLimit, remaining, hasCompletedProfile: true }
}

const SIMILARITY_STOP_WORDS = [
  // คำขึ้นต้นทั่วไป
  'คิดว่า',
  'คิดว่าในอนาคต',
  'คิดว่าจะ',
  'ใครคิดว่า',
  'คุณคิดว่า',
  
  // คำเกี่ยวกับเวลา
  'ภายในปี',
  'ภายในครึ่งปี',
  'ภายในเดือน',
  'ภายในสัปดาห์',
  'ภายใน',
  'ปีนี้',
  'ปีหน้า',
  'เดือนนี้',
  'เดือนหน้า',
  'สัปดาห์นี้',
  'สัปดาห์หน้า',
  'วันนี้',
  'พรุ่งนี้',
  'ก่อน',
  'หลัง',
  
  // ปี พ.ศ. / ค.ศ.
  '2567', '2568', '2569', '2570', '2571',
  '2024', '2025', '2026', '2027', '2028',
  
  // คำถามทั่วไป
  'ใครจะ',
  'อะไรจะ',
  'ที่ไหน',
  'เมื่อไหร่',
  'อย่างไร',
  'จะเป็น',
  'จะมี',
  'จะได้',
  'จะเกิด',
  'หรือไม่',
  'ไหม',
  'มั้ย',
  'ครับ',
  'ค่ะ',
  'นะ',
  
  // คำเชื่อม
  'และ',
  'หรือ',
  'แต่',
  'ที่',
  'ของ',
  'ใน',
  'ให้',
  'ได้',
  'มา',
  'ไป',
  'กับ',
]

// Function ลบ stop words ออกจากคำถาม
function removeStopWords(text) {
  let cleaned = text.toLowerCase().trim()
  
  // ลบ ".." ออก
  cleaned = cleaned.replace(/\.{2,}/g, ' ')
  
  // ลบ stop words
  SIMILARITY_STOP_WORDS.forEach(word => {
    const regex = new RegExp(word, 'gi')
    cleaned = cleaned.replace(regex, ' ')
  })
  
  // ลบ whitespace ซ้ำ และ trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}

// แทนที่ function findSimilarPolls เดิม (บรรทัด 410-436) ด้วย:

export async function findSimilarPolls(question, limit = 5) {
  // ลบ stop words ก่อนค้นหา
  const cleanedQuestion = removeStopWords(question)
  
  // แยกเป็น keywords (เฉพาะคำที่ยาวกว่า 2 ตัวอักษร)
  const keywords = cleanedQuestion
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 5)
  
  // ถ้าไม่มี keywords ที่มีความหมาย ไม่ต้องหา similar
  if (keywords.length === 0) {
    return { data: [], error: null }
  }
  
  // ค้นหาโพลที่ยังไม่ resolve
  const { data: polls, error } = await supabase
    .from('polls')
    .select('id, question, ends_at, resolved, category, options(votes)')
    .or(keywords.map(k => `question.ilike.%${k}%`).join(','))
    .eq('resolved', false)
    .gt('ends_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20) // ดึงมากขึ้นเพื่อ filter ทีหลัง

  if (error) return { data: [], error }

  // คำนวณ similarity โดยใช้ cleaned question
  const scoredPolls = polls?.map(poll => {
    // ลบ stop words จากโพลที่มีอยู่ด้วย
    const cleanedPollQuestion = removeStopWords(poll.question)
    const pollWords = cleanedPollQuestion.split(/\s+/).filter(w => w.length > 2)
    
    // นับคำที่ตรงกัน
    let matchCount = 0
    keywords.forEach(keyword => {
      if (pollWords.some(pw => pw.includes(keyword) || keyword.includes(pw))) {
        matchCount++
      }
    })
    
    const similarity = keywords.length > 0 ? matchCount / keywords.length : 0
    const totalVotes = poll.options?.reduce((sum, o) => sum + o.votes, 0) || 0
    
    return { ...poll, similarity, totalVotes }
  })
  .filter(p => p.similarity >= 0.5) // ใช้ threshold สูงขึ้น (0.5 แทน 0.4)
  .sort((a, b) => b.similarity - a.similarity)
  .slice(0, limit)

  return { data: scoredPolls || [], error: null }
}

// ===== LIVE BATTLE (with +7h timezone fix) =====

export async function createLiveBattleV2({ question, options, category, tags, endDate, endTime, createdBy }) {
  try {
    // User inputs Bangkok time - add 7 hours to compensate for server UTC storage
    // This is a direct fix: if user wants 20:00 Bangkok, we store 20:00 + 7 = 03:00 next day UTC
    // So when displayed, it shows correctly as Bangkok time
    const bangkokDateTime = new Date(`${endDate}T${endTime}:00`)
    const adjustedEndsAt = new Date(bangkokDateTime.getTime() + (BANGKOK_OFFSET_HOURS * 60 * 60 * 1000))
    
    const now = new Date()
    
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ 
        question, category, blind_mode: false, poll_type: 'live_battle',
        ends_at: adjustedEndsAt.toISOString(),
        created_by: createdBy, featured: false, resolved: false,
        is_live: true, live_started_at: now.toISOString()
      }])
      .select().single()
    
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
  const { data: polls, error } = await supabase
    .from('polls')
    .select('*, options(*), users:created_by(username, avatar_url)')
    .eq('poll_type', 'live_battle')
    .eq('is_live', true)
    .gt('ends_at', now)
    .order('created_at', { ascending: false })
  
  if (error || !polls || polls.length === 0) return { data: polls || [], error }
  
  // Fetch tags for live battles
  const pollIds = polls.map(p => p.id)
  const { data: pollTags } = await supabase
    .from('poll_tags')
    .select('poll_id, tags(id, name)')
    .in('poll_id', pollIds)
  
  const pollTagsMap = {}
  pollTags?.forEach(pt => {
    if (!pollTagsMap[pt.poll_id]) pollTagsMap[pt.poll_id] = []
    if (pt.tags) pollTagsMap[pt.poll_id].push(pt.tags)
  })
  
  const pollsWithTags = polls.map(poll => ({
    ...poll,
    tags: pollTagsMap[poll.id] || []
  }))
  
  return { data: pollsWithTags, error: null }
}

export async function endLiveBattle(pollId) {
  const { error } = await supabase.from('polls').update({ is_live: false }).eq('id', pollId)
  return { error }
}

// ===== TIME CAPSULE =====

export async function createTimeCapsule({ question, options, tags, endsAt, createdBy }) {
  try {
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ 
        question, category: 'time_capsule', blind_mode: true, poll_type: 'time_capsule',
        ends_at: endsAt, created_by: createdBy, featured: true, resolved: false 
      }])
      .select().single()
    
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
  const { data: polls, error } = await supabase
    .from('polls')
    .select('*, options(*)')
    .eq('poll_type', 'time_capsule')
    .order('ends_at', { ascending: true })
    .limit(limit)
  
  if (error || !polls || polls.length === 0) return { data: polls || [], error }
  
  // Fetch tags for time capsules
  const pollIds = polls.map(p => p.id)
  const { data: pollTags } = await supabase
    .from('poll_tags')
    .select('poll_id, tags(id, name)')
    .in('poll_id', pollIds)
  
  const pollTagsMap = {}
  pollTags?.forEach(pt => {
    if (!pollTagsMap[pt.poll_id]) pollTagsMap[pt.poll_id] = []
    if (pt.tags) pollTagsMap[pt.poll_id].push(pt.tags)
  })
  
  const pollsWithTags = polls.map(poll => ({
    ...poll,
    tags: pollTagsMap[poll.id] || []
  }))
  
  return { data: pollsWithTags, error: null }
}

// ===== LEADERBOARD =====

export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, reputation, email_verified, is_verified, avatar_url, correct_predictions, total_predictions')
    .eq('is_admin', false)  // Exclude admins from public leaderboard
    .order('reputation', { ascending: false })
    .limit(limit)
  return { data, error }
}

export async function getWeeklyLeaderboard(limit = 10) {
  const weekStart = getBangkokWeekStart()
  
  const { data: votes, error } = await supabase
    .from('votes')
    .select('user_id, points_earned, users!inner(id, username, reputation, email_verified, is_verified, avatar_url, correct_predictions, total_predictions, is_admin)')
    .gte('created_at', weekStart)
    .not('points_earned', 'is', null)

  if (error) return { data: null, error }

  const userPoints = {}
  votes?.forEach(vote => {
    // Exclude admins from leaderboard
    if (vote.users.is_admin) return
    
    const userId = vote.user_id
    if (!userPoints[userId]) {
      userPoints[userId] = {
        id: userId, username: vote.users.username, reputation: vote.users.reputation,
        email_verified: vote.users.email_verified, is_verified: vote.users.is_verified,
        avatar_url: vote.users.avatar_url, correct_predictions: vote.users.correct_predictions,
        total_predictions: vote.users.total_predictions, weeklyPoints: 0
      }
    }
    userPoints[userId].weeklyPoints += vote.points_earned || 0
  })

  const sorted = Object.values(userPoints).sort((a, b) => b.weeklyPoints - a.weeklyPoints).slice(0, limit)
  return { data: sorted, error: null }
}

export async function getMonthlyLeaderboard(limit = 10) {
  const monthStart = getBangkokMonthStart()
  
  const { data: votes, error } = await supabase
    .from('votes')
    .select('user_id, points_earned, users!inner(id, username, reputation, email_verified, is_verified, avatar_url, correct_predictions, total_predictions, is_admin)')
    .gte('created_at', monthStart)
    .not('points_earned', 'is', null)

  if (error) return { data: null, error }

  const userPoints = {}
  votes?.forEach(vote => {
    // Exclude admins from leaderboard
    if (vote.users.is_admin) return
    
    const userId = vote.user_id
    if (!userPoints[userId]) {
      userPoints[userId] = {
        id: userId, username: vote.users.username, reputation: vote.users.reputation,
        email_verified: vote.users.email_verified, is_verified: vote.users.is_verified,
        avatar_url: vote.users.avatar_url, correct_predictions: vote.users.correct_predictions,
        total_predictions: vote.users.total_predictions, monthlyPoints: 0
      }
    }
    userPoints[userId].monthlyPoints += vote.points_earned || 0
  })

  const sorted = Object.values(userPoints).sort((a, b) => b.monthlyPoints - a.monthlyPoints).slice(0, limit)
  return { data: sorted, error: null }
}

// ===== ADMIN FUNCTIONS =====

// Log admin actions for audit trail
export async function logAdminAction(adminId, actionType, targetType, targetId, details = {}) {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        admin_id: adminId,
        action_type: actionType,
        target_type: targetType,
        target_id: targetId,
        details: details
      }])
    if (error) console.error('Failed to log admin action:', error)
    return { error }
  } catch (e) {
    console.error('Audit log error:', e)
    return { error: e }
  }
}

// Get admin audit logs
export async function getAdminAuditLogs(limit = 50) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*, users:admin_id(username)')
    .order('created_at', { ascending: false })
    .limit(limit)
  return { data, error }
}

export async function getAllPollsAdmin() {
  const { data, error } = await supabase.from('polls').select('*, options(*), tags(*)').order('created_at', { ascending: false })
  return { data, error }
}

export async function getPendingPolls() {
  const { data, error } = await supabase.from('polls').select('*, options(*), tags(*)').eq('resolved', false).order('ends_at', { ascending: true })
  return { data, error }
}

// Admin-only: View detailed vote data for moderation/debugging
export async function getVoteDetails(pollId, adminUserId) {
  // Verify caller is admin
  const { data: admin } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', adminUserId)
    .single()
  
  if (!admin?.is_admin) {
    return { data: null, error: { message: 'Unauthorized: Admin access required' } }
  }
  
  // Fetch detailed vote data
  const { data, error } = await supabase
    .from('votes')
    .select(`
      id, confidence, created_at, updated_at, is_correct, points_earned,
      users:user_id (id, username, is_verified, reputation),
      options:option_id (id, text)
    `)
    .eq('poll_id', pollId)
    .order('created_at', { ascending: false })
  
  return { data, error }
}

// Admin-only: Get vote statistics summary for a poll
export async function getVoteStatistics(pollId, adminUserId) {
  // Verify caller is admin
  const { data: admin } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', adminUserId)
    .single()
  
  if (!admin?.is_admin) {
    return { data: null, error: { message: 'Unauthorized: Admin access required' } }
  }
  
  const { data: votes, error } = await supabase
    .from('votes')
    .select('option_id, confidence, created_at')
    .eq('poll_id', pollId)
  
  if (error) return { data: null, error }
  
  // Calculate statistics
  const stats = {
    totalVotes: votes?.length || 0,
    avgConfidence: 0,
    confidenceDistribution: { low: 0, medium: 0, high: 0 },
    voteTimeline: [],
    optionBreakdown: {}
  }
  
  if (votes && votes.length > 0) {
    let totalConf = 0
    votes.forEach(v => {
      totalConf += v.confidence
      if (v.confidence <= 33) stats.confidenceDistribution.low++
      else if (v.confidence <= 66) stats.confidenceDistribution.medium++
      else stats.confidenceDistribution.high++
      
      if (!stats.optionBreakdown[v.option_id]) {
        stats.optionBreakdown[v.option_id] = { count: 0, avgConfidence: 0, totalConf: 0 }
      }
      stats.optionBreakdown[v.option_id].count++
      stats.optionBreakdown[v.option_id].totalConf += v.confidence
    })
    stats.avgConfidence = Math.round(totalConf / votes.length)
    
    // Calculate avg confidence per option
    Object.keys(stats.optionBreakdown).forEach(optId => {
      const opt = stats.optionBreakdown[optId]
      opt.avgConfidence = Math.round(opt.totalConf / opt.count)
      delete opt.totalConf
    })
  }
  
  return { data: stats, error: null }
}

// Reputation formula constants
const REPUTATION_CONFIG = {
  penalty_multiplier: 1.15,
  conviction: { 20: 0.8, 50: 1.0, 100: 1.3 }
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
  
  if (isCorrect) return Math.round(S * C * E)
  return -Math.round(S * C * REPUTATION_CONFIG.penalty_multiplier)
}

export async function resolvePoll(pollId, correctOptionId, adminId = null) {
  try {
    const { data: pollData } = await supabase.from('polls').select('question, poll_type').eq('id', pollId).single()
    const isPrediction = pollData?.poll_type === 'prediction'

    const { error: pollError } = await supabase
      .from('polls')
      .update({ resolved: true, correct_option_id: correctOptionId, resolved_at: new Date().toISOString() })
      .eq('id', pollId)
    if (pollError) throw pollError

    // Log admin action
    if (adminId) {
      await logAdminAction(adminId, 'resolve_poll', 'poll', pollId, {
        correct_option_id: correctOptionId,
        question: pollData?.question?.substring(0, 100)
      })
    }

    const { data: correctOption } = await supabase.from('options').select('text').eq('id', correctOptionId).single()
    const { data: votes } = await supabase.from('votes').select('id, user_id, option_id, confidence').eq('poll_id', pollId)

    for (const vote of votes || []) {
      const isCorrect = vote.option_id === correctOptionId
      
      const { data: userData } = await supabase
        .from('users')
        .select('reputation, current_streak, max_streak, total_predictions, correct_predictions, is_admin')
        .eq('id', vote.user_id).single()
      
      if (userData) {
        const isAdmin = userData.is_admin === true
        let repChange = 0
        if (isPrediction && !isAdmin) {
          const stake = vote.confidence || 50
          repChange = calculateReputationChange(stake, vote.confidence, isCorrect, userData.total_predictions || 0)
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
            ? `🎯 โหวตนี้ถูกต้อง "${pollData?.question?.substring(0, 40)}..." (+${repChange} Reputation)`
            : `❌ โหวตนี้คลาด "${pollData?.question?.substring(0, 40)}..." (${repChange} Reputation)`
        } else {
          notifMessage = `📊 โพลสิ้นสุด "${pollData?.question?.substring(0, 40)}..." ตัวเลือกที่ถูกต้องคือ "${correctOption?.text}"`
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

export async function deletePoll(pollId, adminId = null) {
  try {
    // Get poll info before deletion for logging
    const { data: pollData } = await supabase.from('polls').select('question').eq('id', pollId).single()
    
    await supabase.from('votes').delete().eq('poll_id', pollId)
    await supabase.from('poll_tags').delete().eq('poll_id', pollId)
    await supabase.from('options').delete().eq('poll_id', pollId)
    await supabase.from('notifications').delete().eq('poll_id', pollId)
    const { error } = await supabase.from('polls').delete().eq('id', pollId)
    
    // Log admin action
    if (adminId) {
      await logAdminAction(adminId, 'delete_poll', 'poll', pollId, {
        question: pollData?.question?.substring(0, 100)
      })
    }
    
    return { error }
  } catch (error) {
    return { error }
  }
}

export async function getAllUsers() {
  const { data, error } = await supabase.from('users').select('*').order('reputation', { ascending: false })
  return { data, error }
}

export async function toggleBanUser(userId, isBanned, adminId = null) {
  const { data: userData } = await supabase.from('users').select('username').eq('id', userId).single()
  const { error } = await supabase.from('users').update({ is_banned: isBanned }).eq('id', userId)
  
  // Log admin action
  if (adminId) {
    await logAdminAction(adminId, isBanned ? 'ban_user' : 'unban_user', 'user', userId, {
      username: userData?.username
    })
  }
  
  return { error }
}

export async function toggleFeatured(pollId, featured, adminId = null) {
  const { error } = await supabase.from('polls').update({ featured }).eq('id', pollId)
  
  // Log admin action
  if (adminId) {
    await logAdminAction(adminId, 'toggle_featured', 'poll', pollId, {
      featured: featured
    })
  }
  
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

// ===== BADGES =====

export function calculateBadges(user) {
  const badges = []
  const winRate = user.total_predictions > 0 ? (user.correct_predictions / user.total_predictions) * 100 : 0
  
  if (user.total_predictions >= 10 && winRate >= 70) badges.push({ id: 'accurate', name: 'แม่นยำ', icon: '🎯', description: 'Win Rate > 70%' })
  if (user.current_streak >= 5) badges.push({ id: 'onfire', name: 'ไฟลุก', icon: '🔥', description: 'โหวตถูกติดต่อกัน 5 ครั้ง' })
  if (user.max_streak >= 10) badges.push({ id: 'unstoppable', name: 'ไม่หยุด', icon: '⚡', description: 'เคยโหวตถูกติดต่อกัน 10 ครั้ง' })
  if (user.reputation >= 10000) badges.push({ id: 'legend', name: 'ตำนาน', icon: '👑', description: '10,000+ point' })
  else if (user.reputation >= 5000) badges.push({ id: 'master', name: 'ปรมาจารย์', icon: '🏆', description: '5,000+ point' })
  else if (user.reputation >= 3000) badges.push({ id: 'expert', name: 'ผู้เชี่ยวชาญ', icon: '⭐', description: '3,000+ point' })
  if (user.total_predictions >= 50) badges.push({ id: 'analyst', name: 'นักวิเคราะห์', icon: '📊', description: 'โหวตครบ 50 ครั้ง' })
  else if (user.total_predictions >= 10) badges.push({ id: 'rising', name: 'ดาวรุ่ง', icon: '🌟', description: 'โหวตครบ 10 ครั้ง' })
  
  return badges
}

// ===== NOTIFICATIONS =====

export async function createNotification({ userId, type, message, pollId = null, pointsChange = null }) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{ user_id: userId, type, message, poll_id: pollId, points_change: pointsChange, is_read: false }])
    .select().single()
  return { data, error }
}

export async function getUserNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from('notifications').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(limit)
  return { data, error }
}

export async function getUnreadNotificationCount(userId) {
  const { count, error } = await supabase
    .from('notifications').select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('is_read', false)
  return { count: count || 0, error }
}

export async function markNotificationAsRead(notificationId) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
  return { error }
}

export async function markAllNotificationsAsRead(userId) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  return { error }
}

// ===== FOLLOW SYSTEM =====

export async function followUser(followerId, followingId) {
  const { data: existing } = await supabase.from('follows').select('*').eq('follower_id', followerId).eq('following_id', followingId).single()
  if (existing) return { data: existing, error: null, alreadyFollowing: true }
  const { data, error } = await supabase.from('follows').insert([{ follower_id: followerId, following_id: followingId }]).select().single()
  return { data, error, alreadyFollowing: false }
}

export async function unfollowUser(followerId, followingId) {
  const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId)
  return { error }
}

export async function isFollowing(followerId, followingId) {
  const { data } = await supabase.from('follows').select('*').eq('follower_id', followerId).eq('following_id', followingId).single()
  return !!data
}

export async function getFollowers(userId) {
  const { data, error } = await supabase
    .from('follows').select('follower_id, users!follows_follower_id_fkey(id, username, reputation, avatar_url)')
    .eq('following_id', userId)
  return { data: data?.map(d => d.users) || [], error }
}

export async function getFollowing(userId) {
  const { data, error } = await supabase
    .from('follows').select('following_id, users!follows_following_id_fkey(id, username, reputation, avatar_url)')
    .eq('follower_id', userId)
  return { data: data?.map(d => d.users) || [], error }
}

export async function getFollowCounts(userId) {
  const { count: followersCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId)
  const { count: followingCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
  return { followers: followersCount || 0, following: followingCount || 0 }
}

// ===== AVATAR =====

export async function uploadAvatar(userId, file) {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}-${Date.now()}.${fileExt}`
  const filePath = `avatars/${fileName}`

  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true })
  if (uploadError) return { error: uploadError }

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
  const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', userId)
  if (updateError) return { error: updateError }

  return { data: { url: publicUrl }, error: null }
}

// ===== DEMOGRAPHICS (Profile Completion) =====
// Note: This no longer grants Verified badge immediately.
// Verified badge is granted via checkAndGrantVerified() based on participation.

export async function submitDemographics(userId, { fullName, birthDate, gender, pdpaConsent, marketingConsent }) {
  const today = new Date()
  const birth = new Date(birthDate)
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--

  if (age < 13) return { data: null, error: { message: 'ต้องมีอายุอย่างน้อย 13 ปี' } }

  const { data, error } = await supabase
    .from('users')
    .update({
      full_name: fullName, 
      birth_date: birthDate, 
      gender: gender || null,
      pdpa_consent: pdpaConsent,
      pdpa_consent_at: pdpaConsent ? new Date().toISOString() : null,
      marketing_consent: marketingConsent,
      // Note: is_verified is NOT set here anymore
      // Verified badge is earned through participation (14 days + 20 votes)
    })
    .eq('id', userId).select().single()

  return { data, error }
}

// Legacy alias for backward compatibility
export const submitVerification = submitDemographics

// ===== VERIFIED STATUS (Trust Badge) =====
// Verified badge ✓ is earned through consistent participation:
// - Account age >= 14 days
// - Vote count >= 20 polls
// - Email verified

export async function getUserVoteCount(userId) {
  const { count, error } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
  
  return { count: count || 0, error }
}

export async function getVerifiedProgress(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('created_at, email_verified, is_verified')
    .eq('id', userId)
    .single()
  
  if (error || !user) return { data: null, error }
  
  const { count: voteCount } = await getUserVoteCount(userId)
  const daysSinceSignup = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
  
  return {
    data: {
      isVerified: user.is_verified || false,
      daysSinceSignup,
      daysRequired: 14,
      voteCount,
      votesRequired: 20,
      emailVerified: user.email_verified || false,
      // Progress percentages
      daysProgress: Math.min(100, Math.round((daysSinceSignup / 14) * 100)),
      votesProgress: Math.min(100, Math.round((voteCount / 20) * 100)),
      // Ready to verify?
      meetsRequirements: daysSinceSignup >= 14 && voteCount >= 20 && user.email_verified
    },
    error: null
  }
}

export async function checkAndGrantVerified(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('created_at, email_verified, is_verified')
    .eq('id', userId)
    .single()
  
  if (error || !user) return { granted: false, error }
  
  // Already verified
  if (user.is_verified) return { granted: false, alreadyVerified: true }
  
  // Check conditions
  const daysSinceSignup = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
  const { count: voteCount } = await getUserVoteCount(userId)
  
  // Requirements: 14 days + 20 votes + email verified
  if (daysSinceSignup >= 14 && voteCount >= 20 && user.email_verified) {
    // Grant verified status!
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        is_verified: true, 
        verified_at: new Date().toISOString() 
      })
      .eq('id', userId)
    
    if (updateError) return { granted: false, error: updateError }
    
    // Send notification
    await createNotification({
      userId,
      type: 'verified_granted',
      message: '🎉 คุณได้รับสถานะ Verified แล้ว! ขอบคุณที่ร่วมคิดว่า..และแลกเปลี่ยนความคิดเห็นอย่างต่อเนื่อง'
    })
    
    return { granted: true }
  }
  
  return { 
    granted: false, 
    progress: {
      daysSinceSignup,
      daysRequired: 14,
      voteCount,
      votesRequired: 20,
      emailVerified: user.email_verified
    }
  }
}

export async function skipVerification(userId) {
  const { data, error } = await supabase
    .from('users').update({ verification_skipped: true }).eq('id', userId).select().single()
  return { data, error }
}

export async function checkNeedsVerification(userId) {
  const { data } = await supabase
    .from('users').select('email_verified, is_verified, verification_skipped').eq('id', userId).single()
  if (!data) return false
  return data.email_verified && !data.is_verified && !data.verification_skipped
}

// ===== CREATOR POINTS =====

export async function checkAndAwardCreatorPoints(pollId) {
  const { data: poll } = await supabase
    .from('polls')
    .select('id, created_by, creator_points_100, creator_points_1000, creator_points_10000, options(votes)')
    .eq('id', pollId).single()

  if (!poll) return { awarded: false }

  const totalVotes = poll.options?.reduce((sum, o) => sum + o.votes, 0) || 0
  let pointsToAward = 0
  let milestone = null
  const updates = {}

  if (totalVotes >= 10000 && !poll.creator_points_10000) {
    pointsToAward = 200; milestone = '10000'; updates.creator_points_10000 = true
  } else if (totalVotes >= 1000 && !poll.creator_points_1000) {
    pointsToAward = 50; milestone = '1000'; updates.creator_points_1000 = true
  } else if (totalVotes >= 100 && !poll.creator_points_100) {
    pointsToAward = 20; milestone = '100'; updates.creator_points_100 = true
  }

  if (pointsToAward > 0 && poll.created_by) {
    await supabase.from('polls').update(updates).eq('id', pollId)
    const { data: creator } = await supabase.from('users').select('reputation').eq('id', poll.created_by).single()
    if (creator) {
      await supabase.from('users').update({ reputation: creator.reputation + pointsToAward }).eq('id', poll.created_by)
      await createNotification({
        userId: poll.created_by, type: 'creator_bonus',
        message: `🎉 โพลของคุณมีคนโหวตครบ ${milestone} คน! ได้รับ +${pointsToAward} คะแนน`,
        pollId: pollId, pointsChange: pointsToAward
      })
    }
    return { awarded: true, points: pointsToAward, milestone }
  }

  return { awarded: false }
}
// ============================================================
// KIDWA: Opinion Poll & Admin Extension Functions
// Add these functions to lib/supabase.js
// ============================================================

// ╔════════════════════════════════════════════════════════════╗
// ║  INVARIANT: SHADOW/OPINION POLLS = NO REPUTATION IMPACT    ║
// ╠════════════════════════════════════════════════════════════╣
// ║  Shadow votes are "exploratory support" NOT "stance"       ║
// ║  Opinion polls have no correct answer → no rep impact      ║
// ║                                                            ║
// ║  NEVER add reputation logic to:                            ║
// ║  - voteForShadowOption()                                   ║
// ║  - voteOthersWithShadow()                                  ║
// ║  - suggestShadowOption()                                   ║
// ║  - Any opinion poll resolution                             ║
// ║                                                            ║
// ║  Violation WILL cause:                                     ║
// ║  - Reputation farming exploits                             ║
// ║  - Distorted user incentives                               ║
// ║  - Loss of opinion poll integrity                          ║
// ║                                                            ║
// ║  This invariant is ENFORCED in:                            ║
// ║  - resolvePoll() runtime guard                             ║
// ║  - Code review checklist                                   ║
// ╚════════════════════════════════════════════════════════════╝

// ===== OPINION POLL CONSTANTS =====

const BLOCKED_SUGGESTIONS = [
  'อื่นๆ', 'อื่น ๆ', 'other', 'others',
  'ไม่แน่ใจ', 'ไม่รู้', 'not sure',
  'แล้วแต่', 'แล้วแต่สถานการณ์', 'depends',
  'ไม่มีความเห็น', 'no comment',
  'ทั้งหมด', 'all of above', 'ทุกข้อ',
  'ไม่มี', 'none', 'n/a'
]

const MIN_SUGGESTION_LENGTH = 2
const MAX_SUGGESTION_LENGTH = 100
const MAX_OFFICIAL_OPTIONS = 10
const SHADOW_EXPIRY_HOURS = 72
const MIN_PROMOTION_THRESHOLD = 3
const PROMOTION_THRESHOLD_PERCENTAGE = 0.1 // 10%
const MIN_TRUST_MULTIPLIER = 0.8

// ===== TEXT NORMALIZATION & SIMILARITY =====

function normalizeText(text) {
  if (!text) return ''
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    // Remove common Thai filler words at start
    .replace(/^(ก็|คือ|แบบ|อันนี้|อันนั้น|คำตอบ)\s*/g, '')
    // Remove punctuation
    .replace(/[.,!?;:'"()[\]{}]/g, '')
}

function calculateLevenshteinDistance(str1, str2) {
  const m = str1.length
  const n = str2.length
  
  if (m === 0) return n
  if (n === 0) return m
  
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
    }
  }
  
  return dp[m][n]
}

function calculateSimilarity(str1, str2) {
  const normalized1 = normalizeText(str1)
  const normalized2 = normalizeText(str2)
  
  if (normalized1 === normalized2) return 1.0
  if (!normalized1 || !normalized2) return 0.0
  
  const maxLength = Math.max(normalized1.length, normalized2.length)
  const distance = calculateLevenshteinDistance(normalized1, normalized2)
  
  return 1 - (distance / maxLength)
}

// ===== TRUST WEIGHT CALCULATION =====

export async function getUserTrustWeight(userId) {
  const { data: user, error } = await supabase
    .from('users')
    .select('created_at, is_verified, total_predictions')
    .eq('id', userId)
    .single()
  
  if (error || !user) return 0.5
  
  let weight = 0.5 // base weight
  
  // Account age bonus
  const daysSinceSignup = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
  if (daysSinceSignup >= 30) weight += 0.3
  else if (daysSinceSignup >= 14) weight += 0.15
  
  // Verified bonus
  if (user.is_verified) weight += 0.4
  
  // Vote history bonus
  if (user.total_predictions >= 20) weight += 0.2
  
  // Max 1.4 per user
  return Math.min(1.4, weight)
}

// ===== OPINION POLL CREATION =====

export async function createOpinionPoll({ question, options, category, tags, endsAt, createdBy }) {
  try {
    // 1. Create poll with allow_suggestions = true
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{ 
        question, 
        category, 
        blind_mode: false, 
        poll_type: 'opinion',
        allow_suggestions: true,
        ends_at: endsAt, 
        created_by: createdBy, 
        featured: false, 
        resolved: false 
      }])
      .select()
      .single()
    
    if (pollError) throw pollError

    // 2. Create user-provided options
    const optionsData = options.map(opt => ({ 
      poll_id: poll.id, 
      text: opt, 
      votes: 0,
      is_system: false,
      option_key: null
    }))
    
    // 3. Add system "อื่นๆ" option
    optionsData.push({
      poll_id: poll.id,
      text: 'อื่นๆ',
      votes: 0,
      is_system: true,
      option_key: 'others'
    })
    
    const { error: optionsError } = await supabase.from('options').insert(optionsData)
    if (optionsError) throw optionsError

    // 4. Add tags
    if (tags && tags.length > 0) {
      const tagLinks = tags.map(tagId => ({ poll_id: poll.id, tag_id: tagId }))
      await supabase.from('poll_tags').insert(tagLinks)
    }

    return { data: poll, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

// ===== SHADOW OPTION FUNCTIONS =====

export async function checkSuggestionValidity(pollId, suggestionText, userId) {
  const normalized = normalizeText(suggestionText)
  
  // 1. Check length
  if (normalized.length < MIN_SUGGESTION_LENGTH) {
    return { valid: false, error: 'คำตอบสั้นเกินไป' }
  }
  if (suggestionText.length > MAX_SUGGESTION_LENGTH) {
    return { valid: false, error: 'คำตอบยาวเกินไป (ไม่เกิน 100 ตัวอักษร)' }
  }
  
  // 2. Check blocklist
  const isBlocked = BLOCKED_SUGGESTIONS.some(blocked => 
    normalized.includes(normalizeText(blocked))
  )
  if (isBlocked) {
    return { valid: false, error: 'คำตอบนี้กว้างเกินไป กรุณาระบุให้ชัดเจนกว่านี้' }
  }
  
  // 3. Check user already suggested
  const { data: existingSuggestion } = await supabase
    .from('shadow_options')
    .select('id')
    .eq('poll_id', pollId)
    .eq('suggested_by', userId)
    .in('status', ['pending', 'promoted'])
    .single()
  
  if (existingSuggestion) {
    return { valid: false, error: 'คุณเคยเสนอตัวเลือกในโพลนี้แล้ว' }
  }
  
  // 4. Check similarity with official options
  const { data: officialOptions } = await supabase
    .from('options')
    .select('id, text')
    .eq('poll_id', pollId)
    .eq('is_system', false)
  
  for (const opt of officialOptions || []) {
    const similarity = calculateSimilarity(suggestionText, opt.text)
    if (similarity > 0.7) {
      return { 
        valid: false, 
        error: `มีคำตอบคล้ายกันอยู่แล้ว: "${opt.text}"`,
        similarOption: opt
      }
    }
  }
  
  // 5. Check similarity with pending shadow options
  const { data: shadowOptions } = await supabase
    .from('shadow_options')
    .select('id, text, unique_voters, trust_score')
    .eq('poll_id', pollId)
    .eq('status', 'pending')
  
  for (const shadow of shadowOptions || []) {
    const similarity = calculateSimilarity(suggestionText, shadow.text)
    if (similarity > 0.7) {
      return { 
        valid: false, 
        error: `มีคนเสนอคำตอบคล้ายกันไว้แล้ว`,
        similarShadow: shadow,
        canSupport: true
      }
    }
  }
  
  return { valid: true }
}

export async function suggestShadowOption(pollId, text, userId) {
  // 1. Verify user is verified
  const { data: user } = await supabase
    .from('users')
    .select('email_verified, is_verified')
    .eq('id', userId)
    .single()
  
  if (!user?.email_verified || !user?.is_verified) {
    return { data: null, error: { message: 'กรุณายืนยันอีเมล เพื่อเสนอตัวเลือกง' } }
  }
  
  // 2. Check poll allows suggestions
  const { data: poll } = await supabase
    .from('polls')
    .select('allow_suggestions, poll_type, resolved, ends_at')
    .eq('id', pollId)
    .single()
  
  if (!poll?.allow_suggestions || poll.poll_type !== 'opinion') {
    return { data: null, error: { message: 'โพลนี้ไม่รองรับการเสนอตัวเลือกเพิ่มเติม' } }
  }
  
  if (poll.resolved) {
    return { data: null, error: { message: 'โพลนี้จบแล้ว' } }
  }
  
  // 3. Validate suggestion
  const validation = await checkSuggestionValidity(pollId, text, userId)
  if (!validation.valid) {
    return { 
      data: null, 
      error: { message: validation.error },
      similarOption: validation.similarOption,
      similarShadow: validation.similarShadow,
      canSupport: validation.canSupport
    }
  }
  
  // 4. Create shadow option
  const { data: shadow, error } = await supabase
    .from('shadow_options')
    .insert([{
      poll_id: pollId,
      text: text.trim(),
      suggested_by: userId,
      status: 'pending',
      normalized_text: normalizeText(text)
    }])
    .select()
    .single()
  
  if (error) return { data: null, error }
  
  // 5. Auto-vote by suggester
  const trustWeight = await getUserTrustWeight(userId)
  await supabase
    .from('shadow_votes')
    .insert([{
      shadow_option_id: shadow.id,
      user_id: userId,
      trust_weight: trustWeight
    }])
  
  return { data: shadow, error: null }
}

export async function voteForShadowOption(shadowId, userId) {
  // 1. Check user eligibility
  const { data: user } = await supabase
    .from('users')
    .select('email_verified')
    .eq('id', userId)
    .single()
  
  if (!user?.email_verified) {
    return { data: null, error: { message: 'ต้องยืนยันอีเมลก่อนโหวต' } }
  }
  
  // 2. Check shadow option status
  const { data: shadow } = await supabase
    .from('shadow_options')
    .select('status, poll_id')
    .eq('id', shadowId)
    .single()
  
  if (!shadow || shadow.status !== 'pending') {
    return { data: null, error: { message: 'ไม่สามารถโหวตตัวเลือกนี้ได้' } }
  }
  
  // 3. Check if already voted
  const { data: existingVote } = await supabase
    .from('shadow_votes')
    .select('id')
    .eq('shadow_option_id', shadowId)
    .eq('user_id', userId)
    .single()
  
  if (existingVote) {
    return { data: null, error: { message: 'คุณสนับสนุนตัวเลือกนี้แล้ว' } }
  }
  
  // 4. Create shadow vote
  const trustWeight = await getUserTrustWeight(userId)
  const { data: vote, error } = await supabase
    .from('shadow_votes')
    .insert([{
      shadow_option_id: shadowId,
      user_id: userId,
      trust_weight: trustWeight
    }])
    .select()
    .single()
  
  if (error) return { data: null, error }
  
  // 5. Check for promotion eligibility
  const promotionCheck = await checkAndPromoteShadow(shadowId)
  
  return { 
    data: vote, 
    error: null,
    promoted: promotionCheck.promoted,
    promotionMessage: promotionCheck.message
  }
}

export async function getShadowOptions(pollId) {
  const { data, error } = await supabase
    .from('shadow_options')
    .select(`
      id, text, status, unique_voters, trust_score, created_at,
      suggested_by,
      users:suggested_by (username)
    `)
    .eq('poll_id', pollId)
    .eq('status', 'pending')
    .order('trust_score', { ascending: false })
  
  return { data, error }
}

// ===== SHADOW PROMOTION LOGIC =====

async function getPromotionThreshold(pollId) {
  const { count } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('poll_id', pollId)
  
  const totalVoters = count || 0
  const dynamicThreshold = Math.ceil(totalVoters * PROMOTION_THRESHOLD_PERCENTAGE)
  
  return Math.max(MIN_PROMOTION_THRESHOLD, dynamicThreshold)
}

export async function checkAndPromoteShadow(shadowId) {
  // 1. Get shadow data
  const { data: shadow } = await supabase
    .from('shadow_options')
    .select('*, poll_id')
    .eq('id', shadowId)
    .single()
  
  if (!shadow || shadow.status !== 'pending') {
    return { promoted: false, reason: 'Invalid shadow option' }
  }
  
  // 2. Get threshold
  const threshold = await getPromotionThreshold(shadow.poll_id)
  const minTrustScore = threshold * MIN_TRUST_MULTIPLIER
  
  // 3. Check if meets requirements
  if (shadow.unique_voters < threshold || shadow.trust_score < minTrustScore) {
    return { 
      promoted: false, 
      reason: 'Not enough support',
      progress: {
        voters: shadow.unique_voters,
        threshold,
        trustScore: shadow.trust_score,
        minTrustScore
      }
    }
  }
  
  // 4. Check current option count
  const { data: currentOptions } = await supabase
    .from('options')
    .select('id, text, votes')
    .eq('poll_id', shadow.poll_id)
    .eq('is_system', false)
  
  if (currentOptions.length >= MAX_OFFICIAL_OPTIONS) {
    // Need to replace lowest voted option
    const lowestOption = currentOptions.sort((a, b) => a.votes - b.votes)[0]
    
    // Get shadow vote count
    const { count: shadowVotes } = await supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .eq('shadow_option_id', shadowId)
    
    if ((shadowVotes || 0) <= lowestOption.votes) {
      return { 
        promoted: false, 
        reason: `ตัวเลือกนี้ยังมี votes น้อยกว่าตัวเลือกที่มีอยู่ (${lowestOption.votes} votes)`,
        needsMoreVotes: true
      }
    }
    
    // Demote the lowest option
    await demoteOption(lowestOption.id, shadow.poll_id)
  }
  
  // 5. Promote!
  return await promoteShadowToOfficial(shadowId)
}

async function promoteShadowToOfficial(shadowId) {
  const { data: shadow } = await supabase
    .from('shadow_options')
    .select('*')
    .eq('id', shadowId)
    .single()
  
  if (!shadow) return { promoted: false, reason: 'Shadow not found' }
  
  // 1. Create new official option
  const { data: newOption, error: optionError } = await supabase
    .from('options')
    .insert([{
      poll_id: shadow.poll_id,
      text: shadow.text,
      votes: 0,
      is_system: false,
      option_key: null
    }])
    .select()
    .single()
  
  if (optionError) return { promoted: false, reason: 'Failed to create option' }
  
  // 2. Transfer votes from "อื่นๆ" that pointed to this shadow
  const { data: shadowVotes } = await supabase
    .from('votes')
    .select('id')
    .eq('shadow_option_id', shadowId)
  
  if (shadowVotes && shadowVotes.length > 0) {
    // Update votes to point to new official option
    await supabase
      .from('votes')
      .update({ 
        option_id: newOption.id, 
        shadow_option_id: null 
      })
      .eq('shadow_option_id', shadowId)
    
    // Update vote count on new option
    await supabase
      .from('options')
      .update({ votes: shadowVotes.length })
      .eq('id', newOption.id)
    
    // Decrease "อื่นๆ" vote count
    const { data: othersOption } = await supabase
      .from('options')
      .select('id, votes')
      .eq('poll_id', shadow.poll_id)
      .eq('option_key', 'others')
      .single()
    
    if (othersOption) {
      await supabase
        .from('options')
        .update({ votes: Math.max(0, othersOption.votes - shadowVotes.length) })
        .eq('id', othersOption.id)
    }
  }
  
  // 3. Update shadow status
  await supabase
    .from('shadow_options')
    .update({ 
      status: 'promoted', 
      promoted_at: new Date().toISOString(),
      promoted_to_option_id: newOption.id
    })
    .eq('id', shadowId)
  
  // 4. Notify suggester
  await createNotification({
    userId: shadow.suggested_by,
    type: 'shadow_promoted',
    message: `🎉 ตัวเลือกของคุณ "${shadow.text}" ได้รับการยอมรับจากชุมชนและกลายเป็นตัวเลือกหลักแล้ว`,
    pollId: shadow.poll_id
  })
  
  return { 
    promoted: true, 
    message: '🎉 ตัวเลือกนี้ได้รับการยอมรับจากชุมชน และกลายเป็นตัวเลือกหลักแล้ว',
    newOptionId: newOption.id
  }
}

async function demoteOption(optionId, pollId) {
  const { data: option } = await supabase
    .from('options')
    .select('id, text, votes')
    .eq('id', optionId)
    .single()
  
  if (!option) return
  
  // 1. Create shadow option from demoted
  const { data: newShadow } = await supabase
    .from('shadow_options')
    .insert([{
      poll_id: pollId,
      text: option.text,
      suggested_by: null, // System demoted
      status: 'pending',
      normalized_text: normalizeText(option.text)
    }])
    .select()
    .single()
  
  // 2. Get "อื่นๆ" option
  const { data: othersOption } = await supabase
    .from('options')
    .select('id, votes')
    .eq('poll_id', pollId)
    .eq('option_key', 'others')
    .single()
  
  // 3. Transfer votes to "อื่นๆ" and point to new shadow
  await supabase
    .from('votes')
    .update({ 
      option_id: othersOption.id, 
      shadow_option_id: newShadow?.id 
    })
    .eq('option_id', optionId)
  
  // 4. Update "อื่นๆ" vote count
  if (othersOption) {
    await supabase
      .from('options')
      .update({ votes: othersOption.votes + option.votes })
      .eq('id', othersOption.id)
  }
  
  // 5. Delete old option
  await supabase
    .from('options')
    .delete()
    .eq('id', optionId)
  
  // 6. Notify affected voters
  const { data: affectedVotes } = await supabase
    .from('votes')
    .select('user_id')
    .eq('shadow_option_id', newShadow?.id)
  
  for (const vote of affectedVotes || []) {
    await createNotification({
      userId: vote.user_id,
      type: 'option_demoted',
      message: `ตัวเลือก "${option.text}" ถูกย้ายไป "อื่นๆ" เนื่องจากมีมุมมองใหม่ที่ได้รับความนิยมมากกว่า`,
      pollId: pollId
    })
  }
}

// ===== VOTE FOR "อื่นๆ" WITH SHADOW =====

export async function voteOthersWithShadow(userId, pollId, shadowOptionId, confidence = 50) {
  // 1. Get "อื่นๆ" option
  const { data: othersOption } = await supabase
    .from('options')
    .select('id')
    .eq('poll_id', pollId)
    .eq('option_key', 'others')
    .single()
  
  if (!othersOption) {
    return { data: null, error: { message: 'ไม่พบตัวเลือก "อื่นๆ"' } }
  }
  
  // 2. Verify shadow option exists and is pending
  if (shadowOptionId) {
    const { data: shadow } = await supabase
      .from('shadow_options')
      .select('status, poll_id')
      .eq('id', shadowOptionId)
      .single()
    
    if (!shadow || shadow.status !== 'pending' || shadow.poll_id !== pollId) {
      return { data: null, error: { message: 'มุมมองนี้ไม่พร้อมให้โหวต' } }
    }
  }
  
  // 3. Cast vote using existing vote function logic
  const { data: poll } = await supabase
    .from('polls')
    .select('ends_at, resolved')
    .eq('id', pollId)
    .single()
  
  if (!poll) return { data: null, error: { message: 'ไม่พบโพลนี้' } }
  if (new Date() > new Date(poll.ends_at)) return { data: null, error: { message: 'โพลนี้หมดเวลาแล้ว' } }
  if (poll.resolved) return { data: null, error: { message: 'โพลนี้ถูกเฉลยแล้ว' } }
  
  // 4. Check existing vote
  const { data: existingVote } = await supabase
    .from('votes')
    .select('*')
    .eq('user_id', userId)
    .eq('poll_id', pollId)
    .single()
  
  if (existingVote) {
    // Update existing vote
    const { data, error } = await supabase
      .from('votes')
      .update({ 
        option_id: othersOption.id, 
        shadow_option_id: shadowOptionId,
        confidence, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', existingVote.id)
      .select()
      .single()
    
    return { data, error, isUpdate: true }
  } else {
    // Create new vote
    const { data, error } = await supabase
      .from('votes')
      .insert([{ 
        user_id: userId, 
        poll_id: pollId, 
        option_id: othersOption.id, 
        shadow_option_id: shadowOptionId,
        confidence 
      }])
      .select()
      .single()
    
    return { data, error, isUpdate: false }
  }
}

// ===== SHADOW EXPIRY CLEANUP =====
// Use cleanupExpiredShadowsWithLogging() instead - see CLEANUP CRON section above

// Legacy alias for backward compatibility
export const cleanupExpiredShadows = cleanupExpiredShadowsWithLogging

// ===== ADMIN: POLL TIME EXTENSION =====

export async function extendPollTime(pollId, newEndsAt, reason, adminId) {
  // 1. Verify admin
  const { data: admin } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', adminId)
    .single()
  
  if (!admin?.is_admin) {
    return { data: null, error: { message: 'Unauthorized: Admin access required' } }
  }
  
  // 2. Get poll data
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select('*')
    .eq('id', pollId)
    .single()
  
  if (pollError || !poll) {
    return { data: null, error: { message: 'Poll not found' } }
  }
  
  // 3. Validate poll type (only prediction allowed)
  if (poll.poll_type !== 'prediction') {
    return { 
      data: null, 
      error: { message: 'เฉพาะ Prediction polls เท่านั้นที่ขยายเวลาได้ Live Battle และ Time Capsule ไม่สามารถแก้ไขเวลาได้' } 
    }
  }
  
  // 4. Check if already resolved
  if (poll.resolved) {
    return { data: null, error: { message: 'ไม่สามารถขยายเวลาโพลที่ resolved แล้ว' } }
  }
  
  // 5. Validate new end time
  if (new Date(newEndsAt) <= new Date()) {
    return { data: null, error: { message: 'วันเวลาสิ้นสุดใหม่ต้องอยู่ในอนาคต' } }
  }
  
  // 6. Store original_ends_at if first extension
  const originalEndsAt = poll.original_ends_at || poll.ends_at
  
  // 7. Get vote count for audit
  const { count: totalVotes } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('poll_id', pollId)
  
  // 8. Update poll
  const { data: updatedPoll, error: updateError } = await supabase
    .from('polls')
    .update({
      ends_at: newEndsAt,
      original_ends_at: originalEndsAt,
      extended_at: new Date().toISOString(),
      extended_by: adminId,
      extension_reason: reason,
      extension_count: (poll.extension_count || 0) + 1
    })
    .eq('id', pollId)
    .select()
    .single()
  
  if (updateError) return { data: null, error: updateError }
  
  // 9. Create audit log entry
  await supabase
    .from('poll_extensions')
    .insert([{
      poll_id: pollId,
      admin_id: adminId,
      original_ends_at: originalEndsAt,
      new_ends_at: newEndsAt,
      reason: reason,
      poll_type: poll.poll_type,
      poll_question: poll.question?.substring(0, 200),
      total_votes_at_extension: totalVotes || 0,
      was_expired: new Date(poll.ends_at) < new Date()
    }])
  
  // 10. Log admin action
  await logAdminAction(adminId, 'extend_poll', 'poll', pollId, {
    original_ends_at: originalEndsAt,
    new_ends_at: newEndsAt,
    reason: reason,
    extension_count: (poll.extension_count || 0) + 1,
    was_expired: new Date(poll.ends_at) < new Date()
  })
  
  // 11. Notify all voters
  const { data: voters } = await supabase
    .from('votes')
    .select('user_id')
    .eq('poll_id', pollId)
  
  const uniqueVoterIds = [...new Set(voters?.map(v => v.user_id) || [])]
  
  for (const voterId of uniqueVoterIds) {
    await createNotification({
      userId: voterId,
      type: 'poll_extended',
      message: `⏰ โพล "${poll.question?.substring(0, 40)}..." ถูกขยายเวลา เหตุผล: ${reason}`,
      pollId: pollId
    })
  }
  
  return { 
    data: updatedPoll, 
    error: null,
    notifiedCount: uniqueVoterIds.length
  }
}

// ===== ADMIN: GET POLL EXTENSION HISTORY =====

export async function getPollExtensionHistory(pollId) {
  const { data, error } = await supabase
    .from('poll_extensions')
    .select(`
      id,
      original_ends_at,
      new_ends_at,
      extended_at,
      reason,
      total_votes_at_extension,
      was_expired,
      users:admin_id (username)
    `)
    .eq('poll_id', pollId)
    .order('extended_at', { ascending: false })
  
  return { data, error }
}

// ===== INVARIANT GUARD: OPINION POLL RESOLUTION =====
// This function MUST be called before resolving any poll
// to enforce the NO_REP invariant for opinion polls

export function assertNotOpinionPoll(poll, operation) {
  if (poll?.poll_type === 'opinion') {
    console.error(`[INVARIANT VIOLATION] Attempted ${operation} on opinion poll ${poll.id}`)
    throw new Error(`INVARIANT: Opinion polls cannot have ${operation}. They have no correct answer.`)
  }
}

// Wrapper for resolvePoll that enforces invariant
export async function safeResolvePoll(pollId, correctOptionId, adminId = null) {
  // 1. Fetch poll to check type
  const { data: poll } = await supabase
    .from('polls')
    .select('id, poll_type, question')
    .eq('id', pollId)
    .single()
  
  // 2. INVARIANT CHECK: Opinion polls cannot be "resolved" with correct answer
  if (poll?.poll_type === 'opinion') {
    console.warn(`[INVARIANT] Blocking resolution attempt on opinion poll: ${pollId}`)
    return { 
      error: { 
        message: 'Opinion polls ไม่มีคำตอบถูก/ผิด จึงไม่สามารถ resolve แบบปกติได้',
        code: 'OPINION_NO_RESOLUTION'
      },
      invariantBlocked: true
    }
  }
  
  // 3. Safe to proceed with normal resolution
  // Import and call the original resolvePoll from main supabase.js
  // return await resolvePoll(pollId, correctOptionId, adminId)
  
  // Note: This is a wrapper - integrate with existing resolvePoll
  return { proceedWithResolution: true, pollType: poll?.poll_type }
}

// Close opinion poll without reputation impact
export async function closeOpinionPoll(pollId, adminId = null) {
  const { data: poll } = await supabase
    .from('polls')
    .select('poll_type, question')
    .eq('id', pollId)
    .single()
  
  // Only allow for opinion polls
  if (poll?.poll_type !== 'opinion') {
    return { error: { message: 'Use resolvePoll() for non-opinion polls' } }
  }
  
  // Simply mark as resolved without correct_option_id
  // NO reputation changes - this is the invariant
  const { error } = await supabase
    .from('polls')
    .update({ 
      resolved: true, 
      resolved_at: new Date().toISOString(),
      // correct_option_id intentionally NULL for opinion polls
    })
    .eq('id', pollId)
  
  if (adminId) {
    await logAdminAction(adminId, 'close_opinion_poll', 'poll', pollId, {
      question: poll?.question?.substring(0, 100),
      note: 'Opinion poll closed - NO reputation impact (invariant)'
    })
  }
  
  console.log(`[INVARIANT OK] Opinion poll ${pollId} closed without rep impact`)
  
  return { error, reputationImpact: false }
}

// ===== CLEANUP CRON WITH OBSERVABILITY =====
// CRITICAL INFRASTRUCTURE - Monitor this!

export async function logCleanupEvent({ jobId, event, cleanedCount, errors, durationMs, errorMessage }) {
  try {
    await supabase
      .from('cleanup_logs')
      .insert([{
        job_id: jobId,
        event,
        cleaned_count: cleanedCount,
        errors: errors ? JSON.stringify(errors) : null,
        duration_ms: durationMs,
        error_message: errorMessage,
        timestamp: new Date().toISOString()
      }])
  } catch (e) {
    // Fallback: at minimum log to console
    console.error('[CLEANUP LOG FAILED]', e, { jobId, event })
  }
}

export async function cleanupExpiredShadowsWithLogging() {
  const startTime = Date.now()
  const jobId = crypto.randomUUID ? crypto.randomUUID() : `job-${Date.now()}`
  
  // 1. Log start
  await logCleanupEvent({ jobId, event: 'started' })
  console.log(`[CLEANUP] Job ${jobId} started`)
  
  try {
    // 2. Do actual cleanup
    const expiryTime = new Date(Date.now() - SHADOW_EXPIRY_HOURS * 60 * 60 * 1000)
    
    const { data: expiredShadows, error: fetchError } = await supabase
      .from('shadow_options')
      .select('id, poll_id, text, suggested_by')
      .eq('status', 'pending')
      .lt('created_at', expiryTime.toISOString())
    
    if (fetchError) throw fetchError
    
    let cleanedCount = 0
    const errors = []
    
    for (const shadow of expiredShadows || []) {
      try {
        // Update status to expired
        await supabase
          .from('shadow_options')
          .update({ 
            status: 'expired',
            expired_at: new Date().toISOString()
          })
          .eq('id', shadow.id)
        
        // Clear shadow_option_id from votes
        await supabase
          .from('votes')
          .update({ shadow_option_id: null })
          .eq('shadow_option_id', shadow.id)
        
        // Notify suggester
        if (shadow.suggested_by) {
          await createNotification({
            userId: shadow.suggested_by,
            type: 'shadow_expired',
            message: `มุมมอง "${shadow.text}" ไม่ได้รับการสนับสนุนเพียงพอภายใน 72 ชม.`,
            pollId: shadow.poll_id
          })
        }
        
        cleanedCount++
      } catch (itemError) {
        errors.push({ shadowId: shadow.id, error: itemError.message })
      }
    }
    
    // 3. Log success
    const durationMs = Date.now() - startTime
    await logCleanupEvent({ 
      jobId, 
      event: 'completed', 
      cleanedCount, 
      errors: errors.length > 0 ? errors : null,
      durationMs 
    })
    
    console.log(`[CLEANUP] Job ${jobId} completed: ${cleanedCount} shadows cleaned in ${durationMs}ms`)
    
    return { 
      success: true, 
      jobId,
      cleaned: cleanedCount, 
      errors: errors.length > 0 ? errors : null,
      durationMs
    }
    
  } catch (error) {
    // 4. Log failure (CRITICAL!)
    const durationMs = Date.now() - startTime
    await logCleanupEvent({ 
      jobId, 
      event: 'failed', 
      errorMessage: error.message,
      durationMs
    })
    
    console.error(`[CLEANUP FAILED] Job ${jobId}: ${error.message}`)
    
    // Note: In production, add alerting here (webhook, email, etc.)
    // await sendAlert({ type: 'CLEANUP_FAILED', message: error.message })
    
    return { 
      success: false, 
      jobId,
      error: error.message,
      durationMs
    }
  }
}

// Health check for cleanup cron
export async function getCleanupHealth() {
  const { data: lastRun } = await supabase
    .from('cleanup_logs')
    .select('*')
    .eq('event', 'completed')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()
  
  const { data: lastFailed } = await supabase
    .from('cleanup_logs')
    .select('*')
    .eq('event', 'failed')
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()
  
  const { count: pendingShadows } = await supabase
    .from('shadow_options')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')
  
  const hoursSinceLastRun = lastRun 
    ? (Date.now() - new Date(lastRun.timestamp).getTime()) / (1000 * 60 * 60)
    : Infinity
  
  const isHealthy = hoursSinceLastRun < 24
  const needsAttention = hoursSinceLastRun > 12
  const isCritical = hoursSinceLastRun > 24
  
  return {
    healthy: isHealthy,
    status: isCritical ? 'critical' : needsAttention ? 'warning' : 'ok',
    lastSuccessfulRun: lastRun?.timestamp || null,
    lastFailedRun: lastFailed?.timestamp || null,
    hoursSinceLastRun: Math.round(hoursSinceLastRun * 10) / 10,
    pendingShadowCount: pendingShadows || 0,
    lastCleanedCount: lastRun?.cleaned_count || 0,
    alert: isCritical,
    message: isCritical 
      ? '🚨 Cleanup has not run for 24+ hours!' 
      : needsAttention 
        ? '⚠️ Cleanup running behind schedule'
        : '✅ Cleanup healthy'
  }
}

// ===== GET OPINION POLLS =====

export async function getOpinionPolls(limit = 20) {
  const { data: polls, error } = await supabase
    .from('polls')
    .select('*, options(*)')
    .eq('poll_type', 'opinion')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error || !polls) return { data: polls, error }
  
  // Fetch tags
  const pollIds = polls.map(p => p.id)
  const { data: pollTags } = await supabase
    .from('poll_tags')
    .select('poll_id, tags(id, name)')
    .in('poll_id', pollIds)
  
  const pollTagsMap = {}
  pollTags?.forEach(pt => {
    if (!pollTagsMap[pt.poll_id]) pollTagsMap[pt.poll_id] = []
    if (pt.tags) pollTagsMap[pt.poll_id].push(pt.tags)
  })
  
  // Fetch shadow options count for each poll
  const { data: shadowCounts } = await supabase
    .from('shadow_options')
    .select('poll_id')
    .in('poll_id', pollIds)
    .eq('status', 'pending')
  
  const shadowCountMap = {}
  shadowCounts?.forEach(s => {
    shadowCountMap[s.poll_id] = (shadowCountMap[s.poll_id] || 0) + 1
  })
  
  const pollsWithExtras = polls.map(poll => ({
    ...poll,
    tags: pollTagsMap[poll.id] || [],
    pendingShadowCount: shadowCountMap[poll.id] || 0
  }))
  
  return { data: pollsWithExtras, error: null }
}
// ============================================================
// KIDWA: Recognition Notification System
// Add these functions to lib/supabase.js
// ============================================================

// ===== RECOGNITION CONSTANTS =====

const RECOGNITION_CONFIG = {
  weekly: {
    minVotes: 5,           // ต้องโหวตอย่างน้อย 5 โพล
    type: 'weekly_top'
  },
  monthly: {
    minVotes: 15,          // ต้องโหวตอย่างน้อย 15 โพล
    type: 'monthly_top'
  }
}

// ===== PERIOD KEY HELPERS =====

function getWeekKey(date = new Date()) {
  // ISO week format: YYYY-WXX
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
  return `${d.getFullYear()}-W${weekNum.toString().padStart(2, '0')}`
}

function getPreviousWeekKey() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return getWeekKey(d)
}

function getMonthKey(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
}

function getPreviousMonthKey() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return getMonthKey(d)
}

// ===== CHECK IF ALREADY RECOGNIZED =====

async function hasReceivedRecognition(userId, recognitionType, periodKey) {
  const { data } = await supabase
    .from('recognition_notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('recognition_type', recognitionType)
    .eq('period_key', periodKey)
    .single()
  
  return !!data
}

// ===== WEEKLY RECOGNITION (Run Monday morning) =====

export async function processWeeklyRecognition() {
  const periodKey = getPreviousWeekKey()
  console.log(`[RECOGNITION] Processing weekly recognition for ${periodKey}`)
  
  // 1. Get weekly leaderboard (already excludes admins)
  const { data: weeklyBoard } = await getWeeklyLeaderboard(1)
  
  if (!weeklyBoard || weeklyBoard.length === 0) {
    console.log('[RECOGNITION] No weekly data found')
    return { success: true, recognized: null, reason: 'no_data' }
  }
  
  const topUser = weeklyBoard[0]
  
  // 2. Check minimum participation
  // weeklyPoints comes from votes with points_earned in this week
  // We need to also check vote count
  const weekStart = getBangkokWeekStart()
  const { count: voteCount } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', topUser.id)
    .gte('created_at', weekStart)
  
  if ((voteCount || 0) < RECOGNITION_CONFIG.weekly.minVotes) {
    console.log(`[RECOGNITION] Top user ${topUser.username} has only ${voteCount} votes, minimum is ${RECOGNITION_CONFIG.weekly.minVotes}`)
    return { success: true, recognized: null, reason: 'below_minimum', voteCount }
  }
  
  // 3. Check if already recognized
  const alreadyRecognized = await hasReceivedRecognition(
    topUser.id, 
    RECOGNITION_CONFIG.weekly.type, 
    periodKey
  )
  
  if (alreadyRecognized) {
    console.log(`[RECOGNITION] User ${topUser.username} already recognized for ${periodKey}`)
    return { success: true, recognized: null, reason: 'already_recognized' }
  }
  
  // 4. Send recognition notification (Private, no ranking language)
  await createNotification({
    userId: topUser.id,
    type: 'weekly_recognition',
    message: '📊 สัปดาห์ที่ผ่านมา สิ่งที่คุณคิดว่า.. สุดยอดมาก ขอบคุณที่ร่วมแบ่งปันมุมมองกับชุมชน คิดว่า..!'
  })
  
  // 5. Record recognition to prevent duplicates
  await supabase
    .from('recognition_notifications')
    .insert([{
      user_id: topUser.id,
      recognition_type: RECOGNITION_CONFIG.weekly.type,
      period_key: periodKey,
      votes_in_period: voteCount,
      points_earned_in_period: topUser.weeklyPoints
    }])
  
  console.log(`[RECOGNITION] Weekly recognition sent to ${topUser.username}`)
  
  return { 
    success: true, 
    recognized: {
      userId: topUser.id,
      username: topUser.username,
      periodKey,
      voteCount,
      points: topUser.weeklyPoints
    }
  }
}

// ===== MONTHLY RECOGNITION (Run 1st of month) =====

export async function processMonthlyRecognition() {
  const periodKey = getPreviousMonthKey()
  console.log(`[RECOGNITION] Processing monthly recognition for ${periodKey}`)
  
  // 1. Get monthly leaderboard (already excludes admins)
  const { data: monthlyBoard } = await getMonthlyLeaderboard(1)
  
  if (!monthlyBoard || monthlyBoard.length === 0) {
    console.log('[RECOGNITION] No monthly data found')
    return { success: true, recognized: null, reason: 'no_data' }
  }
  
  const topUser = monthlyBoard[0]
  
  // 2. Check minimum participation
  const monthStart = getBangkokMonthStart()
  const { count: voteCount } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', topUser.id)
    .gte('created_at', monthStart)
  
  if ((voteCount || 0) < RECOGNITION_CONFIG.monthly.minVotes) {
    console.log(`[RECOGNITION] Top user ${topUser.username} has only ${voteCount} votes, minimum is ${RECOGNITION_CONFIG.monthly.minVotes}`)
    return { success: true, recognized: null, reason: 'below_minimum', voteCount }
  }
  
  // 3. Check if already recognized
  const alreadyRecognized = await hasReceivedRecognition(
    topUser.id, 
    RECOGNITION_CONFIG.monthly.type, 
    periodKey
  )
  
  if (alreadyRecognized) {
    console.log(`[RECOGNITION] User ${topUser.username} already recognized for ${periodKey}`)
    return { success: true, recognized: null, reason: 'already_recognized' }
  }
  
  // 4. Send recognition notification (Private, no ranking language)
  await createNotification({
    userId: topUser.id,
    type: 'monthly_recognition',
    message: '📈 เดือนที่ผ่านมาคุณมีส่วนร่วมอย่างสม่ำเสมอและมีคุณภาพ ขอบคุณที่เป็นส่วนสำคัญของชุมชน คิดว่า..!'
  })
  
  // 5. Record recognition
  await supabase
    .from('recognition_notifications')
    .insert([{
      user_id: topUser.id,
      recognition_type: RECOGNITION_CONFIG.monthly.type,
      period_key: periodKey,
      votes_in_period: voteCount,
      points_earned_in_period: topUser.monthlyPoints
    }])
  
  console.log(`[RECOGNITION] Monthly recognition sent to ${topUser.username}`)
  
  return { 
    success: true, 
    recognized: {
      userId: topUser.id,
      username: topUser.username,
      periodKey,
      voteCount,
      points: topUser.monthlyPoints
    }
  }
}

// ===== CRON JOB HANDLERS =====
// Schedule these via Vercel Cron, Railway, or similar

/*
// vercel.json example:
{
  "crons": [
    {
      "path": "/api/cron/weekly-recognition",
      "schedule": "0 1 * * 1"  // Monday 01:00 UTC (08:00 Bangkok)
    },
    {
      "path": "/api/cron/monthly-recognition", 
      "schedule": "0 1 1 * *"  // 1st of month 01:00 UTC
    }
  ]
}

// pages/api/cron/weekly-recognition.js
export default async function handler(req, res) {
  // Verify cron secret if needed
  const result = await processWeeklyRecognition()
  return res.json(result)
}

// pages/api/cron/monthly-recognition.js
export default async function handler(req, res) {
  const result = await processMonthlyRecognition()
  return res.json(result)
}
*/

// ===== GET USER'S RECOGNITION HISTORY =====

export async function getUserRecognitionHistory(userId) {
  const { data, error } = await supabase
    .from('recognition_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
  
  return { data, error }
}
// ============================================================
// KIDWA: Admin 2FA (Multi-Factor Authentication)
// Add these functions to lib/supabase.js
// ============================================================
//
// วิธี Setup:
// 1. Supabase Dashboard → Authentication → Multi-Factor Authentication
// 2. Enable "TOTP" (Time-based One-Time Password)
// 3. Save changes
//
// ============================================================

// ===== MFA ENROLLMENT =====

/**
 * Start MFA enrollment - generates QR code for authenticator app
 * @returns {Promise<{qrCode: string, secret: string, factorId: string, error: Error|null}>}
 */
export async function enrollMFA() {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Kidwa Admin Authenticator'
    })
    
    if (error) {
      console.error('[MFA] Enroll error:', error)
      return { qrCode: null, secret: null, factorId: null, error }
    }
    
    return { 
      qrCode: data.totp.qr_code,      // Base64 QR code image
      secret: data.totp.secret,        // Manual entry key
      factorId: data.id,               // Factor ID (save this!)
      error: null 
    }
  } catch (err) {
    console.error('[MFA] Enroll exception:', err)
    return { qrCode: null, secret: null, factorId: null, error: err }
  }
}

/**
 * Verify MFA enrollment with code from authenticator app
 * @param {string} factorId - Factor ID from enrollMFA
 * @param {string} code - 6-digit code from authenticator
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function verifyMFAEnrollment(factorId, code) {
  try {
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId
    })
    
    if (challengeError) {
      return { success: false, error: challengeError }
    }
    
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code
    })
    
    if (error) {
      return { success: false, error }
    }
    
    console.log('[MFA] Enrollment verified successfully')
    return { success: true, error: null }
  } catch (err) {
    console.error('[MFA] Verify enrollment exception:', err)
    return { success: false, error: err }
  }
}

// ===== MFA VERIFICATION (Login) =====

/**
 * Create MFA challenge for login
 * @param {string} factorId - Factor ID
 * @returns {Promise<{challengeId: string, error: Error|null}>}
 */
export async function challengeMFA(factorId) {
  try {
    const { data, error } = await supabase.auth.mfa.challenge({
      factorId
    })
    
    if (error) {
      return { challengeId: null, error }
    }
    
    return { challengeId: data.id, error: null }
  } catch (err) {
    return { challengeId: null, error: err }
  }
}

/**
 * Verify MFA code during login
 * @param {string} factorId - Factor ID
 * @param {string} challengeId - Challenge ID from challengeMFA
 * @param {string} code - 6-digit code
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function verifyMFA(factorId, challengeId, code) {
  try {
    const { data, error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code
    })
    
    if (error) {
      return { success: false, error }
    }
    
    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err }
  }
}

// ===== MFA STATUS =====

/**
 * Get current MFA status for user
 * @returns {Promise<{hasMFA: boolean, currentLevel: string, needsMFA: boolean, factors: Array, error: Error|null}>}
 */
export async function getMFAStatus() {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    
    if (error) {
      return { hasMFA: false, currentLevel: null, needsMFA: false, factors: [], error }
    }
    
    // aal1 = password only
    // aal2 = MFA verified
    const hasMFA = data.currentLevel === 'aal2'
    const needsMFA = data.nextLevel === 'aal2' && data.currentLevel === 'aal1'
    
    return { 
      hasMFA,
      currentLevel: data.currentLevel,
      nextLevel: data.nextLevel,
      needsMFA,
      factors: data.currentAuthenticationMethods || [],
      error: null 
    }
  } catch (err) {
    return { hasMFA: false, currentLevel: null, needsMFA: false, factors: [], error: err }
  }
}

/**
 * List all enrolled MFA factors
 * @returns {Promise<{factors: Array, error: Error|null}>}
 */
export async function listMFAFactors() {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors()
    
    if (error) {
      return { factors: [], error }
    }
    
    // Filter to only verified TOTP factors
    const verifiedFactors = (data.totp || []).filter(f => f.status === 'verified')
    
    return { factors: verifiedFactors, error: null }
  } catch (err) {
    return { factors: [], error: err }
  }
}

/**
 * Remove MFA factor
 * @param {string} factorId - Factor ID to remove
 * @returns {Promise<{success: boolean, error: Error|null}>}
 */
export async function unenrollMFA(factorId) {
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId })
    
    if (error) {
      return { success: false, error }
    }
    
    console.log('[MFA] Factor unenrolled:', factorId)
    return { success: true, error: null }
  } catch (err) {
    return { success: false, error: err }
  }
}

// ===== MFA GUARDS =====

/**
 * Check if current session has MFA verified
 * Use this to protect admin actions
 * @returns {Promise<{authorized: boolean, reason: string|null}>}
 */
export async function requireMFA() {
  const { hasMFA, currentLevel, needsMFA } = await getMFAStatus()
  
  if (needsMFA) {
    return { 
      authorized: false, 
      reason: 'MFA_REQUIRED',
      message: 'กรุณายืนยัน 2FA ก่อนดำเนินการ'
    }
  }
  
  if (currentLevel !== 'aal2') {
    // Check if user has MFA set up
    const { factors } = await listMFAFactors()
    
    if (factors.length === 0) {
      return { 
        authorized: false, 
        reason: 'MFA_NOT_ENROLLED',
        message: 'กรุณาตั้งค่า 2FA ก่อนใช้งาน Admin Panel'
      }
    }
    
    return { 
      authorized: false, 
      reason: 'MFA_NOT_VERIFIED',
      message: 'กรุณายืนยัน 2FA ก่อนดำเนินการ'
    }
  }
  
  return { authorized: true, reason: null, message: null }
}

/**
 * Check if user is admin AND has MFA verified
 * @param {string} userId - User ID to check
 * @returns {Promise<{authorized: boolean, reason: string|null}>}
 */
export async function requireAdminWithMFA(userId) {
  // 1. Check MFA
  const mfaCheck = await requireMFA()
  if (!mfaCheck.authorized) {
    return mfaCheck
  }
  
  // 2. Check admin role
  const { data: user, error } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .single()
  
  if (error || !user?.is_admin) {
    return { 
      authorized: false, 
      reason: 'NOT_ADMIN',
      message: 'คุณไม่มีสิทธิ์ Admin'
    }
  }
  
  return { authorized: true, reason: null, message: null }
}

// ===== PROTECTED ADMIN FUNCTIONS =====

/**
 * Resolve poll with MFA protection
 * Example of how to wrap admin functions
 */
export async function resolvePollWithMFA(pollId, correctOptionId, adminId) {
  // 1. Verify admin + MFA
  const authCheck = await requireAdminWithMFA(adminId)
  if (!authCheck.authorized) {
    return { error: { message: authCheck.message, code: authCheck.reason } }
  }
  
  // 2. Log admin action
  await logAdminAction(adminId, 'resolve_poll_mfa', 'poll', pollId, {
    correctOptionId,
    mfaVerified: true
  })
  
  // 3. Proceed with resolution
  // ... call existing resolvePoll function ...
  
  return { success: true }
}
// ============================================================
// KIDWA: Vote History Functions
// Add to lib/supabase.js
// ============================================================

// ===== GET VOTE HISTORY FOR CHART =====

/**
 * Get historical vote distribution for a resolved poll
 * @param {string} pollId - Poll ID
 * @param {string} resolution - '6h' | 'daily' | 'monthly'
 * @returns {Promise<{data: Array, error: Error}>}
 */
export async function getVoteHistory(pollId, resolution = 'daily') {
  try {
    // Get snapshots
    const { data: snapshots, error: snapshotError } = await supabase
      .from('vote_snapshots')
      .select('*')
      .eq('poll_id', pollId)
      .eq('resolution', resolution)
      .order('snapshot_time', { ascending: true })
    
    if (snapshotError) throw snapshotError
    
    // Get options for this poll
    const { data: options, error: optionError } = await supabase
      .from('options')
      .select('id, text')
      .eq('poll_id', pollId)
      .order('created_at', { ascending: true })
    
    if (optionError) throw optionError
    
    // Get poll info (for correct answer)
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('correct_option_id, question')
      .eq('id', pollId)
      .single()
    
    if (pollError) throw pollError
    
    // Transform data for chart
    const chartData = snapshots.map(snapshot => {
      const point = {
        time: snapshot.snapshot_time,
        totalVotes: snapshot.total_votes,
      }
      
      // Add percentage for each option
      options.forEach(opt => {
        const optData = snapshot.distribution[opt.id]
        point[opt.id] = optData ? parseFloat(optData.percentage) : 0
        point[`${opt.id}_count`] = optData ? parseInt(optData.count) : 0
      })
      
      return point
    })
    
    return {
      data: {
        chartData,
        options: options.map(o => ({
          ...o,
          isCorrect: o.id === poll.correct_option_id
        })),
        question: poll.question
      },
      error: null
    }
  } catch (err) {
    console.error('[Vote History] Error:', err)
    return { data: null, error: err }
  }
}

/**
 * Get available resolutions for a poll
 * (Check which resolutions have data)
 */
export async function getAvailableResolutions(pollId) {
  try {
    const { data, error } = await supabase
      .from('vote_snapshots')
      .select('resolution')
      .eq('poll_id', pollId)
    
    if (error) throw error
    
    const resolutions = [...new Set(data.map(d => d.resolution))]
    
    return {
      data: {
        has6h: resolutions.includes('6h'),
        hasDaily: resolutions.includes('daily'),
        hasMonthly: resolutions.includes('monthly'),
      },
      error: null
    }
  } catch (err) {
    return { data: null, error: err }
  }
}

/**
 * Manually trigger snapshot generation for a poll
 * (Admin use - normally auto-triggered on resolve)
 */
export async function regenerateSnapshots(pollId) {
  try {
    const { data, error } = await supabase
      .rpc('generate_poll_snapshots', { p_poll_id: pollId })
    
    if (error) throw error
    
    return { count: data, error: null }
  } catch (err) {
    console.error('[Vote History] Regenerate error:', err)
    return { count: 0, error: err }
  }
}

// ===== CHART COLOR HELPERS =====

// Consistent colors for options (up to 10)
const CHART_COLORS = [
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#84CC16', // Lime
  '#EC4899', // Pink
  '#6366F1', // Indigo
]

export function getChartColor(index) {
  return CHART_COLORS[index % CHART_COLORS.length]
}

// Lighter version for area fill
export function getChartColorLight(index, opacity = 0.3) {
  const color = CHART_COLORS[index % CHART_COLORS.length]
  return `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
}
