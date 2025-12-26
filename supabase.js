import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper functions

// Users
export async function getUser(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
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

export async function createUser(username, email = null) {
  const { data, error } = await supabase
    .from('users')
    .insert([{ username, email, reputation: 1000, streak: 0 }])
    .select()
    .single()
  return { data, error }
}

export async function updateUserReputation(userId, change) {
  const { data: user } = await getUser(userId)
  if (!user) return { error: 'User not found' }
  
  const newReputation = Math.max(0, user.reputation + change)
  const { data, error } = await supabase
    .from('users')
    .update({ reputation: newReputation })
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

// Polls
export async function getPolls(category = null, limit = 20) {
  let query = supabase
    .from('polls')
    .select(`
      *,
      options (*),
      tags (*),
      users!created_by (username)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (category && category !== 'home') {
    query = query.eq('category', category)
  }
  
  const { data, error } = await query
  return { data, error }
}

export async function getPoll(pollId) {
  const { data, error } = await supabase
    .from('polls')
    .select(`
      *,
      options (*),
      tags (*),
      comments (*, users (username)),
      users!created_by (username)
    `)
    .eq('id', pollId)
    .single()
  return { data, error }
}

export async function createPoll(pollData) {
  // Create poll
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .insert([{
      question: pollData.question,
      category: pollData.category,
      poll_type: pollData.type,
      blind_mode: pollData.blindMode,
      ends_at: pollData.endsAt,
      created_by: pollData.createdBy
    }])
    .select()
    .single()
  
  if (pollError) return { error: pollError }
  
  // Create options
  const optionsToInsert = pollData.options.map(text => ({
    poll_id: poll.id,
    text,
    votes: 0
  }))
  
  const { error: optionsError } = await supabase
    .from('options')
    .insert(optionsToInsert)
  
  if (optionsError) return { error: optionsError }
  
  // Create tags
  if (pollData.tags && pollData.tags.length > 0) {
    const tagsToInsert = pollData.tags.map(name => ({
      poll_id: poll.id,
      name
    }))
    await supabase.from('tags').insert(tagsToInsert)
  }
  
  return { data: poll }
}

export async function resolvePoll(pollId, correctOptionId) {
  const { data, error } = await supabase
    .from('polls')
    .update({ resolved: true, correct_option_id: correctOptionId })
    .eq('id', pollId)
    .select()
    .single()
  return { data, error }
}

// Votes
export async function vote(userId, pollId, optionId, confidence = 50) {
  // Check if already voted
  const { data: existingVote } = await supabase
    .from('votes')
    .select('*')
    .eq('user_id', userId)
    .eq('poll_id', pollId)
    .single()
  
  if (existingVote) {
    // Update existing vote
    // First decrease old option votes
    await supabase.rpc('decrement_votes', { option_id: existingVote.option_id })
    
    // Update vote record
    const { data, error } = await supabase
      .from('votes')
      .update({ option_id: optionId, confidence })
      .eq('id', existingVote.id)
      .select()
      .single()
    
    // Increment new option votes
    await supabase.rpc('increment_votes', { option_id: optionId })
    
    return { data, error }
  } else {
    // Create new vote
    const { data, error } = await supabase
      .from('votes')
      .insert([{ user_id: userId, poll_id: pollId, option_id: optionId, confidence }])
      .select()
      .single()
    
    // Increment option votes
    await supabase.rpc('increment_votes', { option_id: optionId })
    
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

// Comments
export async function addComment(pollId, userId, text) {
  const { data, error } = await supabase
    .from('comments')
    .insert([{ poll_id: pollId, user_id: userId, text }])
    .select(`*, users (username)`)
    .single()
  return { data, error }
}

// Notifications
export async function getNotifications(userId) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)
  return { data, error }
}

export async function createNotification(userId, type, message, points = null) {
  const { data, error } = await supabase
    .from('notifications')
    .insert([{ user_id: userId, type, message, points }])
    .select()
    .single()
  return { data, error }
}

// Follows
export async function followUser(followerId, followingId) {
  const { data, error } = await supabase
    .from('follows')
    .insert([{ follower_id: followerId, following_id: followingId }])
    .select()
    .single()
  return { data, error }
}

export async function unfollowUser(followerId, followingId) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  return { error }
}

export async function getFollowers(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select('*, users!follower_id (username, reputation)')
    .eq('following_id', userId)
  return { data, error }
}

export async function getFollowing(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select('*, users!following_id (username, reputation)')
    .eq('follower_id', userId)
  return { data, error }
}

// Leaderboard
export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('users')
    .select('id, username, reputation')
    .order('reputation', { ascending: false })
    .limit(limit)
  return { data, error }
}

// Badges
export async function getUserBadges(userId) {
  const { data, error } = await supabase
    .from('user_badges')
    .select('*')
    .eq('user_id', userId)
  return { data, error }
}

export async function awardBadge(userId, badgeName) {
  const { data, error } = await supabase
    .from('user_badges')
    .insert([{ user_id: userId, badge_name: badgeName }])
    .select()
    .single()
  return { data, error }
}
