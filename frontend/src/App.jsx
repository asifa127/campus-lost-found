import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2, ShieldOff } from 'lucide-react';
import { useAuth, homeFor } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import Landing from './pages/Landing';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/Auth';
import NotFound from './pages/NotFound';
import Info from './pages/Info';
import { ButtonLink, Card, EmptyState, ErrorState } from './components/ui';

const page = (loader, name = 'default') => lazy(() => loader().then((m) => ({ default: m[name] })));
const Dashboard = page(() => import('./pages/Dashboard'));
const Browse = page(() => import('./pages/Browse'));
const ItemDetail = page(() => import('./pages/ItemDetail'));
const ReportItem = page(() => import('./pages/ReportItem'), 'ReportItem');
const EditItem = page(() => import('./pages/ReportItem'), 'EditItem');
const MyReports = page(() => import('./pages/MyReports'));
const MyClaims = page(() => import('./pages/Claims'), 'MyClaims');
const ClaimDetail = page(() => import('./pages/Claims'), 'ClaimDetail');
const Matches = page(() => import('./pages/Matches'));
const Notifications = page(() => import('./pages/Notifications'));
const Messages = page(() => import('./pages/Messages'));
const Profile = page(() => import('./pages/Profile'));
const AdminDashboard = page(() => import('./pages/admin/AdminDashboard'));
const StaffDashboard = page(() => import('./pages/admin/StaffDashboard'));
const Settings = page(() => import('./pages/admin/Settings'));
const AdminAnalytics = page(() => import('./pages/admin/AdminAnalytics'));
const AdminUsers = page(() => import('./pages/admin/AdminUsers'));
const AdminReports = page(() => import('./pages/admin/AdminReports'));
const AdminClaims = page(() => import('./pages/admin/AdminClaims'));
const Categories = page(() => import('./pages/admin/Catalog'), 'Categories');
const Locations = page(() => import('./pages/admin/Catalog'), 'Locations');
const AuditLogs = page(() => import('./pages/admin/AuditLogs'));
const AbuseReports = page(() => import('./pages/admin/AbuseReports'));

const Spinner = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
);

// Gate: must be logged in (and, optionally, hold one of `roles`). The server enforces the same rules.
function Protected({ roles, children }) {
  const { user, loading, bootError, retry, loggedOutFrom } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (bootError) return <div className="mx-auto max-w-lg px-4 py-24"><ErrorState message={bootError} onRetry={retry} /></div>;
  const here = location.pathname + location.search;
  if (!user) return <Navigate to="/login" state={here === loggedOutFrom ? undefined : { from: here }} replace />;
  if (roles && !roles.includes(user.role)) return <AccessDenied home={homeFor(user)} />;
  return children;
}

// Shown inside the app shell when a signed-in user opens a page their role does not allow.
// (The API refuses the same requests on its own, this is only the friendly version.)
function AccessDenied({ home }) {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState icon={ShieldOff} title="Access denied" message="You don't have permission to access this page."
        action={<ButtonLink to={home}>Go to dashboard</ButtonLink>} />
    </Card>
  );
}

// /admin is the staff dashboard for staff and the admin dashboard for admins.
function AdminHome() {
  const { user } = useAuth();
  return user.role === 'admin' ? <AdminDashboard /> : <StaffDashboard />;
}

// Login/register pages bounce signed-in users to the page they were trying to open, or else to their home.
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  return user ? <Navigate to={location.state?.from || homeFor(user)} replace /> : children;
}

const STAFF = ['staff', 'admin'];
const ADMIN = ['admin'];

export default function App() {
  const wrap = (roles, el) => <Protected roles={roles}>{el}</Protected>;
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {['about', 'contact', 'privacy', 'terms'].map((p) => <Route key={p} path={`/${p}`} element={<Info page={p} />} />)}

        <Route element={<Protected><AppLayout /></Protected>}>
          <Route path="/dashboard" element={wrap(['student', 'staff'], <Dashboard />)} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/items/:type/:id" element={<ItemDetail />} />
          <Route path="/report/:type" element={wrap(['student', 'staff'], <ReportItem />)} />
          <Route path="/edit/:type/:id" element={<EditItem />} />
          <Route path="/my-reports" element={wrap(['student', 'staff'], <MyReports />)} />
          <Route path="/my-claims" element={wrap(['student', 'staff'], <MyClaims />)} />
          <Route path="/claims/:id" element={<ClaimDetail />} />
          <Route path="/matches" element={wrap(['student', 'staff'], <Matches />)} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/profile" element={<Profile />} />

          <Route path="/admin" element={wrap(STAFF, <AdminHome />)} />
          <Route path="/admin/reports" element={wrap(STAFF, <AdminReports />)} />
          <Route path="/admin/claims" element={wrap(STAFF, <AdminClaims />)} />
          <Route path="/admin/users" element={wrap(ADMIN, <AdminUsers />)} />
          <Route path="/admin/categories" element={wrap(ADMIN, <Categories />)} />
          <Route path="/admin/locations" element={wrap(ADMIN, <Locations />)} />
          <Route path="/admin/analytics" element={wrap(ADMIN, <AdminAnalytics />)} />
          <Route path="/admin/audit" element={wrap(ADMIN, <AuditLogs />)} />
          <Route path="/admin/abuse" element={wrap(ADMIN, <AbuseReports />)} />
          <Route path="/admin/settings" element={wrap(ADMIN, <Settings />)} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
