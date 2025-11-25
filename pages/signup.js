// pages/signup.js
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Auth.module.css';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('patient');
  const [specialty, setSpecialty] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validation
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      if (!fullName.trim()) {
        setError('Full name is required');
        setLoading(false);
        return;
      }

      if (role === 'doctor' && !specialty.trim()) {
        setError('Specialty is required for doctors');
        setLoading(false);
        return;
      }

      const { data, error } = await signUp(email, password, fullName, role, specialty);

      if (error) {
        // Check for specific duplicate email error
        if (error.message?.includes('User already registered') || 
            error.message?.includes('duplicate key') ||
            error.message?.includes('already exists')) {
          setError('An account with this email already exists. Please login instead.');
        } else {
          setError(error.message || 'An error occurred during signup');
        }
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign Up - Booking System</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.authBox}>
          <div className={styles.header}>
            <h1>🏥 Create Account</h1>
            <p>Join our healthcare booking platform</p>
          </div>

          {success ? (
            <div className={styles.success}>
              ✅ Account created successfully! Redirecting to login...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form}>
              {error && (
                <div className={styles.error}>
                  ❌ {error}
                </div>
              )}

              <div className={styles.inputGroup}>
                <label htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="John Doe"
                  disabled={loading}
                />
              </div>

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
                <label htmlFor="role">I am a:</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={loading}
                  className={styles.select}
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                </select>
              </div>

              {role === 'doctor' && (
                <div className={styles.inputGroup}>
                  <label htmlFor="specialty">Specialty</label>
                  <select
                    id="specialty"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    required
                    disabled={loading}
                    className={styles.select}
                  >
                    <option value="">Select Specialty</option>
                    <option value="General Practice">General Practice</option>
                    <option value="Cardiologist">Cardiologist</option>
                    <option value="Dermatologist">Dermatologist</option>
                    <option value="Neurologist">Neurologist</option>
                    <option value="Pediatrician">Pediatrician</option>
                    <option value="Psychiatrist">Psychiatrist</option>
                    <option value="Surgeon">Surgeon</option>
                    <option value="Dentist">Dentist</option>
                    <option value="Orthopedist">Orthopedist</option>
                  </select>
                </div>
              )}

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
                  minLength={6}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  disabled={loading}
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>
          )}

          <div className={styles.footer}>
            <p>
              Already have an account?{' '}
              <Link href="/login" className={styles.link}>
                Sign in
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