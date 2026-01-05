import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';

export const runtime = 'nodejs';

async function POSTHandler(request: NextRequest, { user }: { user: any }) {
  // AuthGuard已处理权限检查
  const username = user.username;

  try {
    // 权限校验 - 只有站长和管理员可以测试
    if (!['owner', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { apiUrl, apiKey, model } = await request.json();

    // 验证参数
    if (!apiUrl || !apiKey) {
      return NextResponse.json(
        {
          error: '请提供API地址和密钥',
        },
        { status: 400 },
      );
    }

    // 构建测试消息
    const testMessages = [
      {
        role: 'system',
        content: '你是一个AI助手，请简单回复确认你可以正常工作。',
      },
      { role: 'user', content: '你好，请回复"测试成功"来确认连接正常。' },
    ];

    // 调用AI API进行测试
    const testUrl = apiUrl.endsWith('/chat/completions')
      ? apiUrl
      : `${apiUrl.replace(/\/$/, '')}/chat/completions`;

    console.log('Testing AI API:', testUrl);

    const requestBody = {
      model: model || 'gpt-3.5-turbo',
      messages: testMessages,
      max_tokens: 100,
      temperature: 0.1,
    };

    console.log('AI API Request Body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'API连接失败';
      let errorDetails = '';

      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          errorMessage =
            errorData.error.message || errorData.error || errorMessage;
          errorDetails = JSON.stringify(errorData, null, 2);
        } else if (errorData.msg) {
          errorMessage = errorData.msg;
          errorDetails = `状态码: ${errorData.status}\n详细信息: ${JSON.stringify(errorData)}`;
        }
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        errorDetails = errorText;
      }

      console.error('AI API Test Error:', errorText);
      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
          status: response.status,
          statusText: response.statusText,
        },
        { status: 400 },
      );
    }

    const result = await response.json();

    console.log('AI API Response:', JSON.stringify(result, null, 2));

    // 检查返回结果格式
    if (!result.choices || result.choices.length === 0) {
      return NextResponse.json(
        {
          error: 'API返回无choices数据',
          rawResponse: JSON.stringify(result).substring(0, 500),
        },
        { status: 400 },
      );
    }

    if (!result.choices[0]?.message) {
      return NextResponse.json(
        {
          error: 'API返回choices格式异常',
          rawResponse: JSON.stringify(result).substring(0, 500),
        },
        { status: 400 },
      );
    }

    // 尝试从多个可能的字段获取回复内容
    const message = result.choices[0].message;
    let testReply = message.content || message.reasoning_content || '';

    // 如果是reasoning_content，尝试提取关键信息
    if (!testReply && message.reasoning_content) {
      // 从reasoning_content中提取可能的回复
      const lines = message.reasoning_content.split('\n');
      for (const line of lines) {
        if (
          line.includes('测试成功') ||
          line.includes('测试') ||
          line.includes('成功')
        ) {
          testReply = line.trim();
          break;
        }
      }
      // 如果没找到，使用前100个字符作为回复
      if (!testReply) {
        testReply = message.reasoning_content.substring(0, 100) + '...';
      }
    }

    console.log('Test Reply:', testReply);

    // 检查内容是否为空
    if (!testReply || testReply.trim() === '') {
      return NextResponse.json(
        {
          error: '⚠️ API返回了空内容！这就是导致空回复的原因',
          details:
            '这表明AI模型返回了空回复，可能原因：\n1. 模型参数配置问题\n2. API密钥权限问题\n3. 模型服务异常\n4. API响应格式非标准（使用了reasoning_content而非content）',
          rawResponse: JSON.stringify(result).substring(0, 1000),
          debug: {
            hasContent: !!message.content,
            hasReasoningContent: !!message.reasoning_content,
            messageFields: Object.keys(message),
          },
          success: false,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: '✅ 测试成功 - AI配置正常',
      testReply: testReply,
      model: result.model || model,
      usage: result.usage,
      diagnosis: {
        responseStructure: '正常',
        contentLength: testReply.length,
        hasContent: testReply.trim().length > 0,
      },
    });
  } catch (error) {
    console.error('AI API test error:', error);

    let errorMessage = '连接测试失败';
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = '无法连接到API服务器，请检查API地址';
      } else if (error.message.includes('timeout')) {
        errorMessage = '连接超时，请检查网络或API服务状态';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}

export const POST = AuthGuard.admin(POSTHandler);
