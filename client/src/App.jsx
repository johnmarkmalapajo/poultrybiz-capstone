import './App.css'
import logo from './assets/logo.png'


function App() {
  return (
    <div className="container">
      
      <div className="wcard">
        <img src={logo} alt="PoultryBiz Logo" className="logo" />

        <p className="subtitle">
          Egginear Agri–Poultry Solutions
        </p>

        <h1 className="title">POULTRYBIZ</h1>

        <p className="tagline">
          Smart Farming. Pure Poultry. Honest Quality.
        </p>

        <button className="btn" onClick={() => window.location.href = '/login'}>
          Get Started
        </button>
      </div>

    </div>
  )
}

export default App