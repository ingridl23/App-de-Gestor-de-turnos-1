import '../global.css';

import * as Notifications from 'expo-notifications';
import { Stack, router, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import { useBusinessStore } from '@/store/businessStore';
import { useNotificationStore } from '@/store/notificationStore';

// Muestra notificaciones en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function useProtectedRoute() {
  const { session, isLoading, setSession } = useAuthStore();
  const { business, isLoadingBusiness, fetchBusiness, setBusiness, setBusinessLoading } =
    useBusinessStore();
  const { registerPushToken, fetchNotifications, fetchPrefs } = useNotificationStore();
  const segments = useSegments();

  // Escucha cambios de sesión Supabase
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Cuando cambia la sesión: carga el negocio si es emprendedor + registra push token
  useEffect(() => {
    const role = session?.user.user_metadata?.role;
    if (session && role === 'emprendedor') {
      fetchBusiness(session.user.id);
      // Registro de push token y notificaciones (best-effort, no bloquea)
      registerPushToken(session.user.id);
      fetchNotifications(session.user.id);
      fetchPrefs(session.user.id);
    } else {
      setBusiness(null);
      setBusinessLoading(false);
    }
  }, [session?.user.id]);

  // Lógica de redirección basada en auth + estado del negocio
  useEffect(() => {
    if (isLoading || isLoadingBusiness) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const isPublicRoute = segments[0] === 'b';
    const isEmprendedor = session?.user.user_metadata?.role === 'emprendedor';

    if (!session) {
      if (!inAuthGroup && !isPublicRoute) router.replace('/(auth)/login');
    } else if (isEmprendedor && !business) {
      if (!inOnboardingGroup) router.replace('/(onboarding)/business-profile');
    } else {
      if (!inTabsGroup && !inOnboardingGroup && !isPublicRoute) {
        router.replace('/(tabs)');
      }
    }
  }, [session, segments, isLoading, business, isLoadingBusiness]);
}

export default function RootLayout() {
  useProtectedRoute();

  return <Stack screenOptions={{ headerShown: false }} />;
}
