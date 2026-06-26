import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

/**
 * Inicia el flujo OAuth con Google via Supabase + WebBrowser.
 * Retorna null si tuvo éxito o fue cancelado; string de error si falló.
 *
 * Pre-requisitos (configurar una sola vez):
 *  - Supabase Dashboard → Authentication → Providers → Google: habilitado
 *  - Google Cloud Console → OAuth credentials → Authorized redirect URIs:
 *    agregar la URL de callback de Supabase (termina en /auth/v1/callback)
 *  - Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
 *    agregar "appdegestordeturnos1://"
 */
export async function signInWithGoogle(): Promise<string | null> {
  const redirectTo = Linking.createURL('/');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) return error.message;
  if (!data.url) return 'No se pudo iniciar Google Sign-In.';

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'success') {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      result.url
    );
    if (exchangeError) return exchangeError.message;
  }

  return null;
}
