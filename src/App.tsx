import { Suspense, lazy } from 'react';
import Navbar from './components/Navbar';

const Dashboard = lazy(() => import('./components/Dashboard'));

function App() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <div className="min-h-screen bg-animate flex items-center justify-center pt-16">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        }
      >
        <Dashboard />
      </Suspense>
    </>
  );
}

export default App;
