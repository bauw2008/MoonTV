# 集成测试步骤

## 第一步：在原页面中添加测试区域

在 `src/app/admin/page.tsx` 的末尾添加：

```typescript
// 在文件末尾，return 语句之前添加
{/* 新组件测试区域 - 临时 */}
{role === 'owner' && (
  <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
    <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-4">
      🧪 新组件测试区域
    </h3>
    <Suspense fallback={<div>加载新组件中...</div>}>
      <YellowConfig />
    </Suspense>
  </div>
)}
```

## 第二步：添加导入

在文件顶部添加：

```typescript
import { YellowConfig } from '../admin-new/components/config/YellowConfig';
```

## 第三步：测试验证

1. 访问管理员页面
2. 查看测试区域是否正常显示
3. 测试懒加载是否工作（网络面板查看）
4. 测试权限控制是否生效
5. 测试配置保存是否立即生效
6. 测试Toast通知是否正常

## 第四步：逐步迁移

确认YellowConfig正常工作后，可以：

1. 迁移其他简单模块（如CategoryConfig）
2. 逐步替换原有组件
3. 保持新旧系统并行运行
4. 最后切换到完整的新架构

## 渐进式迁移顺序建议

1. **简单配置模块**（优先）：
   - YellowConfig（18+配置）
   - CategoryConfig（分类配置）
   - NetdiskConfig（网盘配置）

2. **中等复杂度模块**：
   - SiteConfig（站点配置）
   - TMDBConfig（TMDB配置）
   - AIConfig（AI配置）

3. **复杂模块**（最后）：
   - UserConfig（用户配置）
   - VideoConfig（视频配置）
   - LiveConfig（直播配置）
   - TVBoxConfig（TVBox配置）

4. **系统工具**（站长专用）：
   - CacheManager（缓存管理）
   - DataMigration（数据迁移）
   - ConfigFile（配置文件）
