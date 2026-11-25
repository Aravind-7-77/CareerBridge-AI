import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, BriefcaseBusiness, CheckCircle2, ChevronRight, ClipboardCheck, LayoutDashboard, Library, MessageSquareText, Moon, Search, Settings, Sparkles, Target, UserCircle, Users, X } from 'lucide-react';
import './App.css';

const API = '/api';
const nav = [
  ['Dashboard', LayoutDashboard], ['Profile & Skills', UserCircle], ['Companies & Jobs', BriefcaseBusiness],
  ['Skill Assessment', ClipboardCheck], ['Learning Roadmap', Target], ['Resources', Library],
  ['Mock Interview', MessageSquareText], ['Resume Analyzer', UserCircle], ['Applications', BarChart3],
];

function App() {
  const [token, setToken] = useState(localStorage.getItem('cb_token'));
  const [page, setPage] = useState('Dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [dark, setDark] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  if (!token) return <AuthScreen mode={authMode} setMode={setAuthMode} onAuth={(value) => { localStorage.setItem('cb_token', value); setToken(value); }} />;

  return (
    <div className={dark ? 'app dark' : 'app'}>
      <aside className={mobileNav ? 'sidebar open' : 'sidebar'}>
        <div className="brand"><div className="brandMark"><Sparkles size={18} /></div><span>CareerBridge <b>AI</b></span><button className="iconButton closeNav" onClick={() => setMobileNav(false)}><X /></button></div>
        <nav>{nav.map(([label, Icon]) => <button key={label} className={page === label ? 'navItem active' : 'navItem'} onClick={() => { setPage(label); setMobileNav(false); }}><Icon size={18}/><span>{label}</span></button>)}</nav>
        <button className="navItem settings"><Settings size={18}/><span>Settings</span></button>
      </aside>
      {mobileNav && <button className="backdrop" aria-label="Close menu" onClick={() => setMobileNav(false)} />}
      <main>
        <header><button className="menuButton" onClick={() => setMobileNav(true)}>☰</button><div className="search"><Search size={16}/><input placeholder="Search jobs, skills, resources..." /></div><button className="iconButton" onClick={() => setDark(!dark)}><Moon size={18}/></button><div className="avatar">AS</div></header>
        <div className="content">
          {page === 'Dashboard' && <Dashboard token={token}/>}
          {page === 'Profile & Skills' && <Profile token={token}/>}
          {page === 'Companies & Jobs' && <Jobs token={token}/>}
          {page === 'Skill Assessment' && <Assessment token={token}/>}
          {page === 'Learning Roadmap' && <Roadmap token={token}/>}
          {page === 'Resources' && <Resources token={token}/>}
          {page === 'Mock Interview' && <Interview token={token}/>}
          {page === 'Resume Analyzer' && <Resume token={token}/>}
          {page === 'Applications' && <Applications token={token}/>}
        </div>
      </main>
    </div>
  );
}

async function api(path, token, options = {}) {
  const response = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function AuthScreen({ mode, setMode, onAuth }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setError('');
    try {
      const res = await fetch(API + '/auth/' + mode, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onAuth(data.token);
    } catch (err) { setError(err.message); }
  };
  return <div className="authPage"><div className="authVisual"><div className="brand authBrand"><div className="brandMark"><Sparkles size={18}/></div><span>CareerBridge <b>AI</b></span></div><div className="visualCopy"><div className="miniTag">AI-POWERED CAREER GUIDANCE</div><h1>Bridge the gap between<br/><em>learning & career</em></h1><p>Personalized roadmaps, real job intelligence and objective preparation—built for engineering students.</p></div><div className="orbitCard"><Users size={20}/><div><b>12,000+</b><span>students preparing</span></div></div></div><div className="authPanel"><form onSubmit={submit} className="authForm"><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p>{mode === 'login' ? 'Continue your career preparation journey.' : 'Start building your personalized roadmap.'}</p>{error && <div className="error">{error}</div>} {mode === 'register' && <label>Full name<input required value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="Aravind Sai"/></label>}<label>Email address<input required type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label><label>Password<input required type="password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} placeholder="At least 6 characters"/></label><button className="primary" type="submit">{mode === 'login' ? 'Sign in' : 'Create account'}<ChevronRight size={17}/></button><button type="button" className="textButton" onClick={()=>setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'New here? Create an account' : 'Already registered? Sign in'}</button></form></div></div>;
}

function PageTitle({ eyebrow, title, action }) {
  return <div className="pageTitle"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1></div>{action}</div>;
}

function Dashboard({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('/dashboard', token)
      .then((value) => { if (active) setData(value); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [token]);
  if (error) return <div className="error">{error}</div>;
  if (!data) return <div className="loading">Loading dashboard...</div>;
  const assessedSkills = data.skillData.filter((skill) => skill.assessed);
  const profileSkills = data.skillData.filter((skill) => !skill.assessed);
  return <>
    <PageTitle eyebrow="YOUR DASHBOARD" title={data.name ? `Welcome, ${data.name}` : 'Welcome'} action={<button className="primary">Continue preparation<ChevronRight size={17}/></button>}/>
    <div className="statsGrid">
      <Stat label="Job readiness" value={data.readiness === null ? '—' : `${data.readiness}%`} detail={data.readiness === null ? 'Complete an assessment' : 'Based on saved assessments'} tone="purple"/>
      <Stat label="Roadmap progress" value={data.progress === null ? '—' : `${data.progress}%`} detail={data.roadmapTasks ? `${data.completedTasks}/${data.roadmapTasks} tasks` : 'No saved roadmap'} tone="blue"/>
      <Stat label="Resume analyses" value={data.resumes} detail="Saved latest analysis" tone="green"/>
      <Stat label="Applications" value={data.applications} detail="Tracked applications" tone="orange"/>
      <Stat label="Mock interviews" value={data.interviews} detail="Practice sessions" tone="purple"/>
    </div>
    <div className="dashboardGrid">
      <section className="card progressCard">
        <div className="cardHead"><div><span>THIS WEEK</span><h3>Preparation activity</h3></div><select aria-label="Activity period"><option>Last 7 days</option></select></div>
        <div className="chartWrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.weekly}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6c5ce7" stopOpacity=".28"/><stop offset="100%" stopColor="#6c5ce7" stopOpacity="0"/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="day"/><YAxis allowDecimals={false}/><Tooltip/><Area type="monotone" dataKey="activities" name="Activities" stroke="#6c5ce7" fill="url(#fill)" strokeWidth={3}/></AreaChart></ResponsiveContainer></div>
      </section>
      <section className="card skillsCard">
        <div className="cardHead"><div><span>ASSESSMENT RESULTS</span><h3>Skill proficiency</h3></div></div>
        <div className="chartWrap">
          {assessedSkills.length ? <ResponsiveContainer width="100%" height={profileSkills.length ? '72%' : '100%'}><BarChart data={assessedSkills} layout="vertical"><XAxis type="number" domain={[0,100]} hide/><YAxis type="category" dataKey="name" width={95}/><Tooltip formatter={(value) => [`${value}%`, 'Assessment score']}/><Bar dataKey="value" fill="#6c5ce7" radius={[0,6,6,0]} barSize={12}/></BarChart></ResponsiveContainer>
            : <div className="dashboardEmpty"><strong>{profileSkills.length ? 'Skills from your profile' : 'No skill data yet'}</strong><span>{profileSkills.length ? profileSkills.map((skill) => skill.level ? `${skill.name} (${skill.level})` : skill.name).join(', ') : 'Complete an assessment to see measured skill progress.'}</span></div>}
          {assessedSkills.length > 0 && profileSkills.length > 0 && <div className="profileSkillNotes"><strong>Also in profile</strong><span>{profileSkills.map((skill) => skill.level ? `${skill.name} (${skill.level})` : skill.name).join(', ')}</span></div>}
        </div>
      </section>
    </div>
  </>;
}
function Stat({ label, value, detail, tone }) { return <div className="statCard"><div className={`statIcon ${tone}`}><Target size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></div>; }

function Profile({ token }) {
  const [profile, setProfile] = useState(null); const [saved, setSaved] = useState(false);
  useEffect(() => { api('/profile', token).then(setProfile).catch(console.error); }, [token]);
  if (!profile) return <div className="loading">Loading profile...</div>;
  const update = (e) => { e.preventDefault(); api('/profile', token, { method:'PUT', body:JSON.stringify(profile) }).then(()=>setSaved(true)); };
  return <><PageTitle eyebrow="STUDENT PROFILE" title="Profile & Skills"/><form className="card formGrid" onSubmit={update}><h3>Academic information</h3><label>Full name<input value={profile.name||''} onChange={e=>setProfile({...profile,name:e.target.value})}/></label><label>Engineering branch<select value={profile.branch||''} onChange={e=>setProfile({...profile,branch:e.target.value})}><option value="">Select branch</option><option>CSE</option><option>ECE</option><option>EEE</option><option>Mechanical</option><option>Civil</option></select></label><label>Graduation year<input value={profile.graduationYear||''} onChange={e=>setProfile({...profile,graduationYear:e.target.value})} placeholder="2027"/></label><label>CGPA<input value={profile.cgpa||''} onChange={e=>setProfile({...profile,cgpa:e.target.value})} placeholder="8.2"/></label><label>Active backlogs<input type="number" value={profile.backlogs||0} onChange={e=>setProfile({...profile,backlogs:Number(e.target.value)})}/></label><label>Career interest<input value={profile.careerInterest||''} onChange={e=>setProfile({...profile,careerInterest:e.target.value})} placeholder="Software Engineering"/></label><label>Target company<input value={profile.targetCompany||''} onChange={e=>setProfile({...profile,targetCompany:e.target.value})} placeholder="Amazon"/></label><label>Target role<input value={profile.targetRole||''} onChange={e=>setProfile({...profile,targetRole:e.target.value})} placeholder="SDE I"/></label><div className="formActions">{saved && <span className="saved"><CheckCircle2 size={16}/> Saved</span>}<button className="primary">Save profile</button></div></form></>;
}

function Jobs({ token }) {
  const [jobs,setJobs]=useState([]); const [companies,setCompanies]=useState([]); const [search,setSearch]=useState('');
  useEffect(()=>{api('/jobs',token).then(setJobs);api('/companies',token).then(setCompanies)},[token]);
  const find=async()=>setJobs(await api('/jobs'+(search?'?search='+encodeURIComponent(search):''),token));
  return <><PageTitle eyebrow="OPPORTUNITY INTELLIGENCE" title="Companies & Jobs" action={<div className="inlineSearch"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search roles or skills"/><button onClick={find}>Search</button></div>}/><div className="companyStrip">{companies.map(c=><button key={c.id} className="companyChip" onClick={()=>api('/jobs?company='+c.id,token).then(setJobs)}><i style={{background:c.color}}>{c.logo}</i><span>{c.name}</span></button>)}</div><div className="jobList">{jobs.map(job=><article className="card jobCard" key={job.id}><div className="companyLogo">{job.company[0]}</div><div className="jobMain"><div className="jobMeta"><span>{job.company}</span>{job.verified&&<b><CheckCircle2 size={13}/> Official source</b>}</div><h3>{job.title}</h3><p>{job.location} · {job.type}</p><div className="tags">{job.skills.map(s=><span key={s}>{s}</span>)}</div></div><a className="outline" href={job.source} target="_blank" rel="noreferrer">View source</a></article>)}</div></>;
}

function Assessment({ token }) {
  const [assessment,setAssessment]=useState(null); const [answers,setAnswers]=useState({}); const [result,setResult]=useState(null);
  const generate=async()=>setAssessment(await api('/assessments/generate',token,{method:'POST',body:'{}'}));
  const submit=async()=>setResult(await api('/assessments/submit',token,{method:'POST',body:JSON.stringify({answers})}));
  if(result)return <><PageTitle eyebrow="ASSESSMENT RESULT" title="Your evidence-based skill report"/><section className="card resultCard"><div className="scoreRing" style={{'--score':result.score+'%'}}><strong>{result.score}%</strong><span>Score</span></div><div><h3>{result.score>=70?'Strong fundamentals':'Priority learning areas'}</h3><p>{result.weakSkills.length?`Focus next on ${result.weakSkills.join(', ')}.`:'Keep practicing advanced scenarios.'}</p><small>{result.evidence}</small><button className="primary" onClick={()=>setResult(null)}>Take another assessment</button></div></section></>;
  if(!assessment)return <><PageTitle eyebrow="OBJECTIVE EVALUATION" title="Skill Assessment" action={<button className="primary" onClick={generate}>Generate assessment</button>}/><div className="assessmentEmpty card"><div className="assessmentIcon"><ClipboardCheck/></div><h3>Measure what you can actually demonstrate</h3><p>Your assessment will include practical concepts and scenario-based questions across your selected skills.</p><div className="tags"><span>Algorithms</span><span>DBMS</span><span>Java</span></div></div></>;
  return <><PageTitle eyebrow={assessment.title} title={`${assessment.questions.length} questions · ${assessment.durationMinutes} minutes`} action={<button className="primary" onClick={submit}>Submit assessment</button>}/><div className="questionList">{assessment.questions.map((q,i)=><article className="card question" key={q.id}><span>QUESTION {i+1} · {q.skill}</span><h3>{q.prompt}</h3>{q.options.map((o,j)=><label key={o} className={Number(answers[q.id])===j?'option selected':'option'}><input type="radio" name={q.id} checked={Number(answers[q.id])===j} onChange={()=>setAnswers({...answers,[q.id]:j})}/>{o}</label>)}</article>)}</div></>;
}

function Roadmap({ token }) {
  const [tasks,setTasks]=useState([]);
  useEffect(()=>{api('/roadmap',token).then(setTasks)},[token]);
  const toggle=async(task)=>{const status=task.status==='Completed'?'In progress':'Completed';const updated=await api('/roadmap/'+task.id,token,{method:'PATCH',body:JSON.stringify({status})});setTasks(tasks.map(t=>t.id===updated.id?updated:t));};
  const completed=tasks.filter(t=>t.status==='Completed').length;
  return <><PageTitle eyebrow="PERSONALIZED LEARNING" title="Your career roadmap" action={<button className="outline">Regenerate roadmap</button>}/><div className="roadmapSummary card"><div><span>OVERALL PROGRESS</span><strong>{tasks.length?Math.round(completed/tasks.length*100):0}%</strong></div><div className="progressTrack"><i style={{width:(tasks.length?completed/tasks.length*100:0)+'%'}}/></div><span>{completed} of {tasks.length} tasks complete</span></div><div className="roadmap">{tasks.map((task,i)=><article className="card roadmapTask" key={task.id}><button className={task.status==='Completed'?'taskCheck done':'taskCheck'} onClick={()=>toggle(task)}>{task.status==='Completed'&&<CheckCircle2 size={18}/>}</button><div className="taskNumber">0{i+1}</div><div className="taskMain"><div className="taskHead"><div><span className={'priority '+task.priority.toLower()}>{task.priority} priority</span><h3>{task.topic}</h3></div><span>{task.durationHours} hours</span></div><div className="subtopics">{task.subtopics.map(s=><span key={s}>{s}</span>)}</div><div className="taskActions">{task.resources.slice(0,2).map(r=><a key={r.id||r.url} href={r.url} target="_blank" rel="noreferrer">{r.title}</a>)}</div></div></article>)}</div></>;
}

function Resources({ token }) {
  const [resources,setResources]=useState([]);
  useEffect(()=>{api('/resources',token).then(setResources)},[token]);
  return <><PageTitle eyebrow="CURATED LEARNING" title="Resource library"/><div className="resourceGrid">{resources.map(r=><article className="card resourceCard" key={r.id}><div className="resourceTop"><span>{r.type}</span><b>{r.duration}</b></div><h3>{r.title}</h3><p>{r.provider} · {r.topic}</p><a href={r.url} target="_blank" rel="noreferrer" className="outline">Open resource <ChevronRight size={15}/></a></article>)}</div></>;
}

function Interview({ token }) {
  const [interview,setInterview]=useState(null); const [message,setMessage]=useState(''); const [feedback,setFeedback]=useState(null);
  const [company,setCompany]=useState('Amazon'); const [role,setRole]=useState('SDE I'); const [round,setRound]=useState('Technical'); const [difficulty,setDifficulty]=useState('Medium');
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const start=async()=>{setBusy(true);setError('');try{setInterview(await api('/interviews',token,{method:'POST',body:JSON.stringify({company,role,round,difficulty})}));}catch(err){setError(err.message);}finally{setBusy(false);}};
  const send=async(e)=>{e.preventDefault();if(!message.trim()||busy)return;setBusy(true);setError('');try{const next=await api('/interviews/'+interview.id+'/message',token,{method:'POST',body:JSON.stringify({message})});setInterview(next);setMessage('');}catch(err){setError(err.message);}finally{setBusy(false);}};
  const finish=async()=>{setBusy(true);setError('');try{setFeedback(await api('/interviews/'+interview.id+'/finish',token,{method:'POST',body:'{}'}));}catch(err){setError(err.message);}finally{setBusy(false);}};
  return <><PageTitle eyebrow="GROQ-POWERED PRACTICE" title="Mock interview"/>{error&&<div className="error interviewError" role="alert">{error}</div>}{!interview?<section className="card interviewSetup"><h3>Configure your practice session</h3><div className="formGrid"><label>Company<select value={company} onChange={e=>setCompany(e.target.value)}><option>Amazon</option><option>Microsoft</option><option>TCS</option></select></label><label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option>SDE I</option><option>Software Engineer</option></select></label><label>Round<select value={round} onChange={e=>setRound(e.target.value)}><option>Technical</option><option>Coding</option><option>HR / Behavioral</option></select></label><label>Difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option>Medium</option><option>Easy</option><option>Hard</option></select></label></div><button className="primary" onClick={start} disabled={busy}>{busy?'Connecting to Groq...':'Start mock interview'}</button></section>:<div className="chatLayout"><section className="card chat"><div className="chatHead"><div><span>LIVE PRACTICE</span><h3>{interview.company} · {interview.role}</h3></div><button className="outline" onClick={finish} disabled={busy||Boolean(feedback)}>{busy?'Working...':'Finish session'}</button></div><div className="messages">{interview.messages.map((m,i)=><div className={'message '+m.role} key={i}>{m.content}</div>)}</div><form onSubmit={send} className="chatInput"><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Type your answer..." disabled={busy}/><button className="primary" disabled={busy||!message.trim()}>{busy?'Thinking...':'Send'}</button></form></section>{feedback&&<section className="card feedback"><span>SESSION FEEDBACK</span><h3>{feedback.score}% performance</h3><p>{feedback.technical}% technical · {feedback.communication}% communication</p><h4>Strengths</h4>{feedback.strengths.map(s=><div className="feedbackItem" key={s}><CheckCircle2 size={15}/>{s}</div>)}<h4>Improve next</h4>{feedback.gaps.map(s=><div className="feedbackItem gap" key={s}>{s}</div>)}<small>{feedback.disclaimer}</small></section>}</div>}</>;
}

function Resume({ token }) {
  const [text,setText]=useState('Aravind Sai\nSoftware Engineering student\nPython, Java, SQL\nProjects: student management system');
  const [result,setResult]=useState(null);
  const analyze=async()=>setResult(await api('/resumes/analyze',token,{method:'POST',body:JSON.stringify({text})}));
  return <><PageTitle eyebrow="ATS & CAREER FIT" title="Resume analyzer" action={<button className="primary" onClick={analyze}>Analyze resume</button>}/><div className="resumeGrid"><section className="card"><h3>Resume content</h3><textarea value={text} onChange={e=>setText(e.target.value)} rows={15}/><small>For a demo, paste resume text. Upload support can be added with file parsing.</small></section>{result?<section className="card resumeResult"><span>ESTIMATED ATS SCORE</span><strong>{result.score}%</strong><h3>Found skills</h3><div className="tags">{result.found.map(s=><span key={s}>{s}</span>)}</div><h3>Potential improvements</h3>{result.improvements.map(s=><div className="feedbackItem" key={s}>{s}</div>)}<small>{result.status}</small></section>:<section className="card emptyResult"><Sparkles/><h3>Get actionable resume feedback</h3><p>Analyze skill coverage, ATS structure and impact statements.</p></section>}</div></>;
}

function Applications({ token }) {
  const [items,setItems]=useState([]);
  useEffect(()=>{api('/applications',token).then(setItems)},[token]);
  const add=async()=>{const item=await api('/applications',token,{method:'POST',body:JSON.stringify({company:'Microsoft',role:'Software Engineer',deadline:'2026-12-20'})});setItems([item,...items]);};
  return <><PageTitle eyebrow="OPPORTUNITY TRACKER" title="Applications" action={<button className="primary" onClick={add}>Add application</button>}/><div className="card tableWrap"><table><thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Deadline</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><b>{item.company}</b></td><td>{item.role}</td><td><span className="status">{item.status}</span></td><td>{item.deadline}</td></tr>)}</tbody></table></div></>;
}

export default App;
