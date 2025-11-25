import { useMemo } from 'react';
import styles from '@/styles/Calendar.module.css';

export default function Calendar({ bookingData }) {
  const calendarData = useMemo(() => {
    if (!bookingData?.appointment) return null;

    const appointmentDate = new Date(bookingData.appointment.date);
    const appointmentTime = bookingData.appointment.time;

    // Get calendar month data
    const year = appointmentDate.getFullYear();
    const month = appointmentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const monthDays = lastDay.getDate();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    return {
      monthName: monthNames[month],
      year,
      startingDayOfWeek,
      monthDays,
      bookedDay: appointmentDate.getDate(),
      bookedTime: appointmentTime,
      doctor: bookingData.appointment.doctor,
      specialty: bookingData.appointment.specialty
    };
  }, [bookingData]);

  if (!calendarData) return null;

  const { monthName, year, startingDayOfWeek, monthDays, bookedDay, bookedTime, doctor, specialty } = calendarData;

  // Generate calendar days
  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className={styles.calendarDay}></div>);
  }
  for (let day = 1; day <= monthDays; day++) {
    const isBooked = day === bookedDay;
    days.push(
      <div
        key={day}
        className={`${styles.calendarDay} ${isBooked ? styles.bookedDay : ''}`}
      >
        {day}
        {isBooked && (
          <div className={styles.bookingInfo}>
            <div className={styles.time}>{bookedTime}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.calendarHeader}>
        <h3>{monthName} {year}</h3>
      </div>
      
      <div className={styles.appointmentDetails}>
        <p><strong>Doctor:</strong> {doctor}</p>
        <p><strong>Specialty:</strong> {specialty}</p>
        <p><strong>Date:</strong> {monthName} {bookedDay}, {year}</p>
        <p><strong>Time:</strong> {bookedTime}</p>
      </div>

      <div className={styles.weekDays}>
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>
      
      <div className={styles.calendarGrid}>
        {days}
      </div>
    </div>
  );
}
