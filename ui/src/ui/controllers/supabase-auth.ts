import type { OpenClawApp } from "../app.ts";
import { getSupabaseClient } from "../supabase-client.ts";

export async function handleEmailLogin(host: OpenClawApp, email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) return;
  host.supabaseLoading = true;
  host.supabaseError = null;
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      host.supabaseError = error.message;
      return;
    }
    host.supabaseSession = data.session;
    host.connect();
  } catch (err) {
    host.supabaseError = String(err);
  } finally {
    host.supabaseLoading = false;
  }
}

export async function handleEmailSignup(host: OpenClawApp, email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) return;
  host.supabaseLoading = true;
  host.supabaseError = null;
  try {
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) {
      host.supabaseError = error.message;
      return;
    }
    host.supabaseSession = data.session;
    if (data.session) {
      host.connect();
    }
  } catch (err) {
    host.supabaseError = String(err);
  } finally {
    host.supabaseLoading = false;
  }
}

export async function handleMagicLink(host: OpenClawApp, email: string) {
  const client = getSupabaseClient();
  if (!client) return;
  host.supabaseLoading = true;
  host.supabaseError = null;
  try {
    const { error } = await client.auth.signInWithOtp({ email });
    if (error) {
      host.supabaseError = error.message;
      return;
    }
    host.supabaseError = null;
  } catch (err) {
    host.supabaseError = String(err);
  } finally {
    host.supabaseLoading = false;
  }
}

export async function handleOAuthLogin(host: OpenClawApp, provider: string) {
  const client = getSupabaseClient();
  if (!client) return;
  host.supabaseLoading = true;
  host.supabaseError = null;
  try {
    const { error } = await client.auth.signInWithOAuth({
      provider: provider as "google" | "github",
    });
    if (error) {
      host.supabaseError = error.message;
    }
  } catch (err) {
    host.supabaseError = String(err);
  } finally {
    host.supabaseLoading = false;
  }
}

export async function handleLogout(host: OpenClawApp) {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
  host.supabaseSession = null;
  host.connected = false;
  host.client?.stop();
}

export function initSupabaseAuthListener(host: OpenClawApp) {
  const client = getSupabaseClient();
  if (!client) return;
  client.auth.onAuthStateChange((_event, session) => {
    host.supabaseSession = session;
    if (session && !host.connected) {
      host.connect();
    }
  });
}
