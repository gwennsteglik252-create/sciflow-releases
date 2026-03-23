import{$ as l,a0 as g,a1 as c,a2 as p}from"./index-6tIthkPL.js";const d=async(r,s="weekly")=>{if(r.length===0)return{id:`digest_${Date.now()}`,period:s,generatedAt:new Date().toISOString(),topicClusters:[],overallInsight:"当前订阅流中没有可分析的论文。",feedItemCount:0};const a=r.slice(0,30).map((t,i)=>{var e;return{idx:i,id:t.id,title:t.title||t.englishTitle,authors:((e=t.authors)==null?void 0:e.slice(0,2).join(", "))||"",year:t.year,source:t.source,abstract:(t.abstract||"").substring(0,200)}});try{const t=await l(async e=>{const o=`你是一位资深的科研情报分析师。请对以下 ${a.length} 篇最新学术论文进行主题聚类和趋势分析。

要求：
1. 将论文按研究主题分成 2-5 个聚类（cluster）
2. 每个聚类需要：
   - topic: 主题名称（中文，简洁）
   - paperIdxList: 属于该聚类的论文 idx 数组
   - aiSummary: 中文摘要总结（80-150字），概括该主题下论文的共同发现
   - trendInsight: 趋势洞察（50-80字），分析该研究方向的发展趋势
3. 最后给出 overallInsight: 全局趋势总结（100-200字）

输出 JSON 格式：
{
  "clusters": [{ "topic": "", "paperIdxList": [], "aiSummary": "", "trendInsight": "" }],
  "overallInsight": ""
}

论文列表：
${JSON.stringify(a)}`,n=await e.models.generateContent({model:c,contents:o,config:g});return JSON.parse(p(n.text||"{}"))}),i=(t.clusters||[]).map(e=>({topic:e.topic||"未分类",paperIds:(e.paperIdxList||[]).map(o=>{var n;return(n=a[o])==null?void 0:n.id}).filter(Boolean),aiSummary:e.aiSummary||"",trendInsight:e.trendInsight||""}));return{id:`digest_${Date.now()}`,period:s,generatedAt:new Date().toISOString(),topicClusters:i,overallInsight:t.overallInsight||"分析完成。",feedItemCount:r.length}}catch(t){return console.error("[Digest] Generation failed:",t),{id:`digest_${Date.now()}`,period:s,generatedAt:new Date().toISOString(),topicClusters:[],overallInsight:"AI 摘要生成失败，请稍后重试。",feedItemCount:r.length}}};export{d as generateDigest};
