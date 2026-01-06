'use client';
'use client';
import {
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
import { useCallback, useEffect, useState } from 'react';

import { DefaultPermissions, PermissionType } from '@/lib/permission-types';
import {
  useAdminApi,
  useAdminAuth,
  useAdminLoading,
  useToastNotification,
} from '@/hooks/admin';

// 类型定义
interface User {
  username: string;
  password?: string;
  role: 'owner' | 'admin' | 'user';
  enabled?: boolean;
  banned?: boolean;
  createdAt?: number;
  lastLoginAt?: number;
  lastLoginTime?: number; // 添加这个字段以匹配数据库
  tags?: string[];
  enabledApis?: string[];
  userGroup?: string; // 新增用户组字段
}

interface UserSettings {
  Users: User[];
  Tags: Array<{
    name: string;
    enabledApis: string[];
    aiEnabled?: boolean;
    disableYellowFilter?: boolean;
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
  // 使用新的hooks
  const { loading, error, username, role, isAdminOrOwner, canManageUser } =
    useAdminAuth();
  const { userApi } = useAdminApi();
  const { isLoading, withLoading } = useAdminLoading();
  const { showError, showSuccess } = useToastNotification();

  // 构造 currentUser 对象
  const currentUser = username && role ? { username, role } : null;

  // 所有状态定义必须在任何条件渲染之前
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

  // 视频源状态
  const [videoSources, setVideoSources] = useState<
    Array<{ key: string; name: string; api?: string; disabled?: boolean }>
  >([]);

  // 添加用户表单状态
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUser, setNewUser] = useState<User>({
    username: '',
    password: '',
    role: 'user',
    userGroup: '', // 新增用户组字段
  });

  // 用户组弹窗状态
  const [showAddUserGroupModal, setShowAddUserGroupModal] = useState(false);
  const [showEditUserGroupModal, setShowEditUserGroupModal] = useState(false);
  const [editingUserGroupIndex, setEditingUserGroupIndex] = useState<
    number | null
  >(null);
  const [newUserGroupName, setNewUserGroupName] = useState('');
  const [showAddUserGroupForm, setShowAddUserGroupForm] = useState(false);

  // 获取用户组的详细信息
  const getTagDetails = (tagName: string) => {
    const tag = userSettings.Tags.find((t) => t.name === tagName);
    return tag || null;
  };

  // 加载视频源配置
  const loadVideoSources = async () => {
    try {
      console.log('开始加载视频源列表...');
      const response = await fetch('/api/admin/config');
      const data = await response.json();

      console.log('完整配置:', data);
      console.log('SourceConfig:', data.Config?.SourceConfig);

      let sources = [];

      // 尝试从SourceConfig获取
      if (
        data.Config?.SourceConfig &&
        Array.isArray(data.Config.SourceConfig)
      ) {
        console.log('从SourceConfig加载视频源:', data.Config.SourceConfig);
        sources = data.Config.SourceConfig.map((source) => ({
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

  // 加载配置
  const loadConfig = async () => {
    try {
      console.log('=== loadConfig 开始 ===');
      const response = await fetch('/api/admin/config');
      const data = await response.json();

      console.log('获取到的完整配置:', data);
      console.log('UserConfig是否存在:', !!data?.Config?.UserConfig);

      if (data?.Config?.UserConfig) {
        console.log('原始UserConfig:', data.Config.UserConfig);
        console.log(
          '原始Users数量:',
          data.Config.UserConfig.Users?.length || 0,
        );
        console.log(
          '原始Tags数量:',
          Array.isArray(data.Config.UserConfig.Tags)
            ? data.Config.UserConfig.Tags.length
            : 0,
        );

        // 注释掉直接从数据库获取用户列表的代码，使用配置中的用户数据
        // let dbUsers = [];
        // try {
        //   const response = await fetch('/api/admin/user', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //       action: 'getUsers',
        //     }),
        //   });

        //   if (response.ok) {
        //     const userData = await response.json();
        //     dbUsers = userData.users || [];
        //     console.log('从数据库同步的最新用户列表:', dbUsers);
        //     console.log('数据库用户数量:', dbUsers.length);
        //   } else {
        //     console.error('获取用户列表失败:', response.status);
        //   }
        // } catch (error) {
        //   console.error('从数据库同步用户失败:', error);
        // }

        // 使用配置中的用户组数据
        let tagsToUse = Array.isArray(data.Config.UserConfig.Tags)
          ? data.Config.UserConfig.Tags
          : [];

        console.log('处理后的用户组列表:', tagsToUse);

        // 获取用户统计信息（包含登录时间）
        let userStats: any[] = [];
        try {
          const statsResponse = await fetch('/api/admin/play-stats');
          if (statsResponse.ok) {
            const statsData = await statsResponse.json();
            userStats = statsData.userStats || [];
            console.log('获取到用户统计数量:', userStats.length);
          }
        } catch (error) {
          console.error('获取用户统计失败:', error);
        }

        // 创建配置对象
        const finalConfig = {
          UserConfig: {
            ...data.Config.UserConfig,
            Users: data.Config.UserConfig.Users || [],
            Tags: tagsToUse,
          },
        };

        // 合并用户数据和统计信息
        const mergedUsers = finalConfig.UserConfig.Users.map(
          (configUser: any) => {
            let finalUser = { ...configUser };

            // 从统计信息中获取登录时间
            const userStat = userStats.find(
              (stat: any) => stat.username === configUser.username,
            );
            if (userStat && (userStat.lastLoginTime || userStat.lastLoginAt)) {
              finalUser.lastLoginTime =
                userStat.lastLoginTime || userStat.lastLoginAt;
              finalUser.lastLoginAt =
                userStat.lastLoginTime || userStat.lastLoginAt;
            }

            // 对于站长账户（环境变量用户），确保有时间戳
            const ownerUser = finalConfig.UserConfig.Users.find(
              (u) => u.username === process.env.USERNAME,
            );
            if (ownerUser) {
              // 使用当前时间作为站长的注册时间（首次登录时）
              if (!ownerUser.createdAt) {
                ownerUser.createdAt = Date.now();
              }
              // 如果没有登录时间，设置为注册时间
              if (!ownerUser.lastLoginAt && !ownerUser.lastLoginTime) {
                ownerUser.lastLoginAt = ownerUser.createdAt;
                ownerUser.lastLoginTime = ownerUser.createdAt;
              }
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

            return finalUser;
          },
        );

        const newSettings = {
          Users: mergedUsers,
          Tags: tagsToUse,
          AllowRegister: Boolean(data.Config.UserConfig.AllowRegister),
          RequireApproval: Boolean(data.Config.UserConfig.RequireApproval),
          AutoCleanupInactiveUsers: Boolean(
            data.Config.UserConfig.AutoCleanupInactiveUsers,
          ),
          InactiveUserDays:
            Number(data.Config.UserConfig.InactiveUserDays) || 7,
          PendingUsers: (data.Config.UserConfig.PendingUsers || []).map(
            (p: any) => ({
              username: p.username,
              encryptedPassword: p.encryptedPassword,
              createdAt: p.createdAt || Date.now(),
              reason: p.reason,
              appliedAt: p.appliedAt || new Date().toISOString(),
            }),
          ),
        };

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

  // 添加用户组并关闭表单（简化版，直接调用合并后的函数）
  const handleAddUserGroupWithClose = () => {
    handleAddUserGroup(true);
  };

  // 初始化加载
  useEffect(() => {
    loadConfig();
    loadVideoSources();
  }, []);

  // 辅助函数：计算用户组的视频源数量
  const getVideoSourceCount = useCallback((tag: any) => {
    // 优先使用videoSources字段，如果没有则从enabledApis中过滤
    const specialFeatures = ['ai-recommend', 'disable-yellow-filter'];
    const videoSources =
      tag.videoSources ||
      (tag.enabledApis || []).filter(
        (api: string) => !specialFeatures.includes(api),
      );
    return videoSources.length;
  }, []);

  // 加载状态
  if (loading) {
    return (
      <div className='p-6 text-center text-gray-500'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2'></div>
        <p>验证权限中...</p>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>权限验证失败</h2>
        <p>{error}</p>
      </div>
    );
  }

  // 非管理员或站长禁止访问
  if (!isAdminOrOwner) {
    return (
      <div className='p-6 text-center text-red-500'>
        <h2 className='text-xl font-semibold mb-2'>访问受限</h2>
        <p>您没有权限访问用户管理功能</p>
      </div>
    );
  }

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

  // 工具函数：从数据库同步用户数据（已禁用）
  // const syncUsersFromDatabase = async () => {
  //   let dbUsers = [];
  //   try {
  //     const response = await fetch('/api/admin/user', {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify({
  //         action: 'getUsers',
  //       }),
  //     });

  //     if (response.ok) {
  //       const data = await response.json();
  //       dbUsers = data.users || [];
  //       console.log('数据库同步成功，获取用户数量:', dbUsers.length);
  //     } else {
  //       console.error('获取用户列表失败:', response.status);
  //     }
  //   } catch (error) {
  //     console.error('从数据库同步用户失败:', error);
  //   }
  //   return dbUsers;
  // };

  // 工具函数：配置更新日志（索引系统已移除）
  const updateIndexes = async (type: 'userGroup' | 'all' = 'userGroup') => {
    console.log(
      `[配置更新] ${type === 'all' ? '所有配置' : '用户组配置'}已更新`,
    );
  };

  // 工具函数：获取用户状态
  const getUserStatus = (user: User) => {
    return user.enabled !== undefined ? user.enabled : !user.banned;
  };

  // 通用用户操作函数
  const handleUserAction = async (
    action: 'ban' | 'unban' | 'setAdmin' | 'cancelAdmin' | 'changePassword',
    targetUsername: string,
    targetPassword?: string,
  ) => {
    try {
      switch (action) {
        case 'ban':
          await userApi.ban(targetUsername);
          break;
        case 'unban':
          await userApi.unban(targetUsername);
          break;
        case 'setAdmin':
          await userApi.setAdmin(targetUsername);
          break;
        case 'cancelAdmin':
          await userApi.cancelAdmin(targetUsername);
          break;
        case 'changePassword':
          if (!targetPassword) {
            showError('请输入新密码');
            return;
          }
          await userApi.changePassword(targetUsername, targetPassword);
          break;
      }

      await loadConfig();
    } catch (error) {
      // 错误处理已在useAdminApi中完成
      console.error('用户操作失败:', error);
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
      showError('请输入新密码');
      return;
    }

    await withLoading('changePassword', async () => {
      await handleUserAction(
        'changePassword',
        changePasswordUser.username,
        changePasswordUser.password,
      );

      setChangePasswordUser({ username: '', password: '' });
      setShowChangePasswordForm(false);
    });
  };

  // 设为管理员
  const handleSetAdmin = (username: string) =>
    handleUserAction('setAdmin', username);

  // 取消管理员权限
  const handleRemoveAdmin = (username: string) =>
    handleUserAction('cancelAdmin', username);

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

    await withLoading('saveUserApis', async () => {
      try {
        console.log(
          `保存用户 ${selectedUser.username} 的采集权限:`,
          selectedApis,
        );

        // 使用新的API系统
        await userApi.updateUserApis(selectedUser.username, selectedApis);

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

        setShowConfigureApisModal(false);
        setSelectedUser(null);
        setSelectedApis([]);
      } catch (error) {
        // 错误处理已在useAdminApi中完成
        console.error('保存用户API权限失败:', error);
      }
    });
  };

  // 统一的配置保存函数
  const saveUnifiedConfig = async (
    settings?: Partial<UserSettings>,
    options: {
      skipDbSync?: boolean;
      skipIndexUpdate?: boolean;
      showMessage?: boolean;
    } = {},
  ) => {
    try {
      // 使用传入的设置或当前设置
      const currentSettings = settings
        ? { ...userSettings, ...settings }
        : userSettings;

      // 保存配置
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          UserConfig: currentSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('保存配置失败');
      }

      // 更新索引
      if (!options.skipIndexUpdate) {
        await updateIndexes('all');
      }

      // 显示成功消息
      if (options.showMessage !== false) {
        showSuccess('配置保存成功');
      }

      // 更新本地状态
      if (settings) {
        setUserSettings(currentSettings as UserSettings);
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      showError('保存失败: ' + (error as Error).message);
    }
  };

  // 保持向后兼容的saveConfig函数
  const saveConfig = () => saveUnifiedConfig(undefined, { showMessage: true });

  // 保持向后兼容的saveConfigWithSettings函数
  const saveConfigWithSettings = (settings: any) =>
    saveUnifiedConfig(settings, { showMessage: true });

  const handleToggleSwitch = async (key: keyof UserSettings, value: any) => {
    try {
      console.log(`切换开关: ${key} = ${value}`);

      // 先更新本地状态
      const newSettings = { ...userSettings, [key]: value };
      setUserSettings(newSettings);

      // 保存配置
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          UserConfig: newSettings,
        }),
      });

      if (!response.ok) {
        throw new Error('保存配置失败');
      }

      console.log(`开关 ${key} 已更新为: ${value}`);
      showSuccess('设置已保存');
    } catch (error) {
      console.error('切换开关失败:', error);
      // 如果保存失败，恢复原状态
      setUserSettings(userSettings);
      showError('保存失败: ' + (error as Error).message);
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
        showSuccess(`用户 ${username} 已批准`);
        // 刷新配置
        loadConfig();
      } else {
        showError(data.error || '批准失败');
      }
    } catch (error) {
      showError('批准失败');
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
        showSuccess(`用户 ${username} 已拒绝`);
        // 刷新配置
        loadConfig();
      } else {
        showError(data.error || '拒绝失败');
      }
    } catch (error) {
      showError('拒绝失败');
    }
  };

  // 用户组管理函数
  const handleAddUserGroup = async (closeForm = false) => {
    if (!newUserGroupName.trim()) {
      showError('请输入用户组名称');
      return;
    }

    try {
      // 使用新的API系统
      await userApi.addUserGroup(
        newUserGroupName.trim(),
        videoSources.map((source) => source.key),
      );

      // 更新本地状态
      const newTag = {
        name: newUserGroupName.trim(),
        enabledApis: videoSources.map((source) => source.key),
        videoSources: videoSources.map((source) => source.key),
        disableYellowFilter:
          DefaultPermissions[PermissionType.DISABLE_YELLOW_FILTER],
        aiEnabled: DefaultPermissions[PermissionType.AI_RECOMMEND].length > 0,
      };

      const newSettings = {
        ...userSettings,
        Tags: [...userSettings.Tags, newTag],
      };

      setUserSettings(newSettings);
      await saveUnifiedConfig(newSettings, { skipIndexUpdate: true });

      // 更新索引
      await updateIndexes('userGroup');

      setShowAddUserGroupModal(false);
      setNewUserGroupName('');

      if (closeForm) {
        setShowAddUserGroupForm(false);
      }
    } catch (error) {
      // 错误处理已在useAdminApi中完成
      console.error('添加用户组失败:', error);
    }
  };

  const handleToggleVideoSource = async (
    index: number,
    sourceKey: string,
    checked: boolean,
  ) => {
    const tag = userSettings.Tags[index];
    if (!tag) return;

    const enabledApis = new Set(tag.enabledApis || []);
    if (checked) {
      enabledApis.add(sourceKey);
    } else {
      enabledApis.delete(sourceKey);
    }

    // 同步更新videoSources字段
    const videoSources = [...(tag.videoSources || [])];
    if (checked && !videoSources.includes(sourceKey)) {
      videoSources.push(sourceKey);
    } else if (!checked) {
      const idx = videoSources.indexOf(sourceKey);
      if (idx > -1) videoSources.splice(idx, 1);
    }

    await updateUserGroup(index, {
      enabledApis: Array.from(enabledApis),
      videoSources,
    });
  };

  // 通用的用户组更新函数
  const updateUserGroup = async (
    index: number,
    updates: Partial<{
      enabledApis: string[];
      videoSources: string[];
      disableYellowFilter: boolean;
      aiEnabled: boolean;
    }>,
    options: {
      updateIndex?: boolean;
      showMessage?: string;
    } = {},
  ) => {
    try {
      const newTags = [...userSettings.Tags];
      const updatedTag = { ...newTags[index], ...updates };
      newTags[index] = updatedTag;

      const newSettings = {
        ...userSettings,
        Tags: newTags,
      };

      setUserSettings(newSettings);
      await saveUnifiedConfig(newSettings, { skipIndexUpdate: true });

      // 更新索引
      await updateIndexes('userGroup');

      // 显示成功消息
      if (options.showMessage) {
        showSuccess(options.showMessage);
      }
    } catch (error) {
      console.error('更新用户组失败:', error);
      showError('更新失败: ' + (error as Error).message);
    }
  };

  const handleToggleSpecialFeature = async (
    index: number,
    permissionType: string,
    checked: boolean,
  ) => {
    const tag = userSettings.Tags[index];
    if (!tag) {
      console.error('用户组不存在，索引:', index);
      return;
    }

    const updates: any = {};

    if (
      permissionType === 'ai-recommend' ||
      permissionType === PermissionType.AI_RECOMMEND
    ) {
      updates.aiEnabled = checked;
      // 更新enabledApis
      const enabledApis = [...tag.enabledApis];
      if (checked && !enabledApis.includes('ai-recommend')) {
        enabledApis.push('ai-recommend');
      } else if (!checked) {
        const index = enabledApis.indexOf('ai-recommend');
        if (index > -1) enabledApis.splice(index, 1);
      }
      updates.enabledApis = enabledApis;
    } else if (
      permissionType === 'disable-yellow-filter' ||
      permissionType === PermissionType.DISABLE_YELLOW_FILTER
    ) {
      updates.disableYellowFilter = checked;
      // 更新enabledApis
      const enabledApis = [...tag.enabledApis];
      if (checked && !enabledApis.includes('disable-yellow-filter')) {
        enabledApis.push('disable-yellow-filter');
      } else if (!checked) {
        const index = enabledApis.indexOf('disable-yellow-filter');
        if (index > -1) enabledApis.splice(index, 1);
      }
      updates.enabledApis = enabledApis;
    } else {
      console.warn('未知的权限类型:', permissionType);
      return;
    }

    await updateUserGroup(index, updates, {
      showMessage: `特殊功能已${checked ? '启用' : '禁用'}`,
    });
  };

  const handleSaveUserGroup = async () => {
    if (editingUserGroupIndex === null) return;

    const tag = userSettings.Tags[editingUserGroupIndex];
    if (!tag) return;

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

    await updateUserGroup(editingUserGroupIndex, {
      enabledApis,
      videoSources: selectedApis,
    });

    setShowEditUserGroupModal(false);
    setEditingUserGroupIndex(null);
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
      // 使用新的API系统

      await userApi.deleteUserGroup(groupName);

      // 更新本地状态

      const newTags = userSettings.Tags.filter((_, i) => i !== index);

      const newSettings = {
        ...userSettings,

        Tags: newTags,
      };

      setUserSettings(newSettings);

      await saveUnifiedConfig(newSettings, { skipIndexUpdate: true });

      // 更新索引

      await updateIndexes('userGroup');

      showSuccess('用户组删除成功');
    } catch (error) {
      // 错误处理已在useAdminApi中完成

      console.error('删除用户组失败:', error);
    }
  };

  // 确保userSettings已初始化
  if (
    !userSettings ||
    userSettings === null ||
    typeof userSettings !== 'object'
  ) {
    return (
      <div className='p-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg'>
        <p className='text-yellow-600 dark:text-yellow-400'>
          正在加载用户配置...
        </p>
      </div>
    );
  }

  return (
    <div className='p-6'>
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
                  key={`${pendingUser.username}-${pendingUser.createdAt}`}
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
                onClick={async () => {
                  try {
                    const response = await fetch('/api/admin/config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        UserConfig: {
                          ...userSettings,
                          AllowRegister: !userSettings.AllowRegister,
                        },
                      }),
                    });

                    if (response.ok) {
                      // 更新本地状态
                      setUserSettings({
                        ...userSettings,
                        AllowRegister: !userSettings.AllowRegister,
                      });

                      // 显示成功提示
                      showSuccess(
                        userSettings.AllowRegister
                          ? '已禁止用户注册'
                          : '已允许用户注册',
                      );
                    } else {
                      throw new Error('更新配置失败');
                    }
                  } catch (err) {
                    console.error('切换开关失败:', err);
                    showError('保存失败: ' + (err as Error).message);
                  }
                }}
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
          <div className='overflow-x-auto'>
            <table className='w-full'>
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
                    key={tag.name}
                    className='hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
                  >
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span className='font-medium text-gray-900 dark:text-gray-100'>
                        {tag.name}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span className='text-sm text-gray-900 dark:text-gray-100'>
                        {getVideoSourceCount(tag) > 0
                          ? `${getVideoSourceCount(tag)} 个源`
                          : '无配置'}
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

                <div className='flex flex-col sm:flex-row justify-end gap-3 sm:space-x-3 sm:gap-0'>
                  <button
                    onClick={() => setShowAddUserGroupModal(false)}
                    className='w-full sm:w-auto px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  >
                    取消
                  </button>
                  <button
                    onClick={() => handleAddUserGroup(false)}
                    className='w-full sm:w-auto px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors'
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
                <div className='flex flex-col sm:flex-row justify-end gap-3 sm:space-x-3 sm:gap-0 border-t border-gray-200 dark:border-gray-700 pt-4'>
                  <button
                    onClick={() => {
                      setShowEditUserGroupModal(false);
                      setEditingUserGroupIndex(null);
                      setSelectedApis([]);
                    }}
                    className='w-full sm:w-auto px-4 sm:px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveUserGroup}
                    className='w-full sm:w-auto px-4 sm:px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105'
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
                      userGroup: '',
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
              <div className='space-y-3'>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
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

                  <div>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'>
                      用户组
                    </label>
                    <select
                      value={newUser.userGroup}
                      onChange={(e) =>
                        setNewUser({ ...newUser, userGroup: e.target.value })
                      }
                      className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    >
                      <option value=''>无用户组（无限制）</option>
                      {userSettings.Tags.map((group) => (
                        <option key={`group-${group.name}`} value={group.name}>
                          {group.name}{' '}
                          {group.enabledApis && group.enabledApis.length > 0
                            ? `(${group.enabledApis.length} 个源)`
                            : ''}
                        </option>
                      ))}
                    </select>
                    <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                      选择"无用户组"为无限制，选择特定用户组将限制用户只能访问该用户组允许的采集源
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    if (!newUser.username.trim() || !newUser.password.trim()) {
                      showError('请填写用户名和密码');
                      return;
                    }

                    await withLoading('addUser', async () => {
                      try {
                        console.log(`添加用户: ${newUser.username}`);

                        // 使用新的API系统
                        await userApi.addUser(
                          newUser.username.trim(),
                          newUser.password,
                          newUser.userGroup,
                        );

                        // 重新加载配置
                        await loadConfig();

                        setNewUser({
                          username: '',
                          password: '',
                          role: 'user',
                          userGroup: '',
                        });
                        setShowAddUserForm(false);
                      } catch (error) {
                        // 错误处理已在useAdminApi中完成
                        console.error('添加用户失败:', error);
                      }
                    });
                  }}
                  disabled={isLoading('addUser')}
                  className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {isLoading('addUser') ? '添加中...' : '添加'}
                </button>
              </div>
            </div>
          )}

          <div className='overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0'>
            <table className='w-full min-w-[800px]'>
              <thead>
                <tr className='border-b dark:border-gray-700'>
                  <th className='text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[200px]'>
                    用户信息
                  </th>
                  <th className='text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[100px]'>
                    状态
                  </th>
                  <th className='text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px]'>
                    用户组
                  </th>
                  <th className='text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px]'>
                    采集源权限
                  </th>
                  <th className='text-center py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[200px]'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {userSettings.Users.slice() // 创建副本以避免修改原数组
                  .sort((a, b) => {
                    // 定义角色优先级
                    const rolePriority = {
                      owner: 0,
                      admin: 1,
                      user: 2,
                    };

                    const aPriority =
                      rolePriority[a.role as keyof typeof rolePriority] ?? 2;
                    const bPriority =
                      rolePriority[b.role as keyof typeof rolePriority] ?? 2;

                    // 按优先级排序
                    if (aPriority !== bPriority) {
                      return aPriority - bPriority;
                    }

                    // 相同角色按用户名排序
                    return a.username.localeCompare(b.username);
                  })
                  .map((user) => {
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
                                {user.role !== 'owner' && (
                                  <div className='flex items-center space-x-1'>
                                    <Clock className='w-3 h-3' />
                                    <span>
                                      注册:{' '}
                                      {user.createdAt
                                        ? new Date(
                                            user.createdAt,
                                          ).toLocaleDateString('zh-CN', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit',
                                          })
                                        : '未知'}
                                    </span>
                                  </div>
                                )}
                                <div className='flex items-center space-x-1'>
                                  <Check className='w-3 h-3' />
                                  <span>
                                    登录:{' '}
                                    {user.lastLoginTime || user.lastLoginAt
                                      ? new Date(
                                          user.lastLoginTime ||
                                            user.lastLoginAt,
                                        ).toLocaleDateString('zh-CN', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                        })
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
                                  // 调用API修改用户状态
                                  const action = isEnabled ? 'ban' : 'unban';

                                  const response = await fetch(
                                    '/api/admin/user',
                                    {
                                      method: 'POST',
                                      headers: {
                                        'Content-Type': 'application/json',
                                      },
                                      body: JSON.stringify({
                                        action,
                                        targetUsername: user.username,
                                      }),
                                    },
                                  );

                                  if (!response.ok) {
                                    const data = await response
                                      .json()
                                      .catch(() => ({}));
                                    throw new Error(data.error || '操作失败');
                                  }

                                  // 重新加载配置
                                  await loadConfig();

                                  showSuccess(
                                    isEnabled ? '用户已禁用' : '用户已启用',
                                  );
                                } catch (error) {
                                  console.error('操作失败:', error);
                                  showError(
                                    '操作失败: ' + (error as Error).message,
                                  );
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
                              {/* AI功能显示 */}
                              {(() => {
                                // 检查用户或用户组是否启用了AI功能
                                const hasAiEnabled =
                                  (user.enabledApis || []).includes(
                                    'ai-recommend',
                                  ) ||
                                  (user.tags &&
                                    user.tags.length > 0 &&
                                    userSettings.Tags.find(
                                      (tag) => tag.name === user.tags[0],
                                    )?.aiEnabled);

                                return hasAiEnabled ? (
                                  <span className='inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'>
                                    🤖 AI
                                  </span>
                                ) : null;
                              })()}

                              {/* 18+功能显示 */}
                              {(() => {
                                // 检查用户或用户组是否启用了18+功能
                                const has18Enabled =
                                  (user.enabledApis || []).includes(
                                    'disable-yellow-filter',
                                  ) ||
                                  (user.tags &&
                                    user.tags.length > 0 &&
                                    userSettings.Tags.find(
                                      (tag) => tag.name === user.tags[0],
                                    )?.disableYellowFilter);

                                return has18Enabled ? (
                                  <span className='inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'>
                                    🚫 18+
                                  </span>
                                ) : null;
                              })()}
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
                                // 使用 API 更新用户组
                                const response = await fetch(
                                  '/api/admin/user',
                                  {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      action: 'updateUserGroups',
                                      targetUsername: user.username,
                                      userGroups: newTag ? [newTag] : [],
                                    }),
                                  },
                                );

                                if (!response.ok) {
                                  throw new Error('更新用户组失败');
                                }

                                // 重新加载配置以获取最新状态
                                await loadConfig();

                                showSuccess('用户组已更新');
                              } catch (error) {
                                console.error('更新用户组失败:', error);
                                showError('更新用户组失败');
                              }
                            }}
                            className='px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full'
                          >
                            {userSettings.Tags.map((tag) => (
                              <option key={`tag-${tag.name}`} value={tag.name}>
                                {tag.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* 操作列 */}

                        <td className='py-4 px-4'>
                          <div className='grid grid-cols-2 gap-2 min-w-[200px]'>
                            {/* 第一行 */}
                            {/* 采集源权限按钮 */}

                            <button
                              onClick={() => handleConfigureUserApis(user)}
                              className='px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center'
                            >
                              <span className='mr-1'>⚙️</span>
                              采集权限
                            </button>

                            {/* 修改密码按钮 */}

                            {user.role !== 'owner' && (
                              <button
                                onClick={() =>
                                  handleShowChangePasswordForm(user.username)
                                }
                                className='px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center'
                              >
                                修改密码
                              </button>
                            )}

                            {/* 第二行 */}
                            {/* 管理员控制按钮 */}

                            {canManageUser(user) && (
                              <button
                                onClick={async () => {
                                  if (user.role === 'user') {
                                    await handleSetAdmin(user.username);
                                  } else {
                                    await handleRemoveAdmin(user.username);
                                  }
                                }}
                                className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center ${
                                  user.role === 'admin'
                                    ? 'bg-gray-600 text-white hover:bg-gray-700'
                                    : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                              >
                                <span className='mr-1'>
                                  {user.role === 'admin' ? '👤' : '👑'}
                                </span>

                                {user.role === 'admin'
                                  ? '取消管理员'
                                  : '设为管理员'}
                              </button>
                            )}

                            {/* 删除用户按钮 */}

                            {user.role !== 'owner' && (
                              <button
                                onClick={async () => {
                                  if (
                                    !confirm(
                                      `确定要删除用户 "${user.username}" 吗？`,
                                    )
                                  )
                                    return;

                                  try {
                                    // 使用新的API系统
                                    await userApi.deleteUser(user.username);

                                    // 重新加载配置以获取最新状态
                                    await loadConfig();
                                  } catch (error) {
                                    // 错误处理已在useAdminApi中完成
                                    console.error('删除用户失败:', error);
                                  }
                                }}
                                className='px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center'
                              >
                                <span className='mr-1'>🗑️</span>
                                删除
                              </button>
                            )}
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
          <div className='bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-2xl w-[90vw] max-w-2xl max-h-[85vh] overflow-hidden border border-gray-200/50 dark:border-gray-700/50'>
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
                {/* 采集源选择 */}
                <div className='mb-6'>
                  <div className='flex items-center justify-between mb-4'>
                    <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center'>
                      <span className='mr-2'>📺</span>
                      选择可用的视频源
                    </h4>
                    <div className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400'>
                      <button
                        onClick={() => {
                          const allApis = videoSources
                            .filter((source) => !source.disabled)
                            .map((s) => s.key);
                          setSelectedApis(allApis);
                        }}
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
                        return `${videoSourceCount} 个采集源`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className='flex flex-col sm:flex-row justify-end gap-3 sm:space-x-3 sm:gap-0 border-t border-gray-200 dark:border-gray-700 pt-4'>
                <button
                  onClick={() => {
                    setShowConfigureApisModal(false);
                    setSelectedUser(null);
                    setSelectedApis([]);
                  }}
                  className='w-full sm:w-auto px-4 sm:px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
                >
                  取消
                </button>
                <button
                  onClick={handleSaveUserApis}
                  disabled={
                    selectedApis.length === 0 || isLoading('saveUserApis')
                  }
                  className={`w-full sm:w-auto px-4 sm:px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-all transform hover:scale-105 ${
                    selectedApis.length === 0 || isLoading('saveUserApis')
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                  }`}
                >
                  {isLoading('saveUserApis')
                    ? '保存中...'
                    : `确认配置 (${selectedApis.length})`}
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

            <div className='flex flex-col sm:flex-row justify-end gap-3 sm:space-x-3 sm:gap-0 mt-6 border-t border-gray-200 dark:border-gray-700 pt-4'>
              <button
                onClick={() => {
                  setShowChangePasswordForm(false);
                  setChangePasswordUser({ username: '', password: '' });
                }}
                className='w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
              >
                取消
              </button>
              <button
                onClick={handleChangePassword}
                disabled={
                  !changePasswordUser.password || isLoading('changePassword')
                }
                className='w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
              >
                {isLoading('changePassword') ? '修改中...' : '确认修改'}
              </button>{' '}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserConfig() {
  return <UserConfigContent />;
}

export default UserConfig;
