// ─────────────────────────────────────────────────────────────
// EDIT THIS FILE to update the About page. Everything here is placeholder
// content: swap in real names, roles, bios, and photo URLs anytime.
// Photos accept any https:// image link (or leave imageUrl empty for
// an initials avatar).
// ─────────────────────────────────────────────────────────────

export const CONTACT_EMAIL = "parsu.specs@gmail.com";

export const APP_INFO = {
  name: "Specs App Store",
  tagline: "Student software, built and shared here.",
  description:
    "Specs App Store (CodeCanvas) is a campus community app store where SPECS student developers publish their software, exchange thoughtful feedback, find collaborators, and celebrate progress together.",
  features: [
    {
      title: "Discover projects",
      body: "Browse student-built software by name, category, or developer — and open live demos straight from each card.",
    },
    {
      title: "Feedback threads",
      body: "Every project has a discussion space with nested replies and likes, so useful reviews don't get lost.",
    },
    {
      title: "Milestones wall",
      body: "Builders post progress updates on the Community page and the crowd cheers them on.",
    },
    {
      title: "Leaderboards & trophies",
      body: "Developers and projects earn rank points from upvotes. Top 3 carry gold, silver, and bronze trophies everywhere.",
    },
    {
      title: "Docs import",
      body: "Pull README files straight from a project's GitHub repository instead of pasting them by hand.",
    },
    {
      title: "Developer profiles",
      body: "Each builder gets a profile with their projects, collaborators, and community feedback.",
    },
  ],
};

export type TeamMember = {
  name: string;
  role: string;
  bio: string;
  imageUrl?: string;
  color: string;
};

export const TEAM: TeamMember[] = [
  {
    name: "Your Name",
    role: "Lead Developer",
    bio: "Owns the overall direction of the app store and keeps releases moving.",
    imageUrl: "https://picsum.photos/seed/specs-dev-1/200",
    color: "yellow",
  },
  {
    name: "Teammate Two",
    role: "Frontend Developer",
    bio: "Builds the pages and components students tap through every day.",
    imageUrl: "https://picsum.photos/seed/specs-dev-2/200",
    color: "mint",
  },
  {
    name: "Teammate Three",
    role: "Backend Developer",
    bio: "Keeps data, accounts, and content in good shape behind the scenes.",
    imageUrl: "https://picsum.photos/seed/specs-dev-3/200",
    color: "pink",
  },
  {
    name: "Teammate Four",
    role: "UI Designer",
    bio: "Makes the app store feel playful, clear, and easy to use.",
    imageUrl: "https://picsum.photos/seed/specs-dev-4/200",
    color: "sky",
  },
  {
    name: "Teammate Five",
    role: "QA & Community",
    bio: "Tests releases and keeps community feedback flowing back to builders.",
    imageUrl: "https://picsum.photos/seed/specs-dev-5/200",
    color: "lavender",
  },
];
