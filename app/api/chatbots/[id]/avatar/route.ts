import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

const BUCKET = 'chatbot-assets';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

// Sube (o reemplaza) el avatar/logo del chatbot y guarda la URL pública.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  // El chatbot tiene que ser del usuario
  const { data: chatbot } = await db
    .from('chatbots')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!chatbot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo de imagen' }, { status: 400 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Formato no válido. Usa PNG, JPG, WEBP, GIF o SVG.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen es demasiado grande (máx. 2 MB).' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `${user.id}/${id}.${ext}`;

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (upErr) {
    return NextResponse.json({ error: `Error al subir: ${upErr.message}` }, { status: 500 });
  }

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
  // Cache-busting para que el cambio se vea al instante
  const url = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: updErr } = await db
    .from('chatbots')
    .update({ avatar_url: url })
    .eq('id', id)
    .eq('user_id', user.id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatarUrl: url });
}

// Quita el avatar/logo.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = createAdminClient();

  const { error } = await db
    .from('chatbots')
    .update({ avatar_url: null })
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Borrado best-effort de los ficheros del bucket (varias extensiones posibles)
  const paths = Object.values(EXT_BY_TYPE).map((e) => `${user.id}/${id}.${e}`);
  try { await db.storage.from(BUCKET).remove(paths); } catch {}

  return NextResponse.json({ ok: true });
}
