/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  console.log('Proxy video request for URL:', url);

  let response: Response | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  try {
    const decodedUrl = decodeURIComponent(url);
    console.log('Decoded URL:', decodedUrl);

    // 为短剧视频文件设置合适的请求头，避免403错误
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    // 对于夸克网盘等，设置更精确的请求头
    if (decodedUrl.includes('quark.cn') || decodedUrl.includes('drive.quark.cn')) {
      headers['Referer'] = 'https://pan.quark.cn/';
      headers['Origin'] = 'https://pan.quark.cn';
      // 移除可能导致问题的header
      delete headers['Sec-Fetch-Dest'];
      delete headers['Sec-Fetch-Mode'];
      delete headers['Sec-Fetch-Site'];
    } else if (decodedUrl.includes('dl-c-')) {
      // 对于CDN链接，使用更简单的请求头
      headers['Referer'] = '';
      delete headers['Origin'];
    }

    // 处理Range请求，支持视频拖拽播放
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    response = await fetch(decodedUrl, {
      headers,
      // 添加超时设置
      signal: AbortSignal.timeout(30000), // 30秒超时
    });

    if (!response.ok) {
      console.error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      console.error('Request headers were:', JSON.stringify(headers, null, 2));

      // 返回具有正确CORS头的错误响应
      const errorHeaders = new Headers();
      errorHeaders.set('Access-Control-Allow-Origin', '*');
      errorHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      errorHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin, Authorization');

      return NextResponse.json({
        error: `Failed to fetch video: ${response.status}`,
        details: response.statusText,
        url: decodedUrl
      }, {
        status: response.status >= 400 ? response.status : 500,
        headers: errorHeaders
      });
    }

    console.log(`Successfully fetched video: ${response.status} ${response.statusText}`);

    const responseHeaders = new Headers();

    // 设置内容类型
    const contentType = response.headers.get('content-type');
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    } else {
      // 默认为MP4
      responseHeaders.set('Content-Type', 'video/mp4');
    }

    // 完整的CORS头设置
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept, Origin, Authorization, X-Requested-With');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
    responseHeaders.set('Access-Control-Allow-Credentials', 'false');

    // 支持Range请求
    responseHeaders.set('Accept-Ranges', 'bytes');

    // 传递内容长度和Range响应头
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    // 缓存控制
    responseHeaders.set('Cache-Control', 'public, max-age=3600, must-revalidate');

    // 使用流式传输，支持大文件播放
    const stream = new ReadableStream({
      start(controller) {
        if (!response?.body) {
          controller.close();
          return;
        }

        reader = response.body.getReader();
        let isCancelled = false;

        function pump() {
          if (isCancelled || !reader) {
            return;
          }

          reader.read().then(({ done, value }) => {
            if (isCancelled) {
              return;
            }

            if (done) {
              controller.close();
              cleanup();
              return;
            }

            try {
              controller.enqueue(value);
              pump();
            } catch (error) {
              if (!isCancelled) {
                console.error('Stream error:', error);
                controller.error(error);
                cleanup();
              }
            }
          }).catch((error) => {
            if (!isCancelled) {
              console.error('Reader error:', error);
              controller.error(error);
              cleanup();
            }
          });
        }

        function cleanup() {
          isCancelled = true;
          if (reader && reader.releaseLock) {
            try {
              reader.releaseLock();
            } catch (e) {
              // reader 可能已经被释放，忽略错误
            }
            reader = null;
          }
        }

        pump();
      },
      cancel() {
        // 当流被取消时，确保释放所有资源
        if (reader && reader.releaseLock) {
          try {
            reader.releaseLock();
          } catch (e) {
            // reader 可能已经被释放，忽略错误
          }
          reader = null;
        }

        if (response?.body) {
          try {
            response.body.cancel();
          } catch (e) {
            // 忽略取消时的错误
          }
        }
      }
    });

    return new Response(stream, {
      status: response.status,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Proxy video error:', error);

    // 确保在错误情况下也释放资源
    if (reader && typeof (reader as any)?.releaseLock === 'function') {
      try {
        (reader as ReadableStreamDefaultReader<Uint8Array>).releaseLock();
      } catch (e) {
        // 忽略错误
      }
    }

    if (response?.body) {
      try {
        response.body.cancel();
      } catch (e) {
        // 忽略错误
      }
    }

    return NextResponse.json({
      error: 'Failed to proxy video',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// 支持OPTIONS请求用于CORS预检
export async function OPTIONS(_request: Request) {
  console.log('CORS preflight request received');

  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Origin, Authorization, X-Requested-With',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Max-Age': '86400',
    },
  });
}
