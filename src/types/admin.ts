export interface AdminConfigResult {
  Role: 'owner' | 'admin';
  Config: any; // 这里使用 any，因为 AdminConfig 类型在其他地方定义
}
