// contexts/AuthContext.js
// Authentication context provider for managing user sessions

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/router';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Failsafe: Force loading to false after 10 seconds to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('Auth check timed out, forcing loading to false');
      setLoading(false);
    }, 10000);

    // Check active session
    checkUser().finally(() => {
      clearTimeout(timeoutId);
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        if (newSession?.user) {
          setUser(newSession.user);
          // Pass session to avoid redundant getSession() call
          await fetchUserProfile(newSession.user.id, newSession);
        } else {
          setUser(null);
          setUserProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(timeoutId);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    try {
      console.log('Checking user session...');
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        setUser(null);
        setSession(null);
        setUserProfile(null);
        return;
      }
      
      setSession(currentSession);

      if (currentSession?.user) {
        console.log('User found:', currentSession.user.id);
        setUser(currentSession.user);
        // Pass session to avoid redundant getSession() call
        await fetchUserProfile(currentSession.user.id, currentSession);
      } else {
        console.log('No active session');
        setUser(null);
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error checking user:', error);
      setUser(null);
      setSession(null);
      setUserProfile(null);
    } finally {
      console.log('Auth check complete, setting loading to false');
      setLoading(false);
    }
  };

  // Optimized: Accept session parameter to avoid redundant getSession() calls
  const fetchUserProfile = async (userId, currentSession = null) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // Set a minimal profile so app doesn't break
        setUserProfile({ id: userId, role: 'patient' });
        return;
      }
      
      // Early return if no user data
      if (!userData) {
        setUserProfile({ id: userId, role: 'patient' });
        return;
      }

      let profileData = { ...userData };

      // Fetch additional role-specific data
      // Wrap in try-catch so role-specific failures don't block the entire profile
      try {
        if (userData.role === 'patient') {
          // Use API to bypass RLS recursion
          // Reuse session if provided to avoid redundant getSession call
          const session = currentSession || (await supabase.auth.getSession()).data.session;
          
          if (session?.access_token) {
            const response = await fetch('/api/patient/profile', {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            
            if (response.ok) {
              const patientData = await response.json();
              if (patientData?.id) {
                profileData.patient_id = patientData.id;
              }
            }
          }
        } else if (userData.role === 'doctor') {
          const { data: doctorData } = await supabase
            .from('doctors')
            .select('id')
            .eq('user_id', userId)
            .single();
            
          if (doctorData?.id) {
            profileData.doctor_id = doctorData.id;
          }
        }
      } catch (roleError) {
        // Don't fail the entire profile fetch if role-specific data fails
        console.warn('Failed to fetch role-specific data:', roleError);
      }

      console.log('User profile loaded:', profileData);
      setUserProfile(profileData);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // Set a minimal profile so app doesn't break
      setUserProfile({ id: userId, role: 'patient' });
    }
  };

  // ✅ FIXED: Let the database trigger handle user creation
  const signUp = async (email, password, fullName, role = 'patient', specialty = null) => {
    try {
      console.log('Attempting signup for:', email, 'as', role);
      
      // Create auth user with metadata
      // The database trigger will automatically create the user profile and patient/doctor records
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role,
            specialty: specialty, // Pass specialty to metadata
          }
        }
      });

      if (error) {
        // Return error instead of throwing to avoid Next.js error overlay
        return { data: null, error };
      }

      if (!data.user) {
        return { data: null, error: new Error('User creation failed') };
      }

      console.log('Signup successful for user:', data.user.id);
      return { data, error: null };
    } catch (error) {
      console.error('Signup error:', error);
      return { data: null, error };
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { data: null, error };
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out...');
      
      // Clear local state immediately
      setUser(null);
      setSession(null);
      setUserProfile(null);

      // Attempt to sign out from Supabase with a timeout
      // This prevents the UI from hanging if the network request fails
      const { error } = await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(() => resolve({ error: 'Sign out timed out' }), 2000))
      ]);
      
      if (error) {
        console.warn('Supabase signOut result:', error);
      } else {
        console.log('Supabase signOut successful');
      }
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      // Always redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const value = {
    user,
    session,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};