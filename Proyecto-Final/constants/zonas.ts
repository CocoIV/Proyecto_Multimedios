/**
 * Zonas donde opera Tombolitas CR (todas en la Zona Sur de Costa Rica).
 * La creación de rifas está limitada a estas opciones.
 */
export const ZONAS = ['Golfito', 'Ciudad Neily', 'Paso Canoas'] as const;

export type Zona = (typeof ZONAS)[number];

/** Región que agrupa a todas las zonas. */
export const REGION = 'Zona Sur';
