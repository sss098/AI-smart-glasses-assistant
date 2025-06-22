import * as fs from 'fs';
import * as path from 'path';

export function saveImageToLocal(imageData: Uint8Array, filename: string): Promise<void> {
    return new Promise((resolve, reject) => {
        try {
            // 确保文件名以.jpg结尾
            if (!filename.endsWith('.jpg')) {
                filename += '.jpg';
            }
            
            // 创建Blob对象
            const blob = new Blob([imageData], { type: 'image/jpeg' });
            
            // 创建下载链接
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            
            // 触发下载
            document.body.appendChild(link);
            link.click();
            
            // 清理
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            resolve();
        } catch (error) {
            reject(error);
        }
    });
} 