import React, { useEffect, useRef, useState } from "react";
import { apiRequest } from "./services/api";

async function postForm(path, event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitter = event.nativeEvent.submitter;
  if (submitter) submitter.disabled = true;
  try {
    const data = await apiRequest(path, { method: "POST", body: new FormData(form) });
    form.reset();
    return data;
  } finally {
    if (submitter) submitter.disabled = false;
  }
}

function panelAnchor(title) {
  const anchors = { "Attendance analysis": "dashboard", "Add student": "students", "Mark attendance": "attendance", "Add subject result": "results", "Leave requests": "leave-requests", "My attendance analysis": "my-attendance", "My subject results": "my-results" };
  return anchors[title] || undefined;
}
function Panel({ title, subtitle, id, children }) {
  return <section className="panel" id={id || panelAnchor(title)}><div className="panel-head"><div><h2>{title}</h2>{subtitle && <p className="panel-subtitle">{subtitle}</p>}</div></div>{children}</section>;
}
function Field({ label, name, type = "text", required = true, defaultValue }) { return <div><label htmlFor={name}>{label}</label><input id={name} name={name} type={type} required={required} defaultValue={defaultValue} /></div>; }
function localDate() { const date = new Date(); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10); }
function Stat({ label, value, note }) { return <div className="stat"><div className="stat-label">{label}</div><div className="stat-value">{value}</div><small className="muted">{note}</small></div>; }
function AnalysisBars({ items }) { const max = Math.max(...items.map((item) => item.value), 1); return <div className="analysis-bars">{items.map((item) => <div className="analysis-bar-row" key={item.label}><span>{item.label}</span><div className="analysis-track"><i className={item.tone || "teal"} style={{ width: `${Math.max(item.value / max * 100, item.value ? 8 : 0)}%` }} /></div><strong>{item.value}</strong></div>)}</div>; }
function TeacherCourseAssignments({ teachers, courses, assignments, onSaved, onNotice }) {
  const [busy, setBusy] = useState(false);
  const classes = courses.filter((course) => course.type === "Class");
  const subjects = courses.filter((course) => course.type === "Subject");
  async function assign(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try {
      await apiRequest("/api/admin/teacher-courses", { method: "POST", body: new FormData(form) });
      form.reset();
      onNotice("Teacher-course assignment saved.");
      onSaved();
    } catch (error) {
      onNotice(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(assignment) {
    try {
      const query = new URLSearchParams({ teacher_id: assignment.teacher_id, course_id: assignment.course_id });
      if (assignment.class_id) query.set("class_id", assignment.class_id);
      await apiRequest(`/api/admin/teacher-courses?${query}`, { method: "DELETE" });
      onNotice("Teacher class-course assignment removed.");
      onSaved();
    } catch (error) {
      onNotice(error.message);
    }
  }
  return <Panel title="Teacher-class-course assignments" subtitle="Select one class and one course for each teacher assignment"><form className="inline-form" onSubmit={assign}><select name="teacher_id" required defaultValue=""><option value="" disabled>Select teacher</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select><select name="class_id" required defaultValue=""><option value="" disabled>Select class</option>{classes.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select><select name="course_id" required defaultValue=""><option value="" disabled>Select course</option>{subjects.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select><button className="btn" type="submit" disabled={busy}>{busy ? "Saving..." : "Assign teacher"}</button></form><div className="analysis-pills">{assignments.map((assignment) => <b key={`${assignment.teacher_id}-${assignment.class_id ?? "legacy"}-${assignment.course_id}`}>{assignment.teacher_name} / {assignment.assignment_kind === "pair" ? `${assignment.class_name} / ${assignment.course_name}` : `Existing ${assignment.course_type}: ${assignment.course_name}`} <button className="text-link" type="button" onClick={() => remove(assignment)}>Remove</button></b>)}{!assignments.length && <span className="muted">No assignments yet.</span>}</div></Panel>;
}

const FACE_MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";

function loadFaceApi() {
  if (window.faceapi) return Promise.resolve(window.faceapi);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.min.js";
    script.onload = () => resolve(window.faceapi);
    script.onerror = () => reject(new Error("Face recognition library could not be loaded"));
    document.head.appendChild(script);
  });
}

function FaceEnrollment({ student, onDone }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [faceUrl, setFaceUrl] = useState("");

  async function captureFace() {
    setBusy(true);
    setMessage("Loading camera and face model...");
    try {
      const faceapi = await loadFaceApi();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
      ]);
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }
      setMessage("Center the student's face and press capture again.");
      const result = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      if (!result) throw new Error("No clear face found. Try again with better lighting.");
      const response = await fetch(`/api/teacher/students/${student.id}/face`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ descriptor: Array.from(result.descriptor), class_id: student.course_id, face_url: faceUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Face enrollment failed");
      setMessage("Face enrolled successfully.");
      onDone();
    } catch (error) {
      setMessage(error.message || "Camera access failed");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  return <div className="face-enroll-box"><video ref={videoRef} muted playsInline className="face-preview" /><input value={faceUrl} onChange={(event) => setFaceUrl(event.target.value)} placeholder="Online face image URL (optional)" type="url" /><button className="btn secondary" type="button" onClick={captureFace} disabled={busy}>{busy ? "Capturing..." : "Open / capture face"}</button><small className="muted">{message}</small></div>;
}

function FaceAttendance({ classId, subjects, onSaved }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Camera attendance is ready after face enrollment.");
  const [subject, setSubject] = useState("");
  async function scanFace() {
    setBusy(true);
    try {
      if (!classId || !subject) throw new Error("Select a class and subject first.");
      const faceapi = await loadFaceApi();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(FACE_MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(FACE_MODEL_URL),
      ]);
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();
      }
      const response = await fetch(`/api/teacher/face-students?class_id=${classId}&subject=${encodeURIComponent(subject)}`, { credentials: "include" });
      const enrolled = await response.json();
      if (!response.ok) throw new Error(enrolled.detail || "Could not load enrolled faces.");
      if (!enrolled.students.length) throw new Error("Enroll a student face first.");
      const result = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
      if (!result) throw new Error("No clear face found.");
      const matcher = new faceapi.FaceMatcher(enrolled.students.map((item) => new faceapi.LabeledFaceDescriptors(String(item.id), [new Float32Array(item.descriptor)])), 0.5);
      const match = matcher.findBestMatch(result.descriptor);
      if (match.label === "unknown") throw new Error("Student face was not recognized.");
      const attendanceResponse = await fetch("/api/teacher/face-attendance", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: Number(match.label), class_id: Number(classId), subject, attendance_date: new Date().toISOString().slice(0, 10) }) });
      const data = await attendanceResponse.json();
      if (!attendanceResponse.ok) throw new Error(data.detail || "Attendance could not be saved");
      setMessage(`${enrolled.students.find((item) => String(item.id) === match.label)?.name || "Student"} marked Present.`);
      onSaved();
    } catch (error) {
      setMessage(error.message || "Camera access failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);
  useEffect(() => { setSubject(""); }, [classId]);
  return <Panel title="Face attendance" subtitle="Scan an enrolled student in the selected subject"><div className="face-attendance-box"><video ref={videoRef} muted playsInline className="face-preview" /><label htmlFor="face_attendance_subject">Subject</label><select id="face_attendance_subject" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!subjects.length}><option value="">Select subject</option>{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="btn" type="button" onClick={scanFace} disabled={busy || !classId || !subject}>{busy ? "Scanning..." : "Open camera / scan face"}</button><span className="muted">{message}</span></div></Panel>;
}

function QrAttendance({ className, subjects, onSaved }) {
  const [qr, setQr] = useState(null);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  useEffect(() => { setQr(null); setMessage(""); setSubject(""); }, [className]);
  async function generate() {
    if (!className || !subject) { setMessage("Select a class and subject first."); return; }
    const response = await fetch(`/api/teacher/qr?course=${encodeURIComponent(className)}&subject=${encodeURIComponent(subject)}`, { credentials: "include" });
    const data = await response.json();
    if (!response.ok) { setMessage(data.detail || "QR generation failed"); return; }
    setQr(data);
    setMessage("Students can scan this QR once and verify their registered details.");
    onSaved?.();
  }
  return <Panel title="QR attendance" subtitle="Generate a one-time QR for the selected subject"><label htmlFor="qr_attendance_subject">Subject</label><select id="qr_attendance_subject" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!subjects.length}><option value="">Select subject</option>{subjects.map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="btn" type="button" onClick={generate} disabled={!className || !subject}>Generate QR</button>{qr && <div className="qr-attendance-box"><img src={`data:image/png;base64,${qr.qr_data}`} alt="Attendance QR code" /><input value={qr.scan_url} readOnly onFocus={(event) => event.target.select()} /><small className="muted">{message}</small></div>}{!qr && <p className="muted">{message}</p>}</Panel>;
}
function Shell({ session, onLogout, children, links }) {
  return <div className={`workspace role-${session.role}`}><header className="topbar"><a className="brand" href="#home"><span className="brand-mark">SA</span><span>Smart Attendance<small>Control center</small></span></a><nav id="main-navigation">{links.map((link) => <a key={link} href={`#${link.toLowerCase().replaceAll(" ", "-")}`}>{link}</a>)}<button className="logout" onClick={onLogout}>Log out</button></nav></header><main className="page-shell"><div className="page-heading"><div><div className="eyebrow">{session.role} workspace</div><h1>{session.role === "admin" ? "College control center" : `${session.name || session.username} Dashboard`}</h1><p className="muted">Manage the same attendance workflow with role-based access.</p></div><div className="role-badge"><span className="role-dot" />{session.role} view</div></div>{children}</main></div>;
}

export default function RoleWorkspace({ session, onLogout }) {
  if (session.role === "admin") return <AdminWorkspace session={session} onLogout={onLogout} />;
  if (session.role === "teacher") return <TeacherWorkspace session={session} onLogout={onLogout} />;
  return <StudentWorkspace session={session} onLogout={onLogout} />;
}

function AdminWorkspace({ session, onLogout }) {
  const [data, setData] = useState({ counts: {}, teachers: [], students: [], courses: [], exams: [], assignments: [] });
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [showResetControls, setShowResetControls] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [editingCourse, setEditingCourse] = useState(null);
  const [editingExam, setEditingExam] = useState(null);
  const refresh = () => { setLoading(true); return apiRequest("/api/admin/overview").then(setData).catch((error) => setNotice(error.message)).finally(() => setLoading(false)); };
  useEffect(() => { refresh(); }, []);
  const submit = (path) => async (event) => { try { await postForm(path, event); setNotice("Saved successfully."); refresh(); } catch (error) { setNotice(error.message); } };
  async function saveResource(path, event, successMessage, onDone) {
    event.preventDefault();
    const response = await fetch(path, { method: "PUT", credentials: "include", body: new FormData(event.currentTarget) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(result.detail || "Changes could not be saved."); return; }
    onDone();
    setNotice(successMessage);
    refresh();
  }
  async function removeResource(path, message, successMessage) {
    if (!window.confirm(message)) return;
    const response = await fetch(path, { method: "DELETE", credentials: "include" });
    const result = await response.json().catch(() => ({}));
    setNotice(response.ok ? successMessage : (result.detail || "Item could not be deleted."));
    if (response.ok) refresh();
  }
  const saveTeacher = (event) => saveResource(`/api/admin/teachers/${editingTeacher.id}`, event, "Teacher account updated.", () => setEditingTeacher(null));
  const saveCourse = (event) => saveResource(`/api/admin/courses/${editingCourse.id}`, event, "Class / course updated.", () => setEditingCourse(null));
  async function saveExam(event) {
    event.preventDefault();
    const response = await fetch(`/api/admin/exams/${editingExam.id}`, { method: "PUT", credentials: "include", body: new FormData(event.currentTarget) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setNotice(result.detail || "Exam schedule could not be updated."); return; }
    setEditingExam(null);
    setNotice("Exam schedule updated.");
    refresh();
  }
  async function removeExam(exam) {
    if (!window.confirm(`Delete the ${exam.subject} exam scheduled for ${exam.exam_date}?`)) return;
    const response = await fetch(`/api/admin/exams/${exam.id}`, { method: "DELETE", credentials: "include" });
    const result = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Exam schedule deleted." : (result.detail || "Exam schedule could not be deleted."));
    if (response.ok) refresh();
  }
  async function resetData(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setResetting(true);
    try {
      const result = await apiRequest("/api/admin/reset-data", { method: "POST", body: new FormData(form) });
      form.reset();
      setShowResetControls(false);
      setNotice(`${result.scope} data cleared. The dashboard is ready for new data.`);
      await refresh();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setResetting(false);
    }
  }
  return <Shell session={session} onLogout={onLogout} links={["Dashboard", "Students", "Teachers", "Classes", "Exams"]}>
    {notice && <div className="flash success">{notice}</div>}{loading && <div className="flash">Loading dashboard...</div>}
    <Panel title="Clear saved data" subtitle="Choose which records to remove. Your current admin login is preserved.">
      {!showResetControls ? <button className="delete-btn" type="button" onClick={() => setShowResetControls(true)}>Open data reset</button> : <form onSubmit={resetData}>
        <div className="form-row"><div><label htmlFor="reset_scope">Data group</label><select id="reset_scope" name="scope" required defaultValue=""><option value="" disabled>Select data group</option><option value="admin">Admin-managed data</option><option value="teachers">Teachers</option><option value="students">Students</option><option value="ALLCLEAR">ALLCLEAR</option></select></div><Field label={'Type CLEAR to confirm'} name="confirmation" /></div>
        <small className="muted">Admin-managed data includes classes, courses, exams, and attendance-policy settings. Teachers clears assignments and teacher dashboard activity but keeps teacher IDs. Students clears attendance, results, leave requests, face enrollment, and notifications but keeps student IDs and profiles. ALLCLEAR removes all application records while retaining admin accounts and recreating the default organization and policy.</small>
        <div className="form-row"><button className="delete-btn" type="submit" disabled={resetting}>{resetting ? "Clearing..." : "Clear selected data"}</button><button className="btn secondary" type="button" onClick={() => setShowResetControls(false)} disabled={resetting}>Cancel</button></div>
      </form>}
    </Panel>
    <div className="stats stats-four"><Stat label="Teachers" value={data.counts.teachers || 0} note="Managed accounts" /><Stat label="Students" value={data.counts.students || 0} note="College directory" /><Stat label="Classes / courses" value={data.counts.courses || 0} note="Academic groups" /><Stat label="Exam dates" value={data.counts.exams || 0} note="Scheduled exams" /></div>
    <div className="analysis-grid" id="dashboard"><Panel title="College analysis" subtitle="Coverage of the complete academic system"><AnalysisBars items={[{ label: "Students", value: Number(data.counts.students || 0), tone: "teal" }, { label: "Teachers", value: Number(data.counts.teachers || 0), tone: "gold" }, { label: "Courses", value: Number(data.counts.courses || 0), tone: "coral" }, { label: "Exams", value: Number(data.counts.exams || 0), tone: "blue" }]} /></Panel><Panel title="Administration focus" subtitle="Live areas available after sign in"><div className="analysis-callout"><strong>Full analysis workspace</strong><span>Manage people, courses, exams, attendance and leave requests from the panels below.</span><div className="analysis-pills"><b>{data.teachers.length} teacher IDs</b><b>{data.courses.length} courses</b><b>{data.exams.length} scheduled exams</b></div></div></Panel></div>
    <TeacherCourseAssignments teachers={data.teachers} courses={data.courses} assignments={data.assignments} onSaved={refresh} onNotice={setNotice} />
    <AdminStudentDirectory students={data.students} courses={data.courses} onSaved={refresh} onNotice={setNotice} />
    <Panel title="Add student" subtitle="Create a student account and assign it to an admin-created class"><form onSubmit={submit("/api/admin/students")}><div className="form-row"><Field label="Student name" name="name" /><Field label="Student ID" name="username" /></div><div className="form-row"><Field label="Password" name="password" type="password" /><Field label="Roll number" name="roll_number" /></div><div className="form-row"><Field label="Registration number" name="registration_number" /><div><label htmlFor="student_class_id">Class</label><select id="student_class_id" name="class_id" required defaultValue=""><option value="" disabled>Select class</option>{data.courses.filter((course) => course.type === "Class").map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select></div></div><Field label="Email" name="email" required={false} /><button className="btn" type="submit" disabled={!data.courses.some((course) => course.type === "Class")}>Add student</button>{!data.courses.some((course) => course.type === "Class") && <small className="muted">Create a class first to enroll students.</small>}</form></Panel>
    <div className="grid-2"><Panel title="Add teacher" subtitle="Create teacher ID and password"><form onSubmit={submit("/api/admin/teachers")}><div className="form-row"><Field label="Teacher name" name="name" /><Field label="Teacher ID" name="username" /></div><div className="form-row"><Field label="Password" name="password" type="password" /><Field label="Email" name="email" required={false} /></div><button className="btn" type="submit">Add teacher</button></form></Panel><Panel title="Add class / course" subtitle="Make classes and subjects available everywhere"><label htmlFor="new_course_name">Class or course name</label><input id="new_course_name" name="name" form="course-form" required /><form id="course-form" onSubmit={submit("/api/admin/courses")}><label htmlFor="course_type">Type</label><select id="course_type" name="course_type"><option value="Class">Class</option><option value="Subject">Subject</option></select><button className="btn" type="submit">Add class / subject</button></form></Panel></div>
    <div className="grid-2"><Panel id="exams" title="Schedule exam" subtitle="Manage college exam dates"><form onSubmit={submit("/api/admin/exams")}><div className="form-row"><Field label="Class / course" name="course" /><Field label="Subject" name="subject" /></div><Field label="Exam date" name="exam_date" type="date" /><button className="btn" type="submit">Schedule exam</button></form></Panel><Panel id="teachers" title="Teacher accounts"><table><thead><tr><th>Name</th><th>Teacher ID</th><th>Email</th><th>Manage</th></tr></thead><tbody>{data.teachers.map((teacher) => <tr key={teacher.id}>{editingTeacher?.id === teacher.id ? <td colSpan="4"><form className="inline-form" onSubmit={saveTeacher}><input name="name" defaultValue={teacher.name} required /><input name="username" defaultValue={teacher.username} required /><input name="email" type="email" defaultValue={teacher.email || ""} /><input name="password" type="password" placeholder="New password (optional)" /><button className="btn" type="submit">Save</button><button className="btn secondary" type="button" onClick={() => setEditingTeacher(null)}>Cancel</button></form></td> : <><td>{teacher.name}</td><td>{teacher.username}</td><td>{teacher.email || "-"}</td><td><button className="text-link" type="button" onClick={() => setEditingTeacher(teacher)}>Edit</button><button className="delete-btn" type="button" onClick={() => removeResource(`/api/admin/teachers/${teacher.id}`, `Delete teacher account ${teacher.username}?`, "Teacher account deleted.")}>Delete</button></td></>}</tr>)}</tbody></table></Panel></div>
    <Panel id="classes" title="Classes and subjects" subtitle="Manage entries available to the college"><table><thead><tr><th>Name</th><th>Type</th><th>Manage</th></tr></thead><tbody>{data.courses.map((course) => <tr key={course.id}>{editingCourse?.id === course.id ? <td colSpan="3"><form className="inline-form" onSubmit={saveCourse}><input name="name" defaultValue={course.name} required /><select name="course_type" defaultValue={course.type}><option value="Class">Class</option><option value="Subject">Subject</option></select><button className="btn" type="submit">Save</button><button className="btn secondary" type="button" onClick={() => setEditingCourse(null)}>Cancel</button></form></td> : <><td>{course.name}</td><td><span className="badge success">{course.type}</span></td><td><button className="text-link" type="button" onClick={() => setEditingCourse(course)}>Edit</button><button className="delete-btn" type="button" onClick={() => removeResource(`/api/admin/courses/${course.id}`, `Delete ${course.name}?`, "Class / course deleted.")}>Delete</button></td></>}</tr>)}</tbody></table></Panel>
    <Panel id="exams-list" title="College overview" subtitle="Manage all scheduled exams"><table><thead><tr><th>Course</th><th>Subject</th><th>Exam date</th><th>Manage</th></tr></thead><tbody>{data.exams.map((exam) => <tr key={exam.id}>{editingExam?.id === exam.id ? <td colSpan="4"><form className="inline-form" onSubmit={saveExam}><input name="course" defaultValue={exam.course} required /><input name="subject" defaultValue={exam.subject} required /><input name="exam_date" type="date" defaultValue={exam.exam_date} required /><button className="btn" type="submit">Save</button><button className="btn secondary" type="button" onClick={() => setEditingExam(null)}>Cancel</button></form></td> : <><td>{exam.course}</td><td>{exam.subject}</td><td>{exam.exam_date}</td><td><button className="text-link" type="button" onClick={() => setEditingExam(exam)}>Edit</button><button className="delete-btn" type="button" onClick={() => removeExam(exam)}>Delete</button></td></>}</tr>)}</tbody></table>{!data.exams.length && <div className="empty-state"><strong>No exam schedules yet</strong><span>Add an exam date above to publish it here.</span></div>}</Panel>
  </Shell>;
}

function AdminStudentDirectory({ students, courses, onSaved, onNotice }) {
  const [editingStudent, setEditingStudent] = useState(null);
  const classes = courses.filter((course) => course.type === "Class");

  async function saveStudent(event) {
    event.preventDefault();
    const response = await fetch(`/api/admin/students/${editingStudent.id}`, { method: "PUT", credentials: "include", body: new FormData(event.currentTarget) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      onNotice(result.detail || "Student account could not be updated.");
      return;
    }
    setEditingStudent(null);
    onNotice("Student account updated.");
    onSaved();
  }

  async function deleteStudent(student) {
    if (!window.confirm(`Delete student ${student.name} and all linked records?`)) return;
    try {
      await apiRequest(`/api/admin/students/${student.id}`, { method: "DELETE" });
      onNotice("Student account and linked records deleted.");
      onSaved();
    } catch (error) {
      onNotice(error.message);
    }
  }

  return <Panel id="students" title="Student accounts" subtitle="Edit student profiles and login IDs, or delete an account">
    <table><thead><tr><th>Name</th><th>Student ID</th><th>Roll number</th><th>Registration number</th><th>Class</th><th>Email</th><th>Manage</th></tr></thead><tbody>
      {students.map((student) => <tr key={student.id}>{editingStudent?.id === student.id ? <td colSpan="7"><form className="inline-form" onSubmit={saveStudent}>
        <input name="name" aria-label="Student name" defaultValue={student.name} required />
        <input name="username" aria-label="Student ID" defaultValue={student.username || ""} required />
        <input name="roll_number" aria-label="Roll number" defaultValue={student.roll_number} required />
        <input name="registration_number" aria-label="Registration number" defaultValue={student.registration_number} required />
        <select name="class_id" aria-label="Class" defaultValue={student.course_id || ""} required><option value="" disabled>Select class</option>{classes.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}</select>
        <input name="email" aria-label="Email" type="email" defaultValue={student.email || ""} />
        <input name="password" aria-label="New password" type="password" placeholder="New password (optional)" />
        <button className="btn" type="submit">Save</button><button className="btn secondary" type="button" onClick={() => setEditingStudent(null)}>Cancel</button>
      </form></td> : <><td>{student.name}</td><td>{student.username || "-"}</td><td>{student.roll_number}</td><td>{student.registration_number}</td><td>{student.course}</td><td>{student.email || "-"}</td><td><button className="text-link" type="button" onClick={() => setEditingStudent(student)}>Edit</button><button className="delete-btn" type="button" onClick={() => deleteStudent(student)}>Delete</button></td></>}</tr>)}
      {!students.length && <tr><td colSpan="7" className="muted">No student accounts yet.</td></tr>}
    </tbody></table>
  </Panel>;
}

function TeacherWorkspace({ session, onLogout }) {
  const [data, setData] = useState({ students: [], courses: [], classes: [], class_assignments: [], results: [], leave_requests: [], attendance_summary: {} });
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState("");
  const today = localDate();
  const selectedClass = data.classes.find((item) => String(item.id) === selectedClassId);
  const classStudents = selectedClass ? data.students.filter((student) => String(student.course_id) === String(selectedClass.id) || student.course === selectedClass.name) : [];
  const classAssignments = selectedClass ? data.class_assignments.filter((assignment) => String(assignment.class_id) === String(selectedClass.id)) : [];
  const classSubjects = classAssignments.filter((assignment) => !assignment.legacy && assignment.course_id);
  const classSubjectNames = classSubjects.map((assignment) => assignment.course_name);
  const classResults = selectedClass ? data.results.filter((result) => String(result.course_id) === String(selectedClass.id) || result.course === selectedClass.name) : [];
  const refresh = (classId = selectedClassId) => { const query = classId ? `?class_id=${encodeURIComponent(classId)}` : ""; setLoading(true); return apiRequest(`/api/teacher/overview${query}`).then(setData).catch((error) => setNotice(error.message)).finally(() => setLoading(false)); };
  useEffect(() => { refresh(""); }, []);
  useEffect(() => { if (!selectedClassId && data.classes.length) setSelectedClassId(String(data.classes[0].id)); }, [data.classes, selectedClassId]);
  useEffect(() => { if (selectedClassId) refresh(selectedClassId); }, [selectedClassId]);
  const submit = (path) => async (event) => { try { await postForm(path, event); setNotice("Saved successfully."); refresh(); } catch (error) { setNotice(error.message); } };
  async function removeStudent(student) { if (!window.confirm(`Delete ${student.name} and all attendance/results?`)) return; const response = await fetch(`/api/teacher/students/${student.id}?class_id=${student.course_id}`, { method: "DELETE", credentials: "include" }); if (response.ok) { setNotice("Student deleted."); refresh(); } else { setNotice("Student could not be deleted."); } }
  async function reviewLeave(leaveId, status, classId) { const form = new FormData(); form.append("status_value", status); form.append("class_id", classId); const response = await fetch(`/api/teacher/leave/${leaveId}/review`, { method: "POST", credentials: "include", body: form }); const result = await response.json().catch(() => ({})); setNotice(response.ok ? "Leave request updated." : (result.detail || "Leave request could not be updated.")); if (response.ok) refresh(); }
  return <Shell session={session} onLogout={onLogout} links={["Dashboard", "Students", "Attendance", "Results", "Leave requests"]}>
    {notice && <div className="flash success">{notice}</div>}{loading && <div className="flash">Loading dashboard...</div>}
    <Panel title="Select class" subtitle="Choose the assigned class for attendance and student records"><label htmlFor="teacher_selected_class">Class</label><select id="teacher_selected_class" value={selectedClass ? selectedClass.id : ""} onChange={(event) => setSelectedClassId(event.target.value)} required><option value="" disabled>Select class</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{!data.classes.length && <div className="empty-state"><strong>No class assignments</strong><span>Ask an admin to assign a class and course to your account.</span></div>}</Panel>
    <div className="stats stats-four"><Stat label="My students" value={classStudents.length} note={selectedClass?.name || "Select a class"} /><Stat label="Classes" value={data.classes.length} note="Assigned classes" /><Stat label="Results entered" value={classResults.length} note={selectedClass?.name || "Select a class"} /><Stat label="Face attendance" value={classStudents.filter((student) => student.face_enrolled).length} note="Enrolled faces in class" /></div>
    <div className="analysis-grid"><Panel title="Attendance analysis" subtitle="All recorded attendance by status"><AnalysisBars items={[{ label: "Present", value: data.attendance_summary.present || 0, tone: "teal" }, { label: "Late", value: data.attendance_summary.late || 0, tone: "gold" }, { label: "Absent", value: data.attendance_summary.absent || 0, tone: "coral" }]} /></Panel><Panel title="Leave inbox summary" subtitle="Requests assigned to your teacher ID"><AnalysisBars items={[{ label: "Pending", value: data.leave_requests.filter((item) => item.status === "Pending").length, tone: "gold" }, { label: "Approved", value: data.leave_requests.filter((item) => item.status === "Approved").length, tone: "teal" }, { label: "Rejected", value: data.leave_requests.filter((item) => item.status === "Rejected").length, tone: "coral" }]} /></Panel></div>
    <Panel title="Mark attendance" subtitle="Mark attendance for an assigned subject in the selected class"><form onSubmit={submit("/api/teacher/attendance")}><input type="hidden" name="class_id" value={selectedClass?.id || ""} readOnly /><label htmlFor="attendance_subject">Subject</label><select id="attendance_subject" name="subject" required disabled={!classSubjectNames.length}><option value="" disabled>Select subject</option>{classSubjectNames.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</select><label htmlFor="attendance_student_id">Student</label><select id="attendance_student_id" name="student_id" required disabled={!selectedClass}>{classStudents.map((student) => <option key={student.id} value={student.id}>{student.name} ({student.roll_number})</option>)}</select><Field label="Attendance date" name="attendance_date" type="date" defaultValue={today} /><label htmlFor="status_value">Status</label><select id="status_value" name="status_value"><option>Present</option><option>Absent</option><option>Late</option></select><label htmlFor="method">Method</label><select id="method" name="method"><option>Manual</option><option>Camera</option><option>QR</option></select><button className="btn" type="submit" disabled={!selectedClass || !classSubjectNames.length || !classStudents.length}>Save attendance</button></form></Panel>
    <div className="grid-2"><Panel title="Add subject result" subtitle="Choose an assigned course and a student in the selected class"><form onSubmit={submit("/api/teacher/results")}><input type="hidden" name="class_id" value={selectedClass?.id || ""} readOnly /><label htmlFor="result_subject">Course / subject</label><select id="result_subject" name="subject" required disabled={!classSubjects.length}><option value="" disabled>Select course</option>{classSubjects.map((assignment) => <option key={assignment.course_id} value={assignment.course_name}>{assignment.course_name}</option>)}</select><label htmlFor="result_student_id">Student</label><select id="result_student_id" name="student_id" required disabled={!selectedClass}>{classStudents.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}</select><div className="form-row"><Field label="Exam name" name="exam_name" /><Field label="Marks" name="marks" type="number" /></div><Field label="Total marks" name="total_marks" type="number" /><button className="btn" type="submit" disabled={!selectedClass || !classSubjects.length || !classStudents.length}>Save result</button>{!classSubjects.length && <small className="muted">No courses are assigned for this class.</small>}</form></Panel><Panel id="students" title="Student directory" subtitle={`Students in ${selectedClass?.name || "the selected class"}`}><table><thead><tr><th>Name</th><th>ID</th><th>Class</th><th>Face</th><th>Manage</th></tr></thead><tbody>{classStudents.map((student) => <tr key={student.id}><td>{student.name}</td><td>{student.roll_number}</td><td>{student.course}</td><td><span className={`badge ${student.face_enrolled ? "present" : "absent"}`}>{student.face_enrolled ? "Enrolled" : "Needs setup"}</span><FaceEnrollment student={student} onDone={refresh} /></td><td><button className="delete-btn" type="button" onClick={() => removeStudent(student)}>Delete</button></td></tr>)}{!classStudents.length && <tr><td colSpan="5" className="muted">No students in this class.</td></tr>}</tbody></table></Panel></div>
    <div className="grid-2"><FaceAttendance classId={selectedClass?.id} subjects={classSubjectNames} onSaved={refresh} /><QrAttendance className={selectedClass?.name} subjects={classSubjectNames} onSaved={refresh} /></div>
    <Panel title="Subject results"><table><thead><tr><th>Student</th><th>Subject</th><th>Exam</th><th>Marks</th><th>Grade</th></tr></thead><tbody>{classResults.map((result) => <tr key={result.id}><td>{result.student_name}</td><td>{result.subject}</td><td>{result.exam_name}</td><td>{result.marks}/{result.total_marks}</td><td><span className="badge success">{result.grade}</span></td></tr>)}{!classResults.length && <tr><td colSpan="5" className="muted">No results for the selected class.</td></tr>}</tbody></table></Panel>
    <Panel title="Leave requests" subtitle={`Leave applications for ${selectedClass?.name || "the selected class"}`}><table><thead><tr><th>Student</th><th>Period</th><th>Application</th><th>Status</th><th>Review</th></tr></thead><tbody>{data.leave_requests.map((item) => <tr key={item.id}><td>{item.student_name}<br /><small className="muted">{item.roll_number}</small></td><td>{item.date_from} to {item.date_to}</td><td>{item.reason}</td><td><span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span></td><td><select value={item.status} onChange={(event) => reviewLeave(item.id, event.target.value, selectedClass?.id)}><option>Pending</option><option>Approved</option><option>Rejected</option></select></td></tr>)}{!data.leave_requests.length && <tr><td colSpan="5" className="muted">No leave applications for the selected class.</td></tr>}</tbody></table></Panel>
  </Shell>;
}

function StudentWorkspace({ session, onLogout }) {
  const [data, setData] = useState({ student: {}, attendance: [], results: [], teachers: [], leave_requests: [] });
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const today = localDate();
  const [attendanceStartDate, setAttendanceStartDate] = useState(today);
  const [attendanceEndDate, setAttendanceEndDate] = useState(today);
  const refresh = () => { setLoading(true); return apiRequest("/api/student/overview").then(setData).catch((error) => setNotice(error.message)).finally(() => setLoading(false)); };
  useEffect(() => { refresh(); }, []);
  const submit = async (event) => { try { await postForm("/api/student/leave", event); setNotice("Leave application sent to the selected teacher."); refresh(); } catch (error) { setNotice(error.message); } };
  const exportAttendance = (exportFormat) => {
    if (!attendanceStartDate || !attendanceEndDate || attendanceStartDate > attendanceEndDate) {
      setNotice("Select a valid attendance date range.");
      return;
    }
    const query = new URLSearchParams({ start_date: attendanceStartDate, end_date: attendanceEndDate, export_format: exportFormat });
    window.location.assign(`/api/student/attendance-export?${query}`);
  };
  const present = data.attendance.filter((item) => item.status === "Present").length;
  const percentage = data.attendance.length ? Math.round(present / data.attendance.length * 100) : 0;
  return <Shell session={session} onLogout={onLogout} links={["My attendance", "My results", "Leave requests"]}>
    {notice && <div className="flash success">{notice}</div>}
    <div className="stats stats-four">
      <Stat label="Attendance" value={`${percentage}%`} note="Present ratio" />
      <Stat label="Total records" value={data.attendance.length} note="Entries logged" />
      <Stat label="Present" value={present} note="Marked present" />
      <Stat label="Results" value={data.results.length} note="Subject results" />
    </div>
    <div className="analysis-grid">
      <Panel title="My attendance analysis" subtitle="Your complete attendance record">
        <AnalysisBars items={[{ label: "Present", value: present, tone: "teal" }, { label: "Other records", value: data.attendance.length - present, tone: "coral" }]} />
      </Panel>
      <Panel title="Leave status summary" subtitle="Applications sent to selected teachers">
        <AnalysisBars items={[{ label: "Pending", value: data.leave_requests.filter((item) => item.status === "Pending").length, tone: "gold" }, { label: "Approved", value: data.leave_requests.filter((item) => item.status === "Approved").length, tone: "teal" }, { label: "Rejected", value: data.leave_requests.filter((item) => item.status === "Rejected").length, tone: "coral" }]} />
      </Panel>
    </div>
    <Panel title={data.student.name || "Student profile"} subtitle={`${data.student.course || ""} / ${data.student.roll_number || ""}`}>
      <div className="inline-form">
        <div><label htmlFor="attendance_export_start">From</label><input id="attendance_export_start" type="date" value={attendanceStartDate} max={attendanceEndDate || undefined} onChange={(event) => setAttendanceStartDate(event.target.value)} /></div>
        <div><label htmlFor="attendance_export_end">To</label><input id="attendance_export_end" type="date" value={attendanceEndDate} min={attendanceStartDate || undefined} onChange={(event) => setAttendanceEndDate(event.target.value)} /></div>
        <button className="btn secondary" type="button" onClick={() => exportAttendance("pdf")}>Download PDF</button>
        <button className="btn secondary" type="button" onClick={() => exportAttendance("xlsx")}>Download Excel</button>
      </div>
      <table><thead><tr><th>Date</th><th>Subject</th><th>Status</th><th>Method</th></tr></thead><tbody>{data.attendance.map((item) => <tr key={item.id}><td>{item.attendance_date}</td><td>{item.subject || "Not specified"}</td><td><span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span></td><td>{item.method}</td></tr>)}</tbody></table>
    </Panel>
    <Panel title="My subject results" subtitle="Results published by your teacher">
      <table><thead><tr><th>Subject</th><th>Exam</th><th>Marks</th><th>Grade</th></tr></thead><tbody>{data.results.map((item) => <tr key={`${item.subject}-${item.exam_name}`}><td>{item.subject}</td><td>{item.exam_name}</td><td>{item.marks}/{item.total_marks}</td><td><span className="badge success">{item.grade}</span></td></tr>)}{!data.results.length && <tr><td colSpan="4" className="muted">No results have been published yet.</td></tr>}</tbody></table>
    </Panel>
    <Panel title="Apply for leave" subtitle="Write your application and send it to a selected teacher">
      <form onSubmit={submit}>
        <div className="form-row"><div><label htmlFor="leave_teacher_id">Select teacher</label><select id="leave_teacher_id" name="teacher_id" required><option value="">Choose a teacher</option>{data.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name} ({teacher.username})</option>)}</select></div><Field label="From" name="date_from" type="date" /><Field label="To" name="date_to" type="date" /></div>
        <label htmlFor="leave_reason">Application</label><textarea id="leave_reason" name="reason" rows="5" required placeholder="Write your leave application"></textarea><button className="btn" type="submit">Send leave application</button>
      </form>
    </Panel>
    <Panel title="My leave requests" subtitle="Track applications sent to teachers">
      <table><thead><tr><th>Teacher</th><th>Period</th><th>Application</th><th>Status</th></tr></thead><tbody>{data.leave_requests.map((item) => <tr key={item.id}><td>{item.teacher_name || "Teacher"}</td><td>{item.date_from} to {item.date_to}</td><td>{item.reason}</td><td><span className={`badge ${item.status.toLowerCase()}`}>{item.status}</span></td></tr>)}{!data.leave_requests.length && <tr><td colSpan="4" className="muted">No leave applications submitted yet.</td></tr>}</tbody></table>
    </Panel>
  </Shell>;
}
