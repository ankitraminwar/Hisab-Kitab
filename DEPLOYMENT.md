# Deployment Guide: Hisab Kitab

This guide provides step-by-step instructions for deploying the Hisab Kitab application using Expo (EAS) and managing secrets on Supabase.

## 1. Prerequisites

- [Expo CLI](https://docs.expo.dev/get-started/installation/) installed.
- [EAS CLI](https://docs.expo.dev/build/setup/) installed: `npm install -g eas-cli`
- A [Supabase](https://supabase.com/) project.
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed (optional, for local development).

## 2. Setting Up Environment Variables (Local)

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

`app.config.js` reads these values and publishes them to the app as
`Constants.expoConfig.extra.publicEnv`. They are public client config, so never
store service-role keys in them.

> [!WARNING]
> Never commit `.env` files or service role keys to Version Control.

## 3. Configuring EAS Environment Variables (Cloud)

To build the app for production (Android `aab` or iOS `ipa`), store the same
public runtime values in Expo's environment store for each EAS environment you use.

### Using CLI

Run the following commands:

```bash
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value your_url --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your_key --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value your_url --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your_key --visibility plaintext
```

You can verify what Expo will expose at runtime with:

```bash
npx expo config --type public
```

### Using Expo Dashboard

1. Go to [expo.dev](https://expo.dev).
2. Select your project.
3. Go to **Settings** > **Environment Variables**.
4. Add the keys and values.

## 4. Building the Application

### Android

```bash
# Build for internal distribution (APK)
eas build --platform android --profile preview

# Build for Play Store (AAB)
eas build --platform android --profile production
```

### iOS

```bash
# Build for App Store
eas build --platform ios --profile production
```

## 5. Supabase Secrets Management

If you use Edge Functions (e.g., for sending email reports), you must set secrets on Supabase.

### Set Resend API Key

```bash
supabase secrets set RESEND_API_KEY=your_resend_api_key
```

### Set Custom Env Vars

```bash
supabase secrets set APP_URL=https://your-website.com
```

## 6. Database Migrations

### Apply Migrations Locally

```bash
supabase migration up
```

### Deploy Migrations to Production

1. Link your project: `supabase link --project-ref your_project_id`
2. Push migrations: `supabase db push`

> [!IMPORTANT]
> Ensure all migration files include `-- UP` and `-- DOWN` blocks as per our project SOP.

## 7. Submission

Once the build is complete, you can submit to the stores:

```bash
# Submit Android to Play Store
eas submit --platform android --path ./path-to-build.aab

# Submit iOS to App Store
eas submit --platform ios
```
