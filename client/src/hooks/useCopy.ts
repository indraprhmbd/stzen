import { useState } from 'react'
import { copy } from '../config/copy'

type Lang = 'id' | 'en'

const STORAGE_KEY = 'stzen-lang'

export function useCopy() {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Lang) || 'id'
  })

  const toggle = () => {
    const next = lang === 'id' ? 'en' : 'id'
    setLang(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  return { t: copy[lang], lang, toggle }
}
