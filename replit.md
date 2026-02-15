# EiLanches - Delivery Premium

## Overview
EiLanches is a food delivery application built with React, Vite, TypeScript, and Tailwind CSS. It uses Firebase for backend services (authentication, Firestore database, storage). The app includes features for ordering food, delivery tracking, payments (Mercado Pago), rewards, and admin dashboard.

## Project Architecture
- **Frontend**: React 19 + Vite 6 + TypeScript + Tailwind CSS 3
- **Backend**: Firebase (Firestore, Auth, Storage, Cloud Functions)
- **Payments**: Mercado Pago integration
- **Maps**: Leaflet / React-Leaflet for geolocation
- **State Management**: React Context (AuthContext, CartContext)

## Project Structure
- `/screens/` - Page components (Home, Menu, Cart, Orders, Dashboard, etc.)
- `/context/` - React context providers (Auth, Cart)
- `/config/` - Environment and app configuration
- `/services/` - Service modules (payments, orders, geolocation)
- `/utils/` - Utility functions
- `/src/hooks/` - Custom React hooks
- `/src/types/` - TypeScript type definitions
- `/functions/` - Firebase Cloud Functions (Mercado Pago, reports)

## Environment Variables
See `.env.example` for all required variables. Key ones:
- `VITE_FIREBASE_*` - Firebase configuration (required)
- `VITE_MERCADO_PAGO_*` - Payment processing
- `VITE_IMGBB_KEY` - Image hosting
- `VITE_UNSPLASH_ACCESS_KEY` - Stock images

## Development
- Dev server: `npm run dev` (port 5000)
- Build: `npm run build`
- Preview: `npm run preview`

## Recent Changes
- 2026-02-15: Initial Replit setup - configured Vite for port 5000 with allowedHosts, fixed Tailwind content patterns
