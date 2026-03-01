# Authentication Quick Reference

## 🎯 What Was Added

✅ Supabase authentication integration
✅ Email/password sign up and login
✅ Google OAuth
✅ GitHub OAuth  
✅ User profile page
✅ Protected routes
✅ User menu with dropdown
✅ JWT token handling
✅ Session management

## 📁 New Files Created

### Frontend
```
tools_website.client/src/
├── lib/
│   └── supabase.ts              # Supabase client configuration
├── contexts/
│   └── AuthContext.tsx          # Authentication context/provider
├── pages/
│   ├── Login.tsx                # Login page with OAuth
│   ├── Signup.tsx               # Signup page
│   └── Profile.tsx              # User profile page
└── .env.example                 # Environment variables template
```

### Backend
```
tools_website.Server/
├── Attributes/
│   └── SupabaseAuthAttribute.cs # Auth middleware
└── Controllers/
    └── UserDataController.cs     # Example protected endpoints
```

### Documentation
```
SUPABASE_SETUP.md                # Complete setup guide
```

## ⚡ Quick Start

### 1. Set Up Supabase (5 minutes)

```bash
# Go to https://app.supabase.com
# Create a new project
# Get your Project URL and anon key
```

### 2. Configure Environment

```bash
cd tools_website.client
cp .env.example .env
# Edit .env with your Supabase credentials
```

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

### 3. Run the App

```bash
cd tools_website.Server
dotnet run
```

Open: `https://localhost:5173`

## 🎨 UI/UX Changes

### Header
- Added **Login** and **Sign Up** buttons (when logged out)
- Added **User Menu** with dropdown (when logged in)
  - Shows email
  - Link to Profile
  - Sign Out button

### New Pages
1. **/login** - Login with email or OAuth
2. **/signup** - Create account
3. **/profile** - User profile and settings

### Routes
```typescript
/                    # Home
/login              # Login page
/signup             # Signup page
/profile            # User profile (protected)
/ai-content         # AI Content Check
/robocall           # Robocall Check
/medication         # Medication Check
/job-screening      # Job Screening Check
/landlord           # Landlord Check
/face-dataset       # Face Dataset Check
```

## 🔐 Authentication Flow

### Sign Up Flow
```
1. User enters email, password, full name
2. Supabase sends confirmation email
3. User clicks confirmation link
4. Account activated
5. User is logged in
```

### Login Flow
```
1. User enters email and password (or clicks OAuth)
2. Supabase validates credentials
3. JWT token is stored in browser
4. User is redirected to home
5. Session persists across page refreshes
```

### OAuth Flow
```
1. User clicks "Continue with Google/GitHub"
2. Redirected to OAuth provider
3. User authorizes the app
4. Redirected back with token
5. User is logged in
```

## 🔌 Using Authentication in Components

### Check if user is logged in

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
    const { user, loading } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
    }

    if (!user) {
        return <div>Please log in</div>;
    }

    return <div>Hello, {user.email}</div>;
}
```

### Protect a route

```typescript
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

function ProtectedPage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    if (loading) return <div>Loading...</div>;
    if (!user) return null;

    return <div>Protected content</div>;
}
```

### Sign out

```typescript
import { useAuth } from '../contexts/AuthContext';

function SignOutButton() {
    const { signOut } = useAuth();

    return (
        <button onClick={signOut}>
            Sign Out
        </button>
    );
}
```

## 🌐 Making Authenticated API Calls

### Frontend

```typescript
import { supabase } from '../lib/supabase';

async function callProtectedAPI() {
    // Get the session token
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        console.error('Not logged in');
        return;
    }

    // Make API call with token
    const response = await fetch('/api/UserData/saved-searches', {
        headers: {
            'Authorization': `Bearer ${session.access_token}`
        }
    });

    const data = await response.json();
    return data;
}
```

### Backend

```csharp
// Add [SupabaseAuth] attribute to protect endpoints
[HttpGet("saved-searches")]
[SupabaseAuth]
public IActionResult GetSavedSearches()
{
    // Only authenticated users can access this
    return Ok(data);
}
```

## 🎯 Features You Can Add

### Save Search Results

```typescript
const handleSaveSearch = async (tool: string, query: string, result: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) return;

    await fetch('/api/UserData/save-search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ tool, query, result: JSON.stringify(result) })
    });
};
```

### Display User Searches

```typescript
useEffect(() => {
    const fetchSearches = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const response = await fetch('/api/UserData/saved-searches', {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });

        const searches = await response.json();
        setSavedSearches(searches);
    };

    fetchSearches();
}, []);
```

## 📊 Supabase Dashboard Features

### Users Management
- View all registered users
- Manually verify emails
- Ban/unban users
- Delete users

### Authentication Logs
- See all login attempts
- Track OAuth usage
- Monitor failed logins
- Debug auth issues

### Email Templates
- Customize confirmation emails
- Password reset emails
- Invite emails

## 🔒 Security Features

✅ **JWT Tokens** - Secure, stateless authentication
✅ **Email Verification** - Prevent fake accounts
✅ **Password Hashing** - Bcrypt encryption
✅ **Rate Limiting** - Built-in DDoS protection
✅ **OAuth 2.0** - Industry-standard social login
✅ **HTTPS Only** - Encrypted communications
✅ **Row Level Security** - Database-level permissions

## 🚨 Common Issues & Solutions

### Issue: "Invalid API key"
```bash
# Check your .env file
cat tools_website.client/.env

# Make sure it matches your Supabase dashboard
# Settings > API > Project URL and anon key
```

### Issue: Not receiving confirmation email
```bash
# Option 1: Check spam folder
# Option 2: Disable email confirmation in Supabase
# Settings > Authentication > Email Auth > 
# Uncheck "Enable email confirmations"
```

### Issue: OAuth redirect error
```bash
# Check redirect URL in OAuth provider settings
# Must match: https://YOUR_PROJECT.supabase.co/auth/v1/callback
```

### Issue: User menu not showing
```bash
# Make sure AuthProvider wraps your app
# App.tsx should have:
<AuthProvider>
    <AppContent />
</AuthProvider>
```

## 📚 Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [React Auth Tutorial](https://supabase.com/docs/guides/auth/auth-helpers/react)
- [JWT Best Practices](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

## 🎉 You're Done!

Authentication is fully integrated. Users can now:
- ✅ Sign up with email
- ✅ Log in with email or OAuth
- ✅ View their profile
- ✅ Sign out
- ⏳ Save searches (ready to implement)
- ⏳ View history (ready to implement)

**Next Steps:**
1. Set up your Supabase project
2. Add credentials to `.env`
3. Test the auth flow
4. Implement save search feature
5. Deploy to production!
