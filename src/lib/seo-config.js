// Kidwa SEO Configuration
// Based on Gemini's SEO Blueprint

export const siteConfig = {
  name: 'คิดว่า.. (Kidwa)',
  description: 'แพลตฟอร์มวิเคราะห์และทำนายผลลัพธ์ ร่วมแสดงมุมมองและสะสม Reputation จากความแม่นยำของคุณ',
  url: 'https://i-kidwa.com',
  ogImage: '/og-image.png',
  links: {
    twitter: 'https://twitter.com/kidwa_th',
  },
}

// Generate metadata for a poll page
export function generatePollMetadata(poll) {
  const title = `คิดว่า.. ${poll.question} | วิเคราะห์แม่นยำที่ Kidwa`
  const description = `ร่วมวิเคราะห์ "${poll.question}" กับสังคมไทย ดู Consensus ล่าสุด และสะสม Reputation จากความแม่นยำของคุณที่ Kidwa (คิดว่า..)`
  
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${siteConfig.url}/poll/${poll.id}`,
      images: [
        {
          url: poll.image_url || siteConfig.ogImage,
          width: 1200,
          height: 630,
          alt: poll.question,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [poll.image_url || siteConfig.ogImage],
    },
  }
}

// Generate JSON-LD structured data for a poll
export function generatePollStructuredData(poll) {
  const totalVotes = poll.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0
  
  return {
    '@context': 'https://schema.org',
    '@type': 'Question',
    name: `คิดว่า.. ${poll.question}`,
    text: poll.description || poll.question,
    answerCount: totalVotes,
    dateCreated: poll.created_at,
    suggestedAnswer: poll.options?.map(opt => ({
      '@type': 'Answer',
      text: opt.text,
      upvoteCount: opt.votes,
    })),
  }
}

// Site-wide metadata
export const defaultMetadata = {
  title: {
    default: 'คิดว่า.. (Kidwa) | แพลตฟอร์มวิเคราะห์และทำนายผลลัพธ์',
    template: '%s | Kidwa',
  },
  description: siteConfig.description,
  keywords: [
    'คิดว่า',
    'Kidwa', 
    'prediction',
    'analysis',
    'วิเคราะห์',
    'ทำนาย',
    'โพล',
    'poll',
    'consensus',
    'reputation',
    'Thailand',
    'ไทย'
  ],
  authors: [{ name: 'Kidwa Team' }],
  creator: 'Kidwa',
  publisher: 'Kidwa',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type: 'website',
    locale: 'th_TH',
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: 'คิดว่า.. Kidwa',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteConfig.name,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: '@kidwa_th',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
}

// GA4 Event tracking helpers
export const trackEvent = (eventName, params = {}) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params)
  }
}

export const GA_EVENTS = {
  VIEW_POLL: 'view_poll',
  VOTE_CAST: 'vote_cast',
  REPUTATION_GAIN: 'reputation_gain',
  SHARE_POLL: 'share_poll',
  POLL_CREATED: 'poll_created',
  USER_SIGNUP: 'user_signup',
}

// Track poll view
export const trackPollView = (poll) => {
  trackEvent(GA_EVENTS.VIEW_POLL, {
    poll_id: poll.id,
    category: poll.category,
    poll_type: poll.poll_type,
  })
}

// Track vote
export const trackVote = (poll, conviction) => {
  trackEvent(GA_EVENTS.VOTE_CAST, {
    poll_id: poll.id,
    category: poll.category,
    conviction: conviction === 20 ? 'low' : conviction === 100 ? 'high' : 'medium',
  })
}

// Track share
export const trackShare = (poll, platform) => {
  trackEvent(GA_EVENTS.SHARE_POLL, {
    poll_id: poll.id,
    platform,
  })
}
