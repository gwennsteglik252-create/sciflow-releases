
import React, { useState, useMemo } from 'react';
import { useProjectContext } from '../../context/ProjectContext';
import { UserProfile } from '../../types';
import { CloudSyncState } from '../../hooks/useCloudSync';
import { isSupabaseConfigured } from '../../services/supabase';
import { useAuth } from '../../hooks/useAuth';

interface AccountModalProps {
  show: boolean;
  onClose: () => void;
  cloudSync?: CloudSyncState;
}

type TabId = 'profile' | 'account' | 'sync';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'profile', label: '科研档案', icon: 'fa-flask' },
  { id: 'account', label: '账号安全', icon: 'fa-shield-halved' },
  { id: 'sync', label: '云同步', icon: 'fa-cloud' },
];

// 性别化头像配置 (总计40种：20男20女)，与团队矩阵保持一致
const GENDERED_AVATARS: Record<string, string[]> = {
  Male: [
    'Luo', 'James', 'Jasper', 'Leo', 'Felix', 'John', 'Victor', 'George', 'Oliver', 'Jack',
    'Arthur', 'Dylan', 'Caleb', 'Ethan', 'Ryan', 'Mason', 'Lucas', 'Logan', 'Nolan', 'Julian'
  ],
  Female: [
    'Sarah', 'Aria', 'Lily', 'Nova', 'Mia', 'Zoe', 'Maya', 'Anna', 'Elena', 'Iris',
    'Chloe', 'Ruby', 'Luna', 'Stella', 'Hazel', 'Bella', 'Lucy', 'Daisy', 'Cora', 'Jade'
  ]
};

const SECURITY_LEVELS: UserProfile['securityLevel'][] = ['公开', '内部', '秘密', '机密', '绝密'];

