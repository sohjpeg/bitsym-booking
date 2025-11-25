import { useAuth } from '../../contexts/AuthContext';
import { withAdmin } from '../../lib/withAuth';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Head from 'next/head';
import styles from '../../styles/Dashboard.module.css';

function AdminDashboard() {
  const { user, userProfile, signOut } = useAuth();
  const [stats, setStats] = useState({
    totalAppointments: 0,
    totalDoctors: 0,
    totalPatients: 0,
    pendingAppointments: 0,
  });
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch all appointments with related data
      const { data: appointmentsData, error: aptError } = await supabase
        .from('appointments')
        .select(`
          *,
          doctor:doctors(
            id,
            specialty,
            user:users(full_name, email)
          ),
          patient:patients(
            id,
            user:users(full_name, email)
          )
        `)
        .order('created_at', { ascending: false });

      if (aptError) throw aptError;

      // Fetch all doctors
      const { data: doctorsData, error: docError } = await supabase
        .from('doctors')
        .select(`
          *,
          user:users(full_name, email)
        `);

      if (docError) throw docError;

      // Fetch all patients
      const { data: patientsData, error: patError } = await supabase
        .from('patients')
        .select(`
          *,
          user:users(full_name, email)
        `);

      if (patError) throw patError;

      setAppointments(appointmentsData || []);
      setDoctors(doctorsData || []);
      setPatients(patientsData || []);

      // Calculate stats
      setStats({
        totalAppointments: appointmentsData?.length || 0,
        totalDoctors: doctorsData?.length || 0,
        totalPatients: patientsData?.length || 0,
        pendingAppointments: appointmentsData?.filter((apt) => apt.status === 'pending').length || 0,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: '#FFB547', text: 'Pending' },
      confirmed: { color: '#05CD99', text: 'Confirmed' },
      cancelled: { color: '#EE5D50', text: 'Cancelled' },
      completed: { color: '#4318FF', text: 'Completed' },
      'no-show': { color: '#A3AED0', text: 'No Show' },
    };

    const badge = badges[status] || badges.pending;
    
    return (
      <span
        className={styles.statusBadge}
        style={{ background: badge.color, color: 'white' }}
      >
        {badge.text}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      <Head>
        <title>Admin Dashboard - Booking System</title>
      </Head>

      <div className={styles.dashboardContainer}>
        <aside className={styles.sidebar}>
          <div className={styles.logo}>
            <span>🏥</span> MedBook
          </div>
          
          <nav className={styles.navLinks}>
            <button 
              className={`${styles.navItem} ${activeTab === 'overview' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span>📊</span> Overview
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'appointments' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('appointments')}
            >
              <span>📅</span> Appointments
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'doctors' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('doctors')}
            >
              <span>👨‍⚕️</span> Doctors
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'patients' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('patients')}
            >
              <span>👥</span> Patients
            </button>
          </nav>

          <div className={styles.userProfile}>
            <div className={styles.avatar}>
              A
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{userProfile?.full_name || 'Admin'}</span>
              <span className={styles.userRole}>Administrator</span>
            </div>
          </div>
        </aside>

        <main className={styles.mainContent}>
          <header className={styles.topHeader}>
            <div>
              <p className={styles.pageTitle}>Pages / Admin Dashboard</p>
              <h2 className={styles.welcomeText}>System Overview</h2>
            </div>
            <div className={styles.headerActions}>
              <button onClick={signOut} className={styles.logoutButton}>
                Logout
              </button>
            </div>
          </header>

          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>📅</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Total Appointments</span>
                <span className={styles.statValue}>{stats.totalAppointments}</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>👨‍⚕️</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Active Doctors</span>
                <span className={styles.statValue}>{stats.totalDoctors}</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>👥</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Registered Patients</span>
                <span className={styles.statValue}>{stats.totalPatients}</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statIcon}>⏳</div>
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Pending Requests</span>
                <span className={styles.statValue}>{stats.pendingAppointments}</span>
              </div>
            </div>
          </div>

          {loading ? (
            <p>Loading data...</p>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Recent Activity</h3>
                  </div>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Doctor</th>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.slice(0, 10).map((appointment) => (
                          <tr key={appointment.id}>
                            <td>{appointment.patient?.user?.full_name}</td>
                            <td>{appointment.doctor?.user?.full_name}</td>
                            <td>{formatDate(appointment.appointment_date)}</td>
                            <td>{formatTime(appointment.appointment_time)}</td>
                            <td>{getStatusBadge(appointment.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'appointments' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>All Appointments ({appointments.length})</h3>
                  </div>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Doctor</th>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Reason</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointments.map((appointment) => (
                          <tr key={appointment.id}>
                            <td>{appointment.patient?.user?.full_name}</td>
                            <td>{appointment.doctor?.user?.full_name}</td>
                            <td>{formatDate(appointment.appointment_date)}</td>
                            <td>{formatTime(appointment.appointment_time)}</td>
                            <td>{appointment.reason || '-'}</td>
                            <td>{getStatusBadge(appointment.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'doctors' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>All Doctors ({doctors.length})</h3>
                  </div>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Specialty</th>
                          <th>License</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctors.map((doctor) => (
                          <tr key={doctor.id}>
                            <td>{doctor.user?.full_name}</td>
                            <td>{doctor.user?.email}</td>
                            <td>{doctor.specialty}</td>
                            <td>{doctor.license_number}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'patients' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>All Patients ({patients.length})</h3>
                  </div>
                  <div className={styles.tableContainer}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Date of Birth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patients.map((patient) => (
                          <tr key={patient.id}>
                            <td>{patient.user?.full_name}</td>
                            <td>{patient.user?.email}</td>
                            <td>{patient.phone_number || 'N/A'}</td>
                            <td>{patient.date_of_birth ? formatDate(patient.date_of_birth) : 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default withAdmin(AdminDashboard);
