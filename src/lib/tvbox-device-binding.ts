/**
 * 设备绑定后端验证逻辑
 */

import type { DeviceFingerprint } from './tvbox-device-fingerprint';

interface DeviceBindingConfig {
  enableDeviceBinding: boolean;
  maxDevices: number;
  currentDevices: DeviceFingerprint[];
}

interface ValidationResult {
  success: boolean;
  message: string;
  allowed: boolean;
  reason?: string;
}

/**
 * 验证设备访问权限
 */
export function validateDeviceAccess(
  config: DeviceBindingConfig,
  currentDevice: DeviceFingerprint,
  requestIP: string,
): ValidationResult {
  // 如果设备绑定未启用，直接允许访问
  if (!config.enableDeviceBinding) {
    return {
      success: true,
      message: '设备绑定未启用',
      allowed: true,
    };
  }

  // 检查设备是否已绑定
  const isBound = config.currentDevices.some(
    (device) => device.deviceId === currentDevice.deviceId,
  );

  if (isBound) {
    return {
      success: true,
      message: '设备已验证',
      allowed: true,
    };
  }

  // 检查是否达到设备数量限制
  if (config.currentDevices.length >= config.maxDevices) {
    return {
      success: false,
      message: '设备绑定数量已达上限',
      allowed: false,
      reason: `已达到最大设备数量限制 (${config.maxDevices}台)`,
    };
  }

  // 允许新设备绑定
  return {
    success: true,
    message: '新设备允许绑定',
    allowed: true,
  };
}

/**
 * 处理新设备绑定
 */
export function handleNewDeviceBinding(
  config: DeviceBindingConfig,
  currentDevice: DeviceFingerprint,
): DeviceBindingConfig {
  if (!config.enableDeviceBinding) {
    return config;
  }

  // 检查设备是否已存在
  const existingIndex = config.currentDevices.findIndex(
    (device) => device.deviceId === currentDevice.deviceId,
  );

  let updatedDevices = [...config.currentDevices];

  if (existingIndex !== -1) {
    // 更新现有设备信息
    updatedDevices[existingIndex] = {
      ...currentDevice,
      bindTime: Date.now(),
    };
  } else {
    // 添加新设备
    updatedDevices.push(currentDevice);

    // 如果超过最大设备数，移除最早的设备
    if (updatedDevices.length > config.maxDevices) {
      updatedDevices.sort((a, b) => a.bindTime - b.bindTime);
      updatedDevices = updatedDevices.slice(-config.maxDevices);
    }
  }

  return {
    ...config,
    currentDevices: updatedDevices,
  };
}

/**
 * 移除设备绑定
 */
export function removeDeviceBinding(
  config: DeviceBindingConfig,
  deviceId: string,
): DeviceBindingConfig {
  const updatedDevices = config.currentDevices.filter(
    (device) => device.deviceId !== deviceId,
  );

  return {
    ...config,
    currentDevices: updatedDevices,
  };
}

/**
 * 清空所有设备绑定
 */
export function clearAllDeviceBindings(
  config: DeviceBindingConfig,
): DeviceBindingConfig {
  return {
    ...config,
    currentDevices: [],
  };
}
