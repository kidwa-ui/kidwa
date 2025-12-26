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

// ===== ฟังก์ชันใหม่สำหรับสร้างโพล =====

// ดึง tags ทั้งหมด
export async function getTags() {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true })
  return { data, error }
}

// ค้นหา tags
export async function searchTags(query) {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(10)
  return { data, error }
}

// สร้าง tag ใหม่
export async function createTag(name) {
  // เช็คว่ามีอยู่แล้วหรือไม่
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

// สร้างโพลใหม่
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
    // 1. สร้าง poll
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

    // 2. สร้าง options
    const optionsData = options.map(opt => ({
      poll_id: poll.id,
      text: opt,
      votes: 0
    }))
    
    const { error: optionsError } = await supabase
      .from('options')
      .insert(optionsData)
    
    if (optionsError) throw optionsError

    // 3. เชื่อม tags (ถ้ามี)
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

// ดึงโพลที่ user สร้าง
export async function getUserPolls(userId) {
  const { data, error } = await supabase
    .from('polls')
    .select('*, options(*), tags(*)')
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
  return { data, error }
}
