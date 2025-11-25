import { useAuth } from '../../contexts/AuthContext';
import { withPatient } from '../../lib/withAuth';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../../styles/Dashboard.module.css';

function PatientDashboard() {
  const { user, userProfile, signOut } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (user) {
      fetchPatientData();
      fetchAppointments();
    }
  }, [user]);

  const fetchPatientData = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setPatientData(data);
    } catch (error) {
      console.error('Error fetching patient data:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        console.error('No active session');
        return;
      }

      const response = await fetch('/api/patient/appointments', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch appointments');
      }

      const data = await response.json();
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: '#fbbf24', text: 'Pending' },
      confirmed: { color: '#10b981', text: 'Confirmed' },
      cancelled: { color: '#ef4444', text: 'Cancelled' },
      completed: { color: '#6366f1', text: 'Completed' },
      'no-show': { color: '#9ca3af', text: 'No Show' },
    };

    const badge = badges[status] || badges.pending;
    
    return (
      <span
        className={styles.badge}
        style={{ background: badge.color }}
      >
        {badge.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const upcomingAppointments = appointments.filter(
    (apt) => apt.status !== 'cancelled' && apt.status !== 'completed'
  );

  const pastAppointments = appointments.filter(
    (apt) => apt.status === 'cancelled' || apt.status === 'completed'
  );

  return (
    <>
      <Head>
        <title>Patient Dashboard - Booking System</title>
      </Head>

      <div className={styles.dashboardContainer}>
        <aside className={styles.sidebar}>
          <div className={styles.logo}>
            <span>🏥</span> MedBook
          </div>
          
          <nav className={styles.navLinks}>
            <button 
              className={`${styles.navItem} ${activeTab === 'dashboard' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <span>📊</span> Dashboard
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'appointments' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('appointments')}
            >
              <span>📅</span> Appointments
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'profile' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <span>👤</span> Profile
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'settings' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <span>⚙️</span> Settings
            </button>
          </nav>

          <div className={styles.userProfile}>
            <div className={styles.avatar}>
              {userProfile?.full_name?.charAt(0) || 'P'}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{userProfile?.full_name || 'Patient'}</span>
              <span className={styles.userRole}>Patient Account</span>
            </div>
          </div>
        </aside>

        <main className={styles.mainContent}>
          <header className={styles.topHeader}>
            <div>
              <p className={styles.pageTitle}>Pages / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</p>
              <h2 className={styles.welcomeText}>
                {activeTab === 'dashboard' ? `Hello, ${userProfile?.full_name?.split(' ')[0] || 'Patient'}! 👋` :
                 activeTab === 'appointments' ? 'My Appointments' :
                 activeTab === 'profile' ? 'My Profile' : 'Settings'}
              </h2>
            </div>
            <div className={styles.headerActions}>
              <Link href="/" className={styles.primaryButton}>
                <span>🎤</span> Book Appointment
              </Link>
              <button onClick={signOut} className={styles.logoutButton}>
                Logout
              </button>
            </div>
          </header>

          {activeTab === 'dashboard' && (
            <>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>📅</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Upcoming</span>
                    <span className={styles.statValue}>{upcomingAppointments.length}</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>✅</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Completed</span>
                    <span className={styles.statValue}>{pastAppointments.length}</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>📊</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Total Visits</span>
                    <span className={styles.statValue}>{appointments.length}</span>
                  </div>
                </div>
              </div>

              <div className={styles.section} id="appointments">
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Upcoming Appointments</h3>
                </div>

                {loading ? (
                  <p>Loading appointments...</p>
                ) : upcomingAppointments.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No upcoming appointments scheduled.</p>
                    <Link href="/" className={styles.link}>
                      Book your first appointment →
                    </Link>
                  </div>
                ) : (
                  <div className={styles.appointmentsList}>
                    {upcomingAppointments.map((appointment) => (
                      <div key={appointment.id} className={styles.appointmentCard}>
                        <div className={styles.appointmentMain}>
                          <div className={styles.doctorAvatar}>
                            👨‍⚕️
                          </div>
                          <div className={styles.appointmentInfo}>
                            <h4>{appointment.doctor?.user?.full_name || 'Doctor'}</h4>
                            <p className={styles.specialty}>
                              {appointment.doctor?.specialty || 'General'}
                            </p>
                          </div>
                        </div>
                        
                        <div className={styles.appointmentMeta}>
                          <div className={styles.metaItem}>
                            <span>📅</span>
                            <span>{formatDate(appointment.appointment_date)}</span>
                          </div>
                          <div className={styles.metaItem}>
                            <span>🕐</span>
                            <span>{formatTime(appointment.appointment_time)}</span>
                          </div>
                          {getStatusBadge(appointment.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'appointments' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>All Appointments</h3>
              </div>
              <div className={styles.appointmentsList}>
                {appointments.map((appointment) => (
                  <div key={appointment.id} className={styles.appointmentCard}>
                    <div className={styles.appointmentMain}>
                      <div className={styles.doctorAvatar}>👨‍⚕️</div>
                      <div className={styles.appointmentInfo}>
                        <h4>{appointment.doctor?.user?.full_name || 'Doctor'}</h4>
                        <p className={styles.specialty}>{appointment.doctor?.specialty || 'General'}</p>
                      </div>
                    </div>
                    <div className={styles.appointmentMeta}>
                      <div className={styles.metaItem}>
                        <span>📅</span>
                        <span>{formatDate(appointment.appointment_date)}</span>
                      </div>
                      <div className={styles.metaItem}>
                        <span>🕐</span>
                        <span>{formatTime(appointment.appointment_time)}</span>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>
                  </div>
                ))}
                {appointments.length === 0 && <p>No appointments found.</p>}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>My Profile</h3>
              </div>
              <div className={styles.form}>
                <div className={styles.inputGroup}>
                  <label>Full Name</label>
                  <input type="text" value={userProfile?.full_name || ''} disabled className={styles.input} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Email</label>
                  <input type="email" value={user?.email || ''} disabled className={styles.input} />
                </div>
                <div className={styles.inputGroup}>
                  <label>Phone Number</label>
                  <input type="text" value={patientData?.phone_number || ''} disabled className={styles.input} placeholder="Not set" />
                </div>
                <div className={styles.inputGroup}>
                  <label>Date of Birth</label>
                  <input type="text" value={patientData?.date_of_birth || ''} disabled className={styles.input} placeholder="Not set" />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Settings</h3>
              </div>
              <p>Account settings coming soon.</p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default withPatient(PatientDashboard);
