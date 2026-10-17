import { Lora, Merriweather, Montserrat, Nunito } from "next/font/google";

// Las fuentes que el dueño puede elegir para su landing (FUENTES de
// src/lib/landing.js). "fabrica" no está acá: es la de la app, que ya carga
// layout.js.
//
// preload: false para que una pantalla que importa esto no precargue las
// cuatro: el navegador baja sólo la que algún texto usa. Todas declaran la
// misma variable; Lienzo pone la clase de la elegida y variablesDeFuente()
// la pasa a títulos y texto.
//
// Lora no pasa de 700: los títulos extra negritas de la cartilla (800) se
// ven en 700.
const nunito = Nunito({ subsets: ["latin"], variable: "--fuente-landing", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--fuente-landing", display: "swap", preload: false });
const lora = Lora({ subsets: ["latin"], variable: "--fuente-landing", display: "swap", preload: false });
const merriweather = Merriweather({ subsets: ["latin"], variable: "--fuente-landing", display: "swap", preload: false });

export const FUENTES_LANDING = { nunito, montserrat, lora, merriweather };
