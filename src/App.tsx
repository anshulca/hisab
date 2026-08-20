import React, { useState } from 'react';
import { useComputationStore } from './store/computationStore';
import { Header } from './components/Header';
import { Landing } from './components/Landing';
import { ReviewCentre } from './components/ReviewCentre';
import { I1ReviewCentre } from './components/I1ReviewCentre';
import { I1ReportViewer } from './components/I1ReportViewer';
import { I1FinalHisabCheck } from './components/I1FinalHisabCheck';
import { I2ReviewCentre } from './components/I2ReviewCentre';
import { I2ReportViewer } from './components/I2ReportViewer';
import { I2FinalHisabCheck } from './components/I2FinalHisabCheck';
import { I3ReviewCentre } from './components/I3ReviewCentre';
import { I3ReportViewer } from './components/I3ReportViewer';
import { I3FinalHisabCheck } from './components/I3FinalHisabCheck';
import { ProfitAndLossWorking } from './components/ProfitAndLossWorking';
import { FinalHisabCheck } from './components/FinalHisabCheck';
import { DepreciationScheduleEnhanced } from './components/DepreciationScheduleEnhanced';
import { IncomeBreakdownEnhanced } from './components/IncomeBreakdownEnhanced';
import { Workspace } from './components/Workspace';
import { CompareWorkspace } from './components/CompareWorkspace';
import { ReportViewer } from './components/ReportViewer';
import { Footer } from './components/Footer';
import { LegalPage, type LegalTab } from './components/LegalPage';

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
        return store.itrForm === 'ITR1' ? (
          <I1ReviewCentre onNavigate={setActiveSection} />
        ) : store.itrForm === 'ITR2' ? (
          <I2ReviewCentre onNavigate={setActiveSection} />
        ) : store.itrForm === 'ITR3' ? (
          <I3ReviewCentre onNavigate={setActiveSection} />
        ) : (
          <ReviewCentre onNavigate={setActiveSection} />
        );
      case 'report':
        return store.itrForm === 'ITR1' ? (
          <I1ReportViewer onBack={() => setActiveSection('review')} />
        ) : store.itrForm === 'ITR2' ? (
          <I2ReportViewer onBack={() => setActiveSection('review')} />
        ) : store.itrForm === 'ITR3' ? (
          <I3ReportViewer onBack={() => setActiveSection('review')} />
        ) : (
          <ReportViewer onBack={() => setActiveSection('review')} />
        );
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
        return store.itrForm === 'ITR1' ? (
          <I1FinalHisabCheck onNavigate={setActiveSection} onFinalize={handleFinalize} />
        ) : store.itrForm === 'ITR2' ? (
          <I2FinalHisabCheck onNavigate={setActiveSection} onFinalize={handleFinalize} />
        ) : store.itrForm === 'ITR3' ? (
          <I3FinalHisabCheck onNavigate={setActiveSection} onFinalize={handleFinalize} />
        ) : (
          <FinalHisabCheck
            onNavigate={setActiveSection}
            onFinalize={handleFinalize}
          />
        );
      case 'legal':
      case 'legal:faq':
      case 'legal:privacy':
      case 'legal:terms':
      case 'legal:disclaimer':
        return <LegalPage key={activeSection} initialTab={activeSection.split(':')[1] as LegalTab} onNavigate={setActiveSection} />;
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