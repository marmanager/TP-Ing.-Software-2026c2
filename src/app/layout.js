import { Figtree, Inter, JetBrains_Mono, Merriweather, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { DatosProvider } from "@/lib/datos";
import Guardia from "@/componentes/Guardia";
import ScriptTema from "@/componentes/ScriptTema";
import { CSS_APARIENCIA } from "@/lib/tema";

// next/font descarga las tipografías en el build y las sirve desde el mismo
// dominio. Así la aplicación se ve igual sin internet, que es exactamente el
// escenario de un aula: si las fuentes vinieran del CDN de Google, sin wifi
// la pantalla se vería con la tipografía de reserva.
// El 900 lo usa sólo la landing, para los dos titulares grandes. El sistema
// no pasa de 800.
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--fuente-titulo",
  display: "block",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--fuente-cuerpo",
  display: "block",
});

// Las letras que se pueden elegir en Mi perfil (src/lib/tema.js). Sin precarga:
// el navegador las baja sólo si alguien las eligió.
const inter = Inter({ subsets: ["latin"], variable: "--fuente-inter", display: "swap", preload: false });
const serif = Merriweather({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--fuente-serif",
  display: "swap",
  preload: false,
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--fuente-mono", display: "swap", preload: false });

export const metadata = {
  title: "Inicio",
  description: "Sistema de gestión de casos para negocios de servicio.",
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: el script del tema pone data-tema en <html>
    // antes de que React hidrate, y eso no es un error.
    <html lang="es" className={`${figtree.variable} ${sourceSans.variable} ${inter.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: CSS_APARIENCIA }} />
        <ScriptTema />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <DatosProvider>
            <Guardia>{children}</Guardia>
          </DatosProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
