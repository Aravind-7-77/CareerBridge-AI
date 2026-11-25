import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { Interview, User, UserActivity, UserState } from './models.js';
import { companies, jobListings, resources } from './data.js';
import { groqChat, GroqError, parseGroqJson } from './groq.js';

dotenv.config();
const isProduction = process.env.NODE_ENV === 'production';
const configuredClientOrigins = process.env.CLIENT_ORIGIN || (isProduction ? '' : 'http://localhost:5173');
const clientOrigins = new Set(configuredClientOrigins.split(',').map((origin) => origin.trim()).filter(Boolean));
const trustProxyHops = process.env.TRUST_PROXY_HOPS === undefined ? null : Number(process.env.TRUST_PROXY_HOPS);
if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production');
}
if (clientOrigins.size === 0) {
  throw new Error('CLIENT_ORIGIN must contain at least one allowed frontend origin');
}
if (trustProxyHops !== null && (!Number.isInteger(trustProxyHops) || trustProxyHops < 0)) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
}

const app = express();
if (trustProxyHops !== null) app.set('trust proxy', trustProxyHops);
app.use(helmet({
  contentSecurityPolicy: isProduction ? { directives: { frameAncestors: ["'none'"] } } : false,
  frameguard: { action: 'deny' },
  strictTransportSecurity: isProduction ? undefined : false,
}));
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || clientOrigins.has(origin));
  },
}));
app.use(express.json({ limit: '2mb' }));

const port = process.env.PORT || 5000;
const jwtSecret = process.env.JWT_SECRET || 'careerbridge-development-secret';
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Try again later.' },
});
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI request limit reached. Try again later.' },
});
const users = new Map();
const stateStores = {
  profile: new Map(),
  assessment: new Map(),
  assessmentResults: new Map(),
  roadmap: new Map(),
  applications: new Map(),
  resume: new Map(),
};
const interviews = new Map();
const userActivities = new Map();
let mongoPersistenceEnabled = false;

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    if (isProduction) throw new Error('MONGODB_URI is required in production');
    console.warn('MONGODB_URI is not set; using in-memory demo persistence');
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    mongoPersistenceEnabled = true;
    console.log('MongoDB connected');
  } catch {
    if (isProduction) throw new Error('MongoDB connection failed; production server will not start');
    console.warn('MongoDB unavailable: using in-memory demo persistence');
  }
}

function databaseConnected() {
  return mongoose.connection.readyState === 1;
}

async function findUserByEmail(email) {
  if (!mongoPersistenceEnabled) return [...users.values()].find((user) => user.email === email);
  return User.findOne({ email }).lean();
}

async function saveUser(user) {
  if (!mongoPersistenceEnabled) {
    users.set(user.id, user);
    return;
  }
  await User.create({ _id: user.id, name: user.name, email: user.email, password: user.password });
}

async function getUserState(userId, field, fallback) {
  if (!mongoPersistenceEnabled) return stateStores[field].get(userId) ?? fallback;
  const state = await UserState.findById(userId).select(field).lean();
  return state?.[field] ?? fallback;
}

async function setUserState(userId, field, value) {
  if (!mongoPersistenceEnabled) {
    stateStores[field].set(userId, value);
    return;
  }
  await UserState.updateOne({ _id: userId }, { $set: { [field]: value } }, { upsert: true });
}

async function saveAssessmentSubmission(userId, result, roadmap) {
  if (!mongoPersistenceEnabled) {
    const results = stateStores.assessmentResults.get(userId) || [];
    stateStores.assessmentResults.set(userId, [...results, result]);
    stateStores.roadmap.set(userId, roadmap);
    return;
  }
  await UserState.updateOne(
    { _id: userId },
    { $set: { roadmap }, $push: { assessmentResults: result } },
    { upsert: true, runValidators: true },
  );
}

async function getInterview(interviewId, userId) {
  if (!mongoPersistenceEnabled) {
    const stored = interviews.get(interviewId);
    return stored?.userId === userId ? stored.data : null;
  }
  const stored = await Interview.findOne({ _id: interviewId, userId }).lean();
  return stored ? { ...stored.data, ...(stored.feedback ? { feedback: stored.feedback } : {}) } : null;
}

async function saveInterview(interview, userId) {
  if (!mongoPersistenceEnabled) {
    interviews.set(interview.id, { userId, data: interview });
    return;
  }
  const { feedback, ...data } = interview;
  const update = { userId, data };
  if (feedback !== undefined) update.feedback = feedback;
  await Interview.updateOne(
    { _id: interview.id },
    { $set: update },
    { upsert: true, runValidators: true },
  );
}

