import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading, isAuthEnabled } = useAuth();
    const location = useLocation();

    if (!isAuthEnabled) {
        return <>{children}</>;
    }

    // Show loading state while checking auth
    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <p>Checking authentication...</p>
            </div>
        );
    }

    // Redirect to login if not authenticated
    if (!user) {
        return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }

    // User is authenticated, render the protected content
    return <>{children}</>;
}
