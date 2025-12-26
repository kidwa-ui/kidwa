import './globals.css'

export const metadata = {
  title: 'คิดว่า.. | Prediction Platform',
  description: 'ไม่ใช่แค่โหวต แต่เป็นเกมพิสูจน์ว่าคุณรู้อนาคต',
}

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  )
}
