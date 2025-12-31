/**
 * 客户端配置保存工具
 * 用于localStorage模式的配置保存
 */

import { AdminConfig } from '@/lib/admin.types';

export class ClientConfigSaver {
  /**
   * 在客户端保存配置到localStorage
   */
  static saveToLocalStorage(config: AdminConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (typeof window === 'undefined') {
          reject(new Error('只能在客户端执行'));
          return;
        }

        console.log('ClientConfigSaver - 开始保存到localStorage');
        console.log('配置数据:', config);

        const configStr = JSON.stringify(config);
        localStorage.setItem('vidora_admin_config', configStr);

        // 验证保存是否成功
        const saved = localStorage.getItem('vidora_admin_config');
        if (saved !== configStr) {
          throw new Error('localStorage保存验证失败');
        }

        console.log('ClientConfigSaver - localStorage保存成功');
        resolve();
      } catch (error) {
        console.error('ClientConfigSaver - 保存失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 从localStorage加载配置
   */
  static loadFromLocalStorage(): Promise<AdminConfig | null> {
    return new Promise((resolve) => {
      try {
        if (typeof window === 'undefined') {
          resolve(null);
          return;
        }

        const configStr = localStorage.getItem('vidora_admin_config');
        if (!configStr) {
          resolve(null);
          return;
        }

        const config = JSON.parse(configStr);
        console.log('ClientConfigSaver - 从localStorage加载配置成功');
        resolve(config);
      } catch (error) {
        console.error('ClientConfigSaver - 加载失败:', error);
        resolve(null);
      }
    });
  }
}
