'use client';

import {
  Brain,
  Check,
  Clock,
  Eye,
  ShieldCheck,
  ShieldX,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { DefaultPermissions, PermissionType } from '@/lib/permission-types';

import { useAuth } from '@/components/auth/AuthProvider';
import { PermissionGuard } from '@/components/PermissionGuard';

import { CollapsibleTab } from '@/components/admin/ui/CollapsibleTab';
import { useAdminState } from '@/hooks/admin/useAdminState';
import { ConfigService } from '@/services/admin/configService';

// 类型定义
interface User {
  username: string;
  password?: string;
  role: 'owner' | 'admin' | 'user';
  enabled?: boolean;
  banned?: boolean;
  createdAt?: number;
  lastLoginAt?: number;
  tags?: string[];
  enabledApis?: string[];
  permissionVersion?: number;
}

interface UserSettings {
  Users: User[];
  Tags: Array<{
    name: string;
    enabledApis: string[];
    disableYellowFilter?: boolean;
    aiEnabled?: boolean;
    videoSources?: string[];
  }>;
  AllowRegister: boolean;
  RequireApproval: boolean;
  AutoCleanupInactiveUsers: boolean;
  InactiveUserDays: number;
  PendingUsers: Array<{
    username: string;
    encryptedPassword: string;
    createdAt: number;
    reason?: string;
    appliedAt: string;
  }>;
}

// 用户头像组件
interface UserAvatarProps {
  username: string;
  size?: 'sm' | 'md' | 'lg';
}

const UserAvatar = ({ username, size = 'sm' }: UserAvatarProps) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAvatar = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/avatar?user=${encodeURIComponent(username)}`,
        );
        const data = await response.json();
        setAvatarUrl(data.avatar || null);
      } catch (error) {
        console.error('获取头像失败:', error);
      }
      setLoading(false);
    };

    fetchAvatar();
  }, [username]);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full overflow-hidden relative flex-shrink-0`}
    >
      {loading ? (
        <div className='w-full h-full bg-gray-100 dark:bg-gray-800 animate-pulse' />
      ) : avatarUrl ? (
        <img
          src={
            avatarUrl.startsWith('data:')
              ? avatarUrl
              : `data:image/jpeg;base64,${avatarUrl}`
          }
          alt={`${username} 的头像`}
          width={size === 'sm' ? 32 : size === 'md' ? 40 : 48}
          height={size === 'sm' ? 32 : size === 'md' ? 40 : 48}
          className='w-full h-full object-cover'
        />
      ) : (
        <div className='w-full h-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center'>
          <Users
            className={`${iconSizeClasses[size]} text-blue-500 dark:text-blue-400`}
          />
        </div>
      )}
    </div>
  );
};

