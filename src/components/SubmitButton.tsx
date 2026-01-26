/**
 * React 19 useFormStatus Hook 示例
 * 用于表单提交状态管理
 */

'use client';

import { useFormStatus } from 'react-dom';

/**
 * 提交按钮组件 - 使用 useFormStatus
 * 自动获取表单的提交状态
 */
export function SubmitButton({
  children,
  pendingText = '提交中...',
  className = '',
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type='submit'
      disabled={pending}
      className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
        pending
          ? 'bg-gray-400 cursor-not-allowed opacity-70'
          : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 shadow-lg hover:shadow-xl transform hover:scale-105'
      } ${className}`}
    >
      {pending ? (
        <span className='flex items-center justify-center gap-2'>
          <svg
            className='animate-spin h-5 w-5 text-white'
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
          >
            <circle
              className='opacity-25'
              cx='12'
              cy='12'
              r='10'
              stroke='currentColor'
              strokeWidth='4'
            />
            <path
              className='opacity-75'
              fill='currentColor'
              d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
            />
          </svg>
          {pendingText}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * 使用示例
 *
 * function LoginForm() {
 *   const [state, formAction] = useActionState(loginAction, {
 *     error: null,
 *   });
 *
 *   return (
 *     <form action={formAction}>
 *       <input name="username" />
 *       <input name="password" type="password" />
 *
 *       {state.error && <div className="error">{state.error}</div>}
 *
 *       <SubmitButton pendingText="登录中...">
 *         登录
 *       </SubmitButton>
 *     </form>
 *   );
 * }
 */
