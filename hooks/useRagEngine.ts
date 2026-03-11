
import { useState, useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import { generateEmbeddings, cosineSimilarity, synthesizeRagAnswer } from '../services/gemini/rag';
import { vault } from '../services/persistence';

export interface IndexedChunk {
    id: string;
    literatureId: string;
    text: string;
    embedding: number[];
}

export const useRagEngine = () => {
    const { showToast, resources, setAiStatus } = useProjectContext();
    const [isIndexing, setIsIndexing] = useState(false);
    const [indexProgress, setIndexProgress] = useState(0);
    const [query, setQuery] = useState('');
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const startIndexing = useCallback(async () => {
        const docsToIndex = resources.filter(r => r.abstract && r.abstract.length > 50);
        if (docsToIndex.length === 0) {
            showToast({ message: "没有足够的文献内容可供索引", type: 'info' });
            return;
        }

        setIsIndexing(true);
        setAiStatus?.('🧠 正在构建语义化科研知识网...');
        
        try {
            let completed = 0;
            for (const doc of docsToIndex) {
                // 串行节奏管控：每个文档之间强制停顿，避免触碰 TPM 限制
                if (completed > 0) {
                    await new Promise(r => setTimeout(r, 2500));
                }

                const vector = await generateEmbeddings(doc.abstract);
                const chunk: IndexedChunk = {
                    id: `chunk_${doc.id}_0`,
                    literatureId: doc.id,
                    text: doc.abstract,
                    embedding: vector
                };
                await vault.putOne('document_embeddings', chunk);
                
                completed++;
                setIndexProgress(Math.round((completed / docsToIndex.length) * 100));
            }
            showToast({ message: "语义索引构建完成", type: 'success' });
        } catch (e) {
            console.error("Indexing error", e);
            showToast({ message: "索引构建中断，已保存部分进度", type: 'error' });
        } finally {
            setIsIndexing(false);
            setIndexProgress(0);
            setAiStatus?.(null);
        }
    }, [resources, setAiStatus, showToast]);

    const handleSearch = async () => {
        if (!query.trim() || isLoading) return;
        
        setIsLoading(true);
        const userMsg = query;
        setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
        setQuery('');

        try {
            const queryVector = await generateEmbeddings(userMsg);
            const allEmbeddings = await vault.getAll<IndexedChunk>('document_embeddings');
            const ranked = allEmbeddings
                .map(chunk => ({
                    ...chunk,
                    score: cosineSimilarity(queryVector, chunk.embedding)
                }))
                .filter(c => c.score > 0.4) 
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            if (ranked.length === 0) {
                setChatHistory(prev => [...prev, { role: 'model', text: "在本地知识库中未找到直接相关的证据。建议先导入更多相关文献。" }]);
                return;
            }

            const contextTexts = ranked.map(c => {
                const lit = resources.find(r => r.id === c.literatureId);
                return `【文献: ${lit?.title || 'Unknown'}】: ${c.text}`;
            });
            
            const answer = await synthesizeRagAnswer(userMsg, contextTexts);
            setChatHistory(prev => [...prev, { role: 'model', text: answer }]);
        } catch (e) {
            showToast({ message: "科研大脑响应异常", type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return { 
        isIndexing, indexProgress, query, setQuery, 
        chatHistory, isLoading, handleSearch, startIndexing 
    };
};
