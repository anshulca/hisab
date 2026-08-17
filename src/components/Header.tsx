import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  onNavigate: (section: string) => void;
  isFinalized: boolean;
}

function scrollToSection(id: string, onNavigate: (s: string) => void) {
  onNavigate('hero');
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

export function Header({ onNavigate, isFinalized }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="header">
      <div className="container header-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <div className="logo-group">
          <button className="logo-btn" onClick={() => onNavigate('hero')} title="HISAB home">
            <span className="logo">HIS<span>AB</span></span>
          </button>
          <span className="tagline">JSON se Computation tak.</span>
          <span className="byline">
            <a href="https://www.linkedin.com/in/anshulkarwa/" target="_blank" rel="noreferrer">
              By CA Anshul Karwa
            </a>
          </span>
        </div>

        <nav className="nav">
          {isFinalized && (
            <button className="nav-btn active" onClick={() => onNavigate('hisabCheck')}>
              Finalized ✓
            </button>
          )}
          <button className="nav-btn" onClick={() => scrollToSection('how', onNavigate)}>
            How It Works
          </button>
          <button className="nav-btn" onClick={() => scrollToSection('features', onNavigate)}>
            Features
          </button>

          <label className="toggle-switch" title="Toggle theme">
            <input type="checkbox" checked={!isDark} onChange={toggleTheme} aria-label="Toggle theme" />
            <div className="slider">
              <svg viewBox="0 0 512 512">
                <path d="M283.211 512c78.962 0 151.079-35.925 198.857-94.792 7.068-8.708-.639-21.43-11.562-19.35-124.203 23.654-238.262-71.576-238.262-196.954 0-72.222 38.662-138.635 101.498-174.394 10.348-5.886 6.253-21.607-6.434-22.73-45.455-4.047-91.731-4.047-137.188 0C91.699 6.482 0 96.818 0 210.764 0 376.982 126.802 512 283.211 512z"/>
              </svg>
            </div>
          </label>

          <button className="try-btn" onClick={() => scrollToSection('upload', onNavigate)}>
            <i className="fas fa-lock" style={{ marginRight: 6, fontSize: '0.6rem' }} /> Try HISAB
          </button>
        </nav>

        <div className="menu-icon"><i className="fas fa-bars" /></div>
      </div>
    </header>
  );
}