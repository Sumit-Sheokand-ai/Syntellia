# Authentication Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                 │
│                     (React Frontend - Browser)                           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
        │  Not Logged In          │       Logged In    │
        │                                               │
        ▼                                               ▼
┌──────────────────┐                         ┌──────────────────┐
│  Login Button    │                         │   User Menu      │
│  Signup Button   │                         │   - Profile      │
└────────┬─────────┘                         │   - Sign Out     │
         │                                   └────────┬─────────┘
         │                                            │
         ▼                                            ▼
┌──────────────────────────────────────┐    ┌─────────────────────┐
│        Login/Signup Pages            │    │   Profile Page      │
│  ┌────────────────────────────────┐  │    │  - Account Info     │
│  │  Email/Password Form           │  │    │  - Saved Searches   │
│  └────────────────────────────────┘  │    │  - Settings         │
│  ┌────────────────────────────────┐  │    └─────────────────────┘
│  │  OAuth Buttons                 │  │
│  │  - Google                      │  │
│  │  - GitHub                      │  │
│  └────────────────────────────────┘  │
└───────────────┬──────────────────────┘
                │
                │ Authentication Request
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       AUTHENTICATION CONTEXT                             │
│                       (React Context Provider)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  State Management:                                                       │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  user: User | null                                              │    │
│  │  session: Session | null                                        │    │
│  │  loading: boolean                                               │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Methods:                                                                │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  signIn(email, password)                                        │    │
│  │  signUp(email, password, metadata)                              │    │
│  │  signOut()                                                      │    │
│  │  signInWithGoogle()                                             │    │
│  │  signInWithGithub()                                             │    │
│  └────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │ Supabase Client Calls
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE CLIENT                                  │
│                      (lib/supabase.ts)                                   │
├─────────────────────────────────────────────────────────────────────────┤
│  Configuration:                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  VITE_SUPABASE_URL=https://xxx.supabase.co                     │    │
│  │  VITE_SUPABASE_ANON_KEY=eyJhbGc...                             │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Features:                                                               │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  - Session persistence (localStorage)                           │    │
│  │  - Auto token refresh                                           │    │
│  │  - URL detection for OAuth callbacks                            │    │
│  └────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                │ HTTPS API Calls
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE CLOUD                                   │
│                    (app.supabase.com)                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    AUTHENTICATION SERVICE                         │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  Email/Password:                                                  │  │
│  │  ├─ User registration                                             │  │
│  │  ├─ Email confirmation                                            │  │
│  │  ├─ Password hashing (bcrypt)                                     │  │
│  │  ├─ Login validation                                              │  │
│  │  └─ Password reset                                                │  │
│  │                                                                    │  │
│  │  OAuth Providers:                                                 │  │
│  │  ├─ Google OAuth 2.0                                              │  │
│  │  ├─ GitHub OAuth 2.0                                              │  │
│  │  └─ Callback handling                                             │  │
│  │                                                                    │  │
│  │  JWT Tokens:                                                      │  │
│  │  ├─ Access token generation                                       │  │
│  │  ├─ Refresh token rotation                                        │  │
│  │  └─ Token validation                                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    DATABASE (PostgreSQL)                          │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  auth.users table:                                                │  │
│  │  ├─ id (uuid)                                                     │  │
│  │  ├─ email                                                         │  │
│  │  ├─ encrypted_password                                            │  │
│  │  ├─ email_confirmed_at                                            │  │
│  │  ├─ user_metadata (JSON)                                          │  │
│  │  └─ created_at                                                    │  │
│  │                                                                    │  │
│  │  user_searches table (your custom table):                        │  │
│  │  ├─ id (uuid)                                                     │  │
│  │  ├─ user_id (foreign key → auth.users)                           │  │
│  │  ├─ tool (text)                                                   │  │
│  │  ├─ query (text)                                                  │  │
│  │  ├─ result (text)                                                 │  │
│  │  └─ created_at (timestamp)                                        │  │
│  │                                                                    │  │
│  │  Row Level Security (RLS):                                        │  │
│  │  └─ Users can only access their own data                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    EMAIL SERVICE                                  │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │  - Confirmation emails                                            │  │
│  │  - Password reset emails                                          │  │
│  │  - Magic link emails                                              │  │
│  │  - Custom SMTP support                                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘


AUTHENTICATION FLOWS:
═══════════════════════

1. EMAIL/PASSWORD SIGNUP FLOW:
═══════════════════════════════

