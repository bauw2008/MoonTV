import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  // 返回一个简单的HTML页面用于测试登录
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>登录测试 - 生产环境诊断</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
        }
        .info {
            background: #e8f5e9;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
            border-left: 4px solid #4CAF50;
        }
        .test-section {
            margin: 30px 0;
            padding: 20px;
            background: #f9f9f9;
            border-radius: 5px;
        }
        button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 5px;
        }
        button:hover {
            background: #45a049;
        }
        button.secondary {
            background: #2196F3;
        }
        button.secondary:hover {
            background: #0b7dda;
        }
        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 5px;
            display: none;
        }
        .success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        code {
            background: #f1f1f1;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 生产环境登录测试</h1>
        
        <div class="info">
            <strong>当前环境信息：</strong><br>
            NODE_ENV: <code>${process.env.NODE_ENV || '未设置'}</code><br>
            存储类型: <code>${process.env.NEXT_PUBLIC_STORAGE_TYPE || '未设置'}</code><br>
            PASSWORD设置: <code>${process.env.PASSWORD ? '已设置' : '未设置'}</code><br>
            USERNAME设置: <code>${process.env.USERNAME ? '已设置' : '未设置'}</code>
        </div>
        
        <div class="test-section">
            <h3>测试1: 环境检查</h3>
            <button onclick="testEnvironment()">检查环境变量</button>
            <div id="envResult" class="result"></div>
        </div>
        
        <div class="test-section">
            <h3>测试2: 登录API测试</h3>
            <p>使用环境变量中的密码测试：</p>
            <button onclick="testLogin()">测试登录</button>
            <button class="secondary" onclick="testLoginWithWrongPassword()">测试错误密码</button>
            <div id="loginResult" class="result"></div>
        </div>
        
        <div class="test-section">
            <h3>测试3: Cookie检查</h3>
            <button onclick="checkCookies()">检查当前Cookie</button>
            <button class="secondary" onclick="clearCookies()">清除Cookie</button>
            <div id="cookieResult" class="result"></div>
        </div>
        
        <div class="test-section">
            <h3>测试4: 其他API测试</h3>
            <button onclick="testPublicConfig()">测试/public-config</button>
            <button class="secondary" onclick="testDiagnose()">测试/diagnose</button>
            <div id="apiResult" class="result"></div>
        </div>
    </div>
    
    <script>
        function showResult(elementId, message, isSuccess) {
            const element = document.getElementById(elementId);
            element.innerHTML = message;
            element.className = 'result ' + (isSuccess ? 'success' : 'error');
            element.style.display = 'block';
        }
        
        async function testEnvironment() {
            try {
                const response = await fetch('/api/production-test');
                const data = await response.json();
                showResult('envResult', 
                    '<strong>✅ 环境检查成功</strong><br>' +
                    'NODE_ENV: ' + data.data.environment.NODE_ENV + '<br>' +
                    '平台: ' + data.data.runtime.platform + '<br>' +
                    'PASSWORD设置: ' + data.data.environment.hasPassword + '<br>' +
                    'USERNAME设置: ' + data.data.environment.usernameSet,
                    true
                );
            } catch (error) {
                showResult('envResult', 
                    '<strong>❌ 环境检查失败</strong><br>' + error.message, 
                    false
                );
            }
        }
        
        async function testLogin() {
            try {
                // 尝试使用环境变量中的密码（假设密码是"password"）
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password: 'password' })
                });
                
                const data = await response.json();
                if (response.ok) {
                    showResult('loginResult', 
                        '<strong>✅ 登录成功</strong><br>' +
                        '响应: ' + JSON.stringify(data, null, 2),
                        true
                    );
                } else {
                    showResult('loginResult', 
                        '<strong>❌ 登录失败</strong><br>' +
                        '状态码: ' + response.status + '<br>' +
                        '错误: ' + (data.error || '未知错误'),
                        false
                    );
                }
            } catch (error) {
                showResult('loginResult', 
                    '<strong>❌ 请求失败</strong><br>' + error.message, 
                    false
                );
            }
        }
        
        async function testLoginWithWrongPassword() {
            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password: 'wrongpassword' })
                });
                
                const data = await response.json();
                if (response.status === 401) {
                    showResult('loginResult', 
                        '<strong>✅ 测试通过</strong><br>' +
                        '错误密码正确返回401<br>' +
                        '消息: ' + (data.error || '密码错误'),
                        true
                    );
                } else {
                    showResult('loginResult', 
                        '<strong>⚠️ 异常响应</strong><br>' +
                        '状态码: ' + response.status + '<br>' +
                        '响应: ' + JSON.stringify(data, null, 2),
                        false
                    );
                }
            } catch (error) {
                showResult('loginResult', 
                    '<strong>❌ 请求失败</strong><br>' + error.message, 
                    false
                );
            }
        }
        
        function checkCookies() {
            const cookies = document.cookie;
            if (cookies) {
                showResult('cookieResult', 
                    '<strong>🍪 当前Cookie:</strong><br>' + 
                    cookies.split(';').map(c => c.trim()).join('<br>'),
                    true
                );
            } else {
                showResult('cookieResult', 
                    '<strong>❌ 没有Cookie</strong>',
                    false
                );
            }
        }
        
        function clearCookies() {
            document.cookie.split(";").forEach(function(c) {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            showResult('cookieResult', 
                '<strong>✅ Cookie已清除</strong><br>刷新页面后生效',
                true
            );
        }
        
        async function testPublicConfig() {
            try {
                const response = await fetch('/api/public-config');
                const data = await response.json();
                if (response.status === 401) {
                    showResult('apiResult', 
                        '<strong>⚠️ 需要认证</strong><br>' +
                        'public-config返回401，需要先登录',
                        false
                    );
                } else if (response.ok) {
                    showResult('apiResult', 
                        '<strong>✅ 访问成功</strong><br>' +
                        '已获得认证，可以访问protected API',
                        true
                    );
                }
            } catch (error) {
                showResult('apiResult', 
                    '<strong>❌ 请求失败</strong><br>' + error.message, 
                    false
                );
            }
        }
        
        async function testDiagnose() {
            try {
                const response = await fetch('/api/diagnose');
                const data = await response.json();
                showResult('apiResult', 
                    '<strong>✅ 诊断API正常</strong><br>' +
                    'NODE_ENV: ' + data.environment.NODE_ENV + '<br>' +
                    '数据库: ' + data.tests.database,
                    true
                );
            } catch (error) {
                showResult('apiResult', 
                    '<strong>❌ 诊断API失败</strong><br>' + error.message, 
                    false
                );
            }
        }
        
        // 页面加载时自动检查环境
        window.onload = function() {
            testEnvironment();
        };
    </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}