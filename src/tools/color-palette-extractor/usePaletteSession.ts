import { useReducer, type Dispatch } from 'react'
import type { PaletteColor } from '@/services/tauri'

export interface SessionState {
  baseline: PaletteColor[]
  present: PaletteColor[]
  past: PaletteColor[][]
  future: PaletteColor[][]
}

export type SessionAction =
  | { type: 'replace'; colors: PaletteColor[] }
  | { type: 'move'; index: number; color: PaletteColor }
  | { type: 'commitMove'; before: PaletteColor[] }
  | { type: 'add'; color: PaletteColor }
  | { type: 'remove'; index: number }
  | { type: 'moveUp'; index: number }
  | { type: 'moveDown'; index: number }
  | { type: 'edit'; index: number; color: PaletteColor }
  | { type: 'reset' }
  | { type: 'undo' }
  | { type: 'redo' }

const initial: SessionState = { baseline: [], present: [], past: [], future: [] }
const MAX_HISTORY = 100

function sameColor(a: PaletteColor, b: PaletteColor): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.x === b.x && a.y === b.y
}

export function colorsEqual(a: PaletteColor[], b: PaletteColor[]): boolean {
  return a.length === b.length && a.every((color, index) => sameColor(color, b[index]))
}

function sameColors(a: PaletteColor[], b: PaletteColor[]): boolean {
  return colorsEqual(a, b)
}

function appendHistory(history: PaletteColor[][], colors: PaletteColor[]): PaletteColor[][] {
  return [...history, colors].slice(-MAX_HISTORY)
}

function commit(state: SessionState, next: PaletteColor[]): SessionState {
  if (sameColors(state.present, next)) return state
  return { ...state, present: next, past: appendHistory(state.past, state.present), future: [] }
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'replace':
      return { baseline: action.colors, present: action.colors, past: [], future: [] }
    case 'move': {
      const next = state.present.slice()
      next[action.index] = action.color
      return { ...state, present: next }
    }
    case 'commitMove': {
      if (sameColors(action.before, state.present)) return state
      return { ...state, past: appendHistory(state.past, action.before), future: [] }
    }
    case 'add':
      return commit(state, [...state.present, action.color])
    case 'remove':
      return commit(state, state.present.filter((_, index) => index !== action.index))
    case 'moveUp': {
      if (action.index <= 0) return state
      const next = state.present.slice()
      ;[next[action.index - 1], next[action.index]] = [next[action.index], next[action.index - 1]]
      return commit(state, next)
    }
    case 'moveDown': {
      if (action.index >= state.present.length - 1) return state
      const next = state.present.slice()
      ;[next[action.index], next[action.index + 1]] = [next[action.index + 1], next[action.index]]
      return commit(state, next)
    }
    case 'edit': {
      const next = state.present.slice()
      next[action.index] = action.color
      return commit(state, next)
    }
    case 'reset':
      return commit(state, state.baseline)
    case 'undo': {
      if (state.past.length === 0) return state
      const previous = state.past[state.past.length - 1]
      return {
        ...state,
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
      }
    }
    case 'redo': {
      if (state.future.length === 0) return state
      const next = state.future[0]
      return {
        ...state,
        present: next,
        past: appendHistory(state.past, state.present),
        future: state.future.slice(1),
      }
    }
  }
}

export type SessionDispatch = Dispatch<SessionAction>

export function usePaletteSession(): [SessionState, SessionDispatch] {
  return useReducer(sessionReducer, initial)
}
