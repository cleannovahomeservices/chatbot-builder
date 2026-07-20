import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { getSession } from '@/lib/session';
import { checkPdfLimits, recordPdfGeneration, PLAN_LABELS } from '@/lib/plans';
import { generateSystemPromptFromPdfs, type PdfInput } from '@/lib/anthropic';

export const maxDuration = 120;

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB por archivo
const MAX_TOTAL_BYTES = 28 * 1024 * 1024; // margen bajo el límite de 32 MB de Anthropic

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 1. Límite de generaciones (protege contra regenerar en bucle)
  const limits = await checkPdfLimits(user.id);
  if (!limits.allowed) {
    return NextResponse.json(
      {
        error: `Has agotado tus ${limits.limit} generaciones con PDF del plan ${PLAN_LABELS[limits.plan]}.`,
        upgrade: true,
        plan: limits.plan,
      },
      { status: 403 },
    );
  }

  // 2. Leer archivos
  let files: File[];
  try {
    const form = await request.formData();
    files = form.getAll('files').filter((f): f is File => f instanceof File);
  } catch {
    return NextResponse.json({ error: 'No se pudieron leer los archivos.' }, { status: 400 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: 'Sube al menos un PDF.' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Máximo ${MAX_FILES} archivos por generación.` },
      { status: 400 },
    );
  }

  let totalBytes = 0;
  for (const f of files) {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: `"${f.name}" no es un PDF.` }, { status: 400 });
    }
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `"${f.name}" pesa más de 10 MB.` },
        { status: 400 },
      );
    }
    totalBytes += f.size;
  }
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: 'Los archivos suman más de 28 MB en total.' },
      { status: 400 },
    );
  }

  // 3. Contar páginas y validar contra el plan
  const pdfs: PdfInput[] = [];
  let totalPages = 0;

  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    try {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      totalPages += doc.getPageCount();
    } catch {
      return NextResponse.json(
        { error: `No se pudo leer "${f.name}". Puede estar dañado o protegido con contraseña.` },
        { status: 422 },
      );
    }
    pdfs.push({
      filename: f.name,
      base64: Buffer.from(bytes).toString('base64'),
    });
  }

  if (totalPages === 0) {
    return NextResponse.json({ error: 'El PDF no contiene páginas.' }, { status: 422 });
  }
  if (totalPages > limits.pageLimit) {
    return NextResponse.json(
      {
        error: `Tus PDFs suman ${totalPages} páginas y tu plan ${PLAN_LABELS[limits.plan]} permite hasta ${limits.pageLimit}.`,
        upgrade: true,
        plan: limits.plan,
        pages: totalPages,
        pageLimit: limits.pageLimit,
      },
      { status: 403 },
    );
  }

  // 4. Generar. Solo contabilizamos si Claude responde: un fallo no gasta cuota.
  try {
    const result = await generateSystemPromptFromPdfs(pdfs);
    await recordPdfGeneration(user.id, totalPages);
    return NextResponse.json({ ...result, pages: totalPages });
  } catch (err) {
    console.error('Analyze PDF error:', err);
    return NextResponse.json(
      { error: 'No se pudo analizar el PDF. Inténtalo de nuevo.' },
      { status: 500 },
    );
  }
}
