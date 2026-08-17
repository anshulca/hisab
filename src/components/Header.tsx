import { useTheme } from '../hooks/useTheme';

interface HeaderProps {
  onNavigate: (section: string) => void;
  isFinalized: boolean;
}

export function Header({ onNavigate, isFinalized }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="header">
      <div className="container header-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <button className="logo" onClick={() => onNavigate('hero')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          HISAB<span>·CA</span>
        </button>

        <nav className="nav">
          {isFinalized && (
            <button className="nav-btn active" onClick={() => onNavigate('hisabCheck')}>
              Finalized ✓
            </button>
          )}
          <button className="nav-btn" onClick={() => onNavigate('hero')}>Home</button>
          <button className="nav-btn" onClick={() => onNavigate('review')}>Review</button>
          <button className="btn-theme" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </nav>
      </div>
    </header>
  );
}