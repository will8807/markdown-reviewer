import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getThemePreference,
  setThemePreference,
  applyTheme,
  type ThemePreference,
} from '@/lib/theme/themePreference'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('getThemePreference', () => {
  it('returns "system" when nothing is stored', () => {
    expect(getThemePreference()).toBe('system')
  })

  it('returns the stored preference', () => {
    setThemePreference('dark')
    expect(getThemePreference()).toBe('dark')

    setThemePreference('light')
    expect(getThemePreference()).toBe('light')

    setThemePreference('system')
    expect(getThemePreference()).toBe('system')
  })

  it('returns "system" for an unrecognised stored value', () => {
    localStorage.setItem('markdown-reviewer:theme', 'invalid')
    expect(getThemePreference()).toBe('system')
  })
})

describe('setThemePreference', () => {
  it('persists the preference across reads', () => {
    setThemePreference('dark')
    expect(getThemePreference()).toBe('dark')
  })
})

describe('applyTheme', () => {
  it('adds "dark" class for dark preference', () => {
    applyTheme('dark', false)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes "dark" class for light preference', () => {
    document.documentElement.classList.add('dark')
    applyTheme('light', false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('adds "dark" class for system preference when OS is dark', () => {
    applyTheme('system', true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes "dark" class for system preference when OS is light', () => {
    document.documentElement.classList.add('dark')
    applyTheme('system', false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('dark preference ignores the OS preference argument', () => {
    applyTheme('dark', false)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('light preference ignores the OS preference argument', () => {
    applyTheme('light', true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
