import "./Card.css"

// ── Beautiful SVG Icons for each card ──
export const Icons = {
  flock: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Chicken body */}
      <ellipse cx="20" cy="26" rx="10" ry="8" fill="#f5a623"/>
      {/* Chicken head */}
      <circle cx="28" cy="16" r="6" fill="#f5a623"/>
      {/* Comb */}
      <ellipse cx="26" cy="11" rx="2" ry="3" fill="#e05555"/>
      <ellipse cx="29" cy="10" rx="2" ry="3" fill="#e05555"/>
      <ellipse cx="32" cy="11" rx="2" ry="3" fill="#e05555"/>
      {/* Beak */}
      <polygon points="34,16 38,18 34,20" fill="#f5c842"/>
      {/* Eye */}
      <circle cx="31" cy="15" r="1.5" fill="#333"/>
      <circle cx="31.5" cy="14.5" r="0.6" fill="#fff"/>
      {/* Wing */}
      <ellipse cx="14" cy="26" rx="5" ry="3" fill="#e8920f" transform="rotate(-20 14 26)"/>
      {/* Feet */}
      <line x1="17" y1="33" x2="15" y2="38" stroke="#f5c842" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="22" y1="33" x2="24" y2="38" stroke="#f5c842" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),

  eggs: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Main egg */}
      <ellipse cx="20" cy="22" rx="10" ry="13" fill="#fdf0d5"/>
      <ellipse cx="20" cy="22" rx="10" ry="13" fill="none" stroke="#e8c97a" strokeWidth="1.5"/>
      {/* Shine */}
      <ellipse cx="16" cy="16" rx="3" ry="4" fill="rgba(255,255,255,0.5)" transform="rotate(-20 16 16)"/>
      {/* Small eggs */}
      <ellipse cx="8" cy="28" rx="5" ry="7" fill="#fdf0d5" stroke="#e8c97a" strokeWidth="1"/>
      <ellipse cx="32" cy="28" rx="5" ry="7" fill="#fdf0d5" stroke="#e8c97a" strokeWidth="1"/>
    </svg>
  ),

  revenue: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Coin stack */}
      <ellipse cx="20" cy="32" rx="12" ry="4" fill="#f5c842"/>
      <rect x="8" y="24" width="24" height="8" fill="#f5d060"/>
      <ellipse cx="20" cy="24" rx="12" ry="4" fill="#f5c842"/>
      <rect x="8" y="17" width="24" height="8" fill="#f5d060"/>
      <ellipse cx="20" cy="17" rx="12" ry="4" fill="#f5c842"/>
      {/* Dollar sign */}
      <text x="16" y="22" fontSize="8" fontWeight="bold" fill="#c8960a">₱</text>
      {/* Arrow up */}
      <polyline points="28,12 32,6 36,12" fill="none" stroke="#5aab6e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="32" y1="6" x2="32" y2="18" stroke="#5aab6e" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),

  expenses: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Receipt */}
      <rect x="8" y="5" width="24" height="32" rx="3" fill="#fff" stroke="#ddd" strokeWidth="1.5"/>
      {/* Zigzag bottom */}
      <polyline points="8,34 11,37 14,34 17,37 20,34 23,37 26,34 29,37 32,34" fill="none" stroke="#ddd" strokeWidth="1.5"/>
      {/* Lines */}
      <rect x="12" y="11" width="16" height="2" rx="1" fill="#eee"/>
      <rect x="12" y="16" width="12" height="2" rx="1" fill="#eee"/>
      <rect x="12" y="21" width="14" height="2" rx="1" fill="#eee"/>
      {/* Amount highlight */}
      <rect x="12" y="26" width="16" height="3" rx="1.5" fill="#e05555" opacity="0.8"/>
      <text x="14" y="29" fontSize="6" fill="#fff" fontWeight="bold">TOTAL</text>
    </svg>
  ),

  productive: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Chart bars */}
      <rect x="5" y="28" width="6" height="8" rx="2" fill="#e8a020" opacity="0.6"/>
      <rect x="14" y="20" width="6" height="16" rx="2" fill="#e8a020" opacity="0.8"/>
      <rect x="23" y="12" width="6" height="24" rx="2" fill="#e8a020"/>
      {/* Trend line */}
      <polyline points="8,26 17,18 26,10 35,5" fill="none" stroke="#5aab6e" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="35" cy="5" r="2.5" fill="#5aab6e"/>
      {/* Axis */}
      <line x1="4" y1="36" x2="36" y2="36" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="4" y1="36" x2="4" y2="4" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),

  profit: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Circle background */}
      <circle cx="20" cy="20" r="16" fill="#ede7f6"/>
      {/* Up arrow */}
      <polyline points="14,24 20,12 26,24" fill="none" stroke="#7b52c8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="20" y1="12" x2="20" y2="28" stroke="#7b52c8" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Dollar */}
      <text x="24" y="32" fontSize="9" fontWeight="bold" fill="#7b52c8">₱</text>
    </svg>
  ),

  mortality: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Heart with cross */}
      <path d="M20 34 C20 34 6 24 6 15 C6 10 10 7 14 7 C16.5 7 18.5 8.5 20 10.5 C21.5 8.5 23.5 7 26 7 C30 7 34 10 34 15 C34 24 20 34 20 34Z" fill="#e8f5e9" stroke="#5aab6e" strokeWidth="1.5"/>
      {/* Plus/cross */}
      <rect x="18" y="14" width="4" height="12" rx="2" fill="#5aab6e"/>
      <rect x="14" y="18" width="12" height="4" rx="2" fill="#5aab6e"/>
    </svg>
  ),

  feed: (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Sack */}
      <ellipse cx="20" cy="34" rx="12" ry="4" fill="#c8873a"/>
      <rect x="8" y="18" width="24" height="16" rx="8" fill="#d4944a"/>
      <ellipse cx="20" cy="18" rx="12" ry="5" fill="#e8a95e"/>
      {/* Tie */}
      <rect x="15" y="10" width="10" height="10" rx="4" fill="#b07030"/>
      <ellipse cx="20" cy="10" rx="6" ry="3" fill="#c88040"/>
      {/* Grain dots */}
      <circle cx="15" cy="24" r="2" fill="#f5c87a"/>
      <circle cx="22" cy="27" r="2" fill="#f5c87a"/>
      <circle cx="25" cy="22" r="2" fill="#f5c87a"/>
      {/* Wheat */}
      <line x1="32" y1="8" x2="36" y2="4" stroke="#8bc34a" strokeWidth="1.5" strokeLinecap="round"/>
      <ellipse cx="37" cy="3" rx="2" ry="3" fill="#8bc34a" transform="rotate(30 37 3)"/>
    </svg>
  ),
}

function Card({ title, value, icon, iconBg }) {
  return (
    <div className="dash-card">
      <div className="dash-card-icon" style={{ background: iconBg || "#fff8ec" }}>
        {typeof icon === "string" ? (
          <span className="dash-card-emoji">{icon}</span>
        ) : (
          <div className="dash-card-svg">{icon}</div>
        )}
      </div>
      <div className="dash-card-info">
        <h3 className="dash-card-value">{Number(value).toLocaleString()}</h3>
        <p className="dash-card-label">{title}</p>
      </div>
    </div>
  )
}

export default Card
