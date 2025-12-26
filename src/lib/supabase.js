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
    .insert([{ username, reputation: 1000, streak: 0 }])
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

export async function getPollsByCategory(category) {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*)')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(20)
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

export async function searchTags(query) {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(10)
  return { data, error }
}

export async function createTag(name) {
  const { data: existing } = await supabase
    .from('tags')
    .select('*')
    .eq('name', name.toLowerCase().trim())
    .single()
  
  if (existing) {
    return { data: existing, error: null }
  }
  
  const { data, error } = await supabase
    .from('tags')
    .insert([{ name: name.toLowerCase().trim() }])
    .select()
    .single()
  return { data, error }
}

export async function createPoll({ 
  question, 
  options, 
  category, 
  tags, 
  blindMode, 
  endsAt, 
  pollType,
  createdBy 
}) {
  try {
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .insert([{
        question,
        category,
        blind_mode: blindMode,
        poll_type: pollType || 'prediction',
        ends_at: endsAt,
        created_by: createdBy,
        featured: false,
        resolved: false
      }])
      .select()
      .single()
    
    if (pollError) throw pollError

    const optionsData = options.map(opt => ({
      poll_id: poll.id,
      text: opt,
      votes: 0
    }))
    
    const { error: optionsError } = await supabase
      .from('options')
      .insert(optionsData)
    
    if (optionsError) throw optionsError

    if (tags && tags.length > 0) {
      const tagLinks = tags.map(tagId => ({
        poll_id: poll.id,
        tag_id: tagId
      }))
      
      await supabase
        .from('poll_tags')
        .insert(tagLinks)
    }

    return { data: poll, error: null }
  } catch (error) {
    console.error('Error creating poll:', error)
    return { data: null, error }
  }
}

export async function getUserPolls(userId) {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*)')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
  return { data, error }
}

// ===== ฟังก์ชัน Admin =====

// ดึงโพลทั้งหมดสำหรับ Admin
export async function getAllPollsAdmin() {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*)')
    .order('created_at', { ascending: false })
  return { data, error }
}

// ดึงโพลที่รอเฉลย
export async function getPendingPolls() {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*)')
    .eq('resolved', false)
    .order('ends_at', { ascending: true })
  return { data, error }
}

// เฉลยโพล
export async function resolvePoll(pollId, correctOptionId) {
  try {
    // อัพเดท poll
    const { error: pollError } = await supabase
      .from('polls')
      .update({ 
        resolved: true, 
        correct_option_id: correctOptionId,
        resolved_at: new Date().toISOString()
      })
      .eq('id', pollId)
    
    if (pollError) throw pollError

    // ดึง votes ทั้งหมดของ poll นี้
    const { data: votes } = await supabase
      .from('votes')
      .select('user_id, option_id, confidence')
      .eq('poll_id', pollId)

    // อัพเดท reputation แต่ละ user
    for (const vote of votes || []) {
      const change = vote.option_id === correctOptionId ? vote.confidence : -vote.confidence
      
      // ดึง reputation ปัจจุบัน
      const { data: userData } = await supabase
        .from('users')
        .select('reputation')
        .eq('id', vote.user_id)
        .single()
      
      if (userData) {
        const newRep = Math.max(0, userData.reputation + change)
        await supabase
          .from('users')
          .update({ reputation: newRep })
          .eq('id', vote.user_id)
      }
    }

    return { error: null }
  } catch (error) {
    console.error('Error resolving poll:', error)
    return { error }
  }
}

// ลบโพล
export async function deletePoll(pollId) {
  try {
    // ลบ votes ก่อน
    await supabase.from('votes').delete().eq('poll_id', pollId)
    // ลบ poll_tags
    await supabase.from('poll_tags').delete().eq('poll_id', pollId)
    // ลบ options
    await supabase.from('options').delete().eq('poll_id', pollId)
    // ลบ poll
    const { error } = await supabase
      .from('polls')
      .delete()
      .eq('id', pollId)
    return { error }
  } catch (error) {
    return { error }
  }
}

// ดึง users ทั้งหมด
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('reputation', { ascending: false })
  return { data, error }
}

// แบน/ปลดแบน user
export async function toggleBanUser(userId, isBanned) {
  const { error } = await supabase
    .from('users')
    .update({ is_banned: isBanned })
    .eq('id', userId)
  return { error }
}

// ตั้ง/ยกเลิก featured poll
export async function toggleFeatured(pollId, featured) {
  const { error } = await supabase
    .from('polls')
    .update({ featured })
    .eq('id', pollId)
  return { error }
}

// ดึงสถิติสำหรับ Admin Dashboard
export async function getAdminStats() {
  const { data: polls } = await supabase.from('polls').select('id, resolved, ends_at')
  const { data: users } = await supabase.from('users').select('id')
  const { data: votes } = await supabase.from('votes').select('id')

  const now = new Date()
  const expiredUnresolved = polls?.filter(p => !p.resolved && new Date(p.ends_at) < now).length || 0
  const activePolls = polls?.filter(p => !p.resolved && new Date(p.ends_at) >= now).length || 0
  const resolvedPolls = polls?.filter(p => p.resolved).length || 0

  return {
    totalPolls: polls?.length || 0,
    activePolls,
    expiredUnresolved,
    resolvedPolls,
    totalUsers: users?.length || 0,
    totalVotes: votes?.length || 0
  }
}