async function listUserInterviews(userId) {
  if (!mongoPersistenceEnabled) {
    return [...interviews.values()]
      .filter((stored) => stored.userId === userId)
      .map((stored) => stored.data)
      .reverse();
  }
  const storedInterviews = await Interview.find({ userId }).sort({ updatedAt: -1 }).lean();
  return storedInterviews.map((stored) => ({
    ...stored.data,
    id: stored._id,
    ...(stored.feedback ? { feedback: stored.feedback } : {}),
  }));
}

async function countUserInterviews(userId) {
  if (!mongoPersistenceEnabled) {
    return [...interviews.values()].filter((interview) => interview.userId === userId).length;
  }
  return Interview.countDocuments({ userId });
}

async function recordUserActivity(userId, type) {
  const activity = { type, createdAt: new Date() };
  if (!mongoPersistenceEnabled) {
    const events = userActivities.get(userId) || [];
    userActivities.set(userId, [...events, activity]);
    return;
  }
  await UserActivity.create({ userId, ...activity });
}

async function getWeeklyActivity(userId) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
  const events = mongoPersistenceEnabled
    ? await UserActivity.find({ userId, createdAt: { $gte: start, $lte: now } }).select('createdAt').lean()
    : (userActivities.get(userId) || []).filter((event) => event.createdAt >= start && event.createdAt <= now);
  const counts = new Map();
  const dates = Array.from({ length: 7 }, (_, index) => new Date(start.getTime() + index * 24 * 60 * 60 * 1000));
  for (const date of dates) counts.set(date.toISOString().slice(0, 10), 0);
  for (const event of events) {
    const date = new Date(event.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dates.map((date) => ({
    day: dayNames[date.getUTCDay()],
    activities: counts.get(date.toISOString().slice(0, 10)),
  }));
}

function calculateReadiness(assessmentResults) {
  let correct = 0;
  let total = 0;
  for (const result of assessmentResults) {
    if (!result || typeof result !== 'object') continue;
    if (Number.isFinite(result.correct) && Number.isFinite(result.total)
      && result.total > 0 && result.correct >= 0 && result.correct <= result.total) {
      correct += result.correct;
      total += result.total;
    }
  }
  return total ? Math.round((correct / total) * 100) : null;
}

function buildSkillData(profile, assessmentResults) {
  const profileSkills = new Map();
  if (Array.isArray(profile.skills)) {
    for (const skill of profile.skills) {
      const name = typeof skill === 'string'
        ? skill.trim()
        : typeof skill?.name === 'string' ? skill.name.trim() : '';
      if (name && !profileSkills.has(name)) {
        profileSkills.set(name, typeof skill === 'object' && typeof skill.level === 'string' ? skill.level : null);
      }
    }
  }

  const assessmentSkills = new Map();
  for (const result of assessmentResults) {
    if (!result || !Array.isArray(result.skillScores)) continue;
    for (const skill of result.skillScores) {
      if (!skill || typeof skill.name !== 'string' || !Number.isFinite(skill.correct)
        || !Number.isFinite(skill.total) || skill.total <= 0
        || skill.correct < 0 || skill.correct > skill.total) continue;
      const totals = assessmentSkills.get(skill.name) || { correct: 0, total: 0 };
      totals.correct += skill.correct;
      totals.total += skill.total;
      assessmentSkills.set(skill.name, totals);
    }
  }

  const names = new Set([...profileSkills.keys(), ...assessmentSkills.keys()]);
  return [...names].map((name) => {
    const totals = assessmentSkills.get(name);
    return {
      name,
      value: totals ? Math.round((totals.correct / totals.total) * 100) : null,
      level: profileSkills.get(name) || null,
      assessed: Boolean(totals),
    };
  });
}

const sign = (user) => jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });
function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try { req.user = jwt.verify(token, jwtSecret); next(); }
  catch { return res.status(401).json({ message: 'Invalid or expired session' }); }
}

