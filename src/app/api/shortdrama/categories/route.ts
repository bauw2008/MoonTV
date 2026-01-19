import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const ALL_CATEGORIES = [
  { type_id: 1, type_name: '都市', value: '都市' },
  { type_id: 2, type_name: '言情', value: '言情' },
  { type_id: 3, type_name: '玄幻', value: '玄幻' },
  { type_id: 4, type_name: '古装', value: '古装' },
  { type_id: 5, type_name: '穿越', value: '穿越' },
  { type_id: 6, type_name: '萌宝', value: '萌宝' },
  { type_id: 7, type_name: '励志', value: '励志' },
  { type_id: 8, type_name: '女频', value: '女频' },
  { type_id: 9, type_name: '男频', value: '男频' },
  { type_id: 10, type_name: '现代', value: '现代' },
  { type_id: 11, type_name: '奇幻', value: '奇幻' },
];

export async function GET() {
  const response = NextResponse.json(ALL_CATEGORIES);
  response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
  return response;
}
