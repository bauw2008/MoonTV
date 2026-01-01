/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { clearConfigCache, getConfig } from '@/lib/config';
import { db } from '@/lib/db';


export const runtime = 'nodejs';

// 支持的操作类型
type Action =
  | 'add'
  | 'disable'
  | 'enable'
  | 'delete'
  | 'sort'
  | 'batch_disable'
  | 'batch_enable'
  | 'batch_delete';

interface BaseBody {
  action?: Action;
}

async function POSTHandler(request: NextRequest, { user }: { user: any }) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  try {
    const body = (await request.json()) as BaseBody & Record<string, any>;
    const { action } = body;

    // AuthGuard已处理权限检查

    // 基础校验
    const ACTIONS: Action[] = [
      'add',
      'disable',
      'enable',
      'delete',
      'sort',
      'batch_disable',
      'batch_enable',
      'batch_delete',
    ];
    if (!user.username || !action || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 获取配置与存储
    const adminConfig = await getConfig();

    // 权限与身份校验 - 使用新框架的角色系统
    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ error: '权限不足' }, { status: 401 });
    }

    switch (action) {
      case 'add': {
        const { key, name, api, detail } = body as {
          key?: string;
          name?: string;
          api?: string;
          detail?: string;
        };
        if (!key || !name || !api) {
          return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }
        if (adminConfig.SourceConfig.some((s) => s.key === key)) {
          return NextResponse.json({ error: '该源已存在' }, { status: 400 });
        }
        adminConfig.SourceConfig.push({
          key,
          name,
          api,
          detail,
          from: 'custom',
          disabled: false,
        });
        break;
      }
      case 'disable': {
        const { key } = body as { key?: string };
        if (!key) {
          return NextResponse.json({ error: '缺少 key 参数' }, { status: 400 });
        }
        const entry = adminConfig.SourceConfig.find((s) => s.key === key);
        if (!entry) {
          return NextResponse.json({ error: '源不存在' }, { status: 404 });
        }
        entry.disabled = true;
        break;
      }
      case 'enable': {
        const { key } = body as { key?: string };
        if (!key) {
          return NextResponse.json({ error: '缺少 key 参数' }, { status: 400 });
        }
        const entry = adminConfig.SourceConfig.find((s) => s.key === key);
        if (!entry) {
          return NextResponse.json({ error: '源不存在' }, { status: 404 });
        }
        entry.disabled = false;
        break;
      }
      case 'delete': {
        const { key } = body as { key?: string };
        if (!key) {
          return NextResponse.json({ error: '缺少 key 参数' }, { status: 400 });
        }
        const idx = adminConfig.SourceConfig.findIndex((s) => s.key === key);
        if (idx === -1) {
          return NextResponse.json({ error: '源不存在' }, { status: 404 });
        }
        const entry = adminConfig.SourceConfig[idx];

        // 只有owner可以删除配置文件中的源，admin只能删除自定义源
        if (entry.from === 'config' && user.role !== 'owner') {
          return NextResponse.json(
            { error: '该源不可删除，只有站长可以删除配置文件中的源' },
            { status: 400 },
          );
        }

        adminConfig.SourceConfig.splice(idx, 1);

        // 检查并清理用户组和用户的权限数组
        // 清理用户组权限
        if (Array.isArray(adminConfig.UserConfig.Tags)) {
          adminConfig.UserConfig.Tags.forEach((tag) => {
            if (tag.enabledApis) {
              tag.enabledApis = tag.enabledApis.filter((api) => api !== key);
            }
          });
        }

        // 清理用户权限
        adminConfig.UserConfig.Users.forEach((user) => {
          if (user.enabledApis) {
            user.enabledApis = user.enabledApis.filter((api) => api !== key);
          }
        });
        break;
      }
      case 'batch_disable': {
        const { keys } = body as { keys?: string[] };
        if (!Array.isArray(keys) || keys.length === 0) {
          return NextResponse.json(
            { error: '缺少 keys 参数或为空' },
            { status: 400 },
          );
        }
        keys.forEach((key) => {
          const entry = adminConfig.SourceConfig.find((s) => s.key === key);
          if (entry) {
            entry.disabled = true;
          }
        });
        break;
      }
      case 'batch_enable': {
        const { keys } = body as { keys?: string[] };
        if (!Array.isArray(keys) || keys.length === 0) {
          return NextResponse.json(
            { error: '缺少 keys 参数或为空' },
            { status: 400 },
          );
        }
        keys.forEach((key) => {
          const entry = adminConfig.SourceConfig.find((s) => s.key === key);
          if (entry) {
            entry.disabled = false;
          }
        });
        break;
      }
      case 'batch_delete': {
        const { keys } = body as { keys?: string[] };
        if (!Array.isArray(keys) || keys.length === 0) {
          return NextResponse.json(
            { error: '缺少 keys 参数或为空' },
            { status: 400 },
          );
        }

        // 根据用户角色决定可以删除的源
        let keysToDelete: string[] = [];
        const configSources: string[] = [];

        keys.forEach((key) => {
          const entry = adminConfig.SourceConfig.find((s) => s.key === key);
          if (!entry) return;

          if (entry.from === 'config') {
            if (user.role === 'owner') {
              keysToDelete.push(key);
            } else {
              configSources.push(key);
            }
          } else {
            keysToDelete.push(key);
          }
        });

        // 如果有配置文件中的源且用户不是owner，返回错误
        if (configSources.length > 0 && user.role !== 'owner') {
          return NextResponse.json(
            {
              error: '以下源不可删除，只有站长可以删除配置文件中的源',
              configSources,
            },
            { status: 400 },
          );
        }

        // 批量删除
        keysToDelete.forEach((key) => {
          const idx = adminConfig.SourceConfig.findIndex((s) => s.key === key);
          if (idx !== -1) {
            adminConfig.SourceConfig.splice(idx, 1);
          }
        });

        // 检查并清理用户组和用户的权限数组
        if (keysToDelete.length > 0) {
          // 清理用户组权限
          if (Array.isArray(adminConfig.UserConfig.Tags)) {
            adminConfig.UserConfig.Tags.forEach((tag) => {
              if (tag.enabledApis) {
                tag.enabledApis = tag.enabledApis.filter(
                  (api) => !keysToDelete.includes(api),
                );
              }
            });
          }

          // 清理用户权限
          adminConfig.UserConfig.Users.forEach((user) => {
            if (user.enabledApis) {
              user.enabledApis = user.enabledApis.filter(
                (api) => !keysToDelete.includes(api),
              );
            }
          });
        }
        break;
      }
      case 'sort': {
        const { order } = body as { order?: string[] };
        if (!Array.isArray(order)) {
          return NextResponse.json(
            { error: '排序列表格式错误' },
            { status: 400 },
          );
        }
        const map = new Map(adminConfig.SourceConfig.map((s) => [s.key, s]));
        const newList: typeof adminConfig.SourceConfig = [];
        order.forEach((k) => {
          const item = map.get(k);
          if (item) {
            newList.push(item);
            map.delete(k);
          }
        });
        // 未在 order 中的保持原顺序
        adminConfig.SourceConfig.forEach((item) => {
          if (map.has(item.key)) {
            newList.push(item);
          }
        });
        adminConfig.SourceConfig = newList;
        break;
      }
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    // 持久化到存储
    await db.saveAdminConfig(adminConfig);

    // 清除配置缓存，强制下次重新从数据库读取
    clearConfigCache();
    
    // 源配置已更新

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('视频源管理操作失败:', error);
    return NextResponse.json(
      {
        error: '视频源管理操作失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export const POST = AuthGuard.admin(POSTHandler);