app.get('/api/health', (_req, res) => {
  const database = !mongoPersistenceEnabled ? 'memory' : databaseConnected() ? 'mongodb' : 'unavailable';
  return res.status(database === 'unavailable' ? 503 : 200).json({
    ok: database !== 'unavailable',
    database,
    aiProvider: (process.env.LLM_PROVIDER || 'groq').toLowerCase(),
    aiConfigured: Boolean(process.env.LLM_API_KEY),
  });
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ message: 'Name, email and a 6-character password are required' });
  const normalizedEmail = email.toLowerCase();
  if (await findUserByEmail(normalizedEmail)) return res.status(409).json({ message: 'Email is already registered' });
  const user = { id: crypto.randomUUID(), name, email: normalizedEmail, password: await bcrypt.hash(password, 10) };
  try {
    await saveUser(user);
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Email is already registered' });
    throw error;
  }
  await setUserState(user.id, 'profile', { name, email: user.email, branch: '', graduationYear: '', cgpa: '', backlogs: 0, skills: [{ name: 'Python', level: 'Intermediate' }, { name: 'Data Structures', level: 'Beginner' }], targetCompany: '', targetRole: '', careerInterest: '' });
  return res.status(201).json({ token: sign(user), user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = await findUserByEmail(email?.toLowerCase());
  if (!user || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ message: 'Invalid email or password' });
  const id = user.id || user._id;
  res.json({ token: sign({ id, email: user.email }), user: { id, name: user.name, email: user.email } });
});

app.get('/api/profile', auth, async (req, res) => res.json(await getUserState(req.user.id, 'profile', {})));
app.put('/api/profile', auth, async (req, res) => {
  const profile = { ...await getUserState(req.user.id, 'profile', {}), ...req.body };
  await setUserState(req.user.id, 'profile', profile);
  await recordUserActivity(req.user.id, 'profile_updated');
  res.json(profile);
});

app.get('/api/companies', auth, (_req, res) => res.json(companies));
app.get('/api/jobs', auth, (req, res) => {
  const search = String(req.query.search || '').toLowerCase();
  const companyId = req.query.company;
  const result = jobListings.filter((job) => (!companyId || job.companyId === companyId) && (!search || `${job.title} ${job.company} ${job.skills.join(' ')}`.toLowerCase().includes(search)));
  res.json(result);
});

app.post('/api/assessments/generate', auth, async (req, res) => {
  const requestedSkills = req.body?.skills;
  if (requestedSkills !== undefined
    && (!Array.isArray(requestedSkills) || requestedSkills.some((skill) => typeof skill !== 'string' || !skill.trim()))) {
    return res.status(400).json({ message: 'Skills must be an array of non-empty strings.' });
  }
  const skills = requestedSkills?.length ? requestedSkills.map((skill) => skill.trim()) : ['Algorithms', 'DBMS', 'Java'];
  const questions = skills.slice(0, 4).flatMap((skill, i) => [
    { id: `${i}-1`, skill, type: 'MCQ', prompt: `Which concept is most important when analyzing the time complexity of ${skill}?`, options: ['Problem decomposition', 'Variable naming', 'File formatting', 'IDE configuration'], answer: 0 },
    { id: `${i}-2`, skill, type: 'Scenario', prompt: `Describe a practical way you would improve your working knowledge of ${skill}.`, options: ['Memorize syntax only', 'Build and test a project', 'Skip fundamentals', 'Copy a solution'], answer: 1 },
  ]);
  await setUserState(req.user.id, 'assessment', questions);
  await recordUserActivity(req.user.id, 'assessment_generated');
  res.json({ id: crypto.randomUUID(), title: 'Adaptive Core Assessment', durationMinutes: 20, questions });
});

