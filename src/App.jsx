import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Atom, BookOpen, CheckCircle2, ChevronRight, Code2, GraduationCap,
  LayoutDashboard, LockKeyhole, LogIn, Menu, PlayCircle, Plus, Search, ShieldCheck,
  Sparkles, UploadCloud, UserRound, X, Youtube, FileVideo2, Clock3, BookMarked
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabase";

const starterCourse = {
  id: "ai-web-dev",
  title: "AI-Powered Web Development",
  category: "Web Development",
  level: "Beginner",
  description: "Build real websites with modern tools, learn the fundamentals, and turn ideas into working projects.",
  lessons: 8,
  duration: "Self-paced",
  active: true,
  featured: true,
};

export default function App() {
  const [page, setPage] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([starterCourse]);
  const [lessons, setLessons] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(starterCourse);
  const [selectedLessonId, setSelectedLessonId] = useState(null);
  const [search, setSearch] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminForm, setAdminForm] = useState({ title: "", description: "", duration: "" });
  const [lessonForm, setLessonForm] = useState({ title: "", description: "", course_id: "" });
  const [uploadFile, setUploadFile] = useState(null);
  const [adminTab, setAdminTab] = useState("courses");

  const isAdmin = profile?.role === "admin";
  const filteredCourses = useMemo(() => courses.filter(c =>
    `${c.title} ${c.category || ""}`.toLowerCase().includes(search.toLowerCase())
  ), [courses, search]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!supabaseConfigured) return;
      const { data: courseRows, error: courseError } = await supabase
        .from("courses").select("*").order("created_at", { ascending: false });
      if (!courseError && courseRows?.length) {
        setCourses(courseRows.map(c => ({...c, lessons: c.lesson_count ?? 0})));
        // Keep the admin lesson form pointed at a real Supabase UUID.
        setLessonForm(previous => ({
          ...previous,
          course_id: courseRows.some(c => c.id === previous.course_id)
            ? previous.course_id
            : courseRows[0].id,
        }));
      }
      const { data: lessonRows } = await supabase
        .from("lessons").select("*, courses(title)").order("position", { ascending: true });
      if (lessonRows) setLessons(lessonRows);
    }
    loadData();
  }, [session]);

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user || !supabaseConfigured) { setProfile(null); return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setProfile(data || { id: session.user.id, full_name: session.user.user_metadata?.full_name, role: "student" });
    }
    loadProfile();
  }, [session]);

  function go(next) {
    setPage(next);
    setMenuOpen(false);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitAuth(e) {
    e.preventDefault();
    if (!supabaseConfigured) { setNotice("Pehle .env file mein Supabase URL aur publishable/anon key add karo."); return; }
    setBusy(true); setNotice("");
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: authEmail, password: authPassword,
          options: { data: { full_name: authName } }
        });
        if (error) throw error;
        setNotice("Signup request complete. Agar email confirmation enabled hai, inbox check karo.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
        go("dashboard");
      }
    } catch (err) { setNotice(err.message || "Login failed."); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (supabaseConfigured) await supabase.auth.signOut();
    setSession(null); setProfile(null); go("home");
  }

  async function saveCourse(e) {
    e.preventDefault();
    if (!isAdmin || !supabaseConfigured) return setNotice("Admin login aur Supabase setup zaroori hai.");
    setBusy(true);
    const payload = { title: adminForm.title, description: adminForm.description, category: "Web Development", level: "Beginner", active: true, is_coming_soon: false };
    const { error } = await supabase.from("courses").insert(payload);
    setBusy(false);
    if (error) return setNotice(error.message);
    setAdminForm({ title: "", description: "", duration: "" });
    setNotice("Course add ho gaya.");
    const { data } = await supabase.from("courses").select("*").order("created_at", { ascending: false });
    if (data) setCourses(data);
  }

  async function uploadLesson(e) {
    e.preventDefault();
    if (!isAdmin || !supabaseConfigured) return setNotice("Admin login aur Supabase setup zaroori hai.");
    if (!uploadFile) return setNotice("Pehle video file select karo.");
    if (!lessonForm.course_id || !courses.some(course => course.id === lessonForm.course_id)) {
      return setNotice("Course dropdown se valid course select karo, phir upload karo.");
    }
    if (uploadFile.size > 100 * 1024 * 1024) return setNotice("Is starter version mein max 100 MB per video rakha hai. Bade videos ke liye storage plan/large-file upload setup chahiye.");
    setBusy(true); setNotice("");
    try {
      const safeName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${session.user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("course-videos").upload(path, uploadFile, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("course-videos").getPublicUrl(path);
      const { error: insertError } = await supabase.from("lessons").insert({
        title: lessonForm.title,
        description: lessonForm.description,
        course_id: lessonForm.course_id,
        video_path: path,
        video_url: urlData.publicUrl,
        position: lessons.length + 1,
      });
      if (insertError) throw insertError;
      const { data } = await supabase.from("lessons").select("*, courses(title)").order("position", { ascending: true });
      if (data) setLessons(data);
      setLessonForm({ title: "", description: "", course_id: courses[0]?.id || "" });
      setUploadFile(null);
      setNotice("Lecture upload ho gaya.");
    } catch (err) { setNotice(err.message || "Upload failed."); }
    finally { setBusy(false); }
  }

  async function deleteLesson(lesson) {
    if (!isAdmin || !confirm(`"${lesson.title}" delete karna hai?`)) return;
    const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
    if (error) return setNotice(error.message);
    if (lesson.video_path) await supabase.storage.from("course-videos").remove([lesson.video_path]);
    setLessons(old => old.filter(l => l.id !== lesson.id));
    setNotice("Lecture delete ho gaya.");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => go("home")} aria-label="Modern Gurukul home">
          <span className="brand-mark"><Atom size={23}/></span>
          <span><strong>MODERN <em>GURUKUL</em></strong><small>LEARN • BUILD • GROW</small></span>
        </button>
        <nav className={menuOpen ? "nav-links open" : "nav-links"}>
          <button onClick={() => go("home")} className={page === "home" ? "nav-active" : ""}>Home</button>
          <button onClick={() => go("courses")} className={page === "courses" ? "nav-active" : ""}>Courses</button>
          <button onClick={() => go("about")}>About</button>
          {session ? <button onClick={() => go("dashboard")}>My Learning</button> : null}
        </nav>
        <div className="top-actions">
          {session ? <><button className="icon-button" title="Dashboard" onClick={() => go("dashboard")}><LayoutDashboard size={18}/></button><button className="btn btn-small btn-outline" onClick={logout}>Log out</button></> :
            <><button className="btn btn-ghost" onClick={() => {setAuthMode("login"); go("auth");}}>Log in</button><button className="btn btn-primary btn-small" onClick={() => {setAuthMode("signup"); go("auth");}}>Join free <ArrowRight size={15}/></button></>}
        </div>
        <button className="mobile-menu" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu">{menuOpen ? <X/> : <Menu/>}</button>
      </header>

      {!supabaseConfigured && <div className="setup-banner"><Sparkles size={16}/> Preview mode — Supabase connect karne ke baad login, database aur video upload activate honge.</div>}
      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice("")}><X size={15}/></button></div>}

      {page === "home" && <Home courses={courses} onCourses={() => go("courses")} onStart={() => {setSelectedCourse(courses[0] || starterCourse); go("course");}} />}
      {page === "courses" && <section className="page-wrap">
        <div className="page-heading"><span className="eyebrow"><BookOpen size={14}/> THE LEARNING LIBRARY</span><h1>Learn skills that <span>move you forward.</span></h1><p>Practical courses designed around real projects. Start free, build at your own pace.</p></div>
        <div className="search-row"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses..." /></div>
        <div className="course-grid">{filteredCourses.map(c => <CourseCard key={c.id} course={c} onClick={() => {setSelectedCourse(c); go("course");}} />)}
          {["AI & Automation", "App Development", "Creative Technology"].map((t, i) => <ComingCard key={t} title={t} number={`0${i+2}`} />)}
        </div>
      </section>}
      {page === "course" && <CourseDetail course={selectedCourse} lessons={lessons.filter(l => l.course_id === selectedCourse.id)} onBack={() => go("courses")} onLogin={() => {setAuthMode("signup"); go("auth");}} onLesson={(l) => {setSelectedLessonId(l.id); go("lesson");}} />}
      {page === "lesson" && <LessonPage lesson={lessons.find(l => l.id === selectedLessonId)} onBack={() => go("course")} />}
      {page === "auth" && <section className="auth-page"><div className="auth-art"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="floating-code"><Code2 size={38}/><span>Build your future.</span></div><span className="auth-art-caption">YOUR NEXT CHAPTER STARTS HERE</span></div><form className="auth-card" onSubmit={submitAuth}><span className="eyebrow"><LockKeyhole size={14}/> STUDENT ACCESS</span><h1>{authMode === "signup" ? "Create your account." : "Welcome back."}</h1><p>{authMode === "signup" ? "Start learning and building for free." : "Continue where you left off."}</p>{authMode === "signup" && <label>Full name<input required value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Your name"/></label>}<label>Email address<input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input required minLength={6} type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="At least 6 characters"/></label><button className="btn btn-primary btn-full" disabled={busy}>{busy ? "Please wait..." : authMode === "signup" ? "Create free account" : "Log in"} <ArrowRight size={17}/></button><div className="auth-switch">{authMode === "signup" ? "Already have an account?" : "New to Modern Gurukul?"} <button type="button" onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}>{authMode === "signup" ? "Log in" : "Sign up free"}</button></div><small className="fine-print">By continuing, you agree to learn with curiosity and respect.</small></form></section>}
      {page === "dashboard" && <Dashboard session={session} profile={profile} lessons={lessons} courses={courses} onCourse={() => {setSelectedCourse(courses[0] || starterCourse); go("course");}} onAdmin={() => go("admin")} isAdmin={isAdmin} />}
      {page === "admin" && <AdminPage isAdmin={isAdmin} adminTab={adminTab} setAdminTab={setAdminTab} adminForm={adminForm} setAdminForm={setAdminForm} saveCourse={saveCourse} lessonForm={lessonForm} setLessonForm={setLessonForm} uploadFile={uploadFile} setUploadFile={setUploadFile} uploadLesson={uploadLesson} courses={courses} lessons={lessons} deleteLesson={deleteLesson} busy={busy} />}
      {page === "about" && <section className="page-wrap about-page"><span className="eyebrow"><Sparkles size={14}/> OUR APPROACH</span><h1>Education should lead to <span>creation.</span></h1><p>Modern Gurukul is a practical learning space focused on building useful skills through real projects, experimentation, and consistent practice.</p><div className="about-points"><div><Code2/><h3>Build first</h3><p>Learn by creating things that work.</p></div><div><ShieldCheck/><h3>Learn responsibly</h3><p>Understand the tools, not just the shortcuts.</p></div><div><GraduationCap/><h3>Grow continuously</h3><p>Keep improving with every project.</p></div></div></section>}
      <Footer onNavigate={go}/>
    </div>
  );
}

