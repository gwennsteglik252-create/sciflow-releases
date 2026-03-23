import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, DebatePersona } from '../../types';
import { runExpertDebate, synthesizeDebateConsensus } from '../../services/gemini/chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useTranslation } from '../../locales/useTranslation';

interface DebateViewProps {
  session: any;
  onUpdateSession: (updates: any) => void;
  personas: DebatePersona[];
  isLight: boolean;
  projectContext: string;
}

const DebateView: React.FC<DebateViewProps> = ({ session, onUpdateSession, personas, isLight, projectContext }) => {
  const { t } = useTranslation();
  const [proposition, setProposition] = useState(session.proposition || '');
  const [isDebating, setIsDebating] = useState(false);
  const [consensus, setConsensus] = useState<{summary: string, verdict: string, actionItems: string[]} | null>(session.consensus || null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages, isDebating, consensus]);

  const runFullDebate = async () => {
    if (!proposition.trim() || isDebating) return;

    setIsDebating(true);
    setConsensus(null);
    onUpdateSession({ proposition, messages: [], isComplete: false, consensus: null });

    let currentTranscript = "";
    const updatedMessages: ChatMessage[] = [];

    // Turn 1 & 2: First two experts express conflicting views
    for (const persona of personas.slice(0, 2)) {
        try {
            const agentSpeech = await runExpertDebate(proposition, projectContext, persona, currentTranscript);
            const msg: ChatMessage = {
                role: 'model',
                agentId: persona.id,
                text: agentSpeech,
                timestamp: new Date().toLocaleTimeString()
            };
            updatedMessages.push(msg);
            currentTranscript += `${persona.name}: ${agentSpeech}\n\n`;
            onUpdateSession({ messages: [...updatedMessages] });
            // Add a small delay for "reading time" feeling
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.error(e);
        }
    }

    // Turn 3: The Elder expert or third expert chimes in
    if (personas[2]) {
        try {
            const persona = personas[2];
            const agentSpeech = await runExpertDebate(proposition, projectContext, persona, currentTranscript);
            const msg: ChatMessage = {
                role: 'model',
                agentId: persona.id,
                text: agentSpeech,
                timestamp: new Date().toLocaleTimeString()
            };
            updatedMessages.push(msg);
            currentTranscript += `${persona.name}: ${agentSpeech}\n\n`;
            onUpdateSession({ messages: [...updatedMessages] });
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {}
    }

    // Synthesis: Chairman reaches consensus
    try {
        const finalConsensus = await synthesizeDebateConsensus(proposition, currentTranscript);
        setConsensus(finalConsensus);
        onUpdateSession({ isComplete: true, consensus: finalConsensus });
    } catch (e) {
        console.error("Synthesis failed", e);
    } finally {
        setIsDebating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-900 text-white relative">
      <header className="px-8 py-6 border-b border-white/5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <i className="fa-solid fa-users-between-lines"></i>
             </div>
             <div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">{t('aiAssistant.debate.title')}</h3>
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2rem] mt-1">{t('aiAssistant.debate.modeSubtitle')}</p>
             </div>
          </div>
          <div className="flex gap-2">
             {personas.map(p => (
                 <div key={p.id} className="flex flex-col items-center gap-1 group relative">
                    <img src={p.avatar} className="w-8 h-8 rounded-full border border-white/20 shadow-lg grayscale group-hover:grayscale-0 transition-all" alt={p.name} />
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 p-3 bg-slate-800 border border-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none shadow-2xl">
                        <p className="text-[10px] font-black text-white uppercase">{p.name}</p>
                        <p className="text-[8px] text-slate-400 italic mt-1 leading-relaxed">{p.description}</p>
                    </div>
                 </div>
             ))}
          </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-12">
        {!session.isComplete && !isDebating && session.messages.length === 0 ? (
            <div className="max-w-2xl mx-auto flex flex-col items-center justify-center h-full text-center py-20">
                <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-600/10 border-2 border-dashed border-indigo-500/30 flex items-center justify-center mb-8 animate-pulse">
                    <i className="fa-solid fa-brain text-4xl text-indigo-400"></i>
                </div>
                <h4 className="text-2xl font-black text-slate-400 uppercase italic mb-4">{t('aiAssistant.debate.setProposition')}</h4>
                <p className="text-sm text-slate-500 mb-10 leading-relaxed italic">{t('aiAssistant.debate.propositionDesc')}</p>
                
                <div className="w-full relative group">
                    <textarea 
                        className="w-full bg-white/5 border-2 border-white/10 rounded-[2rem] p-8 text-lg font-medium text-white outline-none focus:border-amber-500/50 transition-all shadow-inner min-h-[160px] resize-none"
                        placeholder={t('aiAssistant.debate.propositionPlaceholder')}
                        value={proposition}
                        onChange={e => setProposition(e.target.value)}
                    />
                    <button 
                        onClick={runFullDebate}
                        disabled={!proposition.trim() || isDebating}
                        className="absolute bottom-6 right-6 px-10 py-4 bg-amber-500 text-slate-900 rounded-2xl font-black uppercase text-xs shadow-xl shadow-amber-500/20 hover:scale-[1.05] transition-all active:scale-95 disabled:opacity-30"
                    >
                        {t('aiAssistant.debate.startDebate')}
                    </button>
                </div>
            </div>
        ) : (
            <div className="max-w-4xl mx-auto space-y-12 pb-32">
                {/* The Proposition Header */}
                <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 opacity-5"><i className="fa-solid fa-quote-right text-6xl"></i></div>
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2">{t('aiAssistant.debate.propositionLabel')}</p>
                    <h4 className="text-xl font-black text-white italic">{proposition}</h4>
                </div>

                {/* Debate Messages */}
                <div className="space-y-8">
                    {session.messages.map((msg: ChatMessage, idx: number) => {
                        const persona = personas.find(p => p.id === msg.agentId);
                        return (
                            <div key={idx} className={`flex gap-6 animate-reveal ${idx % 2 === 0 ? 'flex-row' : 'flex-row-reverse text-right'}`}>
                                <div className="shrink-0">
                                    <div className="relative">
                                        <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white/10 shadow-xl bg-slate-800">
                                            <img src={persona?.avatar} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] shadow-lg border border-white/10`} style={{ backgroundColor: persona?.color }}>
                                            <i className={`fa-solid ${persona?.icon} text-white`}></i>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0 max-w-xl">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap" style={{ justifyContent: idx % 2 === 0 ? 'flex-start' : 'flex-end' }}>
                                        <span className="text-[11px] font-black uppercase" style={{ color: persona?.color }}>{persona?.name}</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{persona?.title}</span>
                                    </div>
                                    <div className={`p-6 rounded-[2rem] shadow-xl border ${idx % 2 === 0 ? 'rounded-tl-none bg-slate-800 border-white/5' : 'rounded-tr-none bg-indigo-900/30 border-indigo-500/20'}`}>
                                        <div className="markdown-body text-[13.5px] leading-relaxed text-indigo-50/90 italic">
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm, remarkMath]} 
                                                rehypePlugins={[rehypeKatex]}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                    <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-2">{msg.timestamp}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {isDebating && (
                    <div className="flex justify-center py-10 animate-pulse">
                        <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-8 py-4 rounded-full">
                            <div className="flex gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{animationDelay: '0s'}}></div>
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{animationDelay: '0.2s'}}></div>
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{animationDelay: '0.4s'}}></div>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3rem]">{t('aiAssistant.debate.debating')}</span>
                        </div>
                    </div>
                )}

                {/* Consensus Block */}
                {consensus && (
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border-2 border-indigo-500/30 rounded-[3rem] p-10 shadow-[0_25px_60px_rgba(0,0,0,0.5)] animate-reveal relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-10 opacity-10"><i className="fa-solid fa-file-signature text-8xl text-indigo-400"></i></div>
                        
                        <header className="flex justify-between items-center mb-8 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-500 shadow-xl ring-2 ring-emerald-500/30">
                                    <i className="fa-solid fa-check-double text-xl"></i>
                                </div>
                                <div>
                                    <h4 className="text-2xl font-black uppercase italic tracking-tighter text-white">{t('aiAssistant.debate.consensusTitle')}</h4>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t('aiAssistant.debate.consensusSubtitle')}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-[8px] font-black text-slate-500 uppercase mb-1">{t('aiAssistant.debate.finalVerdict')}</span>
                                <span className="px-4 py-1.5 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase shadow-lg border border-white/10">{consensus.verdict}</span>
                            </div>
                        </header>

                        <div className="space-y-8 relative z-10">
                            <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                                <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-3">{t('aiAssistant.debate.summaryLabel')}</h5>
                                <p className="text-[13px] font-medium leading-relaxed text-slate-200 italic">{consensus.summary}</p>
                            </div>

                            <div className="space-y-4">
                                <h5 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest px-2">{t('aiAssistant.debate.actionItemsLabel')}</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {consensus.actionItems.map((item: string, i: number) => (
                                        <div key={i} className="flex gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group">
                                            <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-black text-xs shrink-0 shadow-inner group-hover:scale-110 transition-transform">{i+1}</div>
                                            <p className="text-[11px] font-bold text-slate-300 leading-snug">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-10 pt-6 border-t border-white/10 flex justify-between items-center opacity-40">
                             <p className="text-[8px] font-black text-slate-500 uppercase">{t('aiAssistant.verificationCode')}: SF-DEBATE-SYNC-712</p>
                             <button onClick={runFullDebate} className="text-[9px] font-black text-indigo-400 hover:text-white transition-colors uppercase"><i className="fa-solid fa-rotate-right mr-2"></i> {t('aiAssistant.debate.rerun')}</button>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>

      {isDebating && (
          <div className="absolute top-0 left-0 w-full h-1 z-[1000]">
              <div className="h-full bg-amber-500 animate-[loading_2s_infinite]"></div>
          </div>
      )}

      <style>{`
        @keyframes loading {
            0% { width: 0%; left: 0%; }
            50% { width: 40%; }
            100% { width: 0%; left: 100%; }
        }
      `}</style>
    </div>
  );
};

export default DebateView;