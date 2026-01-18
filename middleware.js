// ============================================================
// KIDWA: Rate Limiting Middleware
// File: middleware.js (ไว้ที่ root ของ project)
// ============================================================
//
// วิธี Setup Upstash Redis (ฟรี):
// 1. ไปที่ https://upstash.com/
// 2. สมัครด้วย GitHub หรือ Google
// 3. Create Database → เลือก Region ใกล้ๆ (Singapore)
// 4. Copy UPSTASH_REDIS_REST_URL และ UPSTASH_REDIS_REST_TOKEN
// 5. ใส่ใน .env.local:
//    UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
//    UPSTASH_REDIS_REST_TOKEN=xxx
//
// Install:
// npm install @upstash/ratelimit @upstash/redis
//
// ============================================================

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// ===== REDIS CONNECTION =====
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// ===== RATE LIMITERS =====

// General API rate limit
const generalLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests/นาที
  analytics: true,
  prefix: 'ratelimit:general',
})

// Vote rate limit (stricter)
const voteLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'), // 30 votes/นาที
  analytics: true,
  prefix: 'ratelimit:vote',
})

// Create poll rate limit (very strict)
const createPollLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'), // 5 polls/ชั่วโมง
  analytics: true,
  prefix: 'ratelimit:createpoll',
})

// Auth rate limit (prevent brute force)
const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '15 m'), // 10 attempts/15นาที
  analytics: true,
  prefix: 'ratelimit:auth',
})

// Admin actions rate limit
const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, '1 m'), // 50 actions/นาที
  analytics: true,
  prefix: 'ratelimit:admin',
})

// ===== HELPER FUNCTIONS =====

function getClientIP(request) {
  // Try various headers for real IP
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIP = request.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }
  
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  return 'unknown'
}

function getLimiterForPath(pathname) {
  // Vote endpoints
  if (pathname.includes('/vote') || pathname.includes('/cast')) {
    return { limiter: voteLimiter, name: 'vote' }
  }
  
  // Create poll endpoints
  if (pathname.includes('/poll/create') || pathname.includes('/createPoll')) {
    return { limiter: createPollLimiter, name: 'createpoll' }
  }
  
  // Auth endpoints
  if (pathname.includes('/auth') || pathname.includes('/login') || pathname.includes('/signup')) {
    return { limiter: authLimiter, name: 'auth' }
  }
  
  // Admin endpoints
  if (pathname.includes('/admin')) {
    return { limiter: adminLimiter, name: 'admin' }
  }
  
  // Default
  return { limiter: generalLimiter, name: 'general' }
}

// ===== MIDDLEWARE =====

export async function middleware(request) {
  // Skip rate limiting for static files
  const pathname = request.nextUrl.pathname
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // files with extensions
  ) {
    return NextResponse.next()
  }

  // Only rate limit API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next()
  }

  try {
    const ip = getClientIP(request)
    const { limiter, name } = getLimiterForPath(pathname)
    
    // Create unique identifier (IP + path type)
    const identifier = `${ip}:${name}`
    
    const { success, limit, remaining, reset } = await limiter.limit(identifier)

    // Add rate limit headers to response
    const response = success 
      ? NextResponse.next()
      : NextResponse.json(
          { 
            error: 'ขออภัย คุณส่งคำขอเร็วเกินไป กรุณารอสักครู่',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((reset - Date.now()) / 1000)
          },
          { status: 429 }
        )

    // Set rate limit headers
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', reset.toString())
    
    if (!success) {
      response.headers.set('Retry-After', Math.ceil((reset - Date.now()) / 1000).toString())
      
      // Log rate limit hit for monitoring
      console.warn(`[RATE LIMIT] ${ip} hit ${name} limit on ${pathname}`)
    }

    return response
    
  } catch (error) {
    // If Redis fails, allow request but log error
    console.error('[RATE LIMIT ERROR]', error)
    return NextResponse.next()
  }
}

// ===== MATCHER CONFIG =====
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
  ],
}
