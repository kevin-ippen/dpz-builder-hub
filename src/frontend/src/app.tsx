import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/theme';
import Layout from './components/layout/layout';
import { TooltipProvider } from './components/ui/tooltip';
import { Toaster } from './components/ui/toaster';
import { RouteErrorBoundary } from './components/layout/route-error-boundary';
import { useUserStore } from './stores/user-store';
import { usePermissions } from './stores/permissions-store';
import { useNotificationsStore } from './stores/notifications-store';
import useTestPersonaStore, { installTestPersonaFetchInterceptor } from './stores/test-persona-store';
import { usePointerEventsGuard } from './hooks/use-pointer-events-guard';

// Install the fetch interceptor immediately at module load so even very early
// requests (e.g. probes during component mount) carry the override headers
// once a persona is restored from localStorage.
installTestPersonaFetchInterceptor();
import './i18n/config'; // Initialize i18n

// Import views
import Home from './views/home';
// Data Catalog removed — merged into Catalog (asset-explorer)
import About from './views/about';
import UserGuide from './views/user-guide';
import NotFound from './views/not-found';
import SearchView from './views/search';

// Marketplace merged into Home

// Consumer views
import AssetExplorerView from './views/asset-explorer';
import AssetDetailView from './views/asset-detail';
import LabView from './views/lab';
import SubmitAssetView from './views/submit-asset';
import MyPortfolioView from './views/my-portfolio';
import DemandsView from './views/demands';
import DashboardView from './views/dashboard';



// Global route-scoped guards (e.g. recover from stuck Radix body pointer-events lock)
function RouteGuards() {
  usePointerEventsGuard();
  return null;
}



export default function App() {
  const fetchUserInfo = useUserStore((state: any) => state.fetchUserInfo);
  const { fetchPermissions, fetchAvailableRoles } = usePermissions();
  const { startPolling: startNotificationPolling, stopPolling: stopNotificationPolling } = useNotificationsStore();
  const initializeTestPersonas = useTestPersonaStore((s) => s.initialize);



  useEffect(() => {
    console.log("App component mounted, fetching initial user info and permissions...");
    // Probe for the test-persona feature first so any restored persona
    // selection is in effect before user/permissions calls go out.
    initializeTestPersonas().finally(() => {
      fetchUserInfo();
      fetchPermissions();
      fetchAvailableRoles();
    });

    console.log("Starting notification polling...");
    startNotificationPolling();


    return () => {
        console.log("App component unmounting, stopping notification polling...");
        stopNotificationPolling();
    };
  }, [fetchUserInfo, fetchPermissions, fetchAvailableRoles, startNotificationPolling, stopNotificationPolling, initializeTestPersonas]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="ucapp-theme">
      <TooltipProvider>
        <Router future={{ 
          v7_relativeSplatPath: true,
        }}>
          <RouteGuards />
          <Layout>
            <RouteErrorBoundary>
            <Routes>
              <Route path="/" element={<Home />} />

              {/* Consumer: Discover */}
              <Route path="/assets" element={<AssetExplorerView />} />
              <Route path="/assets/:assetId" element={<AssetDetailView />} />
              <Route path="/lab" element={<LabView />} />
              <Route path="/marketplace" element={<Navigate to="/" replace />} />
              <Route path="/data-catalog" element={<Navigate to="/assets" replace />} />
              <Route path="/data-catalog/*" element={<Navigate to="/assets" replace />} />

              {/* Consumer: Create */}
              <Route path="/submit" element={<SubmitAssetView />} />
              <Route path="/my-portfolio" element={<MyPortfolioView />} />
              <Route path="/demands" element={<DemandsView />} />

              {/* Consumer: Observe */}
              <Route path="/dashboard" element={<DashboardView />} />

              {/* Legacy compat redirects */}
              <Route path="/data-products" element={<Navigate to="/assets" replace />} />
              <Route path="/data-products/:productId" element={<Navigate to="/assets" replace />} />

              {/* System / Utility */}
              <Route path="/search" element={<SearchView />} />
              <Route path="/search/llm" element={<SearchView />} />
              <Route path="/search/index" element={<SearchView />} />
              <Route path="/about" element={<About />} />
              <Route path="/user-guide" element={<UserGuide />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
            </RouteErrorBoundary>
          </Layout>
        </Router>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
