# คิดว่า.. (Kidwa)

> ไม่ใช่แค่โหวต แต่เป็นเกมพิสูจน์ว่าคุณรู้อนาคต

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Supabase account

### Installation

1. Clone the repository
```bash
git clone https://github.com/kidwa-ui/kidwa.git
cd kidwa
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Run development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React 18
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Hosting:** Vercel

## 📝 Features

- ✅ 15 Categories
- ✅ Blind Mode
- ✅ Reputation System
- ✅ Leaderboard (All-time, Weekly, Monthly)
- ✅ Dark Mode
- ✅ Time Capsule
- ✅ Live Battle
- ✅ Notifications
- ✅ Admin Audit Logs

---

## ⚠️ Known Constraints & Design Decisions

> เอกสารนี้มีไว้สำหรับ future developer (รวมถึง future Claude) เพื่อลดการแก้ไขผิดพลาด

### 1. ⏰ Live Battle Timezone Workaround

**ปัญหาเดิม:**  
เมื่อ user เลือกเวลาสิ้นสุด 20:00 Bangkok → DB เก็บเป็น UTC → แสดงผลผิด (เพี้ยน 7 ชม.)

**วิธีแก้ที่ใช้:**
```javascript
// createLiveBattleV2() - supabase.js
const adjustedEndsAt = new Date(bangkokDateTime.getTime() + (BANGKOK_OFFSET_HOURS * 60 * 60 * 1000))
```

**ทำไมบวก +7 ไม่ใช่ลบ:**  
- ผ่านการทดสอบจริงหลายรอบ ✅
- Logic อาจดูผิด แต่ทำงานถูกต้อง
- **⛔ ห้ามแก้ไข timezone logic โดยไม่ทดสอบจริง**

---

### 2. 👑 Admin Excluded from Leaderboards

**เหตุผล:**
- Admin = Operator ไม่ใช่ผู้เล่นแข่งขัน
- มีอำนาจ resolve โพล → ได้เปรียบ unfair
- ป้องกัน conflict of interest

**Implementation:**
```javascript
// getLeaderboard(), getWeeklyLeaderboard(), getMonthlyLeaderboard()
.eq('is_admin', false)  // Exclude admins
```

**หมายเหตุ:**  
- Admin ยังได้รับ reputation ตามปกติ (สำหรับ internal testing)
- แค่ไม่แสดงใน public leaderboard

---

### 3. 🔒 Blind Mode Realtime Isolation

**ปัญหา:**  
Blind mode polls ควรไม่เห็น vote count จนกว่าจะ resolve แต่ global realtime subscription อัพเดททุก poll

**วิธีแก้:**
```javascript
// Realtime subscription filter
setPolls(prev => prev.map(poll => {
  // Blind mode integrity: Don't update vote counts until resolved
  if (poll.blind_mode && !poll.resolved) return poll
  // ... update normally
}))
```

**ผลลัพธ์:**
- UI ซ่อน vote counts สำหรับ blind polls
- State ไม่อัพเดทจาก realtime จนกว่า resolve
- ป้องกันการ "เดา" จาก behavior ของระบบ

---

### 4. 🛡️ Server-Side Vote Validation

**ทำไมต้องมี:**
- Client-side validation bypass ได้ง่าย
- ป้องกัน vote หลังหมดเวลา
- ป้องกัน vote โพลที่ resolve แล้ว

**Implementation:**
```javascript
// vote() - supabase.js
if (new Date() > new Date(poll.ends_at)) 
  return { error: { message: 'โพลนี้หมดเวลาแล้ว' } }
if (poll.resolved) 
  return { error: { message: 'โพลนี้ถูกเฉลยแล้ว' } }
```

---

### 5. 🔄 Vote Count via DB Trigger (Not RPC)

**ปัญหาเดิม:**
- ใช้ `supabase.rpc('increment')` แต่ไม่มี function นี้ใน DB
- Vote count อาจไม่ถูกต้อง

**วิธีแก้:**
- สร้าง DB trigger `trigger_update_vote_count`
- Auto increment/decrement เมื่อ INSERT/UPDATE/DELETE votes
- **ต้อง run `VOTE_TRIGGER.sql` ก่อนใช้งาน**

---

### 6. 🏷️ Tags via Junction Table

**ปัญหา:**
- Supabase `tags(*)` ไม่ทำงานกับ many-to-many relation
- Tags ไม่ load มาพร้อม polls

**วิธีแก้:**
```javascript
// getPolls(), getLiveBattles(), etc.
// Query tags ผ่าน poll_tags junction table
const { data: pollTags } = await supabase
  .from('poll_tags')
  .select('poll_id, tags(id, name)')
  .in('poll_id', pollIds)
```

---

### 7. 📊 Trending Tags Logic

**Algorithm:**
- Time window: 7 วัน
- Sort by: **vote count** (engagement) ไม่ใช่ poll count
- ป้องกัน single viral poll dominate

```javascript
// getTrendingTags()
.gte('polls.created_at', windowStart.toISOString())
// Aggregate total votes per tag
```

---

## 📁 Important Files

| File | Purpose |
|------|---------|
| `VOTE_TRIGGER.sql` | DB trigger for vote counts |
| `AUDIT_LOGS.sql` | Admin audit logging table |
| `CLEANUP_DATABASE.sql` | Wipe all data for fresh start |
| `SET_ADMIN.sql` | Set admin privileges |

---

## 🔐 Admin Functions (For Moderation)

```javascript
// View all votes on a poll (admin only)
await getVoteDetails(pollId, adminUserId)

// Get vote statistics (admin only)
await getVoteStatistics(pollId, adminUserId)

// View audit logs
await getAdminAuditLogs(50)
```

---

## 📄 License

MIT
