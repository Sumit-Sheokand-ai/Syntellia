# Common Runtime Errors & Solutions

## 🔧 Errors Fixed

### TypeScript Errors

#### ✅ Fixed: Type Import Errors
**Error**: `'User' is a type and must be imported using a type-only import when 'verbatimModuleSyntax' is enabled`

**Solution**: Use `type` keyword for type-only imports:
```typescript
// ❌ Before
import { Session } from '@supabase/supabase-js';

// ✅ After
import type { Session } from '@supabase/supabase-js';
```

#### ✅ Fixed: ESLint 'any' Type Errors
**Error**: `Unexpected any. Specify a different type`

**Solution**: Use proper TypeScript types:
```typescript
// ❌ Before
metadata?: any

// ✅ After  
metadata?: Record<string, unknown>
```

#### ✅ Fixed: React Refresh Warning
**Error**: `Fast refresh only works when a file only exports components`

**Solution**: Move hooks to separate file:
```typescript
// Created: src/hooks/useAuth.ts
export function useAuth() { ... }
```

---

## 🚨 Common Runtime Errors & Solutions

### Error 1: "Supabase credentials not found"

**Console Warning**:
```
Supabase credentials not found. Authentication will not work.
```

**Cause**: Missing `.env` file or incorrect environment variables

**Solution**:
```bash
# 1. Copy the template
cd tools_website.client
cp .env.example .env

# 2. Edit .env with your Supabase credentials
# Get from: https://app.supabase.com > Your Project > Settings > API

VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 3. Restart the dev server
cd ../tools_website.Server
dotnet run
```

---

### Error 2: "Failed to fetch" or CORS Error

**Browser Console**:
```
Access to fetch at 'https://xxx.supabase.co' from origin 'https://localhost:5173' 
has been blocked by CORS policy
```

**Cause**: CORS not configured or Supabase URL incorrect

**Solution**:
1. Check your `.env` file has correct Supabase URL
2. Verify CORS is enabled in `Program.cs`:
   ```csharp
   builder.Services.AddCors(options =>
   {
       options.AddDefaultPolicy(policy =>
       {
           policy.AllowAnyOrigin()
                 .AllowAnyMethod()
                 .AllowAnyHeader();
       });
   });
   
   // ...
   
   app.UseCors();
   ```

---

### Error 3: "Invalid API key" or "JWT expired"

**Error Message**:
```
Invalid API key or JWT expired
```

**Cause**: Wrong Supabase anon key or expired session

**Solution**:
```bash
# 1. Verify your anon key in Supabase dashboard
# Go to: Settings > API > anon/public key

# 2. Update .env with correct key
VITE_SUPABASE_ANON_KEY=<correct-key-here>

# 3. Clear browser storage and restart
# Open DevTools > Application > Storage > Clear site data

# 4. Restart dev server
```

---

### Error 4: User menu dropdown not showing

**Issue**: Clicking user button does nothing

**Cause**: Click event outside dropdown closes it immediately

**Solution**: Add click outside handler or check the dropdown implementation in `App.tsx`:
```typescript
// App.tsx already has correct implementation
const [dropdownOpen, setDropdownOpen] = useState(false);
```

If still not working, add this to CSS:
```css
.user-dropdown {
  z-index: 1000; /* Ensure it's on top */
}
```

---

### Error 5: "Cannot read property 'email' of null"

**Error**:
```
TypeError: Cannot read property 'email' of null
```

**Cause**: Trying to access user data before authentication loads

**Solution**: Always check loading state:
```typescript
const { user, loading } = useAuth();

if (loading) {
  return <div>Loading...</div>;
}

if (!user) {
  return <div>Please log in</div>;
}

// Now safe to use user.email
return <div>{user.email}</div>;
```

---

### Error 6: Infinite redirect loop on protected pages

**Issue**: Page keeps redirecting between `/profile` and `/login`

**Cause**: Redirect logic in useEffect without proper dependencies

**Solution**: Check `Profile.tsx` has correct dependencies:
```typescript
useEffect(() => {
    if (!loading && !user) {
        navigate('/login');
    }
}, [user, loading, navigate]); // Important: include all dependencies
```

---

### Error 7: "Network request failed" when signing up

**Issue**: Signup button does nothing or shows network error

**Possible Causes**:
1. Wrong Supabase URL
2. Email confirmation required but email not sent
3. Rate limit exceeded

