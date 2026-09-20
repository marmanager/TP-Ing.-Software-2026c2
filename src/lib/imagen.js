// La foto del negocio (SCRUM-30).
//
// La foto se achica en el navegador y se guarda como texto en una columna,
// no en un bucket de archivos. Es la decisión que hace que ande igual con
// Supabase y en el modo de ejemplo, donde no hay servidor que reciba nada.
//
// Tiene un techo y conviene decirlo: a 256 píxeles una foto pesa unos 20 KB,
// que en una columna no molestan. Para logos grandes o fotos de verdad esto
// no alcanza, y ahí la respuesta es Supabase Storage con su bucket y sus
// políticas, no subirle el número a MAXIMO.

export const MAXIMO = 256;

// Más de esto ni se lee: un archivo grande leído entero a memoria cuelga el
// navegador antes de que lleguemos a achicarlo.
export const PESO_MAXIMO = 10 * 1024 * 1024;

// Cuánto tiene que medir la foto ya achicada. El lado más largo baja al
// máximo y el otro acompaña, así no se deforma.
//
// Tiene test: pruebas/imagen.test.js
export function medidasPara(ancho, alto, maximo = MAXIMO) {
  const lado = Math.max(ancho, alto);

  // Ya entra: agrandarla no sumaría un solo detalle y multiplicaría el peso.
  if (lado <= maximo) return { ancho, alto };

  const escala = maximo / lado;
  return {
    // Nunca menos de 1: un canvas de lado 0 no dibuja nada y la foto saldría
    // en blanco. Pasa con imágenes muy angostas, como una tira de 2000x3.
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

// Qué le pasa a un archivo que alguien eligió, antes de que sea un dato.
//
// Es un borde de confianza: el archivo lo elige una persona pero podría ser
// cualquier cosa, y lo que salga de acá se guarda en la base. Por eso se
// mira el tipo y el peso antes de leer un solo byte.
export function revisarArchivo(archivo) {
  if (!archivo) return "No se eligió ninguna foto.";
  if (!archivo.type.startsWith("image/")) return "Ese archivo no es una imagen.";
  if (archivo.size > PESO_MAXIMO) return "La foto es muy pesada. Máximo 10 MB.";
  return null;
}

// De un archivo a un texto guardable. Devuelve el data URL ya achicado.
//
// Sale en WebP porque mantiene la transparencia: un logo con fondo
// transparente pasado a JPEG queda con un recuadro negro. Un navegador que
// no lo soporte devuelve PNG por su cuenta y sigue andando igual, sólo que
// el texto pesa un poco más.
export function achicar(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Ese archivo no se puede abrir como imagen."));
      img.onload = () => {
        const { ancho, alto } = medidasPara(img.naturalWidth, img.naturalHeight);
        const lienzo = document.createElement("canvas");
        lienzo.width = ancho;
        lienzo.height = alto;
        lienzo.getContext("2d").drawImage(img, 0, 0, ancho, alto);
        resolve(lienzo.toDataURL("image/webp", 0.85));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}