app.get('/api/assessments/results', auth, async (req, res) => {
  try {
    const results = await getUserState(req.user.id, 'assessmentResults', []);
    return res.json([...results].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (error) {
    console.error('Failed to retrieve assessment results:', error);
    return res.status(500).json({ message: 'Could not retrieve assessment results.' });
  }
});

app.post('/api/assessments/submit', auth, async (req, res) => {
  const answers = req.body?.answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({ message: 'Answers must be provided as an object.' });
  }
  let questions;
  try {
    questions = await getUserState(req.user.id, 'assessment', []);
  } catch (error) {
    console.error('Failed to retrieve assessment questions:', error);
    return res.status(500).json({ message: 'Could not retrieve assessment questions.' });
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ message: 'Generate an assessment before submitting answers.' });
  }
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  for (const [questionId, answer] of Object.entries(answers)) {
    const question = questionsById.get(questionId);
    const answerIndex = Number(answer);
    if (!question || !Array.isArray(question.options)
      || (typeof answer !== 'number' && typeof answer !== 'string')
      || String(answer).trim() === ''
      || !Number.isInteger(answerIndex)
      || answerIndex < 0
      || answerIndex >= question.options.length) {
      return res.status(400).json({ message: 'One or more answers are invalid for this assessment.' });
    }
  }
  const correct = questions.filter((q) => Number(answers[q.id]) === q.answer).length;
  const score = questions.length ? Math.round(correct / questions.length * 100) : 0;
  const weakSkills = [...new Set(questions.filter((q) => Number(answers[q.id]) !== q.answer).map((q) => q.skill))];
  const verifiedSkills = [...new Set(questions.filter((q) => Number(answers[q.id]) === q.answer).map((q) => q.skill))];
  const skillTotals = new Map();
  for (const question of questions) {
    const totals = skillTotals.get(question.skill) || { correct: 0, total: 0 };
    totals.total += 1;
    if (Number(answers[question.id]) === question.answer) totals.correct += 1;
    skillTotals.set(question.skill, totals);
  }
  const skillScores = [...skillTotals].map(([name, totals]) => ({ name, ...totals }));
  const roadmap = buildRoadmap(weakSkills.length ? weakSkills : ['Communication', 'System Design']);
  const result = {
    id: crypto.randomUUID(),
    score,
    correct,
    total: questions.length,
    weakSkills,
    verifiedSkills,
    skillScores,
    evidence: 'Assessment-based estimate; not a hiring probability',
    createdAt: new Date(),
    roadmapUpdated: true,
  };
  try {
    await saveAssessmentSubmission(req.user.id, result, roadmap);
  } catch (error) {
    console.error('Failed to save assessment result:', error);
    return res.status(500).json({ message: 'Could not save assessment result.' });
  }
  try {
    await recordUserActivity(req.user.id, 'assessment_submitted');
  } catch (error) {
    console.error('Failed to record assessment activity:', error);
    return res.status(500).json({ message: 'Could not record assessment activity.' });
  }
  return res.json(result);
});

function buildRoadmap(gaps) {
  return gaps.map((topic, i) => ({
    id: `t${i}`, topic, subtopics: topic === 'Algorithms' ? ['Complexity', 'Sorting', 'Graphs'] : [`${topic} fundamentals`, 'Practice', 'Mini project'],
    priority: i === 0 ? 'High' : i === 1 ? 'Medium' : 'Low', durationHours: 6 + i * 2, status: 'In progress', score: null,
    resources: resources.filter((r) => r.topic === topic).concat(resources.slice(i % resources.length, i % resources.length + 1)),
    exercises: [`Complete 5 focused ${topic} exercises`, `Build a small ${topic} mini-project`],
  }));
}

function isValidInterviewFeedback(feedback) {
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) return false;
  const scoreFields = ['score', 'technical', 'communication', 'problemSolving'];
  return scoreFields.every((field) => Number.isFinite(feedback[field]) && feedback[field] >= 0 && feedback[field] <= 100)
    && Array.isArray(feedback.strengths)
    && Array.isArray(feedback.gaps);
}

app.get('/api/roadmap', auth, async (req, res) => {
  res.json(await getUserState(req.user.id, 'roadmap', buildRoadmap(['Data Structures', 'DBMS', 'Communication'])));
});
app.patch('/api/roadmap/:taskId', auth, async (req, res) => {
  const items = await getUserState(req.user.id, 'roadmap', buildRoadmap(['Data Structures', 'DBMS', 'Communication']));
  const task = items.find((item) => item.id === req.params.taskId);
  if (task) Object.assign(task, req.body);
  await setUserState(req.user.id, 'roadmap', items);
  if (task) await recordUserActivity(req.user.id, 'roadmap_updated');
  res.json(task || {});
});
app.post('/api/roadmap/generate', auth, async (req, res) => {
  const items = buildRoadmap(req.body.gaps?.length ? req.body.gaps : ['Data Structures', 'DBMS', 'Communication']);
  await setUserState(req.user.id, 'roadmap', items);
  await recordUserActivity(req.user.id, 'roadmap_generated');
  res.json(items);
});

app.get('/api/resources', auth, (_req, res) => res.json(resources));

app.get('/api/interviews', auth, async (req, res) => {
  try {
    return res.json(await listUserInterviews(req.user.id));
  } catch (error) {
    console.error('Failed to retrieve interviews:', error);
    return res.status(500).json({ message: 'Could not retrieve interviews.' });
  }
});

