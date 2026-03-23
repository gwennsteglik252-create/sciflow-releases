
import React from 'react';
import { useProjectContext } from '../context/ProjectContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { activeTheme } = useProjectContext();
  const isLightMode = activeTheme.type === 'light';

  return (
    <div 
      className={`min-h-screen w-full flex flex-col transition-colors duration-500 ${isLightMode ? 'bg-[#F1F5F9]' : 'bg-[#0F172A]'}`}
      style={{ backgroundColor: activeTheme.colors.background }}
    >
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {children}
      </div>
      
      {/* Visual background elements for scientific aesthetic */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        
        {/* --- Custom Typographic Watermark (LXJ.LAB) --- */}
        <div className="absolute inset-0 flex items-center justify-center z-0 select-none pointer-events-none overflow-hidden">
           <h1 
             className={`text-[25vw] font-black uppercase tracking-tighter leading-none opacity-[0.03] transform -rotate-12 whitespace-nowrap ${isLightMode ? 'text-slate-900' : 'text-white'}`}
             style={{ fontFamily: '"Arial Black", "Impact", sans-serif' }}
           >
             LXJ<span className="text-indigo-500 opacity-50">.</span>LAB
           </h1>
        </div>

        {/* Subtle dot/mesh grid pattern */}
        <div 
          className={`absolute top-0 left-0 w-full h-full opacity-[0.06] ${isLightMode ? 'bg-indigo-900' : 'bg-white'}`} 
          style={{ 
            backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', 
            backgroundSize: '32px 32px' 
          }}
        ></div>
        
        {/* Large atmospheric glow spots */}
        <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[140px] animate-pulse"></div>
        <div className="absolute bottom-[-15%] right-[-5%] w-[60%] h-[60%] rounded-full bg-emerald-500/10 blur-[160px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-rose-500/5 blur-[120px]"></div>
      </div>
    </div>
  );
};

export default Layout;
