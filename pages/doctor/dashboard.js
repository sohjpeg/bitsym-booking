import { useAuth } from '../../contexts/AuthContext';
import { withDoctor } from '../../lib/withAuth';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Head from 'next/head';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Settings, 
  LogOut, 
  Check, 
  X, 
  Clock, 
  Activity,
  Search,
  Filter,
  Phone,
  Mail,
  User
} from 'lucide-react';
import { useRouter } from 'next/router';

function DoctorDashboard() {
  const router = useRouter();
  const { user, session, userProfile, signOut } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctorData, setDoctorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [activeTab, setActiveTab] = useState('dashboard');

  const [processingId, setProcessingId] = useState(null);
  const isInitialMount = useRef(true);

  // Sync activeTab with URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'schedule', 'patients', 'settings'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  // Update URL hash when activeTab changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Failsafe: Force loading to false after 15 seconds
  useEffect(() => {
    if (loading) {
      const timeoutId = setTimeout(() => {
        console.warn('Dashboard loading timed out, forcing display');
        setLoading(false);
      }, 15000);
      return () => clearTimeout(timeoutId);
    }
  }, [loading]);

  const getSessionWithTimeout = async () => {
    // Deprecated: Using session from AuthContext
    return { data: { session }, error: null };
  };

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        const token = session?.access_token;

        if (!token) {
          // If session is not yet available but user is, we might be in a race.
          // But since AuthContext loads user and session together, this should be rare.
          console.warn('No access token available yet');
          return;
        }

        await Promise.all([
          fetchDoctorData(token),
          fetchAppointments(token)
        ]);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [user?.id, session?.access_token, filter]);

  const fetchDoctorData = async (token) => {
    try {
      if (!token) return;

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

  const fetchAppointments = async (token) => {
    try {
      if (!token) {
        console.error('No token provided for appointments');
        return;
      }

      // Only show full loading state if we don't have data yet
      if (appointments.length === 0) {
        setLoading(true);
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch(`/api/doctor/appointments?filter=${filter}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error('Failed to fetch appointments');
        }

        const data = await response.json();
        setAppointments(data || []);
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          console.error('Fetch aborted due to timeout');
        } else {
          throw fetchError;
        }
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    if (processingId) return; // Prevent multiple clicks
    setProcessingId(appointmentId);
    
    try {
      // Use session directly from context
      if (!session) {
        console.error('No active session');
        setProcessingId(null);
        return;
      }

      const response = await fetch('/api/doctor/appointments', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: appointmentId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update appointment');
      }

      // Optimistically update the UI
      setAppointments(prev => prev.map(apt => 
        apt.id === appointmentId ? { ...apt, status: newStatus } : apt
      ));
      
      // Background refresh to ensure consistency
      // Background refresh to ensure consistency
      if (session?.access_token) {
        fetchAppointments(session.access_token);
      }
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Failed to update appointment status');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      confirmed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      completed: 'bg-blue-100 text-blue-800 border-blue-200',
      'no-show': 'bg-gray-100 text-gray-800 border-gray-200',
    };

    const labels = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      cancelled: 'Cancelled',
      completed: 'Completed',
      'no-show': 'No Show',
    };

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
        {labels[status] || 'Pending'}
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

  const NavItem = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        activeTab === id 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
          : 'text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </button>
  );

  return (
    <>
      <Head>
        <title>Doctor Dashboard - MedBook</title>
      </Head>

      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 fixed h-full z-10 hidden md:flex flex-col">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center gap-3 text-blue-600">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Activity size={24} />
              </div>
              <span className="text-xl font-bold tracking-tight">MedBook</span>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <NavItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem id="schedule" icon={Calendar} label="Schedule" />
            <NavItem id="patients" icon={Users} label="Patients" />
            <NavItem id="settings" icon={Settings} label="Settings" />
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                Dr
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {userProfile?.full_name?.startsWith('Dr.') ? userProfile.full_name : `Dr. ${userProfile?.full_name || 'Doctor'}`}
                </p>
                <p className="text-xs text-slate-500 truncate">{doctorData?.specialty || 'Specialist'}</p>
              </div>
            </div>
            <button 
              onClick={signOut}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
                <span>Pages</span>
                <span>/</span>
                <span className="text-slate-900 font-medium capitalize">{activeTab}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {activeTab === 'dashboard' ? `Welcome back, ${userProfile?.full_name?.startsWith('Dr.') ? userProfile.full_name : `Dr. ${userProfile?.full_name || 'Doctor'}`}!` : 
                 activeTab === 'schedule' ? 'Your Schedule' :
                 activeTab === 'patients' ? 'My Patients' : 'Settings'}
              </h1>
            </div>
          </header>

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      <Calendar size={24} />
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{todayCount}</span>
                  </div>
                  <h3 className="text-slate-500 font-medium">Today's Appointments</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                      <Clock size={24} />
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{pendingCount}</span>
                  </div>
                  <h3 className="text-slate-500 font-medium">Pending Requests</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                      <Activity size={24} />
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{appointments.length}</span>
                  </div>
                  <h3 className="text-slate-500 font-medium">Total Appointments</h3>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <h3 className="text-lg font-bold text-slate-900">Appointments</h3>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['today', 'upcoming', 'pending', 'all'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          filter === f 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-slate-500">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading appointments...
                  </div>
                ) : appointments.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <Calendar size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-1">No appointments found</h3>
                    <p className="text-slate-500">No appointments match the selected filter.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {appointments.map((appointment) => (
                      <div key={appointment.id} className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                              <User size={24} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">{appointment.patient?.user?.full_name || 'Patient'}</h4>
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                  <Mail size={14} />
                                  <span>{appointment.patient?.user?.email}</span>
                                </div>
                                {appointment.patient?.phone_number && (
                                  <div className="flex items-center gap-2 text-sm text-slate-500">
                                    <Phone size={14} />
                                    <span>{appointment.patient.phone_number}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                <Calendar size={16} className="text-slate-400" />
                                <span>{formatDate(appointment.appointment_date)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Clock size={16} className="text-slate-400" />
                                <span>{formatTime(appointment.appointment_time)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              {getStatusBadge(appointment.status)}
                              
                              {appointment.status === 'pending' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                                    disabled={processingId === appointment.id}
                                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                                    title="Confirm"
                                  >
                                    <Check size={18} />
                                  </button>
                                  <button
                                    onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                                    disabled={processingId === appointment.id}
                                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                                    title="Reject"
                                  >
                                    <X size={18} />
                                  </button>
                                </div>
                              )}

                              {appointment.status === 'confirmed' && (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                                    disabled={processingId === appointment.id}
                                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
                                    title="Complete"
                                  >
                                    <Check size={18} />
                                  </button>
                                  <button
                                    onClick={() => updateAppointmentStatus(appointment.id, 'no-show')}
                                    disabled={processingId === appointment.id}
                                    className="p-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50"
                                    title="No Show"
                                  >
                                    <X size={18} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Full Schedule</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {appointments
                  .filter(apt => new Date(apt.appointment_date) >= new Date().setHours(0,0,0,0))
                  .length === 0 ? (
                    <div className="p-12 text-center text-slate-500">No upcoming appointments scheduled.</div>
                  ) : (
                    appointments
                      .filter(apt => new Date(apt.appointment_date) >= new Date().setHours(0,0,0,0))
                      .map((appointment) => (
                        <div key={appointment.id} className="p-6 hover:bg-slate-50 transition-colors">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                <User size={24} />
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-900">{appointment.patient?.user?.full_name || 'Patient'}</h4>
                                <p className="text-sm text-slate-500">{appointment.patient?.user?.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-8">
                              <div className="text-right">
                                <div className="text-sm font-medium text-slate-900">{formatDate(appointment.appointment_date)}</div>
                                <div className="text-sm text-slate-500">{formatTime(appointment.appointment_time)}</div>
                              </div>
                              {getStatusBadge(appointment.status)}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">My Patients</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Visit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.from(new Set(appointments.map(a => a.patient?.id)))
                      .map(id => appointments.find(a => a.patient?.id === id)?.patient)
                      .filter(Boolean)
                      .map(patient => (
                        <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
                                {patient.user?.full_name?.charAt(0) || 'P'}
                              </div>
                              <span className="font-medium text-slate-900">{patient.user?.full_name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <div className="text-sm text-slate-900">{patient.user?.email}</div>
                              <div className="text-xs text-slate-500">{patient.phone_number || 'No phone'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                            {formatDate(
                              appointments
                                .filter(a => a.patient_id === patient.id)
                                .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date))[0]?.appointment_date
                            )}
                          </td>
                        </tr>
                      ))}
                    {appointments.length === 0 && (
                      <tr>
                        <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No patients found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900">Account Settings</h3>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User size={18} />
                      </div>
                      <input type="text" value={userProfile?.full_name || ''} disabled className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Email</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail size={18} />
                      </div>
                      <input type="email" value={user?.email || ''} disabled className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Specialty</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Activity size={18} />
                      </div>
                      <input type="text" value={doctorData?.specialty || ''} disabled className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500" />
                    </div>
                  </div>
                  <div className="bg-blue-50 text-blue-700 p-4 rounded-xl text-sm">
                    To update your profile details or specialty, please contact the system administrator.
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

export default withDoctor(DoctorDashboard);
