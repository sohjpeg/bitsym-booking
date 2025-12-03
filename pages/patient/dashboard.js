import { useAuth } from '../../contexts/AuthContext';
import { withPatient } from '../../lib/withAuth';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { 
  LayoutDashboard, 
  Calendar, 
  User, 
  Settings, 
  LogOut, 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Stethoscope,
  MapPin,
  Phone,
  Mail,
  Plus,
  Users
} from 'lucide-react';
import VoiceBookingButton from '../../components/VoiceBookingButton';

function PatientDashboard() {
  const router = useRouter();
  const { user, session, userProfile, loading: authLoading, signOut } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const isInitialMount = useRef(true);

  // Sync activeTab with URL hash on mount
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && ['dashboard', 'appointments', 'profile', 'settings', 'doctors'].includes(hash)) {
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



  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      if (authLoading) return;
      if (!user || !session) return;
      
      try {
        setLoading(true);
        
        const token = session.access_token;

        if (!token) {
          console.warn('No access token available, skipping data fetch');
          setLoading(false);
          return;
        }

        await Promise.all([
          fetchPatientData(token),
          fetchAppointments(token),
          fetchDoctors(token)
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
  }, [user, session, authLoading]);

  const fetchPatientData = async (token) => {
    try {
      if (!token) {
        console.error('No token provided for patient data');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch('/api/patient/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            setPatientData(null);
            return;
          }
          throw new Error('Failed to fetch patient profile');
        }

        const data = await response.json();
        setPatientData(data);
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          console.error('Fetch aborted due to timeout');
        } else {
          throw fetchError;
        }
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
    }
  };

  const fetchAppointments = async (token) => {
    try {
      if (!token) {
        console.error('No token provided for appointments');
        return;
      }

      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await fetch('/api/patient/appointments', {
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
    }
  };

  const fetchDoctors = async (token) => {
    try {
      const response = await fetch('/api/patient/doctors-availability', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDoctors(data || []);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
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

  const now = new Date();

  const pendingAppointments = appointments.filter(
    (apt) => apt.status === 'pending'
  );

  const confirmedAppointments = appointments.filter(
    (apt) => {
      if (apt.status !== 'confirmed') return false;
      const aptDate = new Date(`${apt.appointment_date}T${apt.appointment_time}`);
      return aptDate >= now;
    }
  );

  const pastAppointments = appointments.filter(
    (apt) => {
      const isPastConfirmed = apt.status === 'confirmed' && new Date(`${apt.appointment_date}T${apt.appointment_time}`) < now;
      return apt.status === 'cancelled' || apt.status === 'completed' || apt.status === 'no-show' || apt.status === 'rejected' || isPastConfirmed;
    }
  );

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
        <title>Patient Dashboard - MedBook</title>
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
            <NavItem id="appointments" icon={Calendar} label="Appointments" />
            <NavItem id="doctors" icon={Users} label="Doctors" />
            <NavItem id="profile" icon={User} label="Profile" />
            <NavItem id="settings" icon={Settings} label="Settings" />
          </nav>

          <div className="p-4 border-t border-slate-100">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                {userProfile?.full_name?.charAt(0) || 'P'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {userProfile?.full_name || 'Patient'}
                </p>
                <p className="text-xs text-slate-500 truncate">Patient Account</p>
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
                {activeTab === 'dashboard' ? `Hello, ${userProfile?.full_name?.split(' ')[0] || 'Patient'}! 👋` :
                 activeTab === 'appointments' ? 'My Appointments' :
                 activeTab === 'doctors' ? 'Doctors & Availability' :
                 activeTab === 'profile' ? 'My Profile' : 'Settings'}
              </h1>
            </div>
            <Link 
              href="/book" 
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-200 transition-all hover:scale-105 active:scale-95"
            >
              <Plus size={20} />
              <span>Book Appointment</span>
            </Link>
          </header>

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                      <Clock size={24} />
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{pendingAppointments.length}</span>
                  </div>
                  <h3 className="text-slate-500 font-medium">Pending Requests</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                      <Calendar size={24} />
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{confirmedAppointments.length}</span>
                  </div>
                  <h3 className="text-slate-500 font-medium">Upcoming Visits</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                      <CheckCircle size={24} />
                    </div>
                    <span className="text-2xl font-bold text-slate-900">{pastAppointments.length}</span>
                  </div>
                  <h3 className="text-slate-500 font-medium">Completed Visits</h3>
                </div>
              </div>

              {/* Pending Requests */}
              {pendingAppointments.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-900">Pending Requests</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {pendingAppointments.map((appointment) => (
                      <div key={appointment.id} className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                              <Stethoscope size={24} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">{appointment.doctor?.user?.full_name || 'Doctor'}</h4>
                              <p className="text-sm text-slate-500">{appointment.doctor?.specialty || 'General'}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                                  <Calendar size={14} />
                                  <span>{formatDate(appointment.appointment_date)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock size={14} />
                                  <span>{formatTime(appointment.appointment_time)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {getStatusBadge(appointment.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Appointments */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900">Upcoming Appointments</h3>
                </div>
                
                {loading ? (
                  <div className="p-12 text-center text-slate-500">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    Loading appointments...
                  </div>
                ) : confirmedAppointments.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <Calendar size={32} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-1">No upcoming appointments</h3>
                    <p className="text-slate-500 mb-6">You don't have any confirmed appointments scheduled.</p>
                    {pendingAppointments.length === 0 && (
                      <Link href="/book" className="text-blue-600 font-medium hover:underline">
                        Book your first appointment →
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {confirmedAppointments.map((appointment) => (
                      <div key={appointment.id} className="p-6 hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                              <Stethoscope size={24} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-900">{appointment.doctor?.user?.full_name || 'Doctor'}</h4>
                              <p className="text-sm text-slate-500">{appointment.doctor?.specialty || 'General'}</p>
                              <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                                  <Calendar size={14} />
                                  <span>{formatDate(appointment.appointment_date)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock size={14} />
                                  <span>{formatTime(appointment.appointment_time)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {getStatusBadge(appointment.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">All Appointments</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {appointments.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">No appointments found.</div>
                ) : (
                  appointments.map((appointment) => (
                    <div key={appointment.id} className="p-6 hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            appointment.status === 'confirmed' ? 'bg-green-100 text-green-600' :
                            appointment.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            <Stethoscope size={24} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-900">{appointment.doctor?.user?.full_name || 'Doctor'}</h4>
                            <p className="text-sm text-slate-500">{appointment.doctor?.specialty || 'General'}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                              <div className="flex items-center gap-1">
                                <Calendar size={14} />
                                <span>{formatDate(appointment.appointment_date)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>{formatTime(appointment.appointment_time)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(appointment.status)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'doctors' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {doctors.map((doctor) => (
                <div key={doctor.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                        {doctor.name.charAt(0)}
                      </div>
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                        {doctor.specialty}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{doctor.name}</h3>
                    <p className="text-sm text-slate-500 mb-4">{doctor.email}</p>
                    
                    <div className="space-y-2 mb-6">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Clinic Timings</h4>
                      {doctor.schedule.length > 0 ? (
                        <div className="space-y-1">
                          {doctor.schedule.map((slot, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-slate-600 font-medium">{slot.day}</span>
                              <span className="text-slate-500">{slot.start} - {slot.end}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-400 italic">No schedule available</p>
                      )}
                    </div>

                    <Link 
                      href="/book"
                      className="block w-full py-2.5 bg-blue-50 text-blue-600 text-center rounded-xl font-medium hover:bg-blue-100 transition-colors"
                    >
                      Book Appointment
                    </Link>
                  </div>
                </div>
              ))}
              {doctors.length === 0 && !loading && (
                <div className="col-span-full text-center py-12 text-slate-500">
                  No doctors found.
                </div>
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900">Personal Information</h3>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Full Name</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <User size={18} />
                        </div>
                        <input 
                          type="text" 
                          value={userProfile?.full_name || ''} 
                          disabled 
                          className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Email Address</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Mail size={18} />
                        </div>
                        <input 
                          type="email" 
                          value={user?.email || ''} 
                          disabled 
                          className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Phone Number</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Phone size={18} />
                        </div>
                        <input 
                          type="text" 
                          value={patientData?.phone_number || ''} 
                          disabled 
                          placeholder="Not set"
                          className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Date of Birth</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <Calendar size={18} />
                        </div>
                        <input 
                          type="text" 
                          value={patientData?.date_of_birth || ''} 
                          disabled 
                          placeholder="Not set"
                          className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                  <Settings size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Settings</h3>
                <p className="text-slate-500">Account settings and preferences coming soon.</p>
              </div>
            </div>
          )}
        </main>
      </div>
      <VoiceBookingButton />
    </>
  );
}

export default withPatient(PatientDashboard);
