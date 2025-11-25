import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Auth.module.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data, error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Redirect based on role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (userData) {
      switch (userData.role) {
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
  };

  return (
    <>
      <Head>
        <title>Login - Booking System</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.authBox}>
          <div className={styles.header}>
            <h1>🏥 Healthcare Booking</h1>
            <p>Sign in to manage your appointments</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.error}>
                ❌ {error}
              </div>
            )}

            <div className={styles.inputGroup}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your.email@example.com"
                disabled={loading}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className={styles.footer}>
            <p>
              Don't have an account?{' '}
              <Link href="/signup" className={styles.link}>
                Sign up
              </Link>
            </p>
            <p>
              <Link href="/" className={styles.link}>
                ← Back to home
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