const AccountModal: React.FC<AccountModalProps> = ({ show, onClose, cloudSync }) => {
  const { userProfile, setUserProfile } = useProjectContext();
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState<UserProfile>({ ...userProfile, gender: userProfile.gender || 'Male' });

  // 根据当前性别生成多样化头像（同团队矩阵逻辑）
  const currentGenderAvatars = useMemo(() => {
    const gender = tempProfile.gender || 'Male';
    const happyMouths = ['smile', 'twinkle', 'default'];
    const happyEyes = ['happy', 'wink', 'default'];
    const sadMouths = ['sad', 'serious', 'grimace', 'default'];
    const sadEyes = ['cry', 'squint', 'default'];
    const maleTops = ['shortFlat', 'shortRound', 'shortWaved', 'frizzle', 'dreads01', 'theCaesar', 'theCaesarAndSidePart', 'dreads02', 'shaggy', 'shortCurly'];
    const femaleTops = ['straight01', 'straight02', 'curly', 'curvy', 'dreads', 'frida', 'fro', 'miaWallace', 'longButNotTooLong', 'bob', 'straightAndStrand'];

    return GENDERED_AVATARS[gender].map((seed, idx) => {
      const isHappy = idx % 2 === 0;
      const seedIdx = Math.floor(idx / 2);
      let mouth, eyes;
      if (isHappy) {
        mouth = happyMouths[seedIdx % happyMouths.length];
        eyes = happyEyes[seedIdx % happyEyes.length];
      } else {
        mouth = sadMouths[seedIdx % sadMouths.length];
        eyes = sadEyes[seedIdx % sadEyes.length];
      }
      let genderParams = '';
      if (gender === 'Male') {
        const top = maleTops[seedIdx % maleTops.length];
        const hasFacialHair = seedIdx % 3 === 0;
        genderParams = `&top=${top}&facialHairProbability=${hasFacialHair ? 100 : 0}`;
      } else {
        const top = femaleTops[seedIdx % femaleTops.length];
        genderParams = `&top=${top}&facialHairProbability=0`;
      }
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&mouth=${mouth}&eyes=${eyes}${genderParams}`;
    });
  }, [tempProfile.gender]);

  if (!show) return null;

  const handleSave = () => {
    setUserProfile(tempProfile);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempProfile(userProfile);
    setIsEditing(false);
  };

  const formatSyncTime = (date: Date | null) => {
    if (!date) return '—';
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const syncStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
    local: { label: '仅本地', color: 'text-slate-400', dot: 'bg-slate-400' },
    syncing: { label: '同步中…', color: 'text-blue-600', dot: 'bg-blue-500 animate-pulse' },
    synced: { label: '已同步', color: 'text-emerald-600', dot: 'bg-emerald-500' },
    conflict: { label: '冲突', color: 'text-amber-600', dot: 'bg-amber-500' },
    error: { label: '同步失败', color: 'text-red-600', dot: 'bg-red-500' },
  };

  // ─── 各 Tab 内容 ─────────────────────────────────────────────

  const renderProfileTab = () => (
    <div className="space-y-8">
      {/* Avatar Section */}
      <div className="flex flex-col items-center gap-6">
        <div className={`relative flex flex-col items-center p-6 rounded-[2.5rem] transition-all duration-500 ${isEditing ? 'bg-indigo-50/50 border-4 border-dashed border-indigo-300' : 'bg-transparent border-4 border-transparent'}`}>
          <div className="w-28 h-28 rounded-[2rem] overflow-hidden border-4 border-white shadow-xl relative group bg-white">
            <img
              src={isEditing ? tempProfile.avatar : userProfile.avatar}
              className="w-full h-full bg-slate-50 object-cover"
              alt="Current Avatar"
            />
            {!isEditing && (
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-emerald-500 border-4 border-white rounded-full flex items-center justify-center shadow-lg">
                <i className="fa-solid fa-check text-[10px] text-white"></i>
              </div>
            )}
          </div>
          {isEditing && (
            <div className="mt-6 animate-reveal w-full max-w-md">
              {/* 性别切换 */}
              <div className="w-full mb-4 space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase block px-2">性别 (GENDER)</label>
                <div className="flex bg-white rounded-2xl p-1 border border-slate-200 shadow-sm">
                  <button
                    onClick={() => setTempProfile({ ...tempProfile, gender: 'Male' })}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${tempProfile.gender === 'Male' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className="fa-solid fa-mars text-[12px]"></i> 男性
                  </button>
                  <button
                    onClick={() => setTempProfile({ ...tempProfile, gender: 'Female' })}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 ${tempProfile.gender === 'Female' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className="fa-solid fa-venus text-[12px]"></i> 女性
                  </button>
                </div>
              </div>

              {/* 头像选择网格 */}
              <div className="w-full">
                <div className="flex justify-center items-center gap-2 mb-3">
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2rem]">选择化身 ({tempProfile.gender === 'Male' ? '男性库' : '女性库'})</p>
                  <button
                    title="随机生成头像"
                    onClick={() => {
                      const randomUrl = currentGenderAvatars[Math.floor(Math.random() * currentGenderAvatars.length)];
                      setTempProfile({ ...tempProfile, avatar: randomUrl });
                    }}
                    className="w-5 h-5 rounded-md bg-slate-50 border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-all flex items-center justify-center active:scale-90"
                  >
                    <i className="fa-solid fa-dice text-[10px]"></i>
                  </button>
                </div>
                <div className="grid grid-cols-5 gap-3 max-h-[140px] overflow-y-auto custom-scrollbar pr-1 pb-1">
                  {currentGenderAvatars.map((url, idx) => (
                    <button
                      key={idx}
                      onClick={() => setTempProfile({ ...tempProfile, avatar: url })}
                      className={`w-full aspect-square rounded-xl border-2 transition-all overflow-hidden shadow-sm hover:scale-110 active:scale-95 ${tempProfile.avatar === url ? 'border-indigo-600 ring-2 ring-indigo-100 scale-110 z-10' : 'border-white bg-white opacity-60 hover:opacity-100'}`}
                    >
                      <img src={url} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form / Data Section */}
      <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">研究员姓名</label>
            {isEditing ? (
              <input className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-400 transition-all" value={tempProfile.name} onChange={e => setTempProfile({ ...tempProfile, name: e.target.value })} />
            ) : (
              <p className="text-sm font-black text-slate-800">{userProfile.name}</p>
            )}
          </div>
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">人员标识 (ID)</label>
            <p className="text-sm font-mono font-bold text-slate-400 bg-white py-3 px-3 rounded-xl border border-slate-200 text-center">{userProfile.id}</p>
          </div>

          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">职称 / 角色</label>
            {isEditing ? (
              <input className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-400 transition-all" value={tempProfile.role} onChange={e => setTempProfile({ ...tempProfile, role: e.target.value })} />
            ) : (
              <p className="text-sm font-bold text-indigo-600">{userProfile.role}</p>
            )}
          </div>
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">账户密级权限</label>
            {isEditing ? (
              <select
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none cursor-pointer focus:border-indigo-400 transition-all"
                value={tempProfile.securityLevel}
                onChange={e => setTempProfile({ ...tempProfile, securityLevel: e.target.value as any })}
              >
                {SECURITY_LEVELS.map(level => <option key={level} value={level}>{level}</option>)}
              </select>
            ) : (
              <span className={`inline-block px-3 py-1 rounded-lg text-[10px] font-black uppercase shadow-sm ${userProfile.securityLevel === '绝密' ? 'bg-rose-600 text-white' :
                userProfile.securityLevel === '机密' ? 'bg-amber-500 text-white' :
                  'bg-emerald-500 text-white'
                }`}>
                {userProfile.securityLevel}
              </span>
            )}
          </div>

          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">所属机构</label>
            {isEditing ? (
              <input className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-400 transition-all" value={tempProfile.institution} onChange={e => setTempProfile({ ...tempProfile, institution: e.target.value })} />
            ) : (
              <p className="text-sm font-bold text-slate-700">{userProfile.institution}</p>
            )}
          </div>
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 block">研究领域</label>
            {isEditing ? (
              <input className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:border-indigo-400 transition-all" value={tempProfile.researchArea} onChange={e => setTempProfile({ ...tempProfile, researchArea: e.target.value })} />
            ) : (
              <p className="text-sm font-bold text-slate-700 italic">"{userProfile.researchArea}"</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {!isEditing && (
        <div className="pt-6 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all">
            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">参与课题</p>
            <p className="text-lg font-black text-slate-800">12</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all">
            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">已发布文献</p>
            <p className="text-lg font-black text-slate-800">5</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-indigo-100 transition-all">
            <p className="text-[8px] font-black text-slate-400 uppercase mb-1">贡献记录</p>
            <p className="text-lg font-black text-slate-800">1.2k</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderAccountTab = () => (
    <div className="space-y-6">
      {/* 登录邮箱 */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100/80">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">登录邮箱</label>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
            <i className="fa-solid fa-envelope"></i>
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">{auth.userEmail || '未登录'}</p>
            <p className="text-[8px] font-bold text-slate-400 mt-0.5">Supabase Auth 托管</p>
          </div>
          {auth.isAuthenticated && (
            <span className="ml-auto px-3 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-lg uppercase">已验证</span>
          )}
        </div>
      </div>

      {/* 修改密码 */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100/80">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">密码管理</label>
        <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">点击下方按钮发送密码重置邮件至你注册的邮箱，按照邮件中的链接完成密码修改。</p>
        <button
          onClick={async () => {
            if (auth.userEmail) {
              const result = await auth.resetPassword(auth.userEmail);
              if (!result.error) {
                alert('密码重置邮件已发送，请查收邮箱。');
              } else {
                alert(result.error || '发送失败');
              }
            }
          }}
          disabled={!auth.userEmail}
          className="w-full py-3.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <i className="fa-solid fa-key text-xs"></i>
          发送密码重置邮件
        </button>
      </div>

      {/* 安全信息 */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100/80">
        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 block">会话信息</label>
        <div className="space-y-2.5 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">认证状态</span>
            <span className={`font-black ${auth.isAuthenticated ? 'text-emerald-600' : 'text-red-500'}`}>
              {auth.isAuthenticated ? '已登录' : '未登录'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">用户 ID</span>
            <span className="font-mono text-[9px] text-slate-400 truncate max-w-[180px]">{auth.user?.id || '—'}</span>
          </div>
        </div>
      </div>

      {/* 登出 */}
      <button
        onClick={async () => {
          await auth.signOut();
          onClose();
        }}
        className="w-full py-4 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
      >
        <i className="fa-solid fa-right-from-bracket"></i>
        退出登录
      </button>
    </div>
  );

  const renderSyncTab = () => {
    const isConfigured = isSupabaseConfigured();
    const cs = cloudSync;

    return (
      <div className="space-y-6">
        {!isConfigured && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
            <p className="text-sm font-black text-amber-800">⚠ 尚未配置云同步</p>
            <p className="text-[10px] text-amber-700 leading-relaxed">
              请在项目根目录的 <code className="bg-white px-1.5 py-0.5 rounded text-amber-800 text-[9px]">.env.local</code> 文件中填入 Supabase 凭据。
            </p>
            <a href="https://supabase.com" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-indigo-600 text-[10px] font-bold underline underline-offset-2">
              前往 Supabase 创建项目 →
            </a>
          </div>
        )}

        {isConfigured && cs && (
          <>
            {/* 同步状态卡片 */}
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100/80 space-y-4">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">同步状态</label>
              {cs.isSignedIn && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500">当前账号</span>
                  <span className="text-sm font-black text-slate-800 truncate max-w-[200px]">{cs.userEmail}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">状态</span>
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-black ${syncStatusConfig[cs.syncStatus]?.color || 'text-slate-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${syncStatusConfig[cs.syncStatus]?.dot || 'bg-slate-400'}`} />
                  {syncStatusConfig[cs.syncStatus]?.label || '未知'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500">上次同步</span>
                <span className="text-[10px] font-bold text-slate-600">{formatSyncTime(cs.lastSyncedAt)}</span>
              </div>
            </div>

            {/* 冲突提示 */}
            {cs.conflicts.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-[10px] font-black text-amber-800 mb-3">
                  ⚠ 检测到 {cs.conflicts.length} 个数据冲突
                </p>
                {cs.conflicts.slice(0, 3).map(conflict => (
                  <div key={conflict.projectId} className="flex items-center justify-between py-2 border-t border-amber-200 first:border-0">
                    <span className="text-[10px] text-slate-700 truncate max-w-[150px]">{conflict.localData.title}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => cs.resolveConflictKeepLocal(conflict.projectId)}
                        className="text-[9px] px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-all">保留本地</button>
                      <button onClick={() => cs.resolveConflictKeepCloud(conflict.projectId)}
                        className="text-[9px] px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all">使用云端</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            <button
              onClick={cs.triggerFullSync}
              disabled={cs.syncStatus === 'syncing'}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <i className={`fa-solid fa-arrows-rotate text-xs ${cs.syncStatus === 'syncing' ? 'animate-spin' : ''}`}></i>
              {cs.syncStatus === 'syncing' ? '同步中…' : '立即同步'}
            </button>
          </>
        )}

        {isConfigured && !cs && (
          <div className="text-center py-10 text-slate-400">
            <i className="fa-solid fa-cloud-slash text-2xl opacity-30 mb-3"></i>
            <p className="text-[10px] font-bold">云同步模块未加载</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-[3.5rem] p-8 lg:p-12 animate-reveal shadow-2xl relative border-4 border-white overflow-hidden max-h-[95vh] flex flex-col">
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-rose-500 transition-all active:scale-90 z-10"><i className="fa-solid fa-times text-2xl"></i></button>

        <header className="mb-6 shrink-0">
          <h3 className="text-2xl font-black text-slate-800 uppercase italic border-l-8 border-indigo-600 pl-6 tracking-tighter">
            {isEditing ? '编辑科研档案' : '个人科研空间'}
          </h3>
        </header>

        {/* Tab Navigation */}
        {!isEditing && (
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                <i className={`fa-solid ${tab.icon} text-[10px]`}></i>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 min-h-[420px]">
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'account' && !isEditing && renderAccountTab()}
          {activeTab === 'sync' && !isEditing && renderSyncTab()}
        </div>

        {/* Footer */}
        <footer className="mt-8 shrink-0 flex gap-4">
          {isEditing ? (
            <>
              <button onClick={handleCancel} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[11px] uppercase transition-all hover:bg-slate-200 active:scale-95">取消</button>
              <button onClick={handleSave} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-indigo-100 transition-all hover:bg-black active:scale-95">保存档案变更</button>
            </>
          ) : activeTab === 'profile' ? (
            <>
              <button onClick={onClose} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase transition-all hover:bg-indigo-600 active:scale-95">关闭窗口</button>
              <button onClick={() => setIsEditing(true)} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-indigo-100 transition-all hover:bg-black active:scale-95">
                <i className="fa-solid fa-user-pen mr-2"></i>编辑科研档案
              </button>
            </>
          ) : (
            <button onClick={onClose} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase transition-all hover:bg-indigo-600 active:scale-95">关闭窗口</button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default AccountModal;
