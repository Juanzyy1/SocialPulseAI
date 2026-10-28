import { APP_NAME, SPONSOR_NAME } from '../config/app';
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
          `${APP_NAME} es una aplicación que te permite conectar cuentas de redes sociales que administras y consultar sus estadísticas. Por ahora solo se puede conectar YouTube.`,
        ),
        p(
          `El servicio lo ofrece [COMPLETAR: nombre legal de la persona o empresa responsable], con el patrocinio de ${SPONSOR_NAME}. Puedes escribirnos a [COMPLETAR: correo de contacto].`,
        ),
      ],
    },
    {
      id: 'cuenta',
      heading: '2. Tu cuenta',
      blocks: [
        ul(
          'Debes tener al menos [COMPLETAR: edad mínima] años.',
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
          'Al conectar un canal de YouTube nos das un permiso de solo lectura: podemos consultar la identificación del canal y sus estadísticas. No publicamos, modificamos ni borramos nada en tu canal.',
        ),
        p(
          'Puedes desconectar un canal en cualquier momento. Al hacerlo borramos sus credenciales y sus estadísticas guardadas, e intentamos revocar el acceso en Google.',
        ),
        p('Debes seguir cumpliendo las condiciones de uso de YouTube y de Google.'),
      ],
    },
    {
      id: 'estadisticas',
      heading: '4. Las estadísticas',
      blocks: [
        p(
          'Las cifras vienen de las interfaces oficiales de YouTube y se muestran con fines informativos. Pueden tardar varios días en estar disponibles, por lo que cada pantalla indica hasta qué fecha hay datos. También pueden diferir de las que muestra YouTube Studio.',
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
          'Las funciones que aún no existen, como el análisis de videos con inteligencia artificial u otras redes sociales, no forman parte del servicio actual.',
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
          'Por ahora la aplicación no incluye un botón para eliminar tu cuenta. [COMPLETAR: cómo solicitar la eliminación de la cuenta y en cuánto tiempo se atiende].',
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
      blocks: [p('[COMPLETAR: ley aplicable y jurisdicción].')],
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
          `El responsable del tratamiento de tus datos es [COMPLETAR: nombre legal de la persona o empresa responsable]. Contacto: [COMPLETAR: correo de contacto]. El servicio cuenta con el patrocinio de ${SPONSOR_NAME}.`,
        ),
      ],
    },
    {
      id: 'datos',
      heading: '2. Qué datos tratamos y para qué',
      blocks: [
        p('Tratamos solo los datos necesarios para que la aplicación funcione:'),
        ul(
          'Tu cuenta: correo, nombre, foto de perfil (si la indicas o la entrega Google) y, si te registras con contraseña, un resumen cifrado (hash) de ella; nunca guardamos la contraseña en claro. También guardamos cuándo aceptaste estos textos y qué versión.',
          'Acceso con Google: el identificador de tu cuenta de Google, tu correo y si Google lo ha verificado.',
          'Tu sesión: un resumen (hash) del código de sesión, las fechas de creación, último uso y caducidad, el navegador y la dirección IP desde la que entraste. Sirven para mantener tu sesión y proteger tu cuenta.',
          'Tus canales de YouTube: identificador del canal, nombre, alias, foto, estado de la conexión y fechas de conexión y de sincronización.',
          'El acceso a tu canal: las credenciales que Google nos entrega al conectarlo se guardan cifradas y no se muestran nunca en la aplicación.',
          'Las estadísticas de tus canales: por cada día, vistas, minutos vistos, duración media de reproducción, me gusta, comentarios, veces compartido y suscriptores ganados y perdidos; y los totales de suscriptores, vistas y videos del canal. También un registro de cada sincronización (fecha, periodo y resultado).',
          'Seguridad: para limitar intentos abusivos usamos temporalmente la dirección IP y un resumen (hash) del correo en la memoria del servidor; no se guardan en la base de datos.',
        ),
      ],
    },
    {
      id: 'google',
      heading: '3. Datos de Google y de YouTube',
      blocks: [
        p(
          'Al acceder con Google pedimos solo tu identificación básica (identificador, correo y perfil). Al conectar YouTube pedimos dos permisos de solo lectura: ver tu cuenta de YouTube y ver las estadísticas de tu canal.',
        ),
        p(
          'El permiso de lectura de YouTube permite técnicamente ver más información de tu cuenta que la que usamos. Nosotros solo consultamos la identificación de tu canal y las estadísticas descritas arriba.',
        ),
        p(
          '[COMPLETAR: incluir la declaración de uso limitado de los datos de usuario de Google que exige su política; verificar el texto exacto en la política vigente antes de publicar].',
        ),
      ],
    },
    {
      id: 'nohacemos',
      heading: '4. Lo que no hacemos',
      blocks: [
        ul(
          'No publicamos, modificamos ni borramos contenido de tu canal.',
          'No usamos publicidad ni herramientas de analítica de terceros en la aplicación.',
          'No vendemos tus datos [COMPLETAR: confirmar esta política].',
        ),
      ],
    },
    {
      id: 'compartimos',
      heading: '5. Con quién los compartimos',
      blocks: [
        p(
          'Con Google y YouTube, de quienes obtenemos los datos y con quienes interactúas al iniciar sesión o conectar un canal.',
        ),
        p(
          'Con los proveedores que alojan la aplicación y su base de datos: [COMPLETAR: proveedores de alojamiento y base de datos, y país donde se almacenan los datos].',
        ),
        p('Y cuando la ley nos obligue a hacerlo.'),
      ],
    },
    {
      id: 'cookies',
      heading: '6. Cookies',
      blocks: [
        p(
          'Usamos solo las cookies necesarias para que la aplicación funcione; no usamos cookies de publicidad ni de analítica:',
        ),
        ul(
          'sp_session: mantiene tu sesión iniciada. Dura como máximo 30 días y no puede leerse desde el código de la página.',
          'sp_oauth: temporal (10 minutos), solo durante el acceso con Google.',
          'sp_yt_oauth: temporal (10 minutos), solo durante la conexión de un canal de YouTube.',
        ),
      ],
    },
    {
      id: 'conservacion',
      heading: '7. Cuánto tiempo los conservamos',
      blocks: [
        ul(
          'Tu sesión caduca tras 7 días sin uso y, como máximo, a los 30 días. [COMPLETAR: confirmar que las sesiones caducadas se eliminan periódicamente].',
          'Las credenciales y las estadísticas de un canal se conservan hasta que lo desconectes; al desconectarlo se borran.',
          'Los datos de tu cuenta se conservan mientras la tengas. Por ahora no hay un botón para eliminarla: [COMPLETAR: cómo solicitarlo y en cuánto tiempo se atiende].',
        ),
      ],
    },
    {
      id: 'derechos',
      heading: '8. Tus derechos',
      blocks: [
        p(
          'Puedes retirar el acceso de la aplicación a tu cuenta de Google en cualquier momento, desde la sección de seguridad de tu cuenta de Google, en las aplicaciones con acceso a la cuenta.',
        ),
        p(
          '[COMPLETAR: derechos que reconoce la normativa de protección de datos aplicable (acceso, rectificación, supresión, oposición...) y cómo ejercerlos; verificar al publicar que la aplicación permite corregir el perfil y desconectar canales].',
        ),
      ],
    },
    {
      id: 'seguridad',
      heading: '9. Seguridad',
      blocks: [
        p(
          'Protegemos tus datos con medidas como el cifrado de las credenciales de acceso a tus canales, el almacenamiento seguro (hash) de las contraseñas y las sesiones con caducidad. Ningún sistema es completamente seguro.',
        ),
        p(
          '[COMPLETAR: confirmar al publicar que la aplicación se sirve siempre por conexión cifrada (HTTPS)].',
        ),
      ],
    },
    {
      id: 'menores',
      heading: '10. Menores de edad',
      blocks: [
        p(
          '[COMPLETAR: política sobre menores de edad, coherente con la edad mínima de los términos de uso].',
        ),
      ],
    },
    {
      id: 'cambios',
      heading: '11. Cambios en esta política',
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