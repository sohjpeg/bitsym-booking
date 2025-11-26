import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (userProfile) {
        if (userProfile.role === 'doctor') {
          router.push('/doctor/dashboard');
        } else {
          router.push('/patient/dashboard');
        }
      } else {
        // Fallback if profile not loaded yet but user is
        router.push('/patient/dashboard');
      }
    }
  }, [user, userProfile, loading, router]);

  return (
    <>
      <Head>
        <title>Loading... | MedBook</title>
      </Head>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1>🏥 MedBook</h1>
          <p>Redirecting you...</p>
        </div>
      </div>
    </>
  );
}
