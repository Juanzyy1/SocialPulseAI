/**
 * Versión "ancha" de un tipo: los literales de texto pasan a string. Un JSON importado llega con los
 * textos ensanchados, así que se compara con Widen<Tipo> y no con el tipo literal. Se conserva lo que
 * importa del contrato: campos faltantes, tipos primitivos distintos y null donde no se admite.
 */
export type Widen<T> = T extends string
  ? string
  : T extends number
    ? number
    : T extends boolean
      ? boolean
      : T extends readonly (infer U)[]
        ? Widen<U>[]
        : T extends object
          ? { [K in keyof T]: Widen<T[K]> }
          : T;