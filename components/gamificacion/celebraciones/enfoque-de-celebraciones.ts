"use client";

// Enfoque de la persona para los textos de las celebraciones (RF-GAM-119). Lo pone Celebraciones con lo que le pasa
// ShellDeUsuario; null sin enfoque, y entonces cada celebración usa su texto común.

import { createContext, useContext } from "react";

export const EnfoqueDeCelebraciones = createContext<string | null>(null);

export const useEnfoqueDeCelebraciones = () => useContext(EnfoqueDeCelebraciones);
