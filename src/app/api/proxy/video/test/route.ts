// /* eslint-disable no-console */

// import { NextResponse } from "next/server";

// export const runtime = 'nodejs';

// // 测试视频URL的可达性，用于调试403问题
// export async function GET(request: Request) {
//   const { searchParams } = new URL(request.url);
//   const url = searchParams.get('url');

//   if (!url) {
//     return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
//   }

//   try {
//     const decodedUrl = decodeURIComponent(url);
//     console.log('Testing video URL:', decodedUrl);

//     // 测试不同的请求头配置
//     const testConfigs = [
//       // 配置1：基础浏览器头
//       {
//         name: 'Basic Browser Headers',
//         headers: {
//           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
//           'Accept': '*/*',
//         }
//       },
//       // 配置2：夸克网盘专用头
//       {
//         name: 'Quark Drive Headers',
//         headers: {
//           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
//           'Accept': '*/*',
//           'Referer': 'https://pan.quark.cn/',
//           'Origin': 'https://pan.quark.cn',
//         }
//       },
//       // 配置3：简化头
//       {
//         name: 'Minimal Headers',
//         headers: {
//           'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
//         }
//       }
//     ];

//     const results = [];

//     for (const config of testConfigs) {
//       try {
//         console.log(`Testing with ${config.name}...`);

//         // 只发送HEAD请求来检查URL可达性，避免下载大文件
//         const response = await fetch(decodedUrl, {
//           method: 'HEAD',
//           headers: config.headers,
//           signal: AbortSignal.timeout(10000), // 10秒超时
//         });

//         results.push({
//           config: config.name,
//           status: response.status,
//           statusText: response.statusText,
//           success: response.ok,
//           headers: Object.fromEntries(response.headers.entries()),
//           contentType: response.headers.get('content-type'),
//           contentLength: response.headers.get('content-length'),
//           acceptRanges: response.headers.get('accept-ranges'),
//         });

//         console.log(`${config.name}: ${response.status} ${response.statusText}`);

//         // 如果成功，不需要测试其他配置
//         if (response.ok) {
//           break;
//         }

//       } catch (error) {
//         results.push({
//           config: config.name,
//           error: error instanceof Error ? error.message : String(error),
//           success: false,
//         });
//         console.log(`${config.name}: Error - ${error}`);
//       }
//     }

//     return NextResponse.json({
//       url: decodedUrl,
//       testResults: results,
//       timestamp: new Date().toISOString(),
//     }, {
//       headers: {
//         'Access-Control-Allow-Origin': '*',
//         'Access-Control-Allow-Methods': 'GET, OPTIONS',
//         'Access-Control-Allow-Headers': 'Content-Type',
//       }
//     });

//   } catch (error) {
//     console.error('Test URL error:', error);
//     return NextResponse.json({
//       error: 'Failed to test URL',
//       details: error instanceof Error ? error.message : String(error)
//     }, {
//       status: 500,
//       headers: {
//         'Access-Control-Allow-Origin': '*',
//         'Access-Control-Allow-Methods': 'GET, OPTIONS',
//         'Access-Control-Allow-Headers': 'Content-Type',
//       }
//     });
//   }
// }

// export async function OPTIONS() {
//   return new Response(null, {
//     status: 200,
//     headers: {
//       'Access-Control-Allow-Origin': '*',
//       'Access-Control-Allow-Methods': 'GET, OPTIONS',
//       'Access-Control-Allow-Headers': 'Content-Type',
//       'Access-Control-Max-Age': '86400',
//     },
//   });
// }
