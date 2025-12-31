import { BackButton } from './BackButton';
import MobileHeader from './MobileHeader';
import TopNav from './TopNav';

interface PageLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

const PageLayout = ({ children, activePath = '/' }: PageLayoutProps) => {
  return (
    <div className='w-full min-h-screen' style={{ background: 'transparent' }}>
      {/* 顶部导航 - 所有端都显示 */}
      <TopNav activePath={activePath} />

      {/* 移动端头部 - 仅在特定页面显示，但不在首页显示 */}
      {['/play', '/live'].includes(activePath) && activePath !== '/' && (
        <MobileHeader showBackButton={true} />
      )}

      {/* 主内容区域 */}
      <div
        className='relative min-w-0 flex-1 transition-all duration-300'
        style={{ background: 'transparent' }}
      >
        {/* 桌面端左上角返回按钮 */}
        {['/play', '/live'].includes(activePath) && (
          <div className='absolute top-24 left-4 z-20 hidden md:flex'>
            <BackButton />
          </div>
        )}

        {/* 主内容 */}
        <main
          className='flex-1 md:min-h-0 mt-20 px-2 md:px-4'
          style={{
            paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
          }}
        >
          {' '}
          {children}
        </main>
      </div>
    </div>
  );
};

export default PageLayout;
