import { Figtree, Inter, JetBrains_Mono, Merriweather, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { DatosProvider } from "@/lib/datos";
import Guardia from "@/componentes/Guardia";
import ScriptTema from "@/componentes/ScriptTema";
import { CSS_APARIENCIA } from "@/lib/tema";
import { cookies, headers } from "next/headers";
import { LOCALES, elegirIdioma, traducir } from "@/lib/idioma";
import { IdiomaProvider } from "@/lib/useIdioma";
import es from "@/lib/idiomas/es";
import en from "@/lib/idiomas/en";

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

// El título y la descripción de la pestaña salen en el idioma de quien mira
// (cada pantalla pone el suyo después, con useTitulo).
export async function generateMetadata() {
  const idioma = elegirIdioma(
    (await cookies()).get("idioma")?.value,
    (await headers()).get("accept-language")
  );
  const fuente = { diccionario: idioma === "en" ? en : es, base: es, locale: LOCALES[idioma] };
  return {
    title: traducir(fuente, "inicio.titulo"),
    description: traducir(fuente, "inicio.descripcionSitio"),
  };
}

// Leer la cookie acá hace que cada ruta se dibuje en cada pedido y no quede
// como HTML estático. Se acepta (docs/idiomas.md): decidirlo en el navegador
// mostraría castellano y después saltaría a inglés.
export default async function RootLayout({ children }) {
  const idioma = elegirIdioma(
    (await cookies()).get("idioma")?.value,
    (await headers()).get("accept-language")
  );

  return (
    // suppressHydrationWarning: el script del tema pone data-tema en <html>
    // antes de que React hidrate, y eso no es un error.
    <html lang={idioma} className={`${figtree.variable} ${sourceSans.variable} ${inter.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: CSS_APARIENCIA }} />
        <ScriptTema />
      </head>
      <body className="antialiased">
        {/* Por fuera de todo: auth y datos también muestran textos. Al
            cliente va sólo el diccionario activo, y el castellano de base
            cuando se mira en inglés. */}
        <IdiomaProvider idioma={idioma} diccionario={idioma === "en" ? en : es} base={idioma === "en" ? es : null}>
          <AuthProvider>
            <DatosProvider>
              <Guardia>{children}</Guardia>
            </DatosProvider>
          </AuthProvider>
        </IdiomaProvider>
      </body>
    </html>
  );
}