function Home({ courses, onCourses, onStart }) {
  return <main>
    <section className="hero">
      <div className="hero-grid"></div><div className="hero-content">
        <div className="eyebrow"><span className="live-dot"></span> A NEW WAY TO LEARN TECHNOLOGY</div>
        <h1>Don't just learn.<br/><span>Build your future.</span></h1>
        <p className="hero-copy">Practical skills. Real projects. A modern approach to learning technology — one creation at a time.</p>
        <div className="hero-actions"><button className="btn btn-primary btn-large" onClick={onStart}>Explore your first course <ArrowRight size={18}/></button><button className="btn btn-outline btn-large" onClick={onCourses}><PlayCircle size={18}/> Browse courses</button></div>
        <div className="hero-proof"><div className="proof-icon"><CheckCircle2 size={17}/></div><span><strong>100% Free to start</strong><small>Learn at your own pace</small></span><i></i><div className="proof-icon"><Code2 size={17}/></div><span><strong>Project-based</strong><small>Build real skills</small></span></div>
      </div>
      <div className="hero-visual" aria-label="Abstract coding and AI illustration"><div className="visual-glow"></div><div className="code-window"><div className="window-bar"><div className="window-dots"><i></i><i></i><i></i></div><span>your-future.jsx</span><span className="window-status">● LIVE</span></div><div className="code-lines"><div><b>01</b><span className="code-purple">const</span> <span className="code-blue">future</span> = <span className="code-yellow">"yours"</span>;</div><div><b>02</b><span className="code-purple">function</span> <span className="code-blue">BuildSkills</span>() {"{"}</div><div><b>03</b>&nbsp;&nbsp;<span className="code-purple">return</span> (</div><div><b>04</b>&nbsp;&nbsp;&nbsp;&nbsp;<span className="code-green">Learn</span> + <span className="code-green">Create</span></div><div><b>05</b>&nbsp;&nbsp;);</div><div><b>06</b>{"}"}</div><div className="code-cursor"></div></div><div className="window-footer"><span><span className="green-dot"></span> Ready to build</span><span>UTF-8&nbsp; · &nbsp;JavaScript</span></div></div><div className="float-card float-ai"><span className="float-icon"><Sparkles size={17}/></span><div><strong>AI + Creativity</strong><small>Ideas into reality</small></div></div><div className="float-card float-project"><span className="float-icon violet"><Atom size={17}/></span><div><strong>Real Projects</strong><small>Learn by doing</small></div><span className="mini-check"><CheckCircle2 size={15}/></span></div><div className="visual-orb"></div><div className="visual-cross cross-a">✳</div><div className="visual-cross cross-b">✦</div>
      </div>
      <div className="hero-bottom"><span>DESIGNED FOR THE CURIOUS</span><div></div><span>BUILT FOR THE FUTURE</span></div>
    </section>
    <section className="stats-strip"><div><strong>01</strong><span>Active course</span></div><div><strong>₹0</strong><span>To get started</span></div><div><strong>∞</strong><span>Room to experiment</span></div><div><strong>YOU</strong><span>Are the creator</span></div></section>
    <section className="section-wrap featured-section"><div className="section-heading"><div><span className="eyebrow"><BookOpen size={14}/> START YOUR JOURNEY</span><h2>One skill can open <span>many doors.</span></h2><p>Start with the foundations. Grow by building something real.</p></div><button className="text-link" onClick={onCourses}>View all courses <ArrowRight size={16}/></button></div><div className="featured-grid">{courses.filter(c => c.active !== false && !c.is_coming_soon).slice(0,1).map(c => <CourseCard key={c.id} course={c} featured onClick={onStart}/>)}<div className="next-course-card"><div className="coming-label"><span></span> COMING SOON</div><div className="next-icon"><Atom size={28}/></div><h3>More ways to create.</h3><p>New courses in AI, apps, automation and creative technology are on the way.</p><button className="text-link" onClick={onCourses}>See what's planned <ArrowRight size={16}/></button><div className="next-decoration">MG</div></div></div></section>
    <section className="manifesto"><div className="manifesto-mark"><Sparkles size={24}/></div><span className="eyebrow">THE MODERN GURUKUL MINDSET</span><h2>Knowledge is powerful.<br/><span>Applied knowledge changes things.</span></h2><p>Learn the concept. Try the tool. Make something of your own.</p><button className="btn btn-outline" onClick={onCourses}>Start learning for free <ArrowRight size={17}/></button></section>
  </main>;
}

