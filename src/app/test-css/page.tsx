export default function TestCSSPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          CSS 测试页面
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tailwind 基础样式测试 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-blue-600 dark:text-blue-400 mb-4">
              Tailwind 基础样式
            </h2>
            <div className="space-y-4">
              <div className="bg-red-100 dark:bg-red-900 p-4 rounded">
                红色背景测试
              </div>
              <div className="bg-green-100 dark:bg-green-900 p-4 rounded">
                绿色背景测试
              </div>
              <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded">
                蓝色背景测试
              </div>
            </div>
          </div>
          
          {/* 自定义样式测试 */}
          <div className="glass dark:glass-dark rounded-lg p-6">
            <h2 className="text-2xl font-semibold gradient-text mb-4">
              自定义玻璃样式
            </h2>
            <div className="space-y-4">
              <button className="glass-button px-6 py-3 rounded-lg text-gray-900 dark:text-white">
                玻璃按钮测试
              </button>
              <div className="hover-lift bg-white dark:bg-gray-800 p-4 rounded-lg">
                悬浮效果测试
              </div>
              <div className="glow p-4 rounded-lg bg-gray-100 dark:bg-gray-700">
                发光效果测试
              </div>
            </div>
          </div>
        </div>
        
        {/* 动画测试 */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-purple-600 dark:text-purple-400 mb-4">
            动画效果测试
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="animate-fade-in bg-yellow-100 dark:bg-yellow-900 p-4 rounded text-center">
              淡入动画
            </div>
            <div className="animate-slide-up bg-pink-100 dark:bg-pink-900 p-4 rounded text-center">
              滑入动画
            </div>
            <div className="animate-scale-in bg-indigo-100 dark:bg-indigo-900 p-4 rounded text-center">
              缩放动画
            </div>
          </div>
        </div>
        
        {/* 响应式测试 */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold text-orange-600 dark:text-orange-400 mb-4">
            响应式测试
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-teal-100 dark:bg-teal-900 p-4 rounded text-center">
              手机端
            </div>
            <div className="bg-cyan-100 dark:bg-cyan-900 p-4 rounded text-center sm:block hidden">
              平板端
            </div>
            <div className="bg-lime-100 dark:bg-lime-900 p-4 rounded text-center lg:block hidden">
              桌面端
            </div>
            <div className="bg-emerald-100 dark:bg-emerald-900 p-4 rounded text-center">
              始终显示
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}