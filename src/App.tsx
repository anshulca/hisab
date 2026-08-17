import React, { useState } from 'react';
import { useComputationStore } from './store/computationStore';
import { Header } from './components/Header';
import { Landing } from './components/Landing';
import { ReviewCentre } from './components/ReviewCentre';
import { ProfitAndLossWorking } from './components/ProfitAndLossWorking';
import { FinalHisabCheck } from './components/FinalHisabCheck';
import { DepreciationScheduleEnhanced } from './components/DepreciationScheduleEnhanced';
import { IncomeBreakdownEnhanced } from './components/IncomeBreakdownEnhanced';
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
        return <Landing onGenerate={() => setActiveSection('review')} />;
      case 'review':
        return <ReviewCentre onNavigate={setActiveSection} />;
      case 'income':
        return store.normalizedData ? (
          <IncomeBreakdownEnhanced incomeData={store.normalizedData.incomeBreakdown} />
        ) : <div>No income data</div>;
      case 'pnl':
        return <ProfitAndLossWorking />;
      case 'depreciation':
        return store.normalizedData ? (
          <DepreciationScheduleEnhanced
            initialAssets={store.depreciationAssets}
            onUpdate={store.updateDepreciation}
            assessmentYear={store.normalizedData.taxpayer.assessmentYear}
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
        return <Landing onGenerate={() => setActiveSection('review')} />;
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