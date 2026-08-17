# HISAB - ITR Computation Made Simple

**JSON se Computation tak.**
By CA Anshul Karwa

Live demo: [hisab.github.io](https://hisab.github.io)

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000`

### 3. Build for Production
```bash
npm run build
```

### 4. Preview Production Build
```bash
npm run preview
```

## 🌐 Deploy to GitHub Pages

This repo is configured to auto-deploy to GitHub Pages via GitHub Actions (`/.github/workflows/deploy.yml`).

1. Push this code to GitHub (repository must be named `hisab.github.io` for user-site hosting)
2. In repo Settings → Pages, set source to **GitHub Actions**
3. Every push to `main` triggers a build + deploy automatically

To use a custom domain (e.g. `hisab.studyfromnotes.com`), add it under Settings → Pages → Custom domain and commit a `CNAME` file.

## 📁 Project Structure

```
src/
├── components/     # UI Components
├── hooks/          # Custom React Hooks
├── store/          # Zustand State Management
├── parser/         # ITR-4 JSON Parser
├── calculation/    # Tax Calculation Engine
├── pdf/            # PDF Generation
└── utils/          # Utilities
```

## ⚙️ Tech Stack

- React 18
- TypeScript
- Vite
- Zustand (State Management)
- jsPDF (PDF Generation)
- GitHub Actions (CI/CD)

## 📝 License

Private - All rights reserved