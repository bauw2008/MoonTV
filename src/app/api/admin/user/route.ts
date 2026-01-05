/* eslint-disable @typescript-eslint/no-explicit-any,no-console,@typescript-eslint/no-non-null-assertion */

import { NextRequest, NextResponse } from 'next/server';

import { AuthGuard } from '@/lib/auth';
import { clearConfigCache, getAdminConfig } from '@/lib/config';
import { SimpleCrypto } from '@/lib/crypto';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * 强制用户下线
 * 通过增加用户的权限版本号，使用户的当前token失效
 */
async function forceUserLogout(username: string): Promise<void> {
  try {
    // 获取当前配置
    const adminConfig = await getAdminConfig();
    
    // 查找用户
    const userEntry = adminConfig.UserConfig.Users.find(
      (u) => u.username === username,
    );
    
    if (userEntry) {
      // 增加权限版本号，这将使用户的当前token失效
      userEntry.permissionVersion = (userEntry.permissionVersion || 0) + 1;
      
      // 保存配置
      await db.saveAdminConfig(adminConfig);
    }
  } catch (error) {
    console.error(`强制用户 ${username} 下线失败:`, error);
    throw error;
  }
}

// 支持的操作类型
const ACTIONS = [
  'add',
  'ban',
  'unban',
  'setAdmin',
  'cancelAdmin',
  'changePassword',
  'deleteUser',
  'updateUserApis',
  'userGroup',
  'updateUserGroups',
  'batchUpdateUserGroups',
  'approveRegister',
  'rejectRegister',
  'getPassword',
  'getUsers', // 新增：获取用户列表操作
] as const;

