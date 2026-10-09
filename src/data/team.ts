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
      body: "Browse student-built software by name, category, or developer — tap anywhere on a card to open it, and read upload stamps showing how fresh each project is.",
    },
    {
      title: "Feedback threads",
      body: "Every project has a discussion space with nested replies and likes. Authors can delete their own comments and replies from the ⋯ menu.",
    },
    {
      title: "Notifications inbox",
      body: "The bell collects comments, replies, upvotes, collaborator tags, new projects, and Feed posts — newest first, with sound chimes and delete-all.",
    },
    {
      title: "Voters viewer",
      body: "Tap Voters under any project's vote buttons to see exactly who upvoted, with avatars that open each voter's profile.",
    },
    {
      title: "Collaborators",
      body: "Tag developers on your project and they get notified — on the card, the project page, and in their inbox.",
    },
    {
      title: "Community feed",
      body: "Builders post progress updates in the Feed, reply in nested discussions, and cheer one another on.",
    },
    {
      title: "Leaderboards & trophies",
      body: "Developers and projects earn rank points from upvotes. Top 3 carry gold, silver, and bronze trophies everywhere.",
    },
    {
      title: "Docs import",
      body: "Pull README files straight from a project's GitHub repository, then read long docs page by page with See more / See less.",
    },
    {
      title: "Developer profiles",
      body: "Each builder gets a profile with their projects and feedback — plus an avatar color and a theme palette visitors see on the page.",
    },
    {
      title: "Sound effects",
      body: "Votes land and notifications arrive with playful chimes, wired to fire only on real activity.",
    },
    {
      title: "Account safety",
      body: "Signing out always asks for confirmation, and profile renames survive logout and login.",
    },
    {
      title: "Google sign-in",
      body: "Join with email and password or continue with your Google account — duplicate profiles can be claimed and merged.",
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
