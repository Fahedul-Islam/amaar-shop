import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// ProtectedRoute redirects unauthenticated users to /login.
// Shows nothing while the auth state is still loading to avoid flicker.
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
