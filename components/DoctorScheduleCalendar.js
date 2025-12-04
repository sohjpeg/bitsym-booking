import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, MoreVertical } from 'lucide-react';

export default function DoctorScheduleCalendar({ appointments = [] }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewFilter, setViewFilter] = useState('all'); // 'all', 'confirmed', 'pending'
  const scrollContainerRef = useRef(null);

  // Scroll to 8 AM on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      const hourHeight = 80; // Height of one hour slot
      scrollContainerRef.current.scrollTop = 8 * hourHeight;
    }
  }, []);

  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + direction);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Filter appointments for the selected date
  const dailyAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.appointment_date);
    const isSameDay = aptDate.getDate() === selectedDate.getDate() &&
                      aptDate.getMonth() === selectedDate.getMonth() &&
                      aptDate.getFullYear() === selectedDate.getFullYear();
    
    if (!isSameDay) return false;
    if (viewFilter === 'all') return true;
    return apt.status === viewFilter;
  });

  // Generate time slots (7 AM to 6 PM)
  const startHour = 7;
  const endHour = 18;
  const timeSlots = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  // Helper to calculate position and height
  const getAppointmentStyle = (timeString, durationMinutes = 30) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutesFromStart = (hours - startHour) * 60 + minutes;
    const top = (totalMinutesFromStart / 60) * 80; // 80px per hour
    const height = (durationMinutes / 60) * 80;
    
    return {
      top: `${top}px`,
      height: `${height}px`,
    };
  };

  // Calculate current time line position
  const getCurrentTimePosition = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours < startHour || hours > endHour) return null;
    
    const totalMinutesFromStart = (hours - startHour) * 60 + minutes;
    return (totalMinutesFromStart / 60) * 80;
  };

  const currentTimeTop = isToday(selectedDate) ? getCurrentTimePosition() : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[800px]">
      {/* Header Section */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="flex items-center bg-slate-100 rounded-lg p-1">
            <button 
              onClick={() => navigateDate(-1)}
              className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-500 hover:text-slate-900"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={goToToday}
              className="px-3 py-1 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              Today
            </button>
            <button 
              onClick={() => navigateDate(1)}
              className="p-1 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-500 hover:text-slate-900"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {formatDate(selectedDate)}
          </h2>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            {['all', 'confirmed', 'pending'].map((f) => (
              <button
                key={f}
                onClick={() => setViewFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                  viewFilter === f 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative custom-scrollbar"
      >
        <div className="relative min-h-[960px]"> {/* 12 hours * 80px */}
          
          {/* Time Slots (Y-Axis) */}
          {timeSlots.map((hour) => (
            <div key={hour} className="flex border-b border-slate-50 h-[80px]">
              <div className="w-20 flex-shrink-0 border-r border-slate-100 bg-slate-50/50 text-xs text-slate-500 font-medium p-2 text-right">
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
              </div>
              <div className="flex-1 relative group">
                {/* Half-hour guideline */}
                <div className="absolute top-1/2 left-0 right-0 border-t border-slate-50 border-dashed opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          ))}

          {/* Current Time Indicator */}
          {currentTimeTop !== null && (
            <div 
              className="absolute left-20 right-0 border-t-2 border-red-500 z-10 pointer-events-none flex items-center"
              style={{ top: `${currentTimeTop}px` }}
            >
              <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5"></div>
            </div>
          )}

          {/* Appointment Cards */}
          <div className="absolute top-0 left-20 right-0 bottom-0 pointer-events-none">
            {dailyAppointments.map((apt) => {
              const style = getAppointmentStyle(apt.appointment_time);
              const isConfirmed = apt.status === 'confirmed';
              const isCompleted = apt.status === 'completed';
              const isPending = apt.status === 'pending';
              
              let bgColor = 'bg-blue-50';
              let borderColor = 'border-l-blue-500';
              let textColor = 'text-blue-900';

              if (isConfirmed) {
                bgColor = 'bg-green-50';
                borderColor = 'border-l-green-500';
                textColor = 'text-green-900';
              } else if (isPending) {
                bgColor = 'bg-amber-50';
                borderColor = 'border-l-amber-500';
                textColor = 'text-amber-900';
              } else if (isCompleted) {
                bgColor = 'bg-slate-100';
                borderColor = 'border-l-slate-500';
                textColor = 'text-slate-900';
              }

              return (
                <div
                  key={apt.id}
                  className={`absolute left-2 right-2 md:left-4 md:right-4 p-3 rounded-r-lg border-l-4 ${bgColor} ${borderColor} shadow-sm hover:shadow-md transition-all cursor-pointer pointer-events-auto flex flex-col justify-center`}
                  style={style}
                  onClick={() => alert(`Viewing details for ${apt.patient?.user?.full_name}`)}
                >
                  <div className="flex justify-between items-start">
                    <span className={`font-bold text-sm ${textColor} truncate`}>
                      {apt.patient?.user?.full_name || 'Unknown Patient'}
                    </span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/50 ${textColor} border border-black/5`}>
                      {apt.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs opacity-80">
                    <Clock size={12} />
                    <span>
                      {apt.appointment_time.slice(0, 5)} - {
                        // Calculate end time (assuming 30 mins for now)
                        (() => {
                          const [h, m] = apt.appointment_time.split(':').map(Number);
                          const date = new Date();
                          date.setHours(h, m + 30);
                          return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                        })()
                      }
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