async function POSTHandler(request: NextRequest, { user }: { user: any }) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';

  try {
    const body = await request.json();

    // AuthGuard已处理权限检查
    const username = user.username;

    const {
      targetUsername, // 目标用户名
      targetPassword, // 目标用户密码（仅在添加用户时需要）
      action,
    } = body as {
      targetUsername?: string;
      targetPassword?: string;
      action?: (typeof ACTIONS)[number];
    };

    if (!action || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 用户组操作和批量操作不需要targetUsername
    if (
      !targetUsername &&
      !['userGroup', 'batchUpdateUserGroups', 'getUsers'].includes(action)
    ) {
      return NextResponse.json({ error: '缺少目标用户名' }, { status: 400 });
    }

    if (
      action !== 'changePassword' &&
      action !== 'deleteUser' &&
      action !== 'updateUserApis' &&
      action !== 'userGroup' &&
      action !== 'updateUserGroups' &&
      action !== 'batchUpdateUserGroups' &&
      username === targetUsername
    ) {
      return NextResponse.json(
        { error: '无法对自己进行此操作' },
        { status: 400 },
      );
    }

    // 获取配置与存储
    const adminConfig = await getAdminConfig();

    // AuthGuard已验证权限，直接获取角色
    const operatorRole: 'owner' | 'admin' = user.role as 'owner' | 'admin';

    // 查找目标用户条目（用户组操作和批量操作不需要）
    let targetEntry: any = null;
    let isTargetAdmin = false;

    if (
      !['userGroup', 'batchUpdateUserGroups', 'getUsers'].includes(action) &&
      targetUsername
    ) {
      targetEntry = adminConfig.UserConfig.Users.find(
        (u) => u.username === targetUsername,
      );

      if (
        targetEntry?.role === 'owner' &&
        !['changePassword', 'updateUserApis', 'updateUserGroups'].includes(
          action,
        )
      ) {
        return NextResponse.json({ error: '无法操作站长' }, { status: 400 });
      }

      // 权限校验逻辑
      isTargetAdmin = targetEntry?.role === 'admin';
    }

    switch (action) {
      case 'add': {
        if (targetEntry) {
          return NextResponse.json({ error: '用户已存在' }, { status: 400 });
        }
        if (!targetPassword) {
          return NextResponse.json(
            { error: '缺少目标用户密码' },
            { status: 400 },
          );
        }
        await db.registerUser(targetUsername!, targetPassword);

        // 获取用户组信息
        const { userGroup } = body as { userGroup?: string };

        // 更新配置
        const newUser: any = {
          username: targetUsername!,
          role: 'user',
          createdAt: Date.now(), // 设置创建时间戳
        };

        // 如果指定了用户组，添加到tags中，否则使用默认用户组
        if (userGroup && userGroup.trim()) {
          newUser.tags = [userGroup];
        } else {
          newUser.tags = ['默认'];
        }

        adminConfig.UserConfig.Users.push(newUser);
        targetEntry =
          adminConfig.UserConfig.Users[adminConfig.UserConfig.Users.length - 1];
        break;
      }
      case 'approveRegister': {
        // 审核通过：从 PendingUsers 取回密码并创建用户
        if (
          !adminConfig.UserConfig.PendingUsers ||
          adminConfig.UserConfig.PendingUsers.length === 0
        ) {
          return NextResponse.json({ error: '无待审核用户' }, { status: 400 });
        }
        const pendingIndex = adminConfig.UserConfig.PendingUsers.findIndex(
          (u) => u.username === targetUsername,
        );
        if (pendingIndex === -1) {
          return NextResponse.json(
            { error: '未找到该待审核用户' },
            { status: 404 },
          );
        }
        const pending: any = adminConfig.UserConfig.PendingUsers[pendingIndex];
        const secret = process.env.PASSWORD || 'site-secret';
        const decryptedPwd = SimpleCrypto.decrypt(
          pending.encryptedPassword,
          secret,
        );

        await db.registerUser(targetUsername!, decryptedPwd);
        adminConfig.UserConfig.Users.push({
          username: targetUsername!,
          role: 'user',
          createdAt: Date.now(),
          tags: ['默认'], // 为审核通过的用户分配默认用户组
        } as any);
        adminConfig.UserConfig.PendingUsers.splice(pendingIndex, 1);
        break;
      }
      case 'rejectRegister': {
        if (
          !adminConfig.UserConfig.PendingUsers ||
          adminConfig.UserConfig.PendingUsers.length === 0
        ) {
          return NextResponse.json({ error: '无待审核用户' }, { status: 400 });
        }
        const pendingIndex = adminConfig.UserConfig.PendingUsers.findIndex(
          (u) => u.username === targetUsername,
        );
        if (pendingIndex === -1) {
          return NextResponse.json(
            { error: '未找到该待审核用户' },
            { status: 404 },
          );
        }
        adminConfig.UserConfig.PendingUsers.splice(pendingIndex, 1);
        break;
      }
      case 'ban': {
        if (!targetEntry) {
          return NextResponse.json(
            { error: '目标用户不存在' },
            { status: 404 },
          );
        }
        if (isTargetAdmin) {
          // 目标是管理员
          if (operatorRole !== 'owner') {
            return NextResponse.json(
              { error: '仅站长可封禁管理员' },
              { status: 401 },
            );
          }
        }
        targetEntry.banned = true;
        targetEntry.enabled = false; // 同时设置enabled为false
        // 更新权限版本号
        targetEntry.permissionVersion =
          (targetEntry.permissionVersion || 0) + 1;
        
        // 权限版本号已更新，用户下次操作时会被强制下线
        break;
      }
      case 'unban': {
        if (!targetEntry) {
          return NextResponse.json(
            { error: '目标用户不存在' },
            { status: 404 },
          );
        }
        if (isTargetAdmin) {
          if (operatorRole !== 'owner') {
            return NextResponse.json(
              { error: '仅站长可操作管理员' },
              { status: 401 },
            );
          }
        }
        targetEntry.banned = false;
        targetEntry.enabled = true; // 同时设置enabled为true
        // 更新权限版本号
        targetEntry.permissionVersion =
          (targetEntry.permissionVersion || 0) + 1;
        break;
      }
      case 'setAdmin': {
        if (!targetEntry) {
          return NextResponse.json(
            { error: '目标用户不存在' },
            { status: 404 },
          );
        }
        if (targetEntry.role === 'admin') {
          return NextResponse.json(
            { error: '该用户已是管理员' },
            { status: 400 },
          );
        }
        if (operatorRole !== 'owner') {
          return NextResponse.json(
            { error: '仅站长可设置管理员' },
            { status: 401 },
          );
        }
        targetEntry.role = 'admin';
        // 更新权限版本号
        targetEntry.permissionVersion =
          (targetEntry.permissionVersion || 0) + 1;
        break;
      }
      case 'cancelAdmin': {
        if (!targetEntry) {
          return NextResponse.json(
            { error: '目标用户不存在' },
            { status: 404 },
          );
        }
        if (targetEntry.role !== 'admin') {
          return NextResponse.json(
            { error: '目标用户不是管理员' },
            { status: 400 },
          );
        }
        if (operatorRole !== 'owner') {
          return NextResponse.json(
            { error: '仅站长可取消管理员' },
            { status: 401 },
          );
        }
        targetEntry.role = 'user';
        // 更新权限版本号
        targetEntry.permissionVersion =
          (targetEntry.permissionVersion || 0) + 1;
        break;
      }
      case 'changePassword': {
        if (!targetEntry) {
          return NextResponse.json(
            { error: '目标用户不存在' },
            { status: 404 },
          );
        }
        if (!targetPassword) {
          return NextResponse.json({ error: '缺少新密码' }, { status: 400 });
        }

        // 权限检查：不允许修改站长密码
        if (targetEntry.role === 'owner') {
          return NextResponse.json(
            { error: '无法修改站长密码' },
            { status: 401 },
          );
        }

        if (
          isTargetAdmin &&
          operatorRole !== 'owner' &&
          username !== targetUsername
        ) {
          return NextResponse.json(
            { error: '仅站长可修改其他管理员密码' },
            { status: 401 },
          );
        }

        await db.changePassword(targetUsername!, targetPassword);
        break;
      }
      case 'deleteUser': {
        if (!targetEntry) {
          return NextResponse.json(
            { error: '目标用户不存在' },
            { status: 404 },
          );
        }

        // 权限检查：站长可删除所有用户（除了自己），管理员可删除普通用户
        if (username === targetUsername) {
          return NextResponse.json({ error: '不能删除自己' }, { status: 400 });
        }

        if (isTargetAdmin && operatorRole !== 'owner') {
          return NextResponse.json(
            { error: '仅站长可删除管理员' },
            { status: 401 },
          );
        }

        await db.deleteUser(targetUsername!);

        // 从配置中移除用户
        const userIndex = adminConfig.UserConfig.Users.findIndex(
          (u) => u.username === targetUsername,
        );
        if (userIndex > -1) {
          adminConfig.UserConfig.Users.splice(userIndex, 1);
        }

        break;
      }
      case 'updateUserApis': {
        if (!targetEntry) {
          return NextResponse.json(
            { error: '目标用户不存在' },
            { status: 404 },
          );
        }

        const { enabledApis } = body as { enabledApis?: string[] };

        // 权限检查：站长可配置所有人的采集源，管理员可配置普通用户和自己的采集源
        if (
          isTargetAdmin &&
          operatorRole !== 'owner' &&
          username !== targetUsername
        ) {
          return NextResponse.json(
            { error: '仅站长可配置其他管理员的采集源' },
            { status: 401 },
          );
        }

        // 更新用户的采集源权限
        if (enabledApis && enabledApis.length > 0) {
          targetEntry.enabledApis = enabledApis;
        } else {
          // 如果为空数组或未提供，则删除该字段，表示无限制
          delete targetEntry.enabledApis;
        }

        break;
      }
      case 'userGroup': {
        // 用户组管理操作
        const { groupAction, groupName, enabledApis } = body as {
          groupAction: 'add' | 'edit' | 'delete';
          groupName: string;
          enabledApis?: string[];
          disableYellowFilter?: boolean;
          aiEnabled?: boolean;
          videoSources?: string[];
        };

        if (!Array.isArray(adminConfig.UserConfig.Tags)) {
          (adminConfig.UserConfig as any).Tags = [];
        }

        switch (groupAction) {
          case 'add': {
            // 检查用户组是否已存在
            if ((adminConfig.UserConfig.Tags as any).find((t: any) => t.name === groupName)) {
              return NextResponse.json(
                { error: '用户组已存在' },
                { status: 400 },
              );
            }
            const newTag: any = {
              name: groupName,
              enabledApis: enabledApis || [],
            };

            // 添加其他字段
            if (body.disableYellowFilter !== undefined) {
              newTag.disableYellowFilter = body.disableYellowFilter;
            }
            if (body.aiEnabled !== undefined) {
              newTag.aiEnabled = body.aiEnabled;
            }
            if (body.videoSources !== undefined) {
              newTag.videoSources = body.videoSources;
            }

            (adminConfig.UserConfig.Tags as any).push(newTag);

            console.log(`创建用户组 ${groupName}:`, newTag);
            break;
          }
          case 'edit': {
            const groupIndex = (adminConfig.UserConfig.Tags as any).findIndex(
              (t: any) => t.name === groupName,
            );
            if (groupIndex === -1) {
              return NextResponse.json(
                { error: '用户组不存在' },
                { status: 404 },
              );
            }
            const tag = adminConfig.UserConfig.Tags[groupIndex];
            tag.enabledApis = enabledApis || [];

            // 从请求体中获取其他字段
            if (body.disableYellowFilter !== undefined) {
              tag.disableYellowFilter = body.disableYellowFilter;
            }
            if (body.aiEnabled !== undefined) {
              (tag as any).aiEnabled = body.aiEnabled;
            }
            if (body.videoSources !== undefined) {
              (tag as any).videoSources = body.videoSources;
            }

            console.log(`更新用户组 ${groupName}:`, {
              enabledApis: tag.enabledApis,
              aiEnabled: (tag as any).aiEnabled,
              disableYellowFilter: tag.disableYellowFilter,
              videoSources: (tag as any).videoSources,
            });

            break;
          }
          case 'delete': {
            const groupIndex = (adminConfig.UserConfig.Tags as any).findIndex(
              (t: any) => t.name === groupName,
            );
            if (groupIndex === -1) {
              return NextResponse.json(
                { error: '用户组不存在' },
                { status: 404 },
              );
            }

            // 查找使用该用户组的所有用户
            const affectedUsers: string[] = [];
            adminConfig.UserConfig.Users.forEach((user) => {
              if (user.tags && user.tags.includes(groupName)) {
                affectedUsers.push(user.username);
                // 从用户的tags中移除该用户组
                user.tags = user.tags.filter((tag) => tag !== groupName);
                // 如果用户没有其他标签了，删除tags字段
                if (user.tags.length === 0) {
                  delete user.tags;
                }
              }
            });

            // 删除用户组
            (adminConfig.UserConfig.Tags as any).splice(groupIndex, 1);

            // 记录删除操作的影响
            console.log(
              `删除用户组 "${groupName}"，影响用户: ${
                affectedUsers.length > 0 ? affectedUsers.join(', ') : '无'
              }`,
            );

            break;
          }
          default:
            return NextResponse.json(
              { error: '未知的用户组操作' },
              { status: 400 },
            );
        }
        break;
      }
      case 'updateUserGroups': {
        if (!targetEntry) {
          return NextResponse.json(
            { error: '目标用户不存在' },
            { status: 404 },
          );
        }

        const { userGroups } = body as { userGroups: string[] };

        // 权限检查：站长可配置所有人的用户组，管理员可配置普通用户和自己的用户组
        if (
          isTargetAdmin &&
          operatorRole !== 'owner' &&
          username !== targetUsername
        ) {
          return NextResponse.json(
            { error: '仅站长可配置其他管理员的用户组' },
            { status: 400 },
          );
        }

        // 更新用户的用户组
        if (userGroups && userGroups.length > 0) {
          targetEntry.tags = userGroups;
        } else {
          // 如果为空数组或未提供，则删除该字段，表示无用户组
          delete targetEntry.tags;
        }

        break;
      }
      case 'batchUpdateUserGroups': {
        const { usernames, userGroups } = body as {
          usernames: string[];
          userGroups: string[];
        };

        if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
          return NextResponse.json(
            { error: '缺少用户名列表' },
            { status: 400 },
          );
        }

        // 权限检查：站长可批量配置所有人的用户组，管理员只能批量配置普通用户
        if (operatorRole !== 'owner') {
          for (const targetUsername of usernames) {
            const targetUser = adminConfig.UserConfig.Users.find(
              (u) => u.username === targetUsername,
            );
            if (targetUser?.role === 'admin' && targetUsername !== username) {
              return NextResponse.json(
                { error: `管理员无法操作其他管理员 ${targetUsername}` },
                { status: 400 },
              );
            }
          }
        }

        // 批量更新用户组
        for (const targetUsername of usernames) {
          const targetUser = adminConfig.UserConfig.Users.find(
            (u) => u.username === targetUsername,
          );
          if (targetUser) {
            if (userGroups && userGroups.length > 0) {
              targetUser.tags = userGroups;
            } else {
              // 如果为空数组或未提供，则删除该字段，表示无用户组
              delete targetUser.tags;
            }
          }
        }

        break;
      }
      case 'getPassword': {
        if (!targetEntry) {
          return NextResponse.json(
            { error: '目标用户不存在' },
            { status: 404 },
          );
        }

        // 权限检查：站长可获取所有用户密码，管理员只能获取普通用户密码
        if (isTargetAdmin && operatorRole !== 'owner') {
          return NextResponse.json(
            { error: '仅站长可获取管理员密码' },
            { status: 401 },
          );
        }

        // 获取用户密码
        const password = await db.getUserPassword(targetUsername!);

        return NextResponse.json({
          password: password || '无密码',
        });
      }
      case 'getUsers': {
        // 返回配置文件中的最新用户列表
        const config = await getAdminConfig();
        const users = config.UserConfig?.Users || [];
        return NextResponse.json({
          users: users,
        });
      }
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    // 将更新后的配置写入数据库
    await db.saveAdminConfig(adminConfig);

    // 清除配置缓存，强制下次重新从数据库读取
    clearConfigCache();
    
    // 配置已更新

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store', // 管理员配置不缓存
        },
      },
    );
  } catch (error) {
    console.error('用户管理操作失败:', error);
    return NextResponse.json(
      {
        error: '用户管理操作失败',
        details: (error as Error).message,
      },
      { status: 500 },
    );
  }
}

export const GET = AuthGuard.admin(
  async (req: NextRequest, { user }: { user: any }) => {
    return NextResponse.json(
      { error: 'GET method not supported' },
      { status: 405 },
    );
  },
);
export const POST = AuthGuard.admin(POSTHandler);
