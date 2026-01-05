/**
 * 无缓存的配置服务
 * 确保配置修改立即生效，避免缓存导致的问题
 * 使用API调用而不是直接导入服务器端模块
 */

import { AdminConfig } from '@/lib/admin.types';

export class ConfigService {
  /**
   * 获取配置 - 每次都从API读取最新数据
   */
  async getConfig(): Promise<AdminConfig> {
    console.log('ConfigService.getConfig - 开始获取配置');
    console.log('存储类型:', process.env.NEXT_PUBLIC_STORAGE_TYPE);

    // localStorage模式：直接从客户端读取
    if (
      typeof window !== 'undefined' &&
      process.env.NEXT_PUBLIC_STORAGE_TYPE === 'localstorage'
    ) {
      console.log('ConfigService.getConfig - 使用localStorage模式读取');

              try {
              // 动态导入客户端保存工具
              const { ClientConfigSaver } =
                await import('@/app/api/admin/config/client-save');
              const config = await ClientConfigSaver.loadFromLocalStorage();
        if (config) {
          console.log('ConfigService.getConfig - localStorage读取成功');
          return config;
        } else {
          console.log(
            'ConfigService.getConfig - localStorage无数据，使用API获取',
          );
        }
      } catch (error) {
        console.error('ConfigService.getConfig - localStorage读取失败:', error);
      }
    }

    // 其他存储模式或localStorage无数据时：使用API获取
    console.log('ConfigService.getConfig - 使用API获取配置');

    const response = await fetch('/api/admin/config', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('获取配置失败');
    }

    const data = await response.json();
    console.log('ConfigService.getConfig - API返回数据:', data);
    console.log('ConfigService.getConfig - 返回的Config:', data.Config);

    // 如果是localStorage模式且API返回了数据，保存到localStorage
    if (
      typeof window !== 'undefined' &&
      process.env.NEXT_PUBLIC_STORAGE_TYPE === 'localstorage' &&
      data.Config
    ) {
      try {
        const { ClientConfigSaver } =
          await import('@/app/api/admin/config/client-save');
        await ClientConfigSaver.saveToLocalStorage(data.Config);
        console.log('ConfigService.getConfig - API数据已缓存到localStorage');
      } catch (error) {
        console.error(
          'ConfigService.getConfig - 缓存到localStorage失败:',
          error,
        );
      }
    }

    return data.Config;
  }

  /**
   * 保存配置 - 立即生效
   */
  async saveConfig(config: AdminConfig): Promise<void> {
    console.log('ConfigService.saveConfig - 开始保存配置');
    console.log('存储类型:', process.env.NEXT_PUBLIC_STORAGE_TYPE);
    console.log('ConfigService.saveConfig - UserConfig:', config.UserConfig);
    console.log(
      'ConfigService.saveConfig - Tags数量:',
      Array.isArray(config.UserConfig?.Tags) ? config.UserConfig.Tags.length : 0,
    );
    console.log(
      'ConfigService.saveConfig - Users数量:',
      config.UserConfig?.Users?.length || 0,
    );

    if (config.UserConfig?.Tags) {
      console.log(
        'ConfigService.saveConfig - 第一个用户组详情:',
        config.UserConfig.Tags[0],
      );
    }

    // localStorage模式：直接在客户端保存
    if (
      typeof window !== 'undefined' &&
      process.env.NEXT_PUBLIC_STORAGE_TYPE === 'localstorage'
    ) {
      console.log('ConfigService.saveConfig - 使用localStorage模式保存');

      try {
        // 动态导入客户端保存工具
        const { ClientConfigSaver } =
          await import('@/app/api/admin/config/client-save');
        await ClientConfigSaver.saveToLocalStorage(config);
        console.log('ConfigService.saveConfig - localStorage保存成功');
        return;
      } catch (error) {
        console.error(
          'ConfigService.saveConfig - localStorage保存失败:',
          error,
        );
        throw new Error('localStorage保存失败: ' + (error as Error).message);
      }
    }

    // 其他存储模式（redis等）：使用API保存
    console.log(
      'ConfigService.saveConfig - 使用API保存到',
      process.env.NEXT_PUBLIC_STORAGE_TYPE,
    );
    console.log(
      'ConfigService.saveConfig - 要保存的配置大小:',
      JSON.stringify(config).length,
      'bytes',
    );

    const response = await fetch('/api/admin/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    console.log('ConfigService.saveConfig - API响应状态:', response.status);
    console.log('ConfigService.saveConfig - API响应头:', response.headers);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      console.error('ConfigService.saveConfig - API保存失败:', data);
      throw new Error(data.error || '保存配置失败');
    }

    const result = await response.json();
    console.log('ConfigService.saveConfig - API保存成功:', result);
    console.log('ConfigService.saveConfig - 验证信息:', result.verified);

    // 在redis等模式下，不需要额外的localStorage备份
    console.log('ConfigService.saveConfig - 保存完成');
  }

  /**
   * 刷新配置 - 强制重新加载
   */
  async refreshConfig(): Promise<AdminConfig> {
    return await this.getConfig();
  }

  /**
   * 更新特定配置项
   */
  async updateConfig<K extends keyof AdminConfig>(
    key: K,
    value: AdminConfig[K],
  ): Promise<void> {
    const response = await fetch('/api/admin/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateConfig',
        key: key,
        value: value,
      }),
    });

    if (!response.ok) {
      throw new Error('更新配置失败');
    }
  }

  /**
   * 获取特定配置项
   */
  async getConfigItem<K extends keyof AdminConfig>(
    key: K,
  ): Promise<AdminConfig[K]> {
    const config = await this.getConfig();
    return config[key];
  }
}

export const configService = new ConfigService();
