import { NextResponse } from 'next/server';
import { summaryLogQueries } from '@/lib/db';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get('limit') || '100');
  const offsetParam = parseInt(searchParams.get('offset') || '0');
  const keyword = searchParams.get('keyword') || '';

  const limit = Math.min(Math.max(limitParam, 1), 100);
  const offset = Math.max(offsetParam, 0);

  const logs = summaryLogQueries.listPaged({ limit, offset, keyword });
  const total = summaryLogQueries.count(keyword);

  return NextResponse.json({ logs, total, limit, offset });
}
