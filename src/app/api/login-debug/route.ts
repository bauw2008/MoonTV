import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // 1. 记录原始请求信息
    const requestInfo: any = {
      method: request.method,
      url: request.url,
      headers: {
        'content-type': request.headers.get('content-type'),
        'content-length': request.headers.get('content-length'),
      },
    };

    // 2. 尝试读取请求体
    let requestBody;
    let rawBody;
    
    try {
      rawBody = await request.text();
      requestInfo.rawBody = rawBody;
      requestInfo.rawBodyLength = rawBody.length;
      
      if (rawBody) {
        requestBody = JSON.parse(rawBody);
        requestInfo.parsedBody = requestBody;
      } else {
        requestInfo.parsedBody = 'empty';
      }
    } catch (parseError) {
      return NextResponse.json({
        success: false,
        error: 'JSON解析失败',
        requestInfo,
        parseError: parseError instanceof Error ? parseError.message : String(parseError),
      }, { status: 400 });
    }

    // 3. 检查环境变量
    const envInfo = {
      NODE_ENV: process.env.NODE_ENV,
      NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
      hasPassword: !!process.env.PASSWORD,
      hasUsername: !!process.env.USERNAME,
      passwordLength: process.env.PASSWORD ? process.env.PASSWORD.length : 0,
      username: process.env.USERNAME ? '***' : 'not set',
    };

    // 4. 模拟登录逻辑
    const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
    
    if (storageType === 'localstorage') {
      // localstorage模式
      if (!requestBody || typeof requestBody.password !== 'string') {
        return NextResponse.json({
          success: false,
          error: 'localstorage模式需要password字段',
          requestInfo,
          envInfo,
        }, { status: 400 });
      }

      const envPassword = process.env.PASSWORD;
      if (!envPassword) {
        return NextResponse.json({
          success: false,
          error: 'PASSWORD环境变量未设置',
          requestInfo,
          envInfo,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'localstorage模式检查通过',
        requestInfo,
        envInfo,
        passwordMatch: requestBody.password === envPassword,
      });
    } else {
      // redis/database模式
      if (!requestBody || typeof requestBody.username !== 'string' || typeof requestBody.password !== 'string') {
        return NextResponse.json({
          success: false,
          error: '数据库模式需要username和password字段',
          requestInfo,
          envInfo,
          storageType,
        }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: '数据库模式检查通过',
        requestInfo,
        envInfo,
        storageType,
        hasUsernamePassword: !!process.env.USERNAME && !!process.env.PASSWORD,
      });
    }
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: '服务器错误',
      details: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.stack : undefined : undefined,
    }, { status: 500 });
  }
}