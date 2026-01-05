export const authConfig = {
  storage: {
    type:
      (process.env.NEXT_PUBLIC_STORAGE_TYPE as
        | 'localstorage'
        | 'redis'
        | 'upstash') || 'localstorage',
    options: {
      redis: process.env.REDIS_URL,
      keyPrefix: 'vidora:auth:',
      defaultTTL: 24 * 60 * 60, // 24小时
    },
  },
  token: {
    secret: process.env.PASSWORD,
    accessTokenExpiry: 4 * 60 * 60 * 1000, // 4小时
    refreshTokenExpiry: 7 * 24 * 60 * 60 * 1000, // 7天
  },
  permissions: {
    enableCustomPermissions: true,
    defaultRole: 'user',
  },
};
