
import { useCallback } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import saveAs from 'file-saver';

/**
 * 跨平台文件导出钩子：
 * 1. 在 Electron 环境下调用原生对话框，支持保存到用户指定磁盘位置。
 * 2. 在浏览器/VDE 环境下通过 file-saver 触发沙盒下载。
 */
export const useFileExport = () => {
  const { showToast } = useProjectContext();

  const handleSecureSave = useCallback(async (fileName: string, content: string | Blob) => {
    // 1. Electron 环境检测 (通过预加载脚本注入的 window.electron)
    if (window.electron && window.electron.saveFile) {
      try {
        const lastPath = localStorage.getItem('sciflow_last_save_path');
        
        let stringContent = content;
        if (content instanceof Blob) {
            stringContent = await content.text();
        }

        // 调用 Electron 主进程的保存功能
        const result = await window.electron.saveFile({ 
            name: fileName, 
            content: stringContent as string, 
            defaultPath: lastPath || undefined 
        });

        if (result.success && result.filePath) {
          // 路径兼容性处理：提取目录用于下一次默认保存
          const lastSeparatorIndex = Math.max(result.filePath.lastIndexOf('\\'), result.filePath.lastIndexOf('/'));
          if (lastSeparatorIndex !== -1) {
              localStorage.setItem('sciflow_last_save_path', result.filePath.substring(0, lastSeparatorIndex));
          }

          showToast({
            message: `成功保存至：${result.filePath}`,
            type: 'success',
            actionLabel: '在文件夹中显示',
            onAction: () => window.electron?.showItemInFolder(result.filePath!)
          });
        }
      } catch (error) {
        console.error("Electron native save failed:", error);
        showToast({ message: '本地磁盘写入失败，请检查权限。', type: 'error' });
      }
    } else {
      // 2. Web / VDE 环境回退逻辑
      try {
        saveAs(content, fileName);
        showToast({ message: '文档已触发浏览器下载', type: 'success' });
      } catch (error) {
        console.error("Browser save failed:", error);
        showToast({ message: '下载失败，浏览器可能拦截了自动保存。', type: 'error' });
      }
    }
  }, [showToast]);

  return {
    handleSecureSave
  };
};
