const USER_KEY_STORAGE_KEY = 'ipl_user_key'

export function getUserKey() {
  if (typeof window === 'undefined') {
    return ''
  }

  const existingKey = window.localStorage.getItem(USER_KEY_STORAGE_KEY)
  if (existingKey) {
    return existingKey
  }

  const newKey = window.crypto.randomUUID()
  window.localStorage.setItem(USER_KEY_STORAGE_KEY, newKey)
  return newKey
}
