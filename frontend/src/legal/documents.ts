import { APP_NAME } from '../config/app';
import { CONTACT_EMAIL, GOVERNING_COUNTRY, LEGAL_RESPONSIBLE, MIN_AGE } from '../config/legal';
import { TERMS_VERSION } from './terms';

export type LegalBlock = { type: 'p'; text: string } | { type: 'ul'; items: string[] };

export interface LegalSection {
  id: string;
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  title: string;
  version: string;
  sections: LegalSection[];
}

/**
 * Cambiar a true SOLO cuando un profesional haya revisado los textos y no quede ningún
 * marcador [COMPLETAR]. Mientras sea false, las páginas muestran el aviso de borrador.
 */
export const LEGAL_REVIEWED = false;

const p = (text: string): LegalBlock => ({ type: 'p', text });
const ul = (...items: string[]): LegalBlock => ({ type: 'ul', items });

export const TERMS_DOCUMENT: LegalDocument = {
  title: 'Términos de uso',
  version: TERMS_VERSION,
  sections: [
    {
      id: 'servicio',
      heading: '1. Qué es este servicio',
      blocks: [
        p(
          `${APP_NAME} te permite conectar cuentas de YouTube, Instagram y TikTok que administras y consultar sus estadísticas. No publica, edita ni elimina contenido en esas redes.`,
        ),
        p(
          `El servicio lo ofrece ${LEGAL_RESPONSIBLE} [COMPLETAR: confirmar el nombre o razón social legal]. Puedes escribirnos a ${CONTACT_EMAIL}.`,
        ),
      ],
    },
    {
      id: 'cuenta',
      heading: '2. Tu cuenta',
      blocks: [
        ul(
          `Debes tener al menos ${MIN_AGE} años.`,
          'Debes dar datos verdaderos y mantenerlos al día.',
          'Eres responsable de guardar tu contraseña y de lo que se haga con tu cuenta.',
          'Puedes entrar con correo y contraseña o con tu cuenta de Google.',
        ),
      ],
    },
    {
      id: 'conexion',
      heading: '3. Conexión de tus canales',
      blocks: [
        p('Solo debes conectar canales que administras o para los que tienes autorización.'),
        p(
          'Al conectar YouTube, Instagram o TikTok autorizas a la aplicación a consultar, en modo de lectura, la identidad de la cuenta y las estadísticas descritas en la política de privacidad. No publicamos, modificamos ni borramos contenido en esas cuentas.',
        ),
        p(
          'Puedes desconectar una cuenta en cualquier momento. Al hacerlo borramos de SocialPulse sus credenciales y estadísticas guardadas. Para YouTube y TikTok intentamos revocar el acceso; para Instagram, retira también la autorización desde la configuración de Meta.',
        ),
        p('Debes seguir cumpliendo las condiciones de uso de YouTube y Google, Instagram y Meta, y TikTok.'),
      ],
    },
    {
      id: 'estadisticas',
      heading: '4. Las estadísticas',
      blocks: [
        p(
          'Las cifras vienen de las interfaces oficiales de YouTube, Instagram y TikTok y se muestran con fines informativos. Su disponibilidad y actualización dependen de cada plataforma; pueden diferir de las cifras que esta muestra directamente. En Instagram se consulta el alcance diario disponible. En TikTok se guardan capturas de totales del perfil y de contadores acumulados de hasta los 20 videos públicos más recientes; no representan actividad diaria.',
        ),
        p('No garantizamos que los datos estén completos ni libres de errores.'),
      ],
    },
    {
      id: 'alcance',
      heading: '5. Lo que no prometemos',
      blocks: [
        p(
          'No prometemos resultados de ningún tipo: ni más visualizaciones, ni crecimiento, ni ingresos, ni que un video se vuelva viral.',
        ),
        p(
          'Las funciones que aún no existen, como el análisis de videos con inteligencia artificial, no forman parte del servicio actual.',
        ),
      ],
    },
    {
      id: 'uso',
      heading: '6. Uso aceptable',
      blocks: [
        ul(
          'No intentes acceder a datos de otras personas.',
          'No intentes saltarte los límites de uso, por ejemplo los de intentos de acceso o de sincronizaciones.',
          'No uses el servicio para actividades ilegales ni para perjudicar a otros.',
        ),
      ],
    },
    {
      id: 'disponibilidad',
      heading: '7. Disponibilidad y cambios del servicio',
      blocks: [
        p(
          'El servicio está en desarrollo y se ofrece tal como está: puede cambiar, tener errores o interrumpirse. Podemos modificar o retirar funciones.',
        ),
      ],
    },
    {
      id: 'responsabilidad',
      heading: '8. Responsabilidad',
      blocks: [
        p(
          '[COMPLETAR: cláusula de limitación de responsabilidad, redactada o revisada por un profesional].',
        ),
      ],
    },
    {
      id: 'terminacion',
      heading: '9. Terminación',
      blocks: [
        p(
          'Puedes dejar de usar el servicio cuando quieras. Podemos suspender o cerrar cuentas que incumplan estos términos.',
        ),
        p(
          'Puedes eliminar tu cuenta en cualquier momento desde Ajustes. Al hacerlo se borran de inmediato tu cuenta, tus sesiones, tus cuentas de redes conectadas y sus estadísticas. Se intenta revocar el acceso de YouTube y TikTok; para Instagram, retira también la autorización desde la configuración de Meta. La eliminación no se puede deshacer.',
        ),
      ],
    },
    {
      id: 'cambios',
      heading: '10. Cambios en estos términos',
      blocks: [
        p(
          'Si cambiamos este texto cambiará su versión y te pediremos que lo aceptes de nuevo antes de seguir usando la aplicación.',
        ),
      ],
    },
    {
      id: 'ley',
      heading: '11. Ley aplicable',
      blocks: [
        p(
          `Estos términos se rigen por las leyes de ${GOVERNING_COUNTRY}. [COMPLETAR: confirmar con asesoría legal la jurisdicción competente para las controversias].`,
        ),
      ],
    },
  ],
};

