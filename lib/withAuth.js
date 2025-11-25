// Higher-order component for protecting routes based on authentication and roles

import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

export function withAuth(Component, allowedRoles = []) {
  return function ProtectedRoute(props) {
    const { user, userProfile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!loading) {
        // Not authenticated
        if (!user) {
          router.push('/login');
          return;
        }

        // Check role authorization
        if (allowedRoles.length > 0 && userProfile) {
          if (!allowedRoles.includes(userProfile.role)) {
            // Redirect to appropriate dashboard based on their role
            switch (userProfile.role) {
              case 'admin':
                router.push('/admin/dashboard');
                break;
              case 'doctor':
                router.push('/doctor/dashboard');
                break;
              case 'patient':
              default:
                router.push('/patient/dashboard');
                break;
            }
          }
        }
      }
    }, [user, userProfile, loading, router]);

    // Show loading while checking auth
    if (loading) {
      return (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
          <div style={{
            background: 'white',
            padding: '2rem 3rem',
            borderRadius: '15px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)'
          }}>
            <h2 style={{ margin: 0, color: '#667eea' }}>Loading...</h2>
          </div>
        </div>
      );
    }

    // Not authenticated
    if (!user) {
      return null;
    }

    // Wrong role
    if (allowedRoles.length > 0 && userProfile && !allowedRoles.includes(userProfile.role)) {
      return null;
    }

    return <Component {...props} />;
  };
}

// Convenience exports for specific roles
export const withPatient = (Component) => withAuth(Component, ['patient']);
export const withDoctor = (Component) => withAuth(Component, ['doctor']);
export const withAdmin = (Component) => withAuth(Component, ['admin']);
export const withDoctorOrAdmin = (Component) => withAuth(Component, ['doctor', 'admin']);
