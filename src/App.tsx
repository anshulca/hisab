import React, { useState } from 'react';
import { useComputationStore } from './store/computationStore';
import { Header } from './components/Header';
import { Landing } from './components/Landing';
import { ReviewCentre } from './components/ReviewCentre';
import { ProfitAndLossWorking } from './components/ProfitAndLossWorking';
import { FinalHisabCheck } from './components/FinalHisabCheck';
import { DepreciationScheduleEnhanced } from './components/DepreciationScheduleEnhanced';
import { IncomeBreakdownEnhanced } from './components/IncomeBreakdownEnhanced';
import { Workspace } from './components/Workspace';
import { CompareWorkspace } from './components/CompareWorkspace';
import { ReportViewer } from './components/ReportViewer';
import { Footer } from './components/Footer';

function App() {
  const store = useComputationStore();
  const [activeSection, setActiveSection] = useState<string>('hero');

  const handleFinalize = () => {
    if (window.confirm('Once finalized, the current computation will be treated as the final working version. Continue?')) {
      store.finalize();
    }
  };

  useEffectScrollToTop(activeSection);

  const renderSection = () => {
    switch (activeSection) {
      case 'hero':
        return <Landing onGenerate={() => setActiveSection('app')} />;
      case 'app':
        return <Workspace onNavigate={setActiveSection} />;
      case 'compare':
        return <CompareWorkspace onNavigate={setActiveSection} />;
      case 'review':
        return <ReviewCentre onNavigate={setActiveSection} />;
      case 'report':
        return <ReportViewer onBack={() => setActiveSection('review')} />;
      case 'income':
        return store.normalizedData ? (
          <IncomeBreakdownEnhanced incomeData={store.normalizedData.incomeBreakdown} onBack={() => setActiveSection('review')} />
        ) : <div>No income data</div>;
      case 'pnl':
        return <ProfitAndLossWorking onBack={() => setActiveSection('review')} />;
      case 'depreciation':
        return store.normalizedData ? (
          <DepreciationScheduleEnhanced
            initialAssets={store.depreciationAssets}
            onUpdate={store.updateDepreciation}
            assessmentYear={store.normalizedData.taxpayer.assessmentYear}
            onBack={() => setActiveSection('review')}
          />
        ) : <div>No data</div>;
      case 'hisabCheck':
        return (
          <FinalHisabCheck
            onNavigate={setActiveSection}
            onFinalize={handleFinalize}
          />
        );
      default:
        return <Landing onGenerate={() => setActiveSection('app')} />;
    }
  };

  return (
    <div className="app">
      <Header onNavigate={setActiveSection} isFinalized={store.isFinalized} />
      <main>
        {renderSection()}
      </main>
      <Footer onNavigate={setActiveSection} />
    </div>
  );
}

function useEffectScrollToTop(key: string) {
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [key]);
}

export default App;