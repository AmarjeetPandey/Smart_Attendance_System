import React, { useEffect, useState } from "react";

export default function Dashboard({ session, onLogout }) {
  const [data, setData] = useState({ stats: {}, courses: [], recent: [] });

  useEffect(() => {
    fetch("/api/dashboard", { credentials: "include" })
      .then((response) => response.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const stats = data.stats;
  const today = new Date().toISOString().slice(0, 10);

  return <>
    <header className="topbar">
      <a className="brand" href="#dashboard"><span className="brand-mark">SA</span><span>Smart Attendance<small>Control center</small></span></a>
      <nav id="main-navigation"><a className="active" href="#dashboard">Dashboard</a><a href="#students">Students</a><a href="#attendance">Attendance</a><a href="#profile">Admin profile</a><button className="logout" onClick={onLogout}>Log out</button></nav>
    </header>
    <main className="page-shell">
      <div className="page-heading"><div><div className="eyebrow">Overview / {today}</div><h1>Good afternoon.</h1><p className="muted">Your attendance command center for the selected date.</p></div><div className="heading-actions"><button className="btn secondary">Export CSV</button><div className="overview-date"><label htmlFor="overview_date">Overview date</label><input id="overview_date" type="date" defaultValue={today} /></div></div></div>
      <div className="stats stats-five">
        <Stat label="Total students" value={stats.students || 0} note="Registered students" />
        <Stat label="Present today" value={stats.present || 0} note={today} />
        <Stat label="Absent today" value={stats.absent || 0} note={today} />
        <Stat label="Late students" value={stats.late || 0} note={today} />
        <Stat label="Average attendance" value={`${stats.average_attendance || 0}%`} note="Selected date" />
        <Stat label="Students below 75%" value={stats.students_below_75 || 0} note="Needs follow-up" warning />
      </div>
      <section className="panel"><div className="panel-head"><div><h2>Admin panel</h2><p className="panel-subtitle">Quick access to student, teacher, attendance, reports, and analytics tools.</p></div></div><div className="stats stats-four"><Stat label="Student management" value={stats.students || 0} note="Registered students" link="Open student list" /><Stat label="Class / subject" value={stats.courses || 0} note="Active courses" link="View course analytics" /><Stat label="Attendance monitoring" value={stats.present || 0} note="Present today" link="Open attendance register" /><Stat label="Reports" value={stats.pending_leave_requests || 0} note="Pending leave requests" link="Export CSV report" /></div><div className="inline-actions"><button className="btn secondary">Student management</button><button className="btn secondary">Teacher management</button><button className="btn secondary">Attendance monitoring</button><button className="btn secondary">Leave management</button><button className="btn secondary">Attendance calendar</button><button className="btn secondary">Reports</button></div></section>
      <div className="chart-grid"><section className="panel chart-panel"><div className="panel-head"><h2>Today&apos;s attendance</h2><button className="btn secondary">Edit</button></div><div className="chart-wrap"><div className="empty-state"><strong>{stats.present || 0} present today</strong><span>Attendance chart is ready for today&apos;s register.</span></div></div></section><section className="panel chart-panel"><div className="panel-head"><h2>Monthly attendance graph</h2><button className="btn secondary">Mark attendance</button></div><div className="chart-wrap wide"><div className="empty-state"><strong>Monthly attendance</strong><span>Daily attendance activity will appear here.</span></div></div></section></div>
      <section className="panel"><div className="panel-head"><div><h2>Subject-wise attendance</h2><p className="panel-subtitle">Course-level performance for {today}</p></div></div>{data.courses.length ? <table><thead><tr><th>Course</th><th>Students</th><th>Present</th><th>Absent</th><th>Late</th><th>Attendance</th></tr></thead><tbody>{data.courses.map((course) => <tr key={course.course}><td>{course.course}</td><td>{course.total_students}</td><td>{course.present}</td><td>{course.absent}</td><td>{course.late}</td><td><span className={`badge ${course.percentage < 70 ? "danger" : "success"}`}>{course.percentage}%</span></td></tr>)}</tbody></table> : <div className="empty-state"><strong>No course analytics available</strong><span>There are no students configured yet for this date.</span></div>}</section>
      <section className="panel"><div className="panel-head"><div><h2>Recent attendance</h2><p className="panel-subtitle">Latest marked entries for {today}</p></div><button className="text-link">Open register &rarr;</button></div>{data.recent.length ? <table><thead><tr><th>Student</th><th>Roll number</th><th>Date</th><th>Status</th></tr></thead><tbody>{data.recent.map((row) => <tr key={`${row.roll_number}-${row.attendance_date}`}><td><strong>{row.name}</strong></td><td>{row.roll_number}</td><td>{row.attendance_date}</td><td><span className={`badge ${row.status.toLowerCase()}`}>{row.status}</span></td></tr>)}</tbody></table> : <div className="empty-state"><strong>No attendance recorded</strong><span>Start marking students for this date to see activity here.</span></div>}</section>
    </main>
  </>;
}

function Stat({ label, value, note, warning, link }) {
  return <div className={`stat ${warning ? "stat-warning" : ""}`}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><small className="muted">{note}</small>{link && <div><button className="text-link">{link}</button></div>}</div>;
}