import { NavigationConfigProvider } from '@/contexts/NavigationConfigContext';

import TopNav from './TopNav';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

const PageLayout = ({ children, activePath = '/' }: PageLayoutProps) => {
  return (
    <NavigationConfigProvider>
      <div
        className='w-full min-h-screen'
        style={{ background: 'transparent' }}
      >
        {/* 顶部导航 - 所有页面显示 */}
        <TopNav activePath={activePath} />

        {/* 主内容区域 */}
        <div
          className='relative min-w-0 flex-1 transition-all duration-300'
          style={{ background: 'transparent' }}
        >
          {/* 主内容 */}
          <main
            className='flex-1 md:min-h-0 mt-25 px-2 md:px-4 lg:px-[3rem] 2xl:px-20'
            style={{
              paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom))',
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </NavigationConfigProvider>
  );
};

export default PageLayout;
