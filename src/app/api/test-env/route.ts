import { NextResponse } from 'next/server';

export async function GET() {
  const envInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      PASSWORD: process.env.PASSWORD ? '***已设置***' : '未设置',
      PASSWORD_LENGTH: process.env.PASSWORD?.length || 0,
      EDGEONE_PAGES: process.env.EDGEONE_PAGES,
      NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
      NODE_ENV: process.env.NODE_ENV,
    },
    allEnvKeys: Object.keys(process.env).filter(
      (k) =>
        k.includes('PASSWORD') ||
        k.includes('EDGEONE') ||
        k.includes('NEXT_PUBLIC'),
    ),
  };

  return NextResponse.json(envInfo, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
