import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Cases from '@/pages/Cases';
import CaseDetail from '@/pages/CaseDetail';
import Distributions from '@/pages/Distributions';
import DistributionDetail from '@/pages/DistributionDetail';
import Community from '@/pages/Community';
import Finance from '@/pages/Finance';
import Collections from '@/pages/Collections';
import Deposits from '@/pages/Deposits';
import Donations from '@/pages/Donations';
import FundraisingEventDetail from '@/pages/FundraisingEventDetail';
import Forms from '@/pages/Forms';
import NedarimDonations from '@/pages/NedarimDonations';
import Donors from '@/pages/Donors';
import TelclickMonitor from '@/pages/TelclickMonitor';
import UserAccess from '@/pages/UserAccess';
import Backup from '@/pages/Backup';
import ServiceRequests from '@/pages/ServiceRequests';
import Invoices from '@/pages/Invoices';
import CleaningManagement from '@/pages/CleaningManagement';
import TasksReminders from '@/pages/TasksReminders';
import Projects from '@/pages/Projects';
import ProjectDetail from '@/pages/ProjectDetail';
import { Navigate } from 'react-router-dom';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// Add page imports here

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/cases" replace />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/cases/:id" element={<CaseDetail />} />
          <Route path="/tasks" element={<TasksReminders />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/distributions" element={<Distributions />} />
          <Route path="/distributions/:id" element={<DistributionDetail />} />
          <Route path="/community" element={<Community />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/service" element={<ServiceRequests />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/cleaning" element={<CleaningManagement />} />
          <Route path="/collections" element={<Collections />} />
          <Route path="/deposits" element={<Deposits />} />
          <Route path="/donations" element={<Donations />} />
          <Route path="/donations/events/:id" element={<FundraisingEventDetail />} />
          <Route path="/forms" element={<Forms />} />
          <Route path="/nedarim-donations" element={<NedarimDonations />} />
          <Route path="/donors" element={<Donors />} />
          <Route path="/telclick" element={<TelclickMonitor />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute adminOnly unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/user-access" element={<UserAccess />} />
          <Route path="/backup" element={<Backup />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App