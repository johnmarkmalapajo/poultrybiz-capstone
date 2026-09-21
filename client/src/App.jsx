import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './App.css'
import logo from './assets/logo.png'

const INITIAL_LOADING_MS = 2000

function App() {
  const [isNavigating, setIsNavigating] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true)
    }, INITIAL_LOADING_MS)

    return () => clearTimeout(timer)
  }, [])

  const handleGetStarted = () => {
    setIsNavigating(true)
    setTimeout(() => {
      navigate('/login')
    }, 600)
  }

  const showDots = isNavigating || !isReady

  return (
    <div className="container">

      <div className="wcard">
        <img
          src={logo}
          alt="PoultryBiz Logo"
          className={`logo ${showDots ? 'logo-loading' : ''}`}
        />

        <p className="subtitle">
          Egginear Agri–Poultry Solutions
        </p>

        <h1 className="title">POULTRYBIZ</h1>

        <p className="tagline">
          Smart Farming. Pure Poultry. Honest Quality.
        </p>

        {showDots ? (
          <div className="dots-wrap">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
        ) : (
          <button className="btn" onClick={handleGetStarted}>
            Get Started
          </button>
        )}
      </div>

    </div>
  )
}

export default App