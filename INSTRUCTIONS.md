# TurnosApp — Contexto para el Agente

## Qué es este proyecto
App mobile (iOS + Android) para gestión de turnos, enfocada en peluquerías y esteticas como nicho piloto. Permite a emprendedores gestionar su agenda y a clientes reservar turnos online.

## Stack tecnológico
- Mobile: React Native + Expo (TypeScript)
- Estilos: NativeWind (Tailwind para React Native)
- Base de datos + Auth + Realtime: Supabase
- Estado global: Zustand
- Navegación: React Navigation
- Push notifications: Firebase FCM + Expo
- WhatsApp notifications: Twilio
- Pagos: MercadoPago SDK
- Landing page: Next.js + Vercel

## Roles del sistema
- EMPRENDEDOR: crea servicios, configura horarios, gestiona turnos, cobra con MercadoPago (en un principio)
- CLIENTE: busca emprendedores, reserva turnos, paga, recibe recordatorios, chatea

## Estructura de carpetas esperada
/app → pantallas (Expo Router)
/components → componentes reutilizables
/hooks → custom hooks
/lib → clientes de supabase, mercadopago, etc
/store → zustand stores
/types → tipos TypeScript

## Convenciones
- TypeScript estricto, nunca usar `any`
- camelCase para variables y funciones
- PascalCase para componentes y tipos
- Commits en Conventional Commits (feat:, fix:, chore:)
- NativeWind para todos los estilos, sin StyleSheet salvo excepciones

## Base de datos (Supabase)
Tablas principales: users, businesses, services, availability, blocked_dates, appointments, appointment_services, messages, notifications.
Todas las tablas deben tener Row Level Security (RLS) habilitado.

## Reglas críticas
- Nunca usar `any` en TypeScript
- RLS habilitado en todas las tablas desde el inicio
- Las transacciones de turnos deben ser ACID (evitar reservas duplicadas)
- Nunca almacenar datos de tarjetas, solo tokens de MercadoPago
- Cada feature debe testearse contra sus criterios de aceptación antes de avanzar

## Orden de implementación
1. Setup Expo + TypeScript + NativeWind
2. Crear todas las tablas en Supabase con RLS
3. Autenticación (email/contraseña + Google OAuth)
4. Perfil del emprendedor
5. Gestión de servicios
6. Disponibilidad horaria
7. Flujo de reserva del cliente
8. Chat en tiempo real
9. Notificaciones push + WhatsApp
10. Integración MercadoPago