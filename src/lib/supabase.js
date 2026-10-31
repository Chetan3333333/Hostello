import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// DO NOT REMOVE THE auth OPTION BELOW. It looks like a stray setting. It is not.
//
// Supabase keeps the login token in the browser and guards it with a browser
// "lock", so that two tabs cannot fight over it. Think of a toilet door latch:
// one page latches it, does its business, unlatches, and the next page goes in.
// Every call this app makes - login, rooms, tenants, payments - goes through
// that one door.
//
// That latch is supposed to have a five second time limit, so that a page stuck
// inside cannot block everyone else forever. In this version of the library
// (@supabase/supabase-js 2.105.4) THAT TIME LIMIT IS NEVER SWITCHED ON:
//
//   1. We create the client without any lock settings, as the docs show.
//   2. supabase-js destructures `lockAcquireTimeout` from those settings, so it
//      becomes `undefined`, and passes it on explicitly.
//   3. auth-js merges it with Object.assign, so `undefined` OVERWRITES its own
//      built-in default of 5000.
//   4. Its lock code then tests `if (acquireTimeout > 0)`. `undefined > 0` is
//      false, so no timer is ever started.
//   5. The latch is now held with no time limit at all.
//
// Verified in a browser: the app asked for the lock once, 294ms after opening,
// and then waited with no answer, no timeout and no error. Everything froze.
//
// This happened at random, perhaps one start in ten, whenever some other page
// was holding the latch when it got frozen - refreshing an already-open app,
// having the installed app and a browser tab open at once, coming back from the
// Google sign-in redirect, or Android freezing a background tab to save battery.
// The owner saw the loading screen for a full 60 seconds and was then thrown out
// to the login page. Nothing was actually wrong: the network was fine and the
// database answered every single request successfully.
//
// Passing the value explicitly restores the five seconds the library intended.
// This is deliberately the library's OWN default value, not a number invented
// here. The lock still works exactly as before; it simply can no longer hang
// forever. Measured: a jammed latch went from 60 seconds and an error, to the
// dashboard opening in 5.5 seconds. With no jammed latch, nothing changes at
// all - 1.1 seconds, same as before.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lockAcquireTimeout: 5000
  }
});