app.get('/api/interviews/:id/feedback', auth, async (req, res) => {
  try {
    const interview = await getInterview(req.params.id, req.user.id);
    if (!interview) return res.status(404).json({ message: 'Interview not found.' });
    if (!interview.feedback) return res.status(404).json({ message: 'Interview feedback is not available yet.' });
    if (!isValidInterviewFeedback(interview.feedback)) {
      console.error('Stored interview feedback is invalid.');
      return res.status(500).json({ message: 'Stored interview feedback is invalid.' });
    }
    return res.json(interview.feedback);
  } catch (error) {
    console.error('Failed to retrieve interview feedback:', error);
    return res.status(500).json({ message: 'Could not retrieve interview feedback.' });
  }
});

app.post('/api/interviews', auth, aiLimiter, async (req, res) => {
  const body = req.body || {};
  const company = body.company || 'Amazon';
  const role = body.role || 'SDE I';
  const round = body.round || 'Technical';
  const difficulty = body.difficulty || 'Medium';
  let opening;
  try {
    opening = await groqChat([
      {
        role: 'system',
        content: 'You are a supportive career-practice interviewer. Ask one clear, original opening question for the requested role and interview round. Tailor difficulty as requested. Do not claim to reproduce real, confidential, or guaranteed company interview questions. Output only the question, with at most one brief sentence of setup.',
      },
      {
        role: 'user',
        content: `Company context: ${company}. Role: ${role}. Round: ${round}. Difficulty: ${difficulty}.`,
      },
    ]);
  } catch (error) {
    res.status(error instanceof GroqError ? error.status : 502).json({ message: error.message || 'Could not start the AI interview.' });
    return;
  }
  const interview = { id: crypto.randomUUID(), company, role, round, difficulty, messages: [{ role: 'assistant', content: opening }] };
  await saveInterview(interview, req.user.id);
  await recordUserActivity(req.user.id, 'interview_started');
  res.status(201).json(interview);
});
app.post('/api/interviews/:id/message', auth, aiLimiter, async (req, res) => {
  const interview = await getInterview(req.params.id, req.user.id);
  if (!interview) return res.status(404).json({ message: 'Interview not found' });
  const answer = String(req.body?.message || '').trim();
  if (!answer) return res.status(400).json({ message: 'Please enter an answer before sending.' });
  const messages = [
    {
      role: 'system',
      content: `You are a supportive ${interview.difficulty.toLowerCase()} ${interview.round.toLowerCase()} mock interviewer for the ${interview.role} role at ${interview.company}. Evaluate each answer constructively, ask one focused follow-up question, and keep the conversation realistic and concise. Never claim these are actual or confidential company questions.`,
    },
    ...interview.messages.map(({ role, content }) => ({ role, content })),
    { role: 'user', content: answer },
  ];
  let reply;
  try {
    reply = await groqChat(messages);
  } catch (error) {
    res.status(error instanceof GroqError ? error.status : 502).json({ message: error.message || 'Could not get an AI interview response.' });
    return;
  }
  interview.messages.push({ role: 'user', content: answer }, { role: 'assistant', content: reply });
  await saveInterview(interview, req.user.id);
  await recordUserActivity(req.user.id, 'interview_message');
  res.json(interview);
});
app.post('/api/interviews/:id/finish', auth, aiLimiter, async (req, res) => {
  let interview;
  try {
    interview = await getInterview(req.params.id, req.user.id);
  } catch (error) {
    console.error('Failed to retrieve interview for feedback:', error);
    return res.status(500).json({ message: 'Could not retrieve interview.' });
  }
  if (!interview) return res.status(404).json({ message: 'Interview not found' });
  if (interview.feedback) {
    if (!isValidInterviewFeedback(interview.feedback)) {
      console.error('Stored interview feedback is invalid.');
      return res.status(500).json({ message: 'Stored interview feedback is invalid.' });
    }
    return res.json(interview.feedback);
  }
  const transcript = interview.messages.map(({ role, content }) => `${role}: ${content}`).join('\n');
  let feedback;
  try {
    const content = await groqChat([
      {
        role: 'system',
        content: 'Evaluate the mock interview transcript fairly. Return only a JSON object with numeric fields score, technical, communication, problemSolving (each 0-100), and arrays of 2-4 short strings strengths and gaps. Base scores only on evidence in the transcript. Do not predict hiring outcomes.',
      },
      { role: 'user', content: `Role: ${interview.role}\nRound: ${interview.round}\nTranscript:\n${transcript}` },
    ], { json: true, temperature: 0.2 });
    const result = parseGroqJson(content);
    if (!isValidInterviewFeedback(result)) {
      throw new GroqError('Groq returned incomplete interview feedback. Please retry.', 502);
    }
    feedback = {
      ...result,
      strengths: result.strengths.filter((item) => typeof item === 'string').slice(0, 4),
      gaps: result.gaps.filter((item) => typeof item === 'string').slice(0, 4),
      disclaimer: 'AI-generated practice feedback; not based on confidential company questions or a hiring prediction.',
      generatedAt: new Date(),
    };
  } catch (error) {
    return res.status(error instanceof GroqError ? error.status : 502).json({ message: error.message || 'Could not evaluate the AI interview.' });
  }
  try {
    await saveInterview({ ...interview, feedback }, req.user.id);
  } catch (error) {
    console.error('Failed to save interview feedback:', error);
    return res.status(500).json({ message: 'Could not save interview feedback.' });
  }
  await recordUserActivity(req.user.id, 'interview_finished');
  return res.json(feedback);
});

