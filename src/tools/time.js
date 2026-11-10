export function currentTime(timeZone = 'Asia/Taipei', locale = 'zh-TW') {
  let zone = String(timeZone || 'Asia/Taipei')
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date())
  } catch {
    zone = 'UTC'
  }
  const now = new Date()
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(now)
  return {
    now: now.toISOString(),
    timeZone: zone,
    formatted,
  }
}