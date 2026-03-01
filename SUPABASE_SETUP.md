# Supabase Authentication Setup Guide

This guide will help you set up Supabase authentication for your Privacy Intelligence Tools application.

## 📋 Prerequisites

- A Supabase account (free tier is sufficient)
- Your application running locally

## 🚀 Step 1: Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Click **"New project"**
3. Fill in the details:
   - **Name**: Privacy Tools (or any name you prefer)
   - **Database Password**: Generate a strong password
   - **Region**: Choose the closest to your users
4. Click **"Create new project"**
5. Wait 1-2 minutes for project creation

## 🔑 Step 2: Get Your API Keys

1. In your Supabase project dashboard, go to **Settings** (gear icon)
2. Click on **API** in the left sidebar
3. You'll see two important values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long string)

## ⚙️ Step 3: Configure Your Application
1. Configure environment variables directly (no `.env` file):
   ```powershell
   # Persist for future terminals (Windows)
   setx VITE_SUPABASE_URL "https://xxxxxxxxxxxxx.supabase.co"
   setx VITE_SUPABASE_ANON_KEY "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

2. For the current terminal session only:
   ```powershell
   $env:VITE_SUPABASE_URL = "https://xxxxxxxxxxxxx.supabase.co"
   $env:VITE_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   ```

3. For GitHub Actions builds, store the same values in repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   ```

## 🔐 Step 4: Configure Authentication Providers

### Email/Password Authentication (Default - Already Enabled)

Email authentication is enabled by default. Users can sign up and log in with email and password.

### Google OAuth (Optional)

1. In Supabase dashboard, go to **Authentication** > **Providers**
2. Find **Google** and click configure
3. Follow the instructions to:
   - Create OAuth credentials in Google Cloud Console
   - Copy Client ID and Client Secret
   - Add authorized redirect URIs
4. Enable the provider and save

### GitHub OAuth (Optional)

1. In Supabase dashboard, go to **Authentication** > **Providers**
2. Find **GitHub** and click configure
3. Follow the instructions to:
   - Create OAuth App in GitHub Settings
   - Copy Client ID and Client Secret
   - Add callback URL
4. Enable the provider and save

## 📧 Step 5: Configure Email Templates (Optional)

1. Go to **Authentication** > **Email Templates**
2. Customize the email templates for:
   - Confirm signup
   - Invite user
   - Magic Link
   - Change Email Address
   - Reset Password

## 🔒 Step 6: Set Up Row Level Security (RLS)

If you plan to save user data, create tables with RLS:

### Create User Searches Table

```sql
-- In Supabase SQL Editor
create table user_searches (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  tool text not null,
  query text not null,
  result text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table user_searches enable row level security;

-- Allow users to read only their own searches
create policy "Users can view own searches"
  on user_searches for select
  using (auth.uid() = user_id);

-- Allow users to insert their own searches
create policy "Users can insert own searches"
  on user_searches for insert
  with check (auth.uid() = user_id);

-- Allow users to delete their own searches
create policy "Users can delete own searches"
  on user_searches for delete
  using (auth.uid() = user_id);
```

## 🧪 Step 7: Test Authentication

1. Restart your application:
   ```bash
   # Kill the running app (Ctrl+C)
   # Restart
   cd tools_website.Server
   dotnet run
   ```

2. Open your browser to `https://localhost:5173`

3. Click **"Sign Up"** and create an account:
   - Enter email and password
   - Check your email for confirmation link
   - Click the confirmation link
   - You should be logged in

4. Test the features:
   - View your profile
   - Sign out and sign back in
   - Try Google/GitHub login (if configured)

## 🔍 Step 8: Verify Setup

### Check User Creation

1. Go to Supabase dashboard
2. Click **Authentication** > **Users**
3. You should see your test user(s)

### Check Email Confirmations

1. In **Authentication** settings
2. Look at **Email Auth** settings
3. You can disable email confirmation for testing:
   - Uncheck **"Enable email confirmations"**
   - This allows instant login without email verification

### Check Logs

1. Go to **Logs** in Supabase dashboard
2. Select **Auth Logs**
3. See all authentication events

## 🚨 Troubleshooting

### Issue: "Invalid API key"
**Solution**: Double-check your environment variables (or GitHub secrets) have the correct keys from Supabase dashboard.

### Issue: Email not received
**Solutions**:
- Check spam folder
- Disable email confirmation for testing
- Check Supabase email rate limits (10 emails/hour on free tier)
- Configure custom SMTP in Supabase settings

### Issue: OAuth redirect error
**Solution**: Make sure redirect URLs match exactly in OAuth provider settings:
```
https://xxxxxxxxxxxxx.supabase.co/auth/v1/callback
```

### Issue: User can't log in after signup
**Solutions**:
- Check if email confirmation is required
- Check Supabase Auth logs for errors
- Verify user exists in Users table

## 🎨 Customization

### Change Email Confirmation Requirement

```typescript
// In supabase.ts, add to signUp:
const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
        emailRedirectTo: `${window.location.origin}/`,
        // Add this to auto-confirm (not recommended for production)
        // data: { email_confirmed: true }
    },
});
```

### Add More OAuth Providers

Supabase supports:
- Google ✓ (implemented)
- GitHub ✓ (implemented)
- Facebook
- Twitter
- Discord
- LinkedIn
- And more...

Just enable them in the dashboard and add buttons in Login.tsx.

## 📊 Usage Limits (Free Tier)

- **Users**: 50,000 monthly active users
- **Database**: 500 MB
- **Storage**: 1 GB
- **Edge Functions**: 500,000 invocations/month
- **Bandwidth**: 5 GB
- **Email Auth**: 10 emails/hour (can be increased with custom SMTP)

## 🔐 Security Best Practices

1. ✅ **Never commit secret files** - Use environment variables and CI/CD secret stores
2. ✅ **Use Row Level Security** - Prevents unauthorized data access
3. ✅ **Validate on backend** - Don't trust client-side only
4. ✅ **Use HTTPS in production** - Supabase enforces this
5. ✅ **Enable email confirmation** - Prevents fake accounts
6. ✅ **Rate limit authentication** - Built into Supabase
7. ✅ **Monitor auth logs** - Check for suspicious activity

## 🎯 Next Steps

1. ✅ Set up your Supabase project
2. ✅ Configure environment variables
3. ✅ Test email authentication
4. ⏳ Configure OAuth providers (optional)
5. ⏳ Create user_searches table (optional)
6. ⏳ Implement save search feature
7. ⏳ Add email notifications
8. ⏳ Deploy to production

## 📚 Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [OAuth Providers](https://supabase.com/docs/guides/auth/social-login)
- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)

## 💡 Pro Tips

1. **Development**: Disable email confirmation for faster testing
2. **Production**: Always enable email confirmation
3. **Custom Domain**: Configure custom SMTP for branded emails
4. **User Management**: Use Supabase dashboard to manage users
5. **Backups**: Supabase automatically backs up your database

## 🆘 Need Help?

- Check Supabase [Discord](https://discord.supabase.com/)
- Review [GitHub Discussions](https://github.com/supabase/supabase/discussions)
- Search [Stack Overflow](https://stackoverflow.com/questions/tagged/supabase)
- Contact Supabase Support (paid plans)

---

**You're all set!** Authentication is now integrated into your Privacy Intelligence Tools application. Users can sign up, log in, and access their profile. 🎉
