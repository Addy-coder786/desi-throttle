import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// phones and tablets get on-screen riding controls (see the `touch` variant in index.css)
const coarse = window.matchMedia('(pointer: coarse)')
const markTouch = () => document.documentElement.classList.toggle('touch', coarse.matches)
markTouch()
coarse.addEventListener?.('change', markTouch)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
