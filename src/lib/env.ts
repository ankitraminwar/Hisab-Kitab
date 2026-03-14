const requiredEnv = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_KEY,
};

const missingKeys = Object.entries(requiredEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.warn(`Missing environment variables: ${missingKeys.join(', ')}`);
}

export const env = {
  supabaseUrl: requiredEnv.supabaseUrl ?? '',
  supabaseAnonKey: requiredEnv.supabaseAnonKey ?? '',
};
