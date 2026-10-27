// Antes del lanzamiento, el sitio completo se ve en territoriosvivos.com.co/prueba (pedido del cliente, 20/10/2026);
// en la raíz del dominio está la imagen de «Muy pronto». En el subdominio privado (y en local) sigue en la raíz.
// Las direcciones de la app (el router, las páginas del recorrido) se escriben sin esta base y se le agrega aquí.

export const PREFIX = '/prueba';

export const BASE = location.pathname === PREFIX || location.pathname.startsWith(`${PREFIX}/`) ? PREFIX : '';

/** La dirección dentro de la app, sin la base. */
export const appPath = (pathname: string) => pathname.slice(BASE.length) || '/';
