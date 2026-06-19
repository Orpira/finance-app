import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'finance-app:sensitive-values-hidden'
const CHANGE_EVENT = 'finance-app:sensitive-values-change'

function readPreference() {
  return localStorage.getItem(STORAGE_KEY) === 'true'
}

export function useSensitiveValues() {
  const [hidden, setHidden] = useState(readPreference)

  useEffect(() => {
    const handleChange = () => setHidden(readPreference())

    window.addEventListener(CHANGE_EVENT, handleChange)
    window.addEventListener('storage', handleChange)

    return () => {
      window.removeEventListener(CHANGE_EVENT, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [])

  const toggle = useCallback(() => {
    const nextHidden = !readPreference()
    localStorage.setItem(STORAGE_KEY, String(nextHidden))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return { hidden, toggle }
}