app.post('/api/resumes/analyze', auth, async (req, res) => {
  const text = String(req.body?.text || '').toLowerCase();
  const skillNames = ['python', 'java', 'sql', 'react', 'aws', 'data structures'];
  const found = skillNames.filter((skill) => text.includes(skill));
  const missing = skillNames.filter((skill) => !text.includes(skill));
  const result = { score: Math.min(92, 45 + found.length * 8), found, missing: missing.slice(0, 4), improvements: ['Quantify project outcomes with measurable impact', 'Add a focused technical skills section', 'Use active verbs and one-line achievement summaries'], atsTips: ['Use standard section headings', 'Avoid text inside images', 'Match relevant keywords from the job description'], status: 'AI-generated estimate' };
  await setUserState(req.user.id, 'resume', result);
  await recordUserActivity(req.user.id, 'resume_analyzed');
  res.json(result);
});
app.get('/api/resumes', auth, async (req, res) => res.json(await getUserState(req.user.id, 'resume', null)));

app.get('/api/applications', auth, async (req, res) => res.json(await getUserState(req.user.id, 'applications', [
  { id: 'a1', company: 'Amazon', role: 'SDE I', status: 'Assessment', deadline: '2026-12-10' },
])));
app.post('/api/applications', auth, async (req, res) => {
  const current = await getUserState(req.user.id, 'applications', []);
  const item = { id: crypto.randomUUID(), status: 'Saved', ...req.body };
  await setUserState(req.user.id, 'applications', [item, ...current]);
  await recordUserActivity(req.user.id, 'application_created');
  res.status(201).json(item);
});
app.patch('/api/applications/:id', auth, async (req, res) => {
  const current = await getUserState(req.user.id, 'applications', []);
  const item = current.find((entry) => entry.id === req.params.id);
  if (item) Object.assign(item, req.body);
  await setUserState(req.user.id, 'applications', current);
  if (item) await recordUserActivity(req.user.id, 'application_updated');
  res.json(item || {});
});

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const [profileValue, resultsValue, roadmapValue, applicationsValue, resume, interviews, weekly] = await Promise.all([
      getUserState(req.user.id, 'profile', {}),
      getUserState(req.user.id, 'assessmentResults', []),
      getUserState(req.user.id, 'roadmap', []),
      getUserState(req.user.id, 'applications', []),
      getUserState(req.user.id, 'resume', null),
      countUserInterviews(req.user.id),
      getWeeklyActivity(req.user.id),
    ]);
    const profile = profileValue && typeof profileValue === 'object' ? profileValue : {};
    const results = Array.isArray(resultsValue) ? resultsValue : [];
    const roadmap = Array.isArray(roadmapValue) ? roadmapValue : [];
    const applications = Array.isArray(applicationsValue) ? applicationsValue : [];
    const completedTasks = roadmap.filter((task) => task && task.status === 'Completed').length;

    return res.json({
      name: typeof profile.name === 'string' ? profile.name.trim() : '',
      readiness: calculateReadiness(results),
      progress: roadmap.length ? Math.round(completedTasks / roadmap.length * 100) : null,
      roadmapTasks: roadmap.length,
      completedTasks,
      resumes: resume ? 1 : 0,
      applications: applications.length,
      interviews,
      skillData: buildSkillData(profile, results),
      weekly,
    });
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    return res.status(500).json({ message: 'Could not load dashboard data.' });
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');
app.use(express.static(distDir));
app.get('/{*splat}', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

async function startServer() {
  await connectDatabase();
  app.listen(port, () => console.log(`CareerBridge AI server running at http://localhost:${port}`));
}

startServer().catch((error) => {
  console.error(`Server startup failed: ${error.message}`);
  process.exitCode = 1;
});
