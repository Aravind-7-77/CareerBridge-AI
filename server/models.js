import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema({
  _id: { type: String },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { timestamps: true });

const assessmentSkillScoreSchema = new Schema({
  name: { type: String, required: true },
  correct: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 1 },
}, { _id: false });

const assessmentResultSchema = new Schema({
  id: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  correct: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator(value) {
        return Number.isInteger(value) && value <= this.total;
      },
      message: 'Correct answers must be an integer no greater than the total',
    },
  },
  total: { type: Number, required: true, min: 1 },
  weakSkills: { type: [String], required: true },
  verifiedSkills: { type: [String], required: true },
  skillScores: { type: [assessmentSkillScoreSchema], default: [] },
  evidence: { type: String, required: true },
  createdAt: { type: Date, required: true },
}, { _id: false });

const userStateSchema = new Schema({
  _id: { type: String },
  profile: Schema.Types.Mixed,
  assessment: Schema.Types.Mixed,
  assessmentResults: { type: [assessmentResultSchema], default: [] },
  roadmap: Schema.Types.Mixed,
  resume: Schema.Types.Mixed,
  applications: Schema.Types.Mixed,
}, { timestamps: true });

const interviewFeedbackSchema = new Schema({
  score: { type: Number, required: true, min: 0, max: 100 },
  technical: { type: Number, required: true, min: 0, max: 100 },
  communication: { type: Number, required: true, min: 0, max: 100 },
  problemSolving: { type: Number, required: true, min: 0, max: 100 },
  strengths: { type: [String], required: true, validate: (items) => items.length <= 4 },
  gaps: { type: [String], required: true, validate: (items) => items.length <= 4 },
  disclaimer: { type: String, required: true },
  generatedAt: { type: Date, required: true },
}, { _id: false });

const interviewSchema = new Schema({
  _id: { type: String },
  userId: { type: String, required: true, index: true },
  data: { type: Schema.Types.Mixed, required: true },
  feedback: { type: interviewFeedbackSchema, default: null },
}, { timestamps: true });

const userActivitySchema = new Schema({
  userId: { type: String, required: true },
  type: {
    type: String,
    required: true,
    enum: [
      'profile_updated',
      'assessment_generated',
      'assessment_submitted',
      'roadmap_updated',
      'roadmap_generated',
      'resume_analyzed',
      'application_created',
      'application_updated',
      'interview_started',
      'interview_message',
      'interview_finished',
    ],
  },
}, { timestamps: { createdAt: true, updatedAt: false } });
userActivitySchema.index({ userId: 1, createdAt: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const UserState = mongoose.models.UserState || mongoose.model('UserState', userStateSchema);
export const Interview = mongoose.models.Interview || mongoose.model('Interview', interviewSchema);
export const UserActivity = mongoose.models.UserActivity || mongoose.model('UserActivity', userActivitySchema);
