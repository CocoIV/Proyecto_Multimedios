import type { Timestamp } from 'firebase/firestore';

export type EstadoRifa = 'activa' | 'cerrada' | 'sorteada';

export type Rifa = {
  id: string;
  titulo: string;
  descripcion: string;
  premio: string;
  precio: number;
  total_numeros: number;
  vendidos: number;
  estado: EstadoRifa;
  fecha_sorteo?: Timestamp | null;
  creado_en: Timestamp;
  creado_por_uid: string;
  creado_por_nombre: string;
  // Campos de ganador (se llenan al sortear)
  ganador_numero?: string;
  ganador_nombre?: string;
  ganador_telefono?: string;
  ganador_uid?: string;
  sorteado_en?: Timestamp;
};

export type NumeroDoc = {
  comprador_uid: string;
  comprador_nombre: string;
  comprador_telefono: string;
  comprado_en: Timestamp;
  pagado: boolean;
  rifa_titulo: string;
};
