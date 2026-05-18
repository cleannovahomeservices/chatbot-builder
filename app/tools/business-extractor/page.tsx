import type { Metadata } from 'next';
import { PublicExtractorClient } from './client';

export const metadata: Metadata = {
  title: 'Extractor de negocios de Google Maps — Gratis | BotLuma',
  description: 'Extrae reseñas, fotos, horarios y datos de cualquier negocio de Google Maps. Genera el prompt perfecto para crear su web en Lovable, Cursor o v0. Gratis.',
  openGraph: {
    title: 'Extractor de negocios de Google Maps — Gratis',
    description: 'Convierte cualquier ficha de Google Maps en un prompt listo para vibe coding. Reseñas, fotos, horarios. Gratis.',
    type: 'website',
  },
};

export default function PublicExtractorPage() {
  return <PublicExtractorClient />;
}
