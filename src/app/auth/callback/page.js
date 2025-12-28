'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('กำลังยืนยัน...')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          setStatus('error')
          setMessage('เกิดข้อผิดพลาด: ' + error.message)
          return
        }

        if (session) {
          // ดึงข้อมูล user จาก users table
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('auth_id', session.user.id)
            .single()

          if (userData) {
            // อัพเดท email_verified
            if (session.user.email_confirmed_at && !userData.email_verified) {
              await supabase
                .from('users')
                .update({ email_verified: true })
                .eq('id', userData.id)
              userData.email_verified = true
            }

            // เก็บข้อมูล user ใน localStorage
            localStorage.setItem('kidwa-user', JSON.stringify(userData))
            
            setStatus('success')
            setMessage('✅ ยืนยันสำเร็จ! กำลังพาไปหน้าหลัก...')
            
            setTimeout(() => {
              router.push('/')
            }, 1500)
          } else {
            // กรณีมี auth แต่ไม่มี user record (สำหรับ Magic Link login ครั้งแรก)
            // ต้องสร้าง user record
            const username = session.user.user_metadata?.username || session.user.email?.split('@')[0]
            
            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert([{
                username: username,
                email: session.user.email,
                auth_id: session.user.id,
                email_verified: !!session.user.email_confirmed_at,
                reputation: 1000
              }])
              .select()
              .single()

            if (newUser) {
              localStorage.setItem('kidwa-user', JSON.stringify(newUser))
              setStatus('success')
              setMessage('✅ สมัครสมาชิกสำเร็จ! กำลังพาไปหน้าหลัก...')
              
              setTimeout(() => {
                router.push('/')
              }, 1500)
            } else {
              setStatus('error')
              setMessage('เกิดข้อผิดพลาดในการสร้างบัญชี')
            }
          }
        } else {
          setStatus('error')
          setMessage('ไม่พบ session กรุณาลองใหม่')
        }
      } catch (err) {
        setStatus('error')
        setMessage('เกิดข้อผิดพลาด: ' + err.message)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)',
      fontFamily: 'Noto Sans Thai, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '3rem',
        textAlign: 'center',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '90%'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
          {status === 'loading' && '⏳'}
          {status === 'success' && '🎉'}
          {status === 'error' && '❌'}
        </div>
        
        <h1 style={{ 
          fontSize: '1.5rem', 
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          คิดว่า..
        </h1>
        
        <p style={{ 
          color: status === 'error' ? '#ef4444' : '#666',
          fontSize: '1rem'
        }}>
          {message}
        </p>

        {status === 'error' && (
          <button
            onClick={() => router.push('/')}
            style={{
              marginTop: '1.5rem',
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #ec4899, #f43f5e)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: '600'
            }}
          >
            กลับหน้าหลัก
          </button>
        )}
      </div>
    </div>
  )
}
