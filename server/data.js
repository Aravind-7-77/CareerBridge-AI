export const companies = [
  { id: 'amazon', name: 'Amazon', type: 'Product', roles: ['SDE I', 'Cloud Support Associate'], logo: 'A', color: '#ff9900' },
  { id: 'microsoft', name: 'Microsoft', type: 'Product', roles: ['Software Engineer', 'Data Analyst'], logo: 'M', color: '#5c7cfa' },
  { id: 'google', name: 'Google', type: 'Product', roles: ['Software Engineer', 'STEP Intern'], logo: 'G', color: '#4285f4' },
  { id: 'atlassian', name: 'Atlassian', type: 'Product', roles: ['Backend Engineer', 'SDE I'], logo: 'A', color: '#2684ff' },
  { id: 'zoho', name: 'Zoho', type: 'Product', roles: ['Product Developer', 'QA Engineer'], logo: 'Z', color: '#dc3545' },
  { id: 'salesforce', name: 'Salesforce', type: 'Product', roles: ['Associate Member of Technical Staff'], logo: 'S', color: '#00a1e0' },
  { id: 'tcs', name: 'TCS', type: 'Service', roles: ['Ninja Software Engineer', 'Digital Engineer'], logo: 'T', color: '#6b46c1' },
  { id: 'infosys', name: 'Infosys', type: 'Service', roles: ['Systems Engineer', 'Specialist Programmer'], logo: 'I', color: '#007cc3' },
  { id: 'wipro', name: 'Wipro', type: 'Service', roles: ['Project Engineer', 'Developer'], logo: 'W', color: '#00a651' },
  { id: 'accenture', name: 'Accenture', type: 'Service', roles: ['Application Development Associate'], logo: 'A', color: '#a100ff' },
];

export const jobListings = [
  { id: 'j1', companyId: 'amazon', company: 'Amazon', title: 'SDE I', location: 'Bangalore / Hyderabad', type: 'Full-time', skills: ['Data Structures', 'Algorithms', 'Object-Oriented Programming', 'Java'], eligibility: 'B.Tech CSE/ECE; 7.0 CGPA; no active backlogs', source: 'https://www.amazon.jobs/', sourceLabel: 'Official Amazon Careers', retrievedAt: '2026-11-24', verified: true },
  { id: 'j2', companyId: 'microsoft', company: 'Microsoft', title: 'Software Engineer', location: 'Hyderabad', type: 'Full-time', skills: ['C++', 'Data Structures', 'DBMS', 'Operating Systems'], eligibility: 'B.Tech/B.E. 2026-2027; no active backlogs', source: 'https://jobs.careers.microsoft.com/', sourceLabel: 'Official Microsoft Careers', retrievedAt: '2026-11-24', verified: true },
  { id: 'j3', companyId: 'google', company: 'Google', title: 'Software Engineer', location: 'Bangalore', type: 'Full-time', skills: ['Algorithms', 'Python', 'System Design', 'Problem Solving'], eligibility: 'Engineering degree; strong DSA fundamentals', source: 'https://www.google.com/about/careers/applications/jobs/results/', sourceLabel: 'Official Google Careers', retrievedAt: '2026-11-24', verified: true },
  { id: 'j4', companyId: 'tcs', company: 'TCS', title: 'Digital Engineer', location: 'PAN India', type: 'Full-time', skills: ['Java', 'SQL', 'Aptitude', 'Communication'], eligibility: 'B.E./B.Tech/B.Sc; 60% aggregate; no active backlogs', source: 'https://www.tcs.com/careers', sourceLabel: 'Official TCS Careers', retrievedAt: '2026-11-24', verified: true },
];

export const resources = [
  { id: 'r1', title: 'Data Structures and Algorithms in Java', topic: 'Data Structures', type: 'Course', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=CBYHwZcbD-s', duration: '5h' },
  { id: 'r2', title: 'SQL Full Course', topic: 'DBMS', type: 'Course', provider: 'freeCodeCamp', url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY', duration: '4h' },
  { id: 'r3', title: 'Python Official Tutorial', topic: 'Python', type: 'Documentation', provider: 'Python.org', url: 'https://docs.python.org/3/tutorial/', duration: '6h' },
  { id: 'r4', title: 'LeetCode Data Structures', topic: 'Algorithms', type: 'Practice', provider: 'LeetCode', url: 'https://leetcode.com/explore/learn/', duration: 'Open' },
];