function CourseCard({ course, onClick, featured = false }) {
  return <article className={`course-card ${featured ? "featured-course" : ""}`} onClick={onClick} role="button" tabIndex="0" onKeyDown={e => e.key === "Enter" && onClick()}>
    <div className="course-art"><div className="course-art-grid"></div><div className="course-code-symbol"><Code2 size={featured ? 54 : 44}/></div><div className="course-art-label">MG / COURSE 01</div><div className="course-art-glow"></div></div>
    <div className="course-card-body"><div className="course-tags"><span>{course.category || "Technology"}</span><span className="free-tag">FREE</span></div><h3>{course.title}</h3><p>{course.description || "Learn through practical lessons and real-world projects."}</p><div className="course-meta"><span><BookOpen size={15}/>{course.lesson_count ?? course.lessons ?? 0} lessons</span><span><Clock3 size={15}/>{course.duration || "Self-paced"}</span></div><div className="course-card-bottom"><span className="level-tag">{course.level || "Beginner"}</span><span className="card-arrow"><ArrowRight size={18}/></span></div></div>
  </article>;
}
function ComingCard({ title, number }) {
  return <article className="coming-card"><div className="coming-top"><span className="coming-label"><span></span> COMING SOON</span><span className="course-number">{number}</span></div><div className="coming-art"><div className="coming-ring"></div><Sparkles size={33}/></div><h3>{title}</h3><p>We're preparing a practical learning path. Stay tuned.</p><div className="coming-foot"><span>IN DEVELOPMENT</span><LockKeyhole size={16}/></div></article>;
}
function CourseDetail({ course, lessons, onBack, onLogin, onLesson }) {
  return <main className="page-wrap course-detail"><button className="back-link" onClick={onBack}>← All courses</button><div className="detail-hero"><div className="detail-copy"><span className="eyebrow"><span className="live-dot"></span> FREE COURSE · BEGINNER FRIENDLY</span><h1>{course?.title || starterCourse.title}</h1><p>{course?.description || starterCourse.description}</p><div className="detail-stats"><span><BookOpen size={16}/>{lessons.length || course?.lesson_count || course?.lessons || 0} lessons</span><span><Clock3 size={16}/>Self-paced</span><span><CheckCircle2 size={16}/>Free access</span></div><button className="btn btn-primary btn-large" onClick={onLogin}>Start learning <ArrowRight size={18}/></button></div><div className="detail-art"><div className="detail-orbit"></div><Code2 size={76}/><span className="detail-art-tag">COURSE_001</span></div></div><div className="lesson-section"><div className="section-heading"><div><span className="eyebrow">COURSE CONTENT</span><h2>Your learning path.</h2></div><span className="lesson-count">{lessons.length} uploaded lessons</span></div>{lessons.length ? <div className="lesson-list">{lessons.map((l,i)=><button className="lesson-row" key={l.id} onClick={() => onLesson(l)}><span className="lesson-play"><PlayCircle size={19}/></span><span className="lesson-num">{String(i+1).padStart(2,"0")}</span><span className="lesson-title"><strong>{l.title}</strong><small>{l.description || "Video lesson"}</small></span><LockKeyhole size={16}/></button>)}</div> : <div className="empty-lessons"><BookOpen size={28}/><h3>Lessons are being prepared.</h3><p>The course owner will upload the first lecture here soon.</p></div>}</div></main>;
}
function LessonPage({ lesson, onBack }) {
  if (!lesson) return <section className="page-wrap"><button className="back-link" onClick={onBack}>← Back to course</button><div className="empty-lessons"><FileVideo2 size={28}/><h3>Lecture not found</h3></div></section>;
  return <section className="page-wrap lesson-page"><button className="back-link" onClick={onBack}>← Course overview</button><div className="video-frame">{lesson.video_url ? <video controls controlsList="nodownload" src={lesson.video_url} /> : <div className="video-placeholder"><PlayCircle size={48}/><span>Lecture video will appear here</span></div>}</div><div className="lesson-info"><span className="eyebrow">AI-POWERED WEB DEVELOPMENT</span><h1>{lesson.title}</h1><p>{lesson.description}</p></div></section>;
}
function Dashboard({ session, profile, lessons, courses, onCourse, onAdmin, isAdmin }) {
  if (!session) return <section className="page-wrap empty-state"><UserRound size={36}/><h1>Your learning space.</h1><p>Log in or create a free account to access your dashboard.</p><button className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent("open-auth"))}>Log in to continue <ArrowRight size={16}/></button><p className="small-note">Use the Log in button in the top navigation.</p></section>;
  return <section className="page-wrap dashboard-page"><div className="dashboard-welcome"><div><span className="eyebrow"><LayoutDashboard size={14}/> STUDENT DASHBOARD</span><h1>Welcome back{profile?.full_name ? `, ${profile.full_name}` : ""}.</h1><p>Your next idea starts with your next lesson.</p></div><div className="avatar">{(profile?.full_name || session.user.email || "S").slice(0,1).toUpperCase()}</div></div><div className="dashboard-stats"><div><span>Enrolled courses</span><strong>1</strong><small>Free learning path</small></div><div><span>Lessons available</span><strong>{lessons.length}</strong><small>Uploaded by admin</small></div><div><span>Learning status</span><strong>Ready</strong><small>Build at your pace</small></div></div><div className="section-heading"><div><span className="eyebrow">YOUR CLASSROOM</span><h2>Continue learning.</h2></div></div><div className="dashboard-course-row"><div className="dashboard-course-icon"><Code2 size={29}/></div><div className="dashboard-course-copy"><span className="free-tag">FREE COURSE</span><h3>{courses[0]?.title || starterCourse.title}</h3><p>{lessons.length} lectures currently available</p></div><button className="btn btn-primary" onClick={onCourse}>Open course <ArrowRight size={16}/></button></div>{isAdmin && <div className="admin-callout"><ShieldCheck size={22}/><div><strong>Admin access enabled</strong><p>Manage courses and upload lecture videos.</p></div><button className="btn btn-outline" onClick={onAdmin}>Open admin panel <ArrowRight size={16}/></button></div>}</section>;
}
function AdminPage({ isAdmin, adminTab, setAdminTab, adminForm, setAdminForm, saveCourse, lessonForm, setLessonForm, uploadFile, setUploadFile, uploadLesson, courses, lessons, deleteLesson, busy }) {
  if (!isAdmin) return <section className="page-wrap empty-state"><ShieldCheck size={38}/><h1>Admin access required.</h1><p>This page is available only to an account marked as admin in Supabase.</p><p className="small-note">For security, admin role must be set from the Supabase SQL editor by the project owner.</p></section>;
  return <section className="page-wrap admin-page"><div className="dashboard-welcome"><div><span className="eyebrow"><ShieldCheck size={14}/> CONTENT CONTROL CENTER</span><h1>Admin panel.</h1><p>Manage your classroom, one lesson at a time.</p></div><div className="admin-shield"><ShieldCheck size={28}/></div></div><div className="admin-tabs"><button className={adminTab === "courses" ? "selected" : ""} onClick={() => setAdminTab("courses")}><BookOpen size={16}/> Courses</button><button className={adminTab === "lessons" ? "selected" : ""} onClick={() => setAdminTab("lessons")}><FileVideo2 size={16}/> Video lessons</button></div>
    {adminTab === "courses" ? <div className="admin-layout"><form className="admin-form panel" onSubmit={saveCourse}><span className="eyebrow"><Plus size={14}/> ADD COURSE</span><h2>Create a course</h2><label>Course title<input required value={adminForm.title} onChange={e => setAdminForm({...adminForm,title:e.target.value})} placeholder="e.g. HTML & CSS Foundations"/></label><label>Description<textarea required rows="4" value={adminForm.description} onChange={e => setAdminForm({...adminForm,description:e.target.value})} placeholder="What will students learn?"/></label><button className="btn btn-primary btn-full" disabled={busy}>{busy ? "Saving..." : "Add course"} <ArrowRight size={16}/></button></form><div className="panel"><span className="eyebrow">YOUR COURSES</span><h2>Course library</h2>{courses.map(c=><div className="admin-list-item" key={c.id}><span className="admin-list-icon"><BookOpen size={17}/></span><div><strong>{c.title}</strong><small>{c.active === false || c.is_coming_soon ? "Coming soon" : "Active"} · {c.lesson_count ?? c.lessons ?? 0} lessons</small></div></div>)}</div></div> :
    <div className="admin-layout"><form className="admin-form panel" onSubmit={uploadLesson}><span className="eyebrow"><UploadCloud size={14}/> UPLOAD LECTURE</span><h2>Add a video lesson</h2><label>Lecture title<input required value={lessonForm.title} onChange={e => setLessonForm({...lessonForm,title:e.target.value})} placeholder="Lesson 01 — Introduction"/></label><label>Course<select value={lessonForm.course_id} onChange={e => setLessonForm({...lessonForm,course_id:e.target.value})}>{courses.map(c=><option value={c.id} key={c.id}>{c.title}</option>)}</select></label><label>Description<textarea rows="3" value={lessonForm.description} onChange={e => setLessonForm({...lessonForm,description:e.target.value})} placeholder="Short lesson summary"/></label><label className="upload-drop"><UploadCloud size={25}/><strong>{uploadFile ? uploadFile.name : "Choose a video file"}</strong><span>MP4, WebM or supported video · max 100 MB in starter setup</span><input type="file" accept="video/*" required onChange={e => setUploadFile(e.target.files?.[0] || null)}/></label><button className="btn btn-primary btn-full" disabled={busy}>{busy ? "Uploading..." : "Upload lecture"} <ArrowRight size={16}/></button><p className="small-note">Videos upload to Supabase Storage, not YouTube. The current starter uses a public storage URL; before a production launch, switch to private storage and signed URLs if you want stronger video access control.</p></form><div className="panel"><span className="eyebrow">UPLOADED CONTENT</span><h2>Lecture library</h2>{lessons.length ? lessons.map(l=><div className="admin-list-item" key={l.id}><span className="admin-list-icon"><FileVideo2 size={17}/></span><div><strong>{l.title}</strong><small>{l.courses?.title || "Course lesson"}</small></div><button className="delete-button" onClick={() => deleteLesson(l)} title="Delete lecture"><X size={17}/></button></div>) : <div className="admin-empty"><UploadCloud size={26}/><p>No lectures uploaded yet.</p></div>}</div></div>}
  </section>;
}
function Footer({ onNavigate }) {
  return <footer className="footer"><div className="footer-main"><button className="brand footer-brand" onClick={() => onNavigate("home")}><span className="brand-mark"><Atom size={21}/></span><span><strong>MODERN <em>GURUKUL</em></strong><small>LEARN • BUILD • GROW</small></span></button><p>A modern learning space for curious minds and future creators.</p><div className="footer-note"><span className="green-dot"></span> Learning is free. Possibilities aren't limited.</div></div><div className="footer-links"><div><strong>EXPLORE</strong><button onClick={() => onNavigate("courses")}>Courses</button><button onClick={() => onNavigate("about")}>Our approach</button></div><div><strong>LEARN</strong><button onClick={() => onNavigate("auth")}>Student login</button><button onClick={() => onNavigate("auth")}>Join for free</button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Modern Gurukul</span><span>Made for learners who build.</span></div></footer>;
}
