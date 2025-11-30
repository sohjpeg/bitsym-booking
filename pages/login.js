import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { Activity, Mail, Lock, LogIn, ArrowRight } from 'lucide-react';

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

    try {
      const { data, error } = await signIn(email, password);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Redirect based on role
      const { data: userData, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError || !userData) {
        console.error('Error fetching user role:', profileError);
        setError('Error fetching user profile. Please contact support.');
        setLoading(false);
        return;
      }

      if (userData) {
        switch (userData.role) {
          case 'admin':
            await router.push('/admin/dashboard');
            break;
          case 'doctor':
            await router.push('/doctor/dashboard');
            break;
          case 'patient':
          default:
            await router.push('/patient/dashboard');
            break;
        }
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login - MedBook</title>
      </Head>

      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          {/* Header */}
          <div className="bg-white p-8 pb-6 text-center border-b border-slate-50">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-200">
              <Activity size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome Back</h1>
            <p className="text-slate-500 mt-2 text-sm">Sign in to access your healthcare portal</p>
          </div>

          <div className="p-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                  <div className="mt-0.5">❌</div>
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@example.com"
                    disabled={loading}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    disabled={loading}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <LogIn size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex flex-col gap-4 text-center">
                <p className="text-sm text-slate-600">
                  Don't have an account?{' '}
                  <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium hover:underline">
                    Create account
                  </Link>
                </p>
                <Link href="/" className="inline-flex items-center justify-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors">
                  <ArrowRight size={14} className="rotate-180" />
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
