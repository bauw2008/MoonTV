/**
 * EdgeOne Edge Functions - Cron 定时任务
 * 每天凌晨 1 点执行
 */

export default {
  async scheduled(event, env, ctx) {
    const timestamp = new Date().toISOString();
    console.log('Cron job triggered:', timestamp);

    try {
      // 调用主应用的 cron API
      const response = await fetch(`${env.API_URL}/api/cron`, {
        method: 'GET',
        headers: {
          'User-Agent': 'EdgeOne-Cron/1.0',
          'X-Cron-Secret': env.CRON_SECRET || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Cron API returned ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Cron job completed successfully:', result);

    } catch (error) {
      console.error('Cron job failed:', error);
      throw error;
    }
  },

  // 支持 HTTP 请求触发（用于测试）
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 只允许 GET 请求
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 验证密钥（可选）
    const secret = request.headers.get('X-Cron-Secret');
    if (env.CRON_SECRET && secret !== env.CRON_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      // 调用主应用的 cron API
      const response = await fetch(`${env.API_URL}/api/cron`, {
        method: 'GET',
        headers: {
          'User-Agent': 'EdgeOne-Cron/1.0',
          'X-Cron-Secret': env.CRON_SECRET || '',
        },
      });

      const result = await response.json();

      return new Response(JSON.stringify({
        success: true,
        message: 'Cron job executed via Edge Function',
        timestamp: new Date().toISOString(),
        result,
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: response.status,
      });

    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Cron job failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  },
};