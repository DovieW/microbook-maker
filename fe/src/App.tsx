import { AppProvider } from './context/AppContext';
import { JobManagementProvider } from './context/JobManagementContext';
import MicroBookStudio from './components/redesign/MicroBookStudio';

// Main App Component with Provider
function App() {
  return (
    <AppProvider>
      <JobManagementProvider>
        <MicroBookStudio />
      </JobManagementProvider>
    </AppProvider>
  );
}

export default App;
