import { Figtree, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { DatosProvider } from "@/lib/datos";
import Guardia from "@/componentes/Guardia";

// next/font descarga las tipografías en el build y las sirve desde el mismo
// dominio. Así la aplicación se ve igual sin internet, que es exactamente el
// escenario de un aula: si las fuentes vinieran del CDN de Google, sin wifi
// la pantalla se vería con la tipografía de reserva.
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--fuente-titulo",
  display: "block",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--fuente-cuerpo",
  display: "block",
});

export const metadata = {
  title: "Hoy",
  description: "Sistema de gestión de casos para negocios de servicio.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${figtree.variable} ${sourceSans.variable}`}>
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
