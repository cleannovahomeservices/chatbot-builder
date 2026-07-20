/**
 * Traspaso de los PDFs elegidos en la landing hacia el wizard de /create.
 *
 * Un File no cabe en un query param ni sobrevive a serializarse, así que se
 * queda en memoria y el wizard lo recoge tras una navegación de cliente
 * (router.push). Un recargado completo de página lo pierde a propósito: en ese
 * caso el wizard simplemente muestra su propio selector de archivos.
 */
let pendingPdfs: File[] = [];

export function setPendingPdfs(files: File[]): void {
  pendingPdfs = files;
}

/** Lectura no destructiva: es seguro llamarla durante el render. */
export function peekPendingPdfs(): File[] {
  return pendingPdfs;
}

/** Se llama una vez que el wizard ya ha arrancado con estos archivos. */
export function clearPendingPdfs(): void {
  pendingPdfs = [];
}