function UserConfigContent() {
  const { loading, withLoading } = useAdminState();
  const authState = useAuth();
  const currentUser = authState.state.user;

  const [userSettings, setUserSettings] = useState<UserSettings>({
    Users: [],
    Tags: [],
    AllowRegister: false,
    RequireApproval: false,
    AutoCleanupInactiveUsers: false,
    InactiveUserDays: 7,
    PendingUsers: [],
  });

  // 用户密码状态
  const [userPasswords, setUserPasswords] = useState<Record<string, string>>(
    {},
  );
  const [passwordVisibility, setPasswordVisibility] = useState<
    Record<string, boolean>
  >({});

  // 修改密码表单状态
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [changePasswordUser, setChangePasswordUser] = useState({
    username: '',
    password: '',
  });

  // 采集源权限配置状态
  const [showConfigureApisModal, setShowConfigureApisModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedApis, setSelectedApis] = useState<string[]>([]);
  const [videoSources, setVideoSources] = useState<
    Array<{ key: string; name: string; api?: string; disabled?: boolean }>
  >([]);

  // 获取用户组的详细信息
  const getTagDetails = (tagName: string) => {
    const tag = userSettings.Tags.find((t) => t.name === tagName);
    return tag || null;
  };

  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUser, setNewUser] = useState<User>({
    username: '',
    password: '',
    role: 'user',
    enabled: true,
  });

  // 用户组弹窗状态
  const [showAddUserGroupModal, setShowAddUserGroupModal] = useState(false);
  const [showEditUserGroupModal, setShowEditUserGroupModal] = useState(false);
  const [editingUserGroupIndex, setEditingUserGroupIndex] = useState<
    number | null
  >(null);
  const [newUserGroupName, setNewUserGroupName] = useState('');
  const [showAddUserGroupForm, setShowAddUserGroupForm] = useState(false);

  // 添加用户组并关闭表单
  const handleAddUserGroupWithClose = async () => {
    console.log('handleAddUserGroupWithClose 被调用');
    console.log('newUserGroupName:', newUserGroupName);

    if (!newUserGroupName.trim()) {
      console.log('用户组名称为空，返回');
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('请输入用户组名称');
        });
      }
      return;
    }

    console.log('开始添加用户组...');
    try {
      const newTag = {
        name: newUserGroupName.trim(),
        enabledApis: [],
        videoSources: [],
      };

      const newTags = [...userSettings.Tags, newTag];
      const newSettings = {
        ...userSettings,
        Tags: newTags,
      };

      console.log('添加用户组 - 新的用户组列表:', newTags);
      console.log('添加用户组 - 新的设置:', newSettings);

      // 先更新本地状态
      setUserSettings(newSettings);

      // 使用一个修改版的saveConfig，直接传入newSettings而不是重新获取userSettings
      await saveConfigWithSettings(newSettings);

      console.log('添加用户组 - 保存完成');
      setNewUserGroupName('');
      setShowAddUserGroupForm(false);

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('用户组添加成功');
        });
      }
    } catch (error) {
      console.error('添加用户组失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('添加失败: ' + (error as Error).message);
        });
      }
    }
  };

  // 用户组配置状态

  useEffect(() => {
    loadConfig();
    loadVideoSources();
  }, []);

  const loadVideoSources = async () => {
    try {
      console.log('开始加载视频源列表...');
      const configService = new ConfigService();
      const config = await configService.getConfig();

      console.log('完整配置:', config);
      console.log('SourceConfig:', config.SourceConfig);

      let sources = [];

      // 尝试从SourceConfig获取
      if (config.SourceConfig && Array.isArray(config.SourceConfig)) {
        console.log('从SourceConfig加载视频源:', config.SourceConfig);
        sources = config.SourceConfig.map((source) => ({
          key: source.key,
          name: source.name || source.key,
          api: source.api,
          disabled: source.disabled || false,
        }));
      }

      console.log('处理后的视频源列表:', sources);
      setVideoSources(sources);

      if (sources.length === 0) {
        console.warn('未找到任何视频源配置');
      }
    } catch (error) {
      console.error('获取视频源列表失败:', error);
      // 设置空数组避免界面崩溃
      setVideoSources([]);
    }
  };

  const loadConfig = async () => {
    try {
      console.log('=== loadConfig 开始 ===');
      const configService = new ConfigService();
      const config = await configService.getConfig();

      console.log('获取到的完整配置:', config);
      console.log('UserConfig是否存在:', !!config?.UserConfig);

      if (config?.UserConfig) {
        console.log('原始UserConfig:', config.UserConfig);
        console.log('原始Users数量:', config.UserConfig.Users?.length || 0);
        console.log('原始Tags数量:', Array.isArray(config.UserConfig.Tags) ? config.UserConfig.Tags.length : 0);

        // 先从数据库获取最新的用户列表
        let dbUsers = [];
        try {
          const response = await fetch('/api/admin/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'getUsers',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            dbUsers = data.users || [];
            console.log('从数据库同步的最新用户列表:', dbUsers);
            console.log('数据库用户数量:', dbUsers.length);
          } else {
            console.error('获取用户列表失败:', response.status);
          }
        } catch (error) {
          console.error('从数据库同步用户失败:', error);
        }

        // 使用配置中的用户组数据
        let tagsToUse = Array.isArray(config.UserConfig.Tags) ? config.UserConfig.Tags : [];

        console.log('处理后的用户组列表:', tagsToUse);

        // 如果配置中没有用户数据，优先使用数据库数据
        let usersToUse = config.UserConfig.Users || [];
        if (usersToUse.length === 0 && dbUsers.length > 0) {
          console.log('配置中没有用户数据，使用数据库数据');
          usersToUse = dbUsers;
        }

        // 合并配置中的用户数据和数据库中的用户数据
        const mergedUsers = usersToUse.map((configUser: any) => {
          // 从数据库中查找对应的用户，获取最新的状态信息
          const dbUser = dbUsers.find(
            (u: any) => u.username === configUser.username,
          );

          let finalUser = { ...configUser };

          if (dbUser) {
            // 使用数据库中的最新状态
            finalUser = {
              ...finalUser,
              enabled:
                dbUser.enabled !== undefined ? dbUser.enabled : !dbUser.banned,
              banned: dbUser.banned,
              role: dbUser.role,
              lastLoginAt: dbUser.lastLoginAt,
              createdAt: dbUser.createdAt,
            };
          }

          // 确保用户有tags字段
          let userTags = finalUser.tags || [];

          // 权限继承逻辑：分离视频源权限和特殊功能权限
          let userVideoSources: string[] = [];
          let userSpecialFeatures: string[] = [];

          // 1. 如果用户有独立的enabledApis，分离视频源和特殊功能
          if (finalUser.enabledApis && finalUser.enabledApis.length > 0) {
            const specialFeatures = ['ai-recommend', 'disable-yellow-filter'];
            userVideoSources = finalUser.enabledApis.filter(
              (api) => !specialFeatures.includes(api),
            );
            userSpecialFeatures = finalUser.enabledApis.filter((api) =>
              specialFeatures.includes(api),
            );
                      console.log(`用户 ${finalUser.username} 有独立权限:`, {
                        videoSources: userVideoSources,
                        specialFeatures: userSpecialFeatures,
                      });
                    }
            
                    // 2. 从用户组继承特殊功能权限（仅AI功能）
                    let inheritedSpecialFeatures: string[] = [];
                    userTags.forEach((tagName) => {
                      const tag = tagsToUse.find((t) => t.name === tagName);
                      if (tag && tag.enabledApis) {
                        const specialFeatures = ['ai-recommend'];              const tagSpecialFeatures = tag.enabledApis.filter((api) =>
                specialFeatures.includes(api),
              );
              inheritedSpecialFeatures = [
                ...inheritedSpecialFeatures,
                ...tagSpecialFeatures,
              ];
            }
          });

          // 3. 合并用户的特殊功能权限（用户独立权限 + 用户组继承权限）
          const finalSpecialFeatures = [
            ...new Set([...userSpecialFeatures, ...inheritedSpecialFeatures]),
          ];

          // 4. 构建最终的enabledApis（用户视频源 + 特殊功能）
          finalUser.enabledApis = [
            ...userVideoSources,
            ...finalSpecialFeatures,
          ];

          console.log(`用户 ${finalUser.username} 权限继承结果:`, {
            userVideoSources,
            userSpecialFeatures,
            inheritedSpecialFeatures,
            finalSpecialFeatures,
            finalEnabledApis: finalUser.enabledApis,
          });

          // 保留其他权限相关字段
          finalUser.tags = userTags;
          finalUser.permissionVersion = finalUser.permissionVersion || 0;

          return finalUser;
        });

        const newSettings = {
          Users: mergedUsers,
          Tags: tagsToUse,
          AllowRegister: Boolean(config.UserConfig.AllowRegister),
          RequireApproval: Boolean(config.UserConfig.RequireApproval),
          AutoCleanupInactiveUsers: Boolean(
            config.UserConfig.AutoCleanupInactiveUsers,
          ),
          InactiveUserDays: Number(config.UserConfig.InactiveUserDays) || 7,
          PendingUsers: (config.UserConfig.PendingUsers || []).map(
            (p: any) => ({
              username: p.username,
              encryptedPassword: p.encryptedPassword,
              createdAt: p.createdAt || Date.now(),
              reason: p.reason,
              appliedAt: p.appliedAt || new Date().toISOString(),
            }),
          ),
        };

        console.log('最终用户设置:', newSettings);
        console.log('最终用户数量:', newSettings.Users.length);
        console.log('最终用户组数量:', newSettings.Tags.length);

        setUserSettings(newSettings);
      } else {
        console.error('配置中没有UserConfig');
        // 设置默认空配置
        setUserSettings({
          Users: [],
          Tags: [],
          AllowRegister: false,
          RequireApproval: false,
          AutoCleanupInactiveUsers: false,
          InactiveUserDays: 7,
          PendingUsers: [],
        });
      }
    } catch (error) {
      console.error('加载用户配置失败:', error);
    }
  };

  // 获取用户密码
  const fetchUserPassword = async (username: string) => {
    try {
      const response = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUsername: username,
          action: 'getPassword',
        }),
      });

      if (!response.ok) {
        throw new Error('获取密码失败');
      }

      const data = await response.json();
      setUserPasswords((prev) => ({
        ...prev,
        [username]: data.password || '无密码',
      }));
      // 获取成功后默认显示密码
      setPasswordVisibility((prev) => ({
        ...prev,
        [username]: true,
      }));
    } catch (error) {
      console.error('获取用户密码失败:', error);
      setUserPasswords((prev) => ({
        ...prev,
        [username]: '获取失败',
      }));
    }
  };

  // 切换密码可见性
  const togglePasswordVisibility = (username: string) => {
    // 如果还没有获取密码，先获取
    if (!userPasswords[username]) {
      fetchUserPassword(username);
    } else {
      // 切换显示/隐藏
      setPasswordVisibility((prev) => ({
        ...prev,
        [username]: !prev[username],
      }));
    }
  };

  // 通用用户操作函数
  const handleUserAction = async (
    action: 'ban' | 'unban' | 'setAdmin' | 'cancelAdmin' | 'changePassword',
    targetUsername: string,
    targetPassword?: string,
  ) => {
    try {
      const response = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          targetUsername,
          ...(targetPassword ? { targetPassword } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '操作失败');
      }

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          const actionMessages = {
            ban: '用户已封禁',
            unban: '用户已解封',
            setAdmin: '用户已设为管理员',
            cancelAdmin: '用户已取消管理员权限',
            changePassword: '密码修改成功',
          };
          ToastManager?.success(actionMessages[action]);
        });
      }

      await loadConfig();
    } catch (error) {
      console.error('用户操作失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('操作失败: ' + (error as Error).message);
        });
      }
    }
  };

  // 显示修改密码表单
  const handleShowChangePasswordForm = (username: string) => {
    setChangePasswordUser({ username, password: '' });
    setShowChangePasswordForm(true);
  };

  // 修改密码
  const handleChangePassword = async () => {
    if (!changePasswordUser.username || !changePasswordUser.password) {
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('请输入新密码');
        });
      }
      return;
    }

    await handleUserAction(
      'changePassword',
      changePasswordUser.username,
      changePasswordUser.password,
    );

    setChangePasswordUser({ username: '', password: '' });
    setShowChangePasswordForm(false);
  };

  // 设为管理员
  const handleSetAdmin = async (username: string) => {
    await handleUserAction('setAdmin', username);
  };

  // 取消管理员权限
  const handleRemoveAdmin = async (username: string) => {
    await handleUserAction('cancelAdmin', username);
  };

  // 配置用户采集源权限
  const handleConfigureUserApis = (user: any) => {
    setSelectedUser(user);
    // 确保使用用户独立的enabledApis字段，而不是继承自用户组的权限
    setSelectedApis(user.enabledApis || []);
    setShowConfigureApisModal(true);

    // 调试信息
    console.log(`配置用户 ${user.username} 的采集权限:`, {
      userEnabledApis: user.enabledApis,
      userTags: user.tags,
      // 如果用户没有独立的enabledApis，显示用户组的权限作为参考
      tagPermissions:
        user.tags && user.tags.length > 0
          ? user.tags
              .map((tag) => {
                const tagDetails = userSettings.Tags.find(
                  (t) => t.name === tag,
                );
                return tagDetails ? { [tag]: tagDetails.enabledApis } : null;
              })
              .filter(Boolean)
          : '无用户组',
    });
  };

  // 保存用户API权限
  const handleSaveUserApis = async () => {
    if (!selectedUser) {
      return;
    }

    try {
      console.log(
        `保存用户 ${selectedUser.username} 的采集权限:`,
        selectedApis,
      );

      // 通过API更新用户采集源权限
      const response = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateUserApis',
          targetUsername: selectedUser.username,
          enabledApis: selectedApis,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '更新用户采集源权限失败');
      }

      // 更新本地状态
      const updatedUsers = userSettings.Users.map((u) => {
        if (u.username === selectedUser.username) {
          return {
            ...u,
            enabledApis: selectedApis,
          };
        }
        return u;
      });

      setUserSettings({
        ...userSettings,
        Users: updatedUsers,
      });

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('用户采集源权限已更新');
        });
      }

      setShowConfigureApisModal(false);
      setSelectedUser(null);
      setSelectedApis([]);
    } catch (error) {
      console.error('保存用户API权限失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('保存失败: ' + (error as Error).message);
        });
      }
    }
  };

  const saveConfig = async () => {
    console.log('saveConfig 函数开始执行');
    console.log('saveConfig - 当前 userSettings:', userSettings);

    try {
      // 先获取最新状态
      const currentSettings = userSettings;

      // 获取完整配置
      const configService = new ConfigService();
      const fullConfig = await configService.getConfig();

      // 从数据库获取最新的用户列表，确保不覆盖其他操作产生的数据变更
      let dbUsers = [];
      try {
        const response = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getUsers',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          dbUsers = data.users || [];
          console.log('=== 数据库用户获取调试 ===');
          console.log('API响应数据:', data);
          console.log('数据库用户数量:', dbUsers.length);
          console.log(
            '数据库用户详情:',
            dbUsers.map((u) => ({
              username: u.username,
              role: u.role,
              banned: u.banned,
              enabled: u.enabled,
            })),
          );
          console.log('当前配置中的用户数量:', currentSettings.Users.length);
          console.log(
            '当前配置中的用户:',
            currentSettings.Users.map((u) => ({
              username: u.username,
              role: u.role,
            })),
          );
        }
      } catch (error) {
        console.error('保存前从数据库同步用户失败:', error);
      }

      // 合并用户数据：保留配置中的权限设置，使用数据库中的最新状态
      const mergedUsers = currentSettings.Users.map((configUser: any) => {
        const dbUser = dbUsers.find(
          (u: any) => u.username === configUser.username,
        );

        let finalUser = { ...configUser };

        if (dbUser) {
          // 使用数据库中的状态信息，但保留配置中的 tags 和 enabledApis
          finalUser = {
            ...finalUser,
            enabled:
              dbUser.enabled !== undefined ? dbUser.enabled : !dbUser.banned,
            banned: dbUser.banned,
            role: dbUser.role,
            lastLoginAt: dbUser.lastLoginAt,
            createdAt: dbUser.createdAt,
            tags: configUser.tags || [], // 确保使用配置中的 tags
            enabledApis: configUser.enabledApis || dbUser.enabledApis, // 保留配置中的 enabledApis
          };
        }

        // 保持用户原有的用户组设置，不自动分配
        let userTags = finalUser.tags || [];

        // 权限合并逻辑：分离视频源权限和特殊功能权限
        let userVideoSources: string[] = [];
        let userSpecialFeatures: string[] = [];

        // 1. 如果用户有独立的enabledApis，分离视频源和特殊功能
        if (finalUser.enabledApis && finalUser.enabledApis.length > 0) {
          const specialFeatures = ['ai-recommend'];
          userVideoSources = finalUser.enabledApis.filter(
            (api) => !specialFeatures.includes(api),
          );
          userSpecialFeatures = finalUser.enabledApis.filter((api) =>
            specialFeatures.includes(api),
          );
        }

        // 2. 从用户组继承特殊功能权限（仅AI功能）
        let inheritedSpecialFeatures: string[] = [];
        userTags.forEach((tagName) => {
          const tag = currentSettings.Tags.find((t) => t.name === tagName);
          if (tag && tag.enabledApis) {
            const specialFeatures = ['ai-recommend'];
            const tagSpecialFeatures = tag.enabledApis.filter((api) =>
              specialFeatures.includes(api),
            );
            inheritedSpecialFeatures = [
              ...inheritedSpecialFeatures,
              ...tagSpecialFeatures,
            ];
          }
        });

        // 3. 合并用户的特殊功能权限（用户独立权限 + 用户组继承权限）
        const finalSpecialFeatures = [
          ...new Set([...userSpecialFeatures, ...inheritedSpecialFeatures]),
        ];

        // 4. 构建最终的enabledApis（用户视频源 + 特殊功能）
        finalUser.enabledApis = [...userVideoSources, ...finalSpecialFeatures];

        // 更新用户的tags
        finalUser.tags = userTags;

        console.log(`保存时用户 ${finalUser.username} 权限合并结果:`, {
          userVideoSources,
          userSpecialFeatures,
          inheritedSpecialFeatures,
          finalSpecialFeatures,
          finalEnabledApis: finalUser.enabledApis,
        });

        finalUser.permissionVersion = (finalUser.permissionVersion || 0) + 1;

        return finalUser;
      });

      // 添加数据库中存在但配置中没有的用户（可能是通过其他方式添加的）
      dbUsers.forEach((dbUser: any) => {
        if (
          !currentSettings.Users.find(
            (u: any) => u.username === dbUser.username,
          )
        ) {
          mergedUsers.push(dbUser);
        }
      });

      console.log('保存时合并后的用户数据:', mergedUsers);

      // 创建干净的配置对象，只包含必要的字段
      const cleanConfig: any = {
        UserConfig: {
          ...currentSettings,
          Users: mergedUsers, // 使用合并后的用户数据
        },
        // 保留其他必要的配置字段
        SourceConfig: fullConfig.SourceConfig || [],
        CustomCategories: fullConfig.CustomCategories || [],
        LiveConfig: fullConfig.LiveConfig || [],
        SiteConfig: fullConfig.SiteConfig || {},
        NetDiskConfig: fullConfig.NetDiskConfig || {},
        AIConfig: fullConfig.AIRecommendConfig || {},
        CategoryConfig: Array.isArray(fullConfig.CustomCategories)
          ? fullConfig.CustomCategories
          : [],
      };

      // 保存完整配置
      await configService.saveConfig(cleanConfig);

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('用户配置保存成功');
        });
      }

      // 不重新加载，保持当前状态
    } catch (error) {
      console.error('保存用户配置失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('保存失败: ' + (error as Error).message);
        });
      }
    }
  };

  // 直接使用传入的设置保存配置，不重新获取userSettings
  const saveConfigWithSettings = async (settingsToSave: any) => {
    console.log('saveConfigWithSettings 函数开始执行');
    console.log('saveConfigWithSettings - 要保存的设置:', settingsToSave);

    try {
      // 获取完整配置
      const configService = new ConfigService();
      const fullConfig = await configService.getConfig();

      // 从数据库获取最新的用户列表，确保不覆盖其他操作产生的数据变更
      let dbUsers = [];
      try {
        const response = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'getUsers',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          dbUsers = data.users || [];
          console.log('保存前从数据库同步的最新用户列表:', dbUsers);
        }
      } catch (error) {
        console.error('保存前从数据库同步用户失败:', error);
      }

      // 合并用户数据：保留配置中的权限设置，使用数据库中的最新状态
      const mergedUsers = settingsToSave.Users.map((configUser: any) => {
        // 从数据库中查找对应的用户，获取最新的状态信息
        const dbUser = dbUsers.find(
          (u: any) => u.username === configUser.username,
        );

        if (dbUser) {
          // 保留配置中的权限设置，但使用数据库中的最新状态
          return {
            ...dbUser,
            role: configUser.role || dbUser.role || 'user',
            banned:
              configUser.banned !== undefined
                ? configUser.banned
                : dbUser.banned,
            enabledApis: configUser.enabledApis || dbUser.enabledApis || [],
            tags: configUser.tags || dbUser.tags || [],
          };
        }
        return configUser;
      });

      console.log('保存时合并后的用户数据:', mergedUsers);

      // 创建干净的配置对象，只包含必要的字段
      const cleanConfig: any = {
        UserConfig: {
          ...settingsToSave,
          Users: mergedUsers, // 使用合并后的用户数据
        },
        // 保留其他必要的配置字段
        SourceConfig: fullConfig.SourceConfig || [],
        CustomCategories: fullConfig.CustomCategories || [],
        LiveConfig: fullConfig.LiveConfig || [],
        SiteConfig: fullConfig.SiteConfig || {},
        NetDiskConfig: fullConfig.NetDiskConfig || {},
        AIConfig: fullConfig.AIRecommendConfig || {},
        CategoryConfig: Array.isArray(fullConfig.CustomCategories)
          ? fullConfig.CustomCategories
          : [],
        TVBoxSecurityConfig: fullConfig.TVBoxSecurityConfig || {},
        YellowWords: fullConfig.YellowWords || [],
      };

      // 保存完整配置
      await configService.saveConfig(cleanConfig);

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('用户配置保存成功');
        });
      }

      // 不重新加载，保持当前状态
    } catch (error) {
      console.error('保存用户配置失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('保存失败: ' + (error as Error).message);
        });
      }
    }
  };

  const handleToggleSwitch = async (key: keyof UserSettings, value: any) => {
    try {
      console.log(`切换开关: ${key} = ${value}`);

      // 先更新本地状态
      const newSettings = { ...userSettings, [key]: value };
      setUserSettings(newSettings);

      // 通过API保存配置
      const configService = new ConfigService();
      const fullConfig = await configService.getConfig();

      // 更新UserConfig中的对应字段
      fullConfig.UserConfig = newSettings as any;

      await configService.saveConfig(fullConfig);

      console.log(`开关 ${key} 已更新为: ${value}`);

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('设置已保存');
        });
      }
    } catch (error) {
      console.error('切换开关失败:', error);
      // 如果保存失败，恢复原状态
      setUserSettings(userSettings);

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('保存失败: ' + (error as Error).message);
        });
      }
    }
  };

  const handleApproveUser = async (username: string, index: number) => {
    try {
      const response = await fetch('/api/admin/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approveRegister',
          targetUsername: username,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success(`用户 ${username} 已批准`);
          });
        }
        // 刷新配置
        loadConfig();
      } else {
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error(data.error || '批准失败');
          });
        }
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('批准失败');
        });
      }
    }
  };

  const handleRejectUser = async (username: string, index: number) => {
    try {
      const response = await fetch('/api/admin/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'rejectRegister',
          targetUsername: username,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success(`用户 ${username} 已拒绝`);
          });
        }
        // 刷新配置
        loadConfig();
      } else {
        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.error(data.error || '拒绝失败');
          });
        }
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('拒绝失败');
        });
      }
    }
  };

  // 用户组管理函数
  const handleAddUserGroup = async () => {
    if (!newUserGroupName.trim()) {
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('请输入用户组名称');
        });
      }
      return;
    }

    try {
      const response = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'userGroup',
          groupAction: 'add',
          groupName: newUserGroupName.trim(),
          enabledApis: videoSources.map((source) => source.key),
          disableYellowFilter:
            DefaultPermissions[PermissionType.DISABLE_YELLOW_FILTER],
          aiEnabled: DefaultPermissions[PermissionType.AI_RECOMMEND].length > 0,
          videoSources: videoSources.map((source) => source.key),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '添加用户组失败');
      }

      // 重新加载配置
      await loadConfig();

      setShowAddUserGroupModal(false);
      setNewUserGroupName('');

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('用户组添加成功');
        });
      }
    } catch (error) {
      console.error('添加用户组失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('添加用户组失败: ' + (error as Error).message);
        });
      }
    }
  };

  const handleToggleVideoSource = async (
    index: number,
    sourceKey: string,
    checked: boolean,
  ) => {
    try {
      const newTags = [...userSettings.Tags];
      const tag = { ...newTags[index] };
      const apis = new Set(tag.enabledApis || []);

      if (checked) {
        apis.add(sourceKey);
      } else {
        apis.delete(sourceKey);
      }

      tag.enabledApis = Array.from(apis);

      // 同步更新videoSources字段
      const currentVideoSources = tag.videoSources || [];
      if (checked && !currentVideoSources.includes(sourceKey)) {
        tag.videoSources = [...currentVideoSources, sourceKey];
      } else if (!checked) {
        tag.videoSources = currentVideoSources.filter((s) => s !== sourceKey);
      }

      newTags[index] = tag;

      const newSettings = {
        ...userSettings,
        Tags: newTags,
      };

      setUserSettings(newSettings);
      await saveConfig();
    } catch (error) {
      console.error('切换视频源失败:', error);
    }
  };

  const handleToggleSpecialFeature = async (
    index: number,
    permissionType: string,
    checked: boolean,
  ) => {
    try {
      console.log(
        `切换特殊功能: 用户组索引=${index}, 类型=${permissionType}, 值=${checked}`,
      );

      const tag = userSettings.Tags[index];
      if (!tag) return;

      // 先更新本地状态
      const newTags = [...userSettings.Tags];
      const updatedTag = { ...newTags[index] };

      // 确保enabledApis数组存在
      if (!updatedTag.enabledApis) {
        updatedTag.enabledApis = [];
      }

      // 将字符串转换为枚举值进行比较
      const permissionTypeKey = permissionType as keyof typeof PermissionType;

      // 处理不同类型的权限
      if (
        permissionType === 'ai-recommend' ||
        permissionType === PermissionType.AI_RECOMMEND
      ) {
        updatedTag.aiEnabled = checked;
        // 更新enabledApis
        if (checked && !updatedTag.enabledApis.includes('ai-recommend')) {
          updatedTag.enabledApis.push('ai-recommend');
        } else if (!checked) {
          updatedTag.enabledApis = updatedTag.enabledApis.filter(
            (api) => api !== 'ai-recommend',
          );
        }
      } else if (
        permissionType === 'disable-yellow-filter' ||
        permissionType === PermissionType.DISABLE_YELLOW_FILTER
      ) {
        updatedTag.disableYellowFilter = checked;
        // 更新enabledApis
        if (
          checked &&
          !updatedTag.enabledApis.includes('disable-yellow-filter')
        ) {
          updatedTag.enabledApis.push('disable-yellow-filter');
        } else if (!checked) {
          updatedTag.enabledApis = updatedTag.enabledApis.filter(
            (api) => api !== 'disable-yellow-filter',
          );
        }
      } else {
        console.warn('未知的权限类型:', permissionType);
        return;
      }

      newTags[index] = updatedTag;
      const newSettings = {
        ...userSettings,
        Tags: newTags,
      };

      // 通过API更新用户组
      try {
        const response = await fetch('/api/admin/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'userGroup',
            groupAction: 'edit',
            groupName: tag.name,
            enabledApis: updatedTag.enabledApis,
            // 传递其他字段以保持完整
            disableYellowFilter: updatedTag.disableYellowFilter,
            aiEnabled: updatedTag.aiEnabled,
            videoSources: updatedTag.videoSources,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || '更新用户组失败');
        }

        // 更新本地状态
        setUserSettings(newSettings);

        console.log(
          `用户组 ${tag.name} 的 ${permissionType} 已通过API更新为:`,
          checked,
        );

        if (typeof window !== 'undefined') {
          import('@/components/Toast').then(({ ToastManager }) => {
            ToastManager?.success('用户组已更新');
          });
        }
      } catch (error) {
        console.error('通过API更新用户组失败:', error);
        // 如果API失败，回退到直接保存配置
        setUserSettings(newSettings);
        await saveConfig();
      }
    } catch (error) {
      console.error('切换特殊功能失败:', error);
    }
  };

  const handleSaveUserGroup = async () => {
    if (editingUserGroupIndex === null) return;

    try {
      const tag = userSettings.Tags[editingUserGroupIndex];
      if (!tag) return;

      console.log(`保存用户组 ${tag.name} 的采集源:`, selectedApis);

      // 更新enabledApis以保持兼容性（视频源 + 现有功能权限）
      const enabledApis = [...selectedApis];
      if (tag.aiEnabled && !enabledApis.includes('ai-recommend')) {
        enabledApis.push('ai-recommend');
      }
      if (
        tag.disableYellowFilter &&
        !enabledApis.includes('disable-yellow-filter')
      ) {
        enabledApis.push('disable-yellow-filter');
      }

      // 通过API更新用户组
      const response = await fetch('/api/admin/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'userGroup',
          groupAction: 'edit',
          groupName: tag.name,
          enabledApis: enabledApis,
          videoSources: selectedApis,
          // 保持其他字段不变
          disableYellowFilter: tag.disableYellowFilter,
          aiEnabled: tag.aiEnabled,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || '保存用户组失败');
      }

      // 重新加载配置
      await loadConfig();

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('采集源配置已保存');
        });
      }

      setShowEditUserGroupModal(false);
      setEditingUserGroupIndex(null);
    } catch (error) {
      console.error('保存用户组失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('保存失败: ' + (error as Error).message);
        });
      }
    }
  };

  // 提取域名
  const extractDomain = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  };

  const handleUpdateUserGroup = (index: number, field: string, value: any) => {
    setUserSettings((prev) => {
      const newTags = [...prev.Tags];
      newTags[index] = {
        ...newTags[index],
        [field]: value,
      };
      const newSettings = {
        ...prev,
        Tags: newTags,
      };
      setTimeout(() => saveConfig(), 100);
      return newSettings;
    });
  };

  const handleToggleUserGroupPermission = (
    index: number,
    permissionType: PermissionType,
    value: any,
  ) => {
    setUserSettings((prev) => {
      const newTags = [...prev.Tags];
      const tag = { ...newTags[index] };

      switch (permissionType) {
        case PermissionType.DISABLE_YELLOW_FILTER:
          tag.disableYellowFilter = value;
          break;
        case PermissionType.AI_RECOMMEND:
          tag.aiEnabled = value;
          break;
        case PermissionType.VIDEO_SOURCE:
          tag.videoSources = value;
          break;
      }

      newTags[index] = tag;
      const newSettings = {
        ...prev,
        Tags: newTags,
      };
      setTimeout(() => saveConfig(), 100);
      return newSettings;
    });
  };

  const handleDeleteUserGroup = async (index: number) => {
    const groupName = userSettings.Tags[index].name;
    if (!confirm(`确定要删除用户组 "${groupName}" 吗？`)) {
      return;
    }

    try {
      const newTags = userSettings.Tags.filter((_, i) => i !== index);
      const newSettings = {
        ...userSettings,
        Tags: newTags,
      };

      setUserSettings(newSettings);
      await saveConfig();

      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.success('用户组删除成功');
        });
      }
    } catch (error) {
      console.error('删除用户组失败:', error);
      if (typeof window !== 'undefined') {
        import('@/components/Toast').then(({ ToastManager }) => {
          ToastManager?.error('删除失败: ' + (error as Error).message);
        });
      }
    }
  };

  // 确保userSettings已初始化
  if (
    !userSettings ||
    userSettings === null ||
    typeof userSettings !== 'object'
  ) {
    return (
      <CollapsibleTab
        title='用户配置'
        theme='blue'
        icon={
          <svg
            className='w-5 h-5 text-blue-500'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
            />
          </svg>
        }
        defaultCollapsed
      >
        <div className='p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg'>
          <p className='text-yellow-600 dark:text-yellow-400'>
            正在加载用户配置...
          </p>
        </div>
      </CollapsibleTab>
    );
  }

  return (
    <CollapsibleTab
      title='用户配置'
      theme='blue'
      icon={
        <svg
          className='w-5 h-5 text-blue-500'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
          />
        </svg>
      }
      defaultCollapsed
    >
      <div className='space-y-6'>
        {/* 统计信息 */}
        <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
          <div className='bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <span className='text-blue-500 mr-3 text-2xl'>👥</span>
                <div>
                  <div className='text-2xl font-bold text-blue-600'>
                    {userSettings.Users.length}
                  </div>
                  <div className='text-sm text-gray-500'>总用户数</div>
                </div>
              </div>
            </div>
          </div>
          <div className='bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <ShieldCheck className='text-green-500 mr-3' size={24} />
                <div>
                  <div className='text-2xl font-bold text-green-600'>
                    {
                      userSettings.Users.filter((u) =>
                        u.enabled !== undefined ? u.enabled : !u.banned,
                      ).length
                    }
                  </div>
                  <div className='text-sm text-gray-500'>已启用</div>
                </div>
              </div>
            </div>
          </div>
          <div className='bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <ShieldX className='text-red-500 mr-3' size={24} />
                <div>
                  <div className='text-2xl font-bold text-red-600'>
                    {
                      userSettings.Users.filter((u) =>
                        u.enabled === undefined ? u.banned : !u.enabled,
                      ).length
                    }
                  </div>
                  <div className='text-sm text-gray-500'>已禁用</div>
                </div>
              </div>
            </div>
          </div>
          <div className='bg-blue-100 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center'>
                <Clock className='text-orange-500 mr-3' size={24} />
                <div>
                  <div className='text-2xl font-bold text-orange-600'>
                    {userSettings.PendingUsers.length}
                  </div>
                  <div className='text-sm text-gray-500'>待审批</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* 待审批用户列表 */}{' '}
        {userSettings.PendingUsers.length > 0 && (
          <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border rounded-lg p-6'>
            <h3 className='text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100'>
              待审批用户
            </h3>
            <div className='space-y-2'>
              {userSettings.PendingUsers.map((pendingUser, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'
                >
                  <div>
                    <span className='font-medium text-gray-900 dark:text-gray-100'>
                      {pendingUser.username}
                    </span>
                    <span className='ml-2 text-xs text-gray-500 dark:text-gray-400'>
                      {new Date(pendingUser.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className='flex gap-2'>
                    <button
                      onClick={() =>
                        handleApproveUser(pendingUser.username, index)
                      }
                      className='px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700'
                    >
                      批准
                    </button>
                    <button
                      onClick={() =>
                        handleRejectUser(pendingUser.username, index)
                      }
                      className='px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700'
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 用户注册设置 */}
        <div className='bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6'>
          <h3 className='text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100'>
            用户注册设置
          </h3>
          <div className='space-y-4'>
            {/* 允许用户注册 */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  允许用户注册
                </label>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  开放后新用户可以自行注册账户
                </p>
              </div>
              <button
                type='button'
                onClick={() =>
                  handleToggleSwitch(
                    'AllowRegister',
                    !userSettings.AllowRegister,
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  userSettings.AllowRegister
                    ? 'bg-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    userSettings.AllowRegister
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 需要审批 */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  需要审批
                </label>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  开启后新注册用户需要管理员审批
                </p>
              </div>
              <button
                type='button'
                onClick={() =>
                  handleToggleSwitch(
                    'RequireApproval',
                    !userSettings.RequireApproval,
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  userSettings.RequireApproval
                    ? 'bg-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    userSettings.RequireApproval
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 自动清理非活跃用户 */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  自动清理非活跃用户
                </label>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  自动禁用超过指定天数未登录的用户
                </p>
              </div>
              <button
                type='button'
                onClick={() =>
                  handleToggleSwitch(
                    'AutoCleanupInactiveUsers',
                    !userSettings.AutoCleanupInactiveUsers,
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  userSettings.AutoCleanupInactiveUsers
                    ? 'bg-green-600'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    userSettings.AutoCleanupInactiveUsers
                      ? 'translate-x-6'
                      : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 非活跃天数 */}
            <div className='flex items-center justify-between'>
              <div>
                <label className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  非活跃天数
                </label>
                <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                  超过此天数未登录的用户将被禁用
                </p>
              </div>
              <input
                type='number'
                min='1'
                max='365'
                value={userSettings.InactiveUserDays}
                onChange={(e) =>
                  handleToggleSwitch('InactiveUserDays', Number(e.target.value))
                }
                className='w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
              />
            </div>
          </div>
        </div>
        {/* 用户组管理 */}
        <div className='bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              用户组管理
            </h3>
            <button
              onClick={() => setShowAddUserGroupForm(!showAddUserGroupForm)}
              className='flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
            >
              <UserPlus size={16} />
              <span>添加用户组</span>
            </button>
          </div>

          {showAddUserGroupForm && (
            <div className='mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border'>
              <div className='flex items-center justify-between mb-3'>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  添加新用户组
                </h4>
                <button
                  onClick={() => {
                    setShowAddUserGroupForm(false);
                    setNewUserGroupName('');
                  }}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                >
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
              <div className='flex space-x-3'>
                <input
                  type='text'
                  placeholder='用户组名称'
                  value={newUserGroupName}
                  onChange={(e) => setNewUserGroupName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddUserGroupWithClose();
                    }
                  }}
                  className='flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
                <button
                  onClick={() => {
                    console.log('保存按钮被点击');
                    handleAddUserGroupWithClose();
                  }}
                  className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
                >
                  保存
                </button>
              </div>
            </div>
          )}

          {/* 用户组列表 */}
          <div className='border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden'>
            <table className='min-w-full'>
              <thead className='bg-gray-50 dark:bg-gray-900'>
                <tr>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    用户组名称
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    可用视频源
                  </th>
                  <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    特殊功能
                  </th>
                  <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-200 dark:divide-gray-700'>
                {userSettings.Tags.map((tag, index) => (
                  <tr
                    key={index}
                    className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                  >
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span className='font-medium text-gray-900 dark:text-gray-100'>
                        {tag.name}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span className='text-sm text-gray-900 dark:text-gray-100'>
                        {(() => {
                          // 优先使用videoSources字段，如果没有则从enabledApis中过滤
                          const specialFeatures = [
                            'ai-recommend',
                            'disable-yellow-filter',
                          ];
                          const videoSources =
                            tag.videoSources ||
                            (tag.enabledApis || []).filter(
                              (api) => !specialFeatures.includes(api),
                            );
                          return videoSources.length > 0
                            ? `${videoSources.length} 个源`
                            : '无配置';
                        })()}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='flex flex-wrap gap-2'>
                        {/* AI推荐功能开关 */}
                        <div className='inline-flex items-center space-x-1'>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              tag.aiEnabled
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            🤖 AI
                          </span>
                          <button
                            onClick={() =>
                              handleToggleSpecialFeature(
                                index,
                                'ai-recommend',
                                !tag.aiEnabled,
                              )
                            }
                            className={`w-4 h-4 rounded-full transition-colors ${
                              tag.aiEnabled
                                ? 'bg-blue-500 hover:bg-blue-600'
                                : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'
                            }`}
                            title={tag.aiEnabled ? '关闭AI推荐' : '开启AI推荐'}
                          >
                            {tag.aiEnabled && (
                              <svg
                                className='w-3 h-3 text-white mx-auto'
                                fill='currentColor'
                                viewBox='0 0 20 20'
                              >
                                <path
                                  fillRule='evenodd'
                                  d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                  clipRule='evenodd'
                                />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* 18+内容过滤开关 */}
                        <div className='inline-flex items-center space-x-1'>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              tag.disableYellowFilter
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}
                          >
                            🚫 18+
                          </span>
                          <button
                            onClick={() =>
                              handleToggleSpecialFeature(
                                index,
                                'disable-yellow-filter',
                                !tag.disableYellowFilter,
                              )
                            }
                            className={`w-4 h-4 rounded-full transition-colors ${
                              tag.disableYellowFilter
                                ? 'bg-yellow-500 hover:bg-yellow-600'
                                : 'bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500'
                            }`}
                            title={
                              tag.disableYellowFilter
                                ? '关闭18+过滤'
                                : '开启18+过滤'
                            }
                          >
                            {tag.disableYellowFilter && (
                              <svg
                                className='w-3 h-3 text-white mx-auto'
                                fill='currentColor'
                                viewBox='0 0 20 20'
                              >
                                <path
                                  fillRule='evenodd'
                                  d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
                                  clipRule='evenodd'
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-right'>
                      <div className='flex space-x-2'>
                        <button
                          onClick={() => {
                            setEditingUserGroupIndex(index);
                            // 初始化采集源选择：只包含视频源，排除特殊功能
                            const tag = userSettings.Tags[index];
                            const specialFeatures = [
                              'ai-recommend',
                              'disable-yellow-filter',
                            ];
                            const videoSourcesOnly = (
                              tag.videoSources ||
                              tag.enabledApis ||
                              []
                            ).filter((api) => !specialFeatures.includes(api));
                            setSelectedApis(videoSourcesOnly);
                            setShowEditUserGroupModal(true);
                          }}
                          className='px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors'
                        >
                          采集源
                        </button>
                        <button
                          onClick={() => handleDeleteUserGroup(index)}
                          className='px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors'
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {userSettings.Tags.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className='px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400'
                    >
                      暂无用户组，请添加用户组来管理用户权限
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* 添加用户组弹窗 */}
        {showAddUserGroupModal && (
          <div className='fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'>
            <div className='bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto'>
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                    添加新用户组
                  </h3>
                  <button
                    onClick={() => setShowAddUserGroupModal(false)}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className='space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
                      用户组名称
                    </label>
                    <input
                      type='text'
                      value={newUserGroupName}
                      onChange={(e) => setNewUserGroupName(e.target.value)}
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      placeholder='输入用户组名称'
                    />
                  </div>
                </div>

                <div className='flex justify-end space-x-3'>
                  <button
                    onClick={() => setShowAddUserGroupModal(false)}
                    className='px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddUserGroup}
                    className='px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
                  >
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* 编辑用户组弹窗 - 只配置视频源 */}
        {showEditUserGroupModal && editingUserGroupIndex !== null && (
          <div className='fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40'>
            <div className='bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-2xl w-[90vw] max-w-2xl max-h-[85vh] overflow-hidden border border-gray-200/50 dark:border-gray-700/50'>
              <div className='p-6'>
                <div className='flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4'>
                  <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center'>
                    <span className='mr-2'>⚙️</span>
                    配置采集源 -{' '}
                    {userSettings.Tags[editingUserGroupIndex]?.name}
                  </h3>
                  <button
                    onClick={() => {
                      setShowEditUserGroupModal(false);
                      setEditingUserGroupIndex(null);
                      setSelectedApis([]);
                    }}
                    className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className='max-h-[60vh] overflow-y-auto pr-2'>
                  {/* 采集源选择 */}
                  <div className='mb-6'>
                    <div className='flex items-center justify-between mb-4'>
                      <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center'>
                        <span className='mr-2'>📺</span>
                        选择可用的采集源
                      </h4>
                      <div className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400'>
                        <button
                          onClick={() =>
                            setSelectedApis(videoSources.map((s) => s.key))
                          }
                          className='px-3 py-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors'
                        >
                          全选
                        </button>
                        <button
                          onClick={() => setSelectedApis([])}
                          className='px-3 py-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors'
                        >
                          清空
                        </button>
                      </div>
                    </div>
                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'>
                      {videoSources.map((source) => (
                        <label
                          key={source.key}
                          className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                            selectedApis.includes(source.key)
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                              : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                          }`}
                        >
                          <input
                            type='checkbox'
                            checked={selectedApis.includes(source.key)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedApis([...selectedApis, source.key]);
                              } else {
                                setSelectedApis(
                                  selectedApis.filter(
                                    (api) => api !== source.key,
                                  ),
                                );
                              }
                            }}
                            className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                          />
                          <div className='flex-1 min-w-0'>
                            <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                              {source.name}
                            </div>
                            <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                              {source.api}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 统计信息 */}
                  <div className='flex items-center justify-between mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                    <div className='text-sm text-gray-600 dark:text-gray-400 flex items-center'>
                      已选择：
                      <span className='ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full font-medium text-xs'>
                        {selectedApis.length} 个采集源
                      </span>
                    </div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className='flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 pt-4'>
                  <button
                    onClick={() => {
                      setShowEditUserGroupModal(false);
                      setEditingUserGroupIndex(null);
                      setSelectedApis([]);
                    }}
                    className='px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveUserGroup}
                    className='px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105'
                  >
                    保存配置
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* 用户列表 */}
        <div className='bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
              用户列表
            </h3>
            <button
              onClick={() => setShowAddUserForm(!showAddUserForm)}
              className='flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
            >
              <UserPlus size={16} />
              <span>添加用户</span>
            </button>
          </div>

          {showAddUserForm && (
            <div className='mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border'>
              <div className='flex items-center justify-between mb-3'>
                <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
                  添加新用户
                </h4>
                <button
                  onClick={() => {
                    setShowAddUserForm(false);
                    setNewUser({
                      username: '',
                      password: '',
                      role: 'user',
                      enabled: true,
                    });
                  }}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                >
                  <svg
                    className='w-5 h-5'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M6 18L18 6M6 6l12 12'
                    />
                  </svg>
                </button>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
                <input
                  type='text'
                  placeholder='用户名'
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
                <input
                  type='password'
                  placeholder='密码'
                  value={newUser.password}
                  onChange={(e) =>
                    setNewUser({ ...newUser, password: e.target.value })
                  }
                  className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
                <button
                  onClick={async () => {
                    if (!newUser.username.trim() || !newUser.password.trim()) {
                      if (typeof window !== 'undefined') {
                        import('@/components/Toast').then(
                          ({ ToastManager }) => {
                            ToastManager?.error('请填写用户名和密码');
                          },
                        );
                      }
                      return;
                    }

                    try {
                      console.log(`添加用户: ${newUser.username}`);

                      // 通过API添加用户
                      const response = await fetch('/api/admin/user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'add',
                          targetUsername: newUser.username.trim(),
                          targetPassword: newUser.password,
                          userGroup: '默认', // 新用户默认分配到默认用户组
                        }),
                      });

                      if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(data.error || '添加用户失败');
                      }

                      // 重新加载配置
                      await loadConfig();

                      if (typeof window !== 'undefined') {
                        import('@/components/Toast').then(
                          ({ ToastManager }) => {
                            ToastManager?.success('用户添加成功');
                          },
                        );
                      }

                      setNewUser({
                        username: '',
                        password: '',
                        role: 'user',
                        enabled: true,
                      });
                      setShowAddUserForm(false);
                    } catch (error) {
                      console.error('添加用户失败:', error);
                      if (typeof window !== 'undefined') {
                        import('@/components/Toast').then(
                          ({ ToastManager }) => {
                            ToastManager?.error(
                              '添加失败: ' + (error as Error).message,
                            );
                          },
                        );
                      }
                    }
                  }}
                  className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors'
                >
                  添加
                </button>
              </div>
            </div>
          )}

          <div className='overflow-x-auto'>
            <table className='w-full'>
              <thead>
                <tr className='border-b dark:border-gray-700'>
                  <th className='text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300'>
                    用户信息
                  </th>
                  <th className='text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300'>
                    状态
                  </th>
                  <th className='text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300'>
                    用户组
                  </th>
                  <th className='text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300'>
                    采集源权限
                  </th>
                  <th className='text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {userSettings.Users.map((user) => {
                  // 处理状态：优先使用 enabled，如果不存在则根据 banned 判断
                  const isEnabled =
                    user.enabled !== undefined ? user.enabled : !user.banned;

                  return (
                    <tr
                      key={user.username}
                      className='border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'
                    >
                      {/* 用户信息列 */}
                      <td className='py-4 px-4'>
                        <div className='flex items-start space-x-3'>
                          <UserAvatar username={user.username} size='md' />
                          <div className='flex-1 min-w-0'>
                            {/* 用户名和角色 */}
                            <div className='flex items-center space-x-2 mb-2'>
                              <div className='font-medium text-gray-900 dark:text-gray-100 truncate'>
                                {user.username}
                              </div>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
                                  user.role === 'owner'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                    : user.role === 'admin'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {user.role === 'owner'
                                  ? '站长'
                                  : user.role === 'admin'
                                    ? '管理员'
                                    : '用户'}
                              </span>
                            </div>

                            {/* 时间信息 */}
                            <div className='text-xs text-gray-500 dark:text-gray-400 space-y-1'>
                              <div className='flex items-center space-x-1'>
                                <Clock className='w-3 h-3' />
                                <span>
                                  注册:{' '}
                                  {user.createdAt
                                    ? new Date(
                                        user.createdAt,
                                      ).toLocaleDateString()
                                    : '未知'}
                                </span>
                              </div>
                              <div className='flex items-center space-x-1'>
                                <Check className='w-3 h-3' />
                                <span>
                                  登录:{' '}
                                  {user.lastLoginAt
                                    ? new Date(
                                        user.lastLoginAt,
                                      ).toLocaleDateString()
                                    : '从未'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 状态列 */}
                      <td className='py-4 px-4'>
                        <div className='space-y-3'>
                          {/* 账户状态 */}
                          <button
                            onClick={async () => {
                              try {
                                // 通过配置路径修改用户状态
                                const updatedUsers = userSettings.Users.map(
                                  (u) => {
                                    if (u.username === user.username) {
                                      return {
                                        ...u,
                                        enabled: !isEnabled,
                                        banned: isEnabled, // 与enabled相反
                                        permissionVersion:
                                          (u.permissionVersion || 0) + 1,
                                      };
                                    }
                                    return u;
                                  },
                                );

                                const updatedSettings = {
                                  ...userSettings,
                                  Users: updatedUsers as User[],
                                };

                                setUserSettings(
                                  updatedSettings as UserSettings,
                                );

                                // 保存配置
                                await saveConfig();

                                if (typeof window !== 'undefined') {
                                  import('@/components/Toast').then(
                                    ({ ToastManager }) => {
                                      ToastManager?.success(
                                        isEnabled ? '用户已禁用' : '用户已启用',
                                      );
                                    },
                                  );
                                }
                              } catch (error) {
                                console.error('操作失败:', error);
                                if (typeof window !== 'undefined') {
                                  import('@/components/Toast').then(
                                    ({ ToastManager }) => {
                                      ToastManager?.error(
                                        '操作失败: ' + (error as Error).message,
                                      );
                                    },
                                  );
                                }
                              }
                            }}
                            className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              isEnabled
                                ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50'
                                : 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50'
                            }`}
                          >
                            {isEnabled ? (
                              <ShieldCheck size={12} />
                            ) : (
                              <ShieldX size={12} />
                            )}
                            <span>{isEnabled ? '启用' : '禁用'}</span>
                          </button>

                          {/* 密码信息 */}
                          {user.role !== 'owner' && (
                            <div className='flex items-center space-x-2'>
                              <span className='text-xs text-gray-500 dark:text-gray-400 w-8'>
                                密码:
                              </span>
                              <div className='flex items-center space-x-1 flex-1'>
                                <span className='text-xs text-gray-900 dark:text-gray-100 font-mono max-w-[80px] truncate'>
                                  {passwordVisibility[user.username] &&
                                  userPasswords[user.username]
                                    ? userPasswords[user.username]
                                    : '••••••••'}
                                </span>
                                <button
                                  onClick={() =>
                                    togglePasswordVisibility(user.username)
                                  }
                                  className='text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors'
                                  title={
                                    passwordVisibility[user.username]
                                      ? '隐藏密码'
                                      : '显示密码'
                                  }
                                >
                                  <Eye size={12} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 采集源权限列 */}
                      <td className='py-4 px-4'>
                        <div className='text-center'>
                          <div className='mb-2'>
                            {(() => {
                              const specialFeatures = [
                                'ai-recommend',
                                'disable-yellow-filter',
                              ];
                              const videoSourceCount = (
                                user.enabledApis || []
                              ).filter(
                                (api) => !specialFeatures.includes(api),
                              ).length;

                              return (
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    videoSourceCount === 0
                                      ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                  }`}
                                >
                                  <Video size={12} className='mr-1' />
                                  {videoSourceCount === 0
                                    ? '无配置'
                                    : `${videoSourceCount} 个采集源`}
                                </span>
                              );
                            })()}
                          </div>
                          <div className='flex flex-wrap gap-1 justify-center'>
                            {(user.enabledApis || []).includes(
                              'ai-recommend',
                            ) && (
                              <span className='inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'>
                                <Brain size={10} className='mr-1' />
                                AI
                              </span>
                            )}
                            {(user.enabledApis || []).includes(
                              'disable-yellow-filter',
                            ) && (
                              <span className='inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'>
                                <Eye size={10} className='mr-1' />
                                18+
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 用户组列 */}
                      <td className='py-4 px-4'>
                        <select
                          value={
                            user.tags && user.tags.length > 0
                              ? user.tags[0]
                              : undefined
                          }
                          onChange={async (e) => {
                            const newTag = e.target.value;

                            try {
                              // 更新用户组
                              const updatedUsers = userSettings.Users.map(
                                (u) => {
                                  if (u.username === user.username) {
                                    return {
                                      ...u,
                                      tags: newTag ? [newTag] : [],
                                      permissionVersion:
                                        (u.permissionVersion || 0) + 1,
                                    };
                                  }
                                  return u;
                                },
                              );

                              const newSettings = {
                                ...userSettings,
                                Users: updatedUsers,
                              };

                              // 直接使用 saveConfigWithSettings 避免重新获取数据
                              await saveConfigWithSettings(newSettings);
                              setUserSettings(newSettings);

                              if (typeof window !== 'undefined') {
                                import('@/components/Toast').then(
                                  ({ ToastManager }) => {
                                    ToastManager?.success('用户组已更新');
                                  },
                                );
                              }
                            } catch (error) {
                              console.error('更新用户组失败:', error);
                              if (typeof window !== 'undefined') {
                                import('@/components/Toast').then(
                                  ({ ToastManager }) => {
                                    ToastManager?.error('更新用户组失败');
                                  },
                                );
                              }
                            }
                          }}
                          className='px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full'
                        >
                          {userSettings.Tags.map((tag, index) => (
                            <option key={index} value={tag.name}>
                              {tag.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* 操作列 */}
                      <td className='py-4 px-4'>
                        <div className='flex flex-col gap-2'>
                          {/* 主要操作 */}
                          <div className='flex flex-wrap gap-2 justify-center'>
                            {/* 权限控制逻辑 */}
                            {(() => {
                              // 修改密码权限
                              const canChangePassword =
                                user.role !== 'owner' &&
                                (currentUser?.role === 'owner' ||
                                  (currentUser?.role === 'admin' &&
                                    (user.role === 'user' ||
                                      user.username ===
                                        currentUser?.username)));

                              // 操作权限
                              const canOperate =
                                currentUser?.role === 'owner' ||
                                (currentUser?.role === 'admin' &&
                                  user.role === 'user');

                              return (
                                <>
                                  {/* 配置采集源权限按钮 */}
                                  {(currentUser?.role === 'owner' ||
                                    (currentUser?.role === 'admin' &&
                                      (user.role === 'user' ||
                                        user.username ===
                                          currentUser?.username))) && (
                                    <button
                                      onClick={() =>
                                        handleConfigureUserApis(user)
                                      }
                                      className='px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center'
                                    >
                                      <span className='mr-1'>⚙️</span>
                                      采集权限
                                    </button>
                                  )}

                                  {/* 修改密码按钮 */}
                                  {canChangePassword && (
                                    <button
                                      onClick={() =>
                                        handleShowChangePasswordForm(
                                          user.username,
                                        )
                                      }
                                      className='px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
                                    >
                                      修改密码
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>

                          {/* 高级操作 */}
                          {(() => {
                            const canOperate = currentUser?.role === 'owner';

                            if (!canOperate) return null;

                            return (
                              <div className='flex flex-wrap gap-1 justify-center'>
                                {/* 角色管理 */}
                                {user.role === 'user' && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        // 通过配置路径修改用户角色
                                        const updatedUsers =
                                          userSettings.Users.map((u) => {
                                            if (u.username === user.username) {
                                              return {
                                                ...u,
                                                role: 'admin' as
                                                  | 'owner'
                                                  | 'admin'
                                                  | 'user',
                                                permissionVersion:
                                                  (u.permissionVersion || 0) +
                                                  1,
                                              };
                                            }
                                            return u;
                                          });

                                        const updatedSettings = {
                                          ...userSettings,
                                          Users: updatedUsers,
                                        };

                                        // 保存配置
                                        await saveConfigWithSettings(
                                          updatedSettings,
                                        );
                                        setUserSettings(updatedSettings);

                                        if (typeof window !== 'undefined') {
                                          import('@/components/Toast').then(
                                            ({ ToastManager }) => {
                                              ToastManager?.success(
                                                '用户已设为管理员',
                                              );
                                            },
                                          );
                                        }
                                      } catch (error) {
                                        console.error('设为管理员失败:', error);
                                        if (typeof window !== 'undefined') {
                                          import('@/components/Toast').then(
                                            ({ ToastManager }) => {
                                              ToastManager?.error(
                                                '操作失败: ' +
                                                  (error as Error).message,
                                              );
                                            },
                                          );
                                        }
                                      }
                                    }}
                                    className='px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors'
                                  >
                                    设为管理
                                  </button>
                                )}
                                {user.role === 'admin' && (
                                  <button
                                    onClick={async () => {
                                      try {
                                        // 通过配置路径修改用户角色
                                        const updatedUsers =
                                          userSettings.Users.map((u) => {
                                            if (u.username === user.username) {
                                              return {
                                                ...u,
                                                role: 'user' as
                                                  | 'owner'
                                                  | 'admin'
                                                  | 'user',
                                                permissionVersion:
                                                  (u.permissionVersion || 0) +
                                                  1,
                                              };
                                            }
                                            return u;
                                          });

                                        const updatedSettings = {
                                          ...userSettings,
                                          Users: updatedUsers,
                                        };

                                        // 保存配置
                                        await saveConfigWithSettings(
                                          updatedSettings,
                                        );
                                        setUserSettings(updatedSettings);

                                        if (typeof window !== 'undefined') {
                                          import('@/components/Toast').then(
                                            ({ ToastManager }) => {
                                              ToastManager?.success(
                                                '管理员权限已取消',
                                              );
                                            },
                                          );
                                        }
                                      } catch (error) {
                                        console.error('取消管理员失败:', error);
                                        if (typeof window !== 'undefined') {
                                          import('@/components/Toast').then(
                                            ({ ToastManager }) => {
                                              ToastManager?.error(
                                                '操作失败: ' +
                                                  (error as Error).message,
                                              );
                                            },
                                          );
                                        }
                                      }
                                    }}
                                    className='px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors'
                                  >
                                    取消管理
                                  </button>
                                )}

                                {/* 删除按钮 */}
                                <button
                                  onClick={async () => {
                                    if (
                                      !confirm(
                                        `确定要删除用户 "${user.username}" 吗？`,
                                      )
                                    ) {
                                      return;
                                    }

                                    try {
                                      // 直接通过API删除用户
                                      const response = await fetch(
                                        '/api/admin/user',
                                        {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                          },
                                          body: JSON.stringify({
                                            targetUsername: user.username,
                                            action: 'deleteUser',
                                          }),
                                        },
                                      );

                                      if (!response.ok) {
                                        throw new Error('删除用户失败');
                                      }

                                      // 从本地状态中移除用户
                                      const updatedUsers =
                                        userSettings.Users.filter(
                                          (u) => u.username !== user.username,
                                        );

                                      const updatedSettings = {
                                        ...userSettings,
                                        Users: updatedUsers,
                                      };

                                      setUserSettings(updatedSettings);

                                      if (typeof window !== 'undefined') {
                                        import('@/components/Toast').then(
                                          ({ ToastManager }) => {
                                            ToastManager?.success('用户已删除');
                                          },
                                        );
                                      }

                                      // 重新加载配置确保同步
                                      await loadConfig();
                                    } catch (error) {
                                      console.error('删除用户失败:', error);
                                      if (typeof window !== 'undefined') {
                                        import('@/components/Toast').then(
                                          ({ ToastManager }) => {
                                            ToastManager?.error(
                                              '删除失败: ' +
                                                (error as Error).message,
                                            );
                                          },
                                        );
                                      }
                                    }
                                  }}
                                  className='px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors'
                                >
                                  删除
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 配置用户采集源权限 - 无遮罩弹窗 */}
      {showConfigureApisModal && selectedUser && (
        <div className='fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40'>
          <div className='bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] overflow-hidden border border-gray-200/50 dark:border-gray-700/50'>
            <div className='p-6'>
              <div className='flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4'>
                <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center'>
                  <span className='mr-2'>⚙️</span>
                  采集源权限配置 - {selectedUser.username}
                </h3>
                <button
                  onClick={() => {
                    setShowConfigureApisModal(false);
                    setSelectedUser(null);
                    setSelectedApis([]);
                  }}
                  className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'
                >
                  <X size={20} />
                </button>
              </div>

              <div className='max-h-[60vh] overflow-y-auto pr-2'>
                {/* 视频源选择 */}
                <div className='mb-6'>
                  <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 flex items-center'>
                    <span className='mr-2'>📺</span>
                    选择可用的视频源
                  </h4>
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'>
                    {videoSources.map((source) => (
                      <label
                        key={source.key}
                        className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                          selectedApis.includes(source.key)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                            : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <input
                          type='checkbox'
                          checked={selectedApis.includes(source.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedApis([...selectedApis, source.key]);
                            } else {
                              setSelectedApis(
                                selectedApis.filter(
                                  (api) => api !== source.key,
                                ),
                              );
                            }
                          }}
                          className='rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700'
                        />
                        <div className='flex-1 min-w-0'>
                          <div className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
                            {source.name}
                          </div>
                          <div className='text-xs text-gray-500 dark:text-gray-400 truncate'>
                            {source.api}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 快速操作和统计 */}
              <div className='flex items-center justify-between mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg'>
                <div className='flex space-x-3'>
                  <button
                    onClick={() => setSelectedApis([])}
                    className='px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors'
                  >
                    清空
                  </button>
                  <button
                    onClick={() => {
                      const allApis = videoSources
                        .filter((source) => !source.disabled)
                        .map((s) => s.key);
                      setSelectedApis(allApis);
                    }}
                    className='px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors'
                  >
                    全选
                  </button>
                </div>
                <div className='text-sm text-gray-600 dark:text-gray-400 flex items-center'>
                  已选择：
                  <span className='ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full font-medium text-xs'>
                    {(() => {
                      if (selectedApis.length === 0) {
                        return '无配置';
                      }
                      // 过滤掉特殊功能权限，只统计真正的视频源
                      const specialFeatures = [
                        'ai-recommend',
                        'disable-yellow-filter',
                      ];
                      const videoSourceCount = selectedApis.filter(
                        (api) => !specialFeatures.includes(api),
                      ).length;
                      return `${videoSourceCount} 个源`;
                    })()}
                  </span>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className='flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-700 pt-4'>
                <button
                  onClick={() => {
                    setShowConfigureApisModal(false);
                    setSelectedUser(null);
                    setSelectedApis([]);
                  }}
                  className='px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
                >
                  取消
                </button>
                <button
                  onClick={handleSaveUserApis}
                  className='px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105'
                >
                  确认配置
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 修改密码弹窗 - 无遮罩层 */}
      {showChangePasswordForm && (
        <div className='fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40'>
          <div className='bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-200/50 dark:border-gray-700/50'>
            <div className='flex items-center justify-between mb-6 border-b border-gray-200 dark:border-gray-700 pb-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center'>
                <span className='mr-2'>🔑</span>
                修改用户密码
              </h3>
              <button
                onClick={() => {
                  setShowChangePasswordForm(false);
                  setChangePasswordUser({ username: '', password: '' });
                }}
                className='text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'
              >
                <X size={20} />
              </button>
            </div>

            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  用户名
                </label>
                <input
                  type='text'
                  value={changePasswordUser.username}
                  readOnly
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                  新密码
                </label>
                <input
                  type='password'
                  value={changePasswordUser.password}
                  onChange={(e) =>
                    setChangePasswordUser((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  placeholder='请输入新密码'
                  className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                />
              </div>
            </div>

            <div className='flex justify-end space-x-3 mt-6 border-t border-gray-200 dark:border-gray-700 pt-4'>
              <button
                onClick={() => {
                  setShowChangePasswordForm(false);
                  setChangePasswordUser({ username: '', password: '' });
                }}
                className='px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
              >
                取消
              </button>
              <button
                onClick={handleChangePassword}
                disabled={!changePasswordUser.password}
                className='px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}
    </CollapsibleTab>
  );
}

// 导出组件
export function UserConfig() {
  return (
    <PermissionGuard permission='canManageUsers'>
      <UserConfigContent />
    </PermissionGuard>
  );
}

export default UserConfig;
