import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// My Profile > Text Size. Every `font-size` in the app's CSS is multiplied
// by the --pb-text-scale variable (set on <html> from the signed-in user's
// saved Text Size, 1 = Default), so the whole system -- Dashboard, tables,
// forms, buttons, dropdowns, notifications, cards -- follows one setting,
// immediately and without a refresh. Only font sizes change; layout widths
// and the responsive breakpoints stay exactly as they are.
// Values already relative to their parent (em, %, keywords) follow
// automatically and are left alone, so nothing is scaled twice.
const scaleFontSizes = () => ({
  postcssPlugin: 'pb-text-scale',
  Declaration: {
    'font-size': (decl) => {
      const value = decl.value.trim()
      if (value.includes('--pb-text-scale')) return
      if (!/px|var\(/i.test(value)) return
      decl.value = `calc(${value} * var(--pb-text-scale, 1))`
    },
  },
})
scaleFontSizes.postcss = true

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [scaleFontSizes()],
    },
  },
})