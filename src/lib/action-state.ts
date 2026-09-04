/**
 * Estado que devuelven las acciones del panel.
 *
 * Vive fuera de actions.ts a proposito: un archivo "use server" solo puede
 * exportar funciones asincronicas. Exportar un objeto ahi compila igual, pero
 * revienta en runtime la primera vez que alguien usa un boton.
 */
export type ActionState = { ok: boolean; message: string | null };

export const IDLE: ActionState = { ok: false, message: null };
