// lib/supabase.js  (CommonJS)
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET; // pick whichever you set

if (!url) throw new Error('Missing SUPABASE_URL');
if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET');

const supabase = createClient(url, key, { auth: { persistSession: false } });

module.exports = supabase;
