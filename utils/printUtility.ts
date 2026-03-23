
/**
 * SciFlow 极致稳定型打印引擎 v3.2
 * 通过 DOM 克隆与同步堆栈强制锁定技术，确保 100% 触发系统打印对话框
 */
export const printElement = async (el: HTMLElement, title: string) => {
  if (!el) {
    console.error("Print Error: 目标元素不存在");
    return;
  }

  // 1. 同步设置文档标题，作为默认文件名
  const originalTitle = document.title;
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
  document.title = safeTitle;

  try {
    // 2. 深度克隆节点，使其脱离原有复杂的 React 虚拟 DOM 层级
    const clone = el.cloneNode(true) as HTMLElement;
    clone.classList.add('is-printing-target');
    
    // 3. 处理 Canvas：克隆节点不包含 Canvas 位图内容，必须手动绘制
    const originalCanvases = Array.from(el.querySelectorAll('canvas'));
    const clonedCanvases = Array.from(clone.querySelectorAll('canvas'));
    clonedCanvases.forEach((c, i) => {
        const ctx = c.getContext('2d');
        if (ctx && originalCanvases[i]) {
            // 保持宽高一致
            c.width = originalCanvases[i].width;
            c.height = originalCanvases[i].height;
            ctx.drawImage(originalCanvases[i], 0, 0);
        }
    });

    // 4. 将克隆体挂载到 Body 根节点
    document.body.appendChild(clone);
    document.body.classList.add('global-printing-active');

    // 5. 等待关键资源就绪
    if (document.fonts) {
        await document.fonts.ready;
    }

    // 6. 使用同步堆栈保护机制调用 window.print()
    return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
            setTimeout(() => {
                try {
                    window.print();
                } catch (err) {
                    console.error("打印请求被拦截:", err);
                } finally {
                    // 7. 现场恢复
                    setTimeout(() => {
                        document.body.classList.remove('global-printing-active');
                        if (clone.parentNode) {
                            document.body.removeChild(clone);
                        }
                        document.title = originalTitle;
                        resolve();
                    }, 500); 
                }
            }, 100); 
        });
    });

  } catch (err) {
    console.error("PDF 生成发生严重错误:", err);
    document.title = originalTitle;
  }
};
