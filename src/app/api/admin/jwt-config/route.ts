import crypto from 'crypto';
import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

import { AuthManager } from '@/lib/auth/core/auth-manager';

export const runtime = 'nodejs';

// JWT密钥配置文件路径
const JWT_CONFIG_PATH = path.join(process.cwd(), 'data', 'jwt-config.json');

interface JwtConfig {
  secret: string;
  updatedAt: number;
  updatedBy: string;
  history: Array<{
    secret: string;
    updatedAt: number;
    updatedBy: string;
    reason?: string;
  }>;
}

// 读取JWT配置
function getJwtConfig(): JwtConfig {
  try {
    if (fs.existsSync(JWT_CONFIG_PATH)) {
      const content = fs.readFileSync(JWT_CONFIG_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('读取JWT配置失败:', error);
  }

  // 如果没有配置文件，使用环境变量
  return {
    secret: process.env.JWT_SECRET || process.env.PASSWORD || '',
    updatedAt: Date.now(),
    updatedBy: 'system',
    history: [],
  };
}

// 保存JWT配置
function saveJwtConfig(config: JwtConfig): void {
  try {
    const dir = path.dirname(JWT_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(JWT_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('保存JWT配置失败:', error);
    throw new Error('保存JWT配置失败');
  }
}

// 生成强JWT密钥
function generateJwtSecret(): string {
  return crypto.randomBytes(64).toString('hex');
}

// GET - 获取当前JWT配置
export async function GET(request: NextRequest) {
  try {
    const authManager = AuthManager.getInstance();
    const authResult = await authManager.authenticate(request);

    if (!authResult.success || authResult.user?.role !== 'owner') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const config = getJwtConfig();

    // 为站长返回完整密钥，用于复制和管理
    const safeConfig = {
      secret: config.secret || '',
      secretLength: config.secret.length,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
      historyCount: config.history.length,
      lastRotation:
        config.history.length > 0
          ? config.history[config.history.length - 1].updatedAt
          : null,
    };

    return NextResponse.json({
      success: true,
      config: safeConfig,
    });
  } catch (error) {
    console.error('获取JWT配置失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// POST - 更新JWT配置
export async function POST(request: NextRequest) {
  try {
    const authManager = AuthManager.getInstance();
    const authResult = await authManager.authenticate(request);

    if (!authResult.success || authResult.user?.role !== 'owner') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { action, secret, reason } = await request.json();
    const config = getJwtConfig();
    const currentUser = authResult.user.username;

    // 保存当前密钥到历史记录
    if (config.secret) {
      config.history.unshift({
        secret: config.secret,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
        reason: reason || '密钥轮换',
      });

      // 只保留最近10个历史记录
      config.history = config.history.slice(0, 10);
    }

    let newSecret: string;

    switch (action) {
      case 'generate':
        newSecret = generateJwtSecret();
        break;

      case 'set':
        if (!secret || secret.length < 32) {
          return NextResponse.json(
            { error: '密钥长度至少32字符' },
            { status: 400 },
          );
        }
        newSecret = secret;
        break;

      case 'restore': {
        // 从历史记录恢复
        const historyIndex = parseInt(reason || '0');
        if (historyIndex >= 0 && historyIndex < config.history.length) {
          newSecret = config.history[historyIndex].secret;
        } else {
          return NextResponse.json(
            { error: '无效的历史记录索引' },
            { status: 400 },
          );
        }
        break;
      }

      default:
        return NextResponse.json({ error: '无效的操作' }, { status: 400 });
    }

    // 更新配置
    config.secret = newSecret;
    config.updatedAt = Date.now();
    config.updatedBy = currentUser;

    // 保存配置
    saveJwtConfig(config);

    // 更新环境变量（临时，重启后失效）
    process.env.JWT_SECRET = newSecret;

    // 清除认证缓存
    if (
      'clearCache' in authManager &&
      typeof authManager.clearCache === 'function'
    ) {
      authManager.clearCache();
    }

    return NextResponse.json({
      success: true,
      message: 'JWT配置更新成功',
      config: {
        secret: `${newSecret.substring(0, 8)}...${newSecret.substring(newSecret.length - 8)}`,
        secretLength: newSecret.length,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
      },
    });
  } catch (error) {
    console.error('更新JWT配置失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// DELETE - 清除JWT配置，恢复到环境变量
export async function DELETE(request: NextRequest) {
  try {
    const authManager = AuthManager.getInstance();
    const authResult = await authManager.authenticate(request);

    if (!authResult.success || authResult.user?.role !== 'owner') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 删除配置文件
    if (fs.existsSync(JWT_CONFIG_PATH)) {
      fs.unlinkSync(JWT_CONFIG_PATH);
    }

    // 清除环境变量
    delete process.env.JWT_SECRET;

    // 清除认证缓存
    if (
      'clearCache' in authManager &&
      typeof authManager.clearCache === 'function'
    ) {
      authManager.clearCache();
    }

    return NextResponse.json({
      success: true,
      message: 'JWT配置已清除，恢复到环境变量',
    });
  } catch (error) {
    console.error('清除JWT配置失败:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