export const PRIVACY_DOCUMENT: LegalDocument = {
  title: 'Política de privacidad',
  version: TERMS_VERSION,
  sections: [
    {
      id: 'responsable',
      heading: '1. Quién es el responsable',
      blocks: [
        p(
          `El responsable del tratamiento de tus datos es ${LEGAL_RESPONSIBLE} [COMPLETAR: confirmar el nombre o razón social legal]. Correo de contacto: ${CONTACT_EMAIL}. [COMPLETAR: teléfono de contacto del responsable, que la ley exige informar].`,
        ),
      ],
    },
    {
      id: 'finalidades',
      heading: '2. Para qué usamos tus datos',
      blocks: [
        ul(
          'Crear y mantener tu cuenta y tu sesión.',
          'Conectar tus cuentas de YouTube, Instagram y TikTok y mostrarte las estadísticas que autorizaste.',
          'Proteger la aplicación y tu cuenta frente a accesos abusivos.',
          'Cumplir las obligaciones legales que nos apliquen.',
        ),
        p('No usamos tus datos para otros fines.'),
      ],
    },
    {
      id: 'datos',
      heading: '3. Qué datos tratamos',
      blocks: [
        p('Tratamos solo los datos necesarios para que la aplicación funcione:'),
        ul(
          'Tu cuenta: correo, nombre, foto de perfil (si la indicas o la entrega Google) y, si te registras con contraseña, un resumen cifrado (hash) de ella; nunca guardamos la contraseña en claro. También guardamos cuándo aceptaste estos textos y qué versión.',
          'Acceso con Google: el identificador de tu cuenta de Google, tu correo y si Google lo ha verificado.',
          'Tu sesión: un resumen (hash) del código de sesión, las fechas de creación, último uso y caducidad, el navegador y la dirección IP desde la que entraste. Sirven para mantener tu sesión y proteger tu cuenta.',
          'Tus cuentas de redes: plataforma, identificador de cuenta, nombre o alias, foto cuando la plataforma la entrega, estado y fechas de conexión y sincronización.',
          'El acceso a tus cuentas: los tokens que Google, Meta o TikTok nos entregan para conectar la cuenta se guardan cifrados y no se muestran en la aplicación.',
          'YouTube: estadísticas diarias de vistas, minutos vistos, duración media de reproducción, me gusta, comentarios, veces compartido y suscriptores ganados y perdidos; además de totales de suscriptores, vistas y videos.',
          'Instagram: la serie diaria de alcance que devuelve la API de Instagram para la cuenta profesional conectada.',
          'TikTok: totales de seguidores, cuentas seguidas, me gusta recibidos y cantidad de videos del perfil; y la suma de vistas, me gusta, comentarios y compartidos de hasta los 20 videos públicos más recientes. Son capturas puntuales acumuladas, no estadísticas diarias.',
          'Un registro de cada sincronización (fecha, periodo y resultado).',
          'Seguridad: para limitar intentos abusivos usamos temporalmente la dirección IP y un resumen (hash) del correo en la memoria del servidor; no se guardan en la base de datos.',
        ),
      ],
    },
    {
      id: 'google',
      heading: '4. Datos de Google y de YouTube',
      blocks: [
        p(
          'Al acceder con Google pedimos solo tu identificación básica (identificador, correo y perfil). Al conectar YouTube pedimos dos permisos de solo lectura: ver tu cuenta de YouTube y ver las estadísticas de tu canal.',
        ),
        p(
          'El permiso de lectura de YouTube permite técnicamente ver más información de tu cuenta que la que usamos. Nosotros solo consultamos la identificación de tu canal y las estadísticas descritas arriba.',
        ),
        p(
          `El uso que ${APP_NAME} hace de la información recibida de las API de Google, y su transferencia a cualquier otra aplicación, cumplirá la Política de datos de usuario de los servicios de las API de Google, incluidos los requisitos de uso limitado. [COMPLETAR: confirmar con la documentación de Google y de la API de YouTube el texto exacto que exigen en la verificación de la aplicación].`,
        ),
      ],
    },
    {
      id: 'meta-tiktok',
      heading: '5. Datos de Meta, Instagram y TikTok',
      blocks: [
        p(
          'Al conectar una cuenta profesional de Instagram, Meta nos proporciona un token de acceso y la cuenta que compartiste. Consultamos el alcance diario disponible mediante Instagram Insights. No consultamos seguidores, me gusta ni compartidos de Instagram.',
        ),
        p(
          'Al conectar TikTok, TikTok nos proporciona un token de acceso y los datos del perfil que autorizaste. Consultamos los totales del perfil y los contadores acumulados de hasta los 20 videos públicos más recientes. No publicamos ni administramos contenido.',
        ),
        p(
          'Las credenciales se usan en el servidor para consultar únicamente los datos descritos en esta política. Puedes retirar el acceso desde la configuración de Meta/Instagram o TikTok; al hacerlo, la sincronización dejará de funcionar y puede ser necesario volver a conectar la cuenta.',
        ),
      ],
    },
    {
      id: 'nohacemos',
      heading: '6. Lo que no hacemos',
      blocks: [
        ul(
          'No publicamos, modificamos ni borramos contenido de tu canal.',
          'No usamos publicidad ni herramientas de analítica de terceros en la aplicación.',
          'No vendemos tus datos ni los compartimos con terceros con fines comerciales.',
        ),
      ],
    },
    {
      id: 'compartimos',
      heading: '7. Con quién los compartimos',
      blocks: [
        p(
          'Con Google y YouTube, de quienes obtenemos los datos y con quienes interactúas al iniciar sesión o conectar un canal.',
        ),
        p(
          'Con Meta e Instagram, y con TikTok, para autorizar y consultar la cuenta que conectas.',
        ),
        p(
          'Con Render, el proveedor que aloja la aplicación y su base de datos PostgreSQL, en la región de Oregón (Estados Unidos). Tus datos se almacenan, por tanto, fuera de Colombia. [COMPLETAR: confirmar con asesoría legal el tratamiento de la transmisión o transferencia internacional de datos].',
        ),
        p('Y cuando la ley o una autoridad competente nos obligue a hacerlo.'),
      ],
    },
    {
      id: 'cookies',
      heading: '8. Cookies',
      blocks: [
        p(
          'Usamos solo las cookies necesarias para que la aplicación funcione; no usamos cookies de publicidad ni de analítica:',
        ),
        ul(
          'sp_session: mantiene tu sesión iniciada. Dura como máximo 30 días y no puede leerse desde el código de la página.',
          'sp_oauth: temporal (10 minutos), solo durante el acceso con Google.',
          'sp_yt_oauth: temporal (10 minutos), solo durante la conexión de un canal de YouTube.',
          'sp_ig_oauth y sp_tt_oauth: temporales (10 minutos), solo durante la conexión de Instagram y TikTok, respectivamente.',
        ),
      ],
    },
    {
      id: 'conservacion',
      heading: '9. Cuánto tiempo los conservamos',
      blocks: [
        ul(
          'Tu sesión caduca tras 7 días sin uso y, como máximo, a los 30 días. Las sesiones caducadas se eliminan automáticamente de forma periódica.',
          'Las credenciales y las estadísticas de una cuenta conectada se conservan hasta que la desconectes; al desconectarla se borran de SocialPulse.',
          'Los datos de tu cuenta se conservan mientras la tengas. Puedes eliminarla desde Ajustes: se borran de inmediato tu cuenta, tus sesiones, tus cuentas conectadas y sus estadísticas. [COMPLETAR: si se conservan copias de seguridad, durante cuánto tiempo y cómo se eliminan].',
        ),
      ],
    },
    {
      id: 'derechos',
      heading: '10. Tus derechos',
      blocks: [
        p(
          'Como titular de tus datos puedes conocer, actualizar y rectificar tus datos personales; revocar tu autorización y pedir que los eliminemos; y presentar una queja ante la Superintendencia de Industria y Comercio (SIC), la autoridad que vigila el cumplimiento de la ley de protección de datos en Colombia.',
        ),
        p(
          `Para eliminar tu cuenta y todos sus datos, usa Ajustes: es inmediato. Para cualquier otra consulta, actualización o reclamo, escribe a ${CONTACT_EMAIL}. [COMPLETAR: plazos y procedimiento para atender consultas y reclamos, y revisión legal de la lista completa de derechos del titular].`,
        ),
        p(
          'Además, puedes retirar el acceso de la aplicación desde la configuración de seguridad o integraciones de Google, Meta/Instagram y TikTok.',
        ),
      ],
    },
    {
      id: 'seguridad',
      heading: '11. Seguridad',
      blocks: [
        p(
          'Protegemos tus datos con medidas como el cifrado de las credenciales de acceso a tus canales, el almacenamiento seguro (hash) de las contraseñas, las sesiones con caducidad y la comunicación siempre cifrada (HTTPS). Ningún sistema es completamente seguro.',
        ),
      ],
    },
    {
      id: 'menores',
      heading: '12. Menores de edad',
      blocks: [
        p(
          `El servicio es solo para personas de ${MIN_AGE} años o más. No recopilamos de forma deliberada datos de menores de edad; si crees que un menor se registró, escríbenos a ${CONTACT_EMAIL} y eliminaremos su cuenta.`,
        ),
      ],
    },
    {
      id: 'cambios',
      heading: '13. Cambios en esta política',
      blocks: [
        p(
          'Si cambiamos este texto cambiará su versión y te pediremos que lo aceptes de nuevo antes de seguir usando la aplicación.',
        ),
      ],
    },
  ],
};

function textsOf(doc: LegalDocument): string[] {
  return doc.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.type === 'p' ? [block.text] : block.items)),
  );
}

/** Marcadores [COMPLETAR: ...] que quedan en un documento. */
export function placeholdersIn(doc: LegalDocument): string[] {
  return textsOf(doc).flatMap((text) => text.match(/\[COMPLETAR[^\]]*\]/g) ?? []);
}

export interface TextPart {
  text: string;
  placeholder: boolean;
}

/** Separa un texto en partes normales y marcadores, para resaltar estos últimos. */
export function splitPlaceholders(text: string): TextPart[] {
  return text
    .split(/(\[COMPLETAR[^\]]*\])/)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, placeholder: part.startsWith('[COMPLETAR') }));
}