**Solutions**:

**A. Check Supabase URL**:
```bash
# .env should have full URL
VITE_SUPABASE_URL=https://xxxxx.supabase.co  # ✅ Correct
VITE_SUPABASE_URL=xxxxx.supabase.co          # ❌ Missing https://
```

**B. Disable email confirmation for testing**:
1. Go to Supabase dashboard
2. Authentication > Providers > Email
3. Uncheck "Enable email confirmations"
4. Try signup again

**C. Check rate limits**:
- Free tier: 10 emails/hour
- Wait an hour or configure custom SMTP

---

### Error 8: OAuth buttons not working

**Issue**: Clicking Google/GitHub does nothing

**Cause**: OAuth providers not configured in Supabase

**Solution**:
1. Go to Supabase dashboard
2. Authentication > Providers
3. Enable and configure Google/GitHub:
   - Add Client ID
   - Add Client Secret
   - Add redirect URIs
4. See `SUPABASE_SETUP.md` for detailed instructions

---

### Error 9: "Session expired" after refresh

**Issue**: User logged out after page refresh

**Cause**: Session not persisting

**Solution**: Check `supabase.ts` configuration:
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,        // ✅ Must be true
        autoRefreshToken: true,      // ✅ Must be true
        detectSessionInUrl: true     // ✅ Must be true
    }
});
```

---

### Error 10: Build fails with "Cannot find module"

**Error**:
```
Cannot find module '../hooks/useAuth' or its corresponding type declarations
```

**Cause**: New file not recognized by TypeScript

**Solution**:
```bash
# 1. Stop the dev server (Ctrl+C)

# 2. Clean and reinstall
cd tools_website.client
rm -rf node_modules
npm install

# 3. Restart
cd ../tools_website.Server
dotnet run
```

---

## 🔍 Debugging Tips

### Check Browser Console
```
Press F12 > Console tab
Look for red errors
```

### Check Network Tab
```
F12 > Network tab
Filter by "Fetch/XHR"
Look for failed requests (red)
Click on failed request to see details
```

### Check Supabase Logs
```
1. Go to Supabase dashboard
2. Logs > Auth Logs
3. See all authentication attempts and errors
```

### Check Environment Variables
```bash
# In browser console:
console.log(import.meta.env.VITE_SUPABASE_URL);
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);

# Should show your values (not undefined)
```

### Verify Supabase Connection
```bash
# In browser console:
import { supabase } from './lib/supabase';
const { data, error } = await supabase.auth.getSession();
console.log('Session:', data, 'Error:', error);
```

---

## ✅ Pre-Flight Checklist

Before reporting an issue, verify:

- [ ] Supabase project is created
- [ ] `.env` file exists with correct values
- [ ] `VITE_SUPABASE_URL` starts with `https://`
- [ ] `VITE_SUPABASE_ANON_KEY` is the full JWT string
- [ ] Dev server was restarted after adding `.env`
- [ ] Browser cache cleared
- [ ] No console errors in browser DevTools
- [ ] Internet connection is working
- [ ] Supabase project status is "Active"

---

## 🆘 Still Having Issues?

### Quick Reset (Nuclear Option)
```bash
# Stop the server

# Backend
cd tools_website.Server
dotnet clean
dotnet restore

# Frontend
cd ../tools_website.client
rm -rf node_modules
npm install

# Restart
cd ../tools_website.Server
dotnet run
```

### Check Supabase Status
Visit: https://status.supabase.com/

### Review Setup Guide
See: `SUPABASE_SETUP.md`

### Common Mistakes
1. ❌ Forgot to create `.env` file
2. ❌ Used wrong API key (service_role instead of anon)
3. ❌ Didn't restart server after adding `.env`
4. ❌ Have email confirmation enabled but no email sent
5. ❌ Supabase project is paused/inactive

---

## 📞 Getting Help

If you're still stuck:

1. Check the browser console for specific error messages
2. Check Supabase Auth Logs
3. Review `SUPABASE_SETUP.md` step-by-step
4. Try the "Quick Reset" above
5. Search the error message on Stack Overflow

---

**Most issues are related to:**
- Missing or incorrect `.env` file (80%)
- Not restarting server after config changes (10%)
- Email confirmation blocking signup (5%)
- OAuth not configured (5%)