User                Frontend              Supabase
│                   │                     │
├─ Enter email ────>│                     │
│  & password       │                     │
│                   ├─ signUp() ─────────>│
│                   │                     ├─ Hash password
│                   │                     ├─ Create user record
│                   │                     ├─ Send confirmation email
│                   │<── Success ─────────┤
│<── "Check email" ─┤                     │
│                   │                     │
├─ Click link in ──>│                     │
│  email            ├─ Confirm ──────────>│
│                   │                     ├─ Mark email_confirmed
│                   │<── Redirect ────────┤
│<── Logged in ─────┤                     │


2. EMAIL/PASSWORD LOGIN FLOW:
══════════════════════════════

User                Frontend              Supabase
│                   │                     │
├─ Enter email ────>│                     │
│  & password       │                     │
│                   ├─ signIn() ─────────>│
│                   │                     ├─ Validate password
│                   │                     ├─ Generate JWT tokens
│                   │<── Session ─────────┤
│<── Logged in ─────┤                     │
│                   ├─ Store in localStorage
│                   ├─ Update AuthContext


3. OAUTH (GOOGLE/GITHUB) FLOW:
═══════════════════════════════

User                Frontend              Supabase             OAuth Provider
│                   │                     │                    │
├─ Click "Google" ─>│                     │                    │
│                   ├─ signInWithOAuth ───>│                    │
│                   │                     ├─ Redirect ─────────>│
│                   │                     │                    ├─ Show consent
│                   │<────────────────────┼── Redirect ────────┤
│<── OAuth page ────┤                     │                    │
├─ Authorize ───────────────────────────────────────────────>│
│                   │                     │                    │
│                   │<────────────────────┼── Callback ────────┤
│                   │                     │<── User data ──────┤
│                   │                     ├─ Create/update user
│                   │<── Session ─────────┤
│<── Logged in ─────┤


4. MAKING AUTHENTICATED API CALLS:
═══════════════════════════════════

Frontend            ASP.NET Backend       Supabase
│                   │                     │
├─ Get session ─────>│                     │
├─ Extract JWT      │                     │
│                   │                     │
├─ API call ────────>│                     │
│  with Bearer      │                     │
│  token            ├─ Validate token ────>│
│                   │<── Valid ───────────┤
│                   ├─ Process request    │
│<── Response ──────┤                     │


5. SESSION PERSISTENCE FLOW:
═════════════════════════════

Page Load           AuthContext          Supabase            localStorage
│                   │                    │                   │
├─ App starts ─────>│                    │                   │
│                   ├─ getSession() ────>│                   │
│                   │                    ├─ Check ──────────>│
│                   │                    │<── Session ───────┤
│                   │<── User data ──────┤                   │
│<── Logged in ─────┤                    │                   │
│                   │                    │                   │
│                   ├─ onAuthStateChange ─────────>│          │
│                   │  (listen for changes)                  │


DATA SECURITY LAYERS:
═══════════════════════

┌─────────────────────────────────────────┐
│  1. HTTPS/TLS Encryption                 │
│     └─ All traffic encrypted             │
├─────────────────────────────────────────┤
│  2. JWT Token Authentication             │
│     └─ Signed tokens, tamper-proof       │
├─────────────────────────────────────────┤
│  3. Password Hashing                     │
│     └─ Bcrypt with salt                  │
├─────────────────────────────────────────┤
│  4. Row Level Security (RLS)             │
│     └─ Database-level access control     │
├─────────────────────────────────────────┤
│  5. API Rate Limiting                    │
│     └─ Prevent abuse                     │
├─────────────────────────────────────────┤
│  6. Email Verification                   │
│     └─ Confirm real users                │
└─────────────────────────────────────────┘


USER STATES & UI RENDERING:
════════════════════════════

┌─────────────────────────────┐
│  Loading State              │
│  - Show spinner             │
│  - Don't render content     │
└──────────┬──────────────────┘
           │
           ▼
    ┌──────────────┐
    │ Has session? │
    └──┬────────┬──┘
       │        │
    Yes│        │No
       │        │
       ▼        ▼
┌──────────┐  ┌──────────────┐
│ Logged   │  │ Not Logged   │
│ In       │  │ In           │
│          │  │              │
│ Show:    │  │ Show:        │
│ - User   │  │ - Login btn  │
│   menu   │  │ - Signup btn │
│ - Profile│  │              │
│ - Signout│  │ Redirect to: │
│          │  │ - /login     │
└──────────┘  └──────────────┘
```

This authentication system is production-ready and secure! 🔐
