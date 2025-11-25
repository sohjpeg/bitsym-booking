import { useAuth } from '../../contexts/AuthContext';
import { withDoctor } from '../../lib/withAuth';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Head from 'next/head';
import styles from '../../styles/Dashboard.module.css';

function DoctorDashboard() {
  const { user, userProfile, signOut } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctorData, setDoctorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today');
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (user) {
      fetchDoctorData();
      fetchAppointments();
    }
  }, [user, filter]);

  const fetchDoctorData = async () => {
    try {
      const { data, error } = await supabase
        .from('doctors')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setDoctorData(data);
    } catch (error) {
      console.error('Error fetching doctor data:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);

      // Get doctor ID first
      const { data: doctorRecord } = await supabase
        .from('doctors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!doctorRecord) return;

      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(
            id,
            date_of_birth,
            phone_number,
            user:users(full_name, email)
          )
        `)
        .eq('doctor_id', doctorRecord.id);

      // Apply date filters
      const today = new Date().toISOString().split('T')[0];
      
      if (filter === 'today') {
        query = query.eq('appointment_date', today);
      } else if (filter === 'upcoming') {
        query = query.gte('appointment_date', today);
      } else if (filter === 'pending') {
        query = query.eq('status', 'pending');
      }

      query = query.order('appointment_date', { ascending: true })
                   .order('appointment_time', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      setAppointments(data || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      // Refresh appointments
      fetchAppointments();
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Failed to update appointment status');
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
      weekday: 'short',
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

  const todayCount = appointments.filter(
    (apt) => apt.appointment_date === new Date().toISOString().split('T')[0]
  ).length;

  const pendingCount = appointments.filter(
    (apt) => apt.status === 'pending'
  ).length;

  return (
    <>
      <Head>
        <title>Doctor Dashboard - Booking System</title>
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
              className={`${styles.navItem} ${activeTab === 'schedule' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <span>📅</span> Schedule
            </button>
            <button 
              className={`${styles.navItem} ${activeTab === 'patients' ? styles.navItemActive : ''}`}
              onClick={() => setActiveTab('patients')}
            >
              <span>👥</span> Patients
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
              Dr
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>Dr. {userProfile?.full_name?.split(' ')[0] || 'Doctor'}</span>
              <span className={styles.userRole}>{doctorData?.specialty || 'Specialist'}</span>
            </div>
          </div>
        </aside>

        <main className={styles.mainContent}>
          <header className={styles.topHeader}>
            <div>
              <p className={styles.pageTitle}>Pages / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</p>
              <h2 className={styles.welcomeText}>
                {activeTab === 'dashboard' ? `Welcome back, Dr. ${userProfile?.full_name?.split(' ')[1] || 'Doctor'}!` : 
                 activeTab === 'schedule' ? 'Your Schedule' :
                 activeTab === 'patients' ? 'My Patients' : 'Settings'}
              </h2>
            </div>
            <div className={styles.headerActions}>
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
                    <span className={styles.statLabel}>Today's Appointments</span>
                    <span className={styles.statValue}>{todayCount}</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>⏳</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Pending Requests</span>
                    <span className={styles.statValue}>{pendingCount}</span>
                  </div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statIcon}>📊</div>
                  <div className={styles.statInfo}>
                    <span className={styles.statLabel}>Total Appointments</span>
                    <span className={styles.statValue}>{appointments.length}</span>
                  </div>
                </div>
              </div>

              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>Appointments</h3>
                  <div className={styles.filters}>
                    <button
                      className={filter === 'today' ? styles.filterActive : styles.filter}
                      onClick={() => setFilter('today')}
                    >
                      Today
                    </button>
                    <button
                      className={filter === 'upcoming' ? styles.filterActive : styles.filter}
                      onClick={() => setFilter('upcoming')}
                    >
                      Upcoming
                    </button>
                    <button
                      className={filter === 'pending' ? styles.filterActive : styles.filter}
                      onClick={() => setFilter('pending')}
                    >
                      Pending
                    </button>
                    <button
                      className={filter === 'all' ? styles.filterActive : styles.filter}
                      onClick={() => setFilter('all')}
                    >
                      All
                    </button>
                  </div>
                </div>

                {loading ? (
                  <p>Loading appointments...</p>
                ) : appointments.length === 0 ? (
                  <div className={styles.emptyState}>
                    <p>No appointments found for this filter</p>
                  </div>
                ) : (
                  <div className={styles.appointmentsList}>
                    {appointments.map((appointment) => (
                      <div key={appointment.id} className={styles.appointmentCard}>
                        <div className={styles.appointmentMain}>
                          <div className={styles.doctorAvatar}>
                            👤
                          </div>
                          <div className={styles.appointmentInfo}>
                            <h4>{appointment.patient?.user?.full_name || 'Patient'}</h4>
                            <p className={styles.specialty}>
                              {appointment.patient?.user?.email}
                            </p>
                            {appointment.patient?.phone_number && (
                              <p className={styles.specialty}>📞 {appointment.patient.phone_number}</p>
                            )}
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

                        {appointment.status === 'pending' && (
                          <div className={styles.actionButtons}>
                            <button
                              className={styles.btnApprove}
                              onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                              title="Confirm"
                            >
                              ✓
                            </button>
                            <button
                              className={styles.btnReject}
                              onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        {appointment.status === 'confirmed' && (
                          <div className={styles.actionButtons}>
                            <button
                              className={styles.btnApprove}
                              onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                              title="Complete"
                            >
                              ✓
                            </button>
                            <button
                              className={styles.btnReject}
                              onClick={() => updateAppointmentStatus(appointment.id, 'no-show')}
                              title="No Show"
                            >
                              ?
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'schedule' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Full Schedule</h3>
              </div>
              {/* Reuse the appointments list but show all upcoming by default */}
              <div className={styles.appointmentsList}>
                {appointments
                  .filter(apt => new Date(apt.appointment_date) >= new Date().setHours(0,0,0,0))
                  .map((appointment) => (
                  <div key={appointment.id} className={styles.appointmentCard}>
                    <div className={styles.appointmentMain}>
                      <div className={styles.doctorAvatar}>👤</div>
                      <div className={styles.appointmentInfo}>
                        <h4>{appointment.patient?.user?.full_name || 'Patient'}</h4>
                        <p className={styles.specialty}>{appointment.patient?.user?.email}</p>
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
                {appointments.filter(apt => new Date(apt.appointment_date) >= new Date().setHours(0,0,0,0)).length === 0 && (
                  <p>No upcoming appointments scheduled.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>My Patients</h3>
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Last Visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Deduplicate patients from appointments */}
                    {Array.from(new Set(appointments.map(a => a.patient?.id)))
                      .map(id => appointments.find(a => a.patient?.id === id)?.patient)
                      .filter(Boolean)
                      .map(patient => (
                        <tr key={patient.id}>
                          <td>{patient.user?.full_name}</td>
                          <td>{patient.user?.email}</td>
                          <td>{patient.phone_number || 'N/A'}</td>
                          <td>
                            {formatDate(
                              appointments
                                .filter(a => a.patient_id === patient.id)
                                .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))[0]?.appointment_date
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {appointments.length === 0 && <p>No patients found.</p>}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Account Settings</h3>
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
                  <label>Specialty</label>
                  <input type="text" value={doctorData?.specialty || ''} disabled className={styles.input} />
                </div>
                <p style={{ marginTop: '1rem', color: '#666' }}>
                  To update your profile details, please contact the administrator.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default withDoctor(DoctorDashboard);
