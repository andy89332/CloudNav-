
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Save, Bot, Key, Globe, Sparkles, PauseCircle, Wrench, Box, Copy, Check, List, GripVertical, Filter, LayoutTemplate } from 'lucide-react';
import { AIConfig, LinkItem, Category, SiteSettings } from '../types';
import { generateLinkDescription } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AIConfig;
  siteSettings: SiteSettings;
  onSave: (config: AIConfig, siteSettings: SiteSettings) => void;
  links: LinkItem[];
  categories: Category[];
  onUpdateLinks: (links: LinkItem[]) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, config, siteSettings, onSave, links, categories, onUpdateLinks 
}) => {
  const [activeTab, setActiveTab] = useState<'site' | 'ai' | 'tools' | 'links'>('site');
  const [localConfig, setLocalConfig] = useState<AIConfig>(config);
  const [localSiteSettings, setLocalSiteSettings] = useState<SiteSettings>(siteSettings);
  
  // Bulk Generation State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const shouldStopRef = useRef(false);

  // Tools State
  const [password, setPassword] = useState('');
  const [domain, setDomain] = useState('');
  const [browserType, setBrowserType] = useState<'chrome' | 'firefox'>('chrome');
  
  // Link Management State
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  const availableCategories = useMemo(() => {
      const catIds = Array.from(new Set(links.map(l => l.categoryId)));
      return catIds;
  }, [links]);

  const [copiedStates, setCopiedStates] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      setLocalSiteSettings(siteSettings);
      setIsProcessing(false);
      setProgress({ current: 0, total: 0 });
      shouldStopRef.current = false;
      setDomain(window.location.origin);
      const storedToken = localStorage.getItem('cloudnav_auth_token');
      if (storedToken) setPassword(storedToken);
      setDraggedId(null);
      setFilterCategory('all');
    }
  }, [isOpen, config, siteSettings]);

  const handleChange = (key: keyof AIConfig, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSiteChange = (key: keyof SiteSettings, value: string) => {
    setLocalSiteSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(localConfig, localSiteSettings);
    onClose();
  };

  const handleBulkGenerate = async () => {
    if (!localConfig.apiKey) {
        alert("请先配置并保存 API Key");
        return;
    }

    const missingLinks = links.filter(l => !l.description);
    if (missingLinks.length === 0) {
        alert("所有链接都已有描述！");
        return;
    }

    if (!confirm(`发现 ${missingLinks.length} 个链接缺少描述，确定要使用 AI 自动生成吗？这可能需要一些时间。`)) return;

    setIsProcessing(true);
    shouldStopRef.current = false;
    setProgress({ current: 0, total: missingLinks.length });
    
    let currentLinks = [...links];

    for (let i = 0; i < missingLinks.length; i++) {
        if (shouldStopRef.current) break;

        const link = missingLinks[i];
        try {
            const desc = await generateLinkDescription(link.title, link.url, localConfig);
            currentLinks = currentLinks.map(l => l.id === link.id ? { ...l, description: desc } : l);
            onUpdateLinks(currentLinks);
            setProgress({ current: i + 1, total: missingLinks.length });
        } catch (e) {
            console.error(`Failed to generate for ${link.title}`, e);
        }
    }

    setIsProcessing(false);
  };

  const handleStop = () => {
      shouldStopRef.current = true;
      setIsProcessing(false);
  };

  const handleCopy = (text: string, key: string) => {
      navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => {
          setCopiedStates(prev => ({ ...prev, [key]: false }));
      }, 2000);
  };

  // --- Drag and Drop Logic ---

  const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedId(id);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
      e.preventDefault(); 
      if (!draggedId || draggedId === targetId) return;
      
      const newLinks = [...links];
      const sourceIndex = newLinks.findIndex(l => l.id === draggedId);
      const targetIndex = newLinks.findIndex(l => l.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) return;

      const [movedItem] = newLinks.splice(sourceIndex, 1);
      newLinks.splice(targetIndex, 0, movedItem);
      
      onUpdateLinks(newLinks);
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDraggedId(null);
  };

  const filteredLinks = useMemo(() => {
      if (filterCategory === 'all') return links;
      return links.filter(l => l.categoryId === filterCategory);
  }, [links, filterCategory]);

  // --- Extension Generators ---

  const chromeManifest = `{
  "manifest_version": 3,
  "name": "CloudNav Assistant",
  "version": "3.1",
  "permissions": ["activeTab"],
  "action": {
    "default_popup": "popup.html",
    "default_title": "Save to CloudNav"
  }
}`;

  const firefoxManifest = `{
  "manifest_version": 3,
  "name": "CloudNav Assistant",
  "version": "3.1",
  "permissions": ["activeTab"],
  "browser_specific_settings": {
    "gecko": {
      "id": "cloudnav@example.com",
      "strict_min_version": "109.0"
    }
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "Save to CloudNav"
  }
}`;

  const extManifest = browserType === 'chrome' ? chromeManifest : firefoxManifest;

  const extPopupHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { width: 320px; padding: 16px; font-family: -apple-system, sans-serif; background: #f8fafc; }
    h3 { margin: 0 0 16px 0; font-size: 16px; color: #0f172a; }
    label { display: block; font-size: 12px; color: #64748b; margin-bottom: 4px; }
    input, select { width: 100%; margin-bottom: 12px; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-size: 14px; }
    button { width: 100%; background: #3b82f6; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #2563eb; }
    button:disabled { background: #94a3b8; cursor: not-allowed; }
    #status { margin-top: 12px; text-align: center; font-size: 12px; min-height: 18px; }
    #warning { color: #f59e0b; font-size: 12px; margin-bottom: 10px; display: none; }
    .error { color: #ef4444; }
    .success { color: #22c55e; }
  </style>
</head>
<body>
  <h3>Save to CloudNav</h3>
  
  <div id="warning">⚠️ This URL already exists!</div>

  <label>Title</label>
  <input type="text" id="title" placeholder="Website Title">
  
  <label>Category</label>
  <select id="category">
    <option value="" disabled selected>Loading categories...</option>
  </select>
  
  <button id="saveBtn">Save Bookmark</button>
  <div id="status"></div>
  
  <script src="popup.js"></script>
</body>
</html>`;

  const extPopupJs = `const CONFIG = {
  apiBase: "${domain}",
  password: "${password}"
};

document.addEventListener('DOMContentLoaded', async () => {
  const titleInput = document.getElementById('title');
  const catSelect = document.getElementById('category');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const warningDiv = document.getElementById('warning');
  
  let currentTabUrl = '';

  // API handling for both Chrome and Firefox
  const browserAPI = window.chrome || window.browser;

  // 1. Get Current Tab Info
  if (browserAPI && browserAPI.tabs) {
      const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        titleInput.value = tabs[0].title || '';
        currentTabUrl = tabs[0].url || '';
      }
  }

  // 2. Fetch Data (Categories & Check Duplicates)
  try {
    const res = await fetch(\`\${CONFIG.apiBase}/api/storage\`, {
      headers: { 'x-auth-password': CONFIG.password }
    });
    
    if (!res.ok) throw new Error('Auth failed. Check password.');
    
    const data = await res.json();
    
    // Check Duplicate
    if (data.links) {
        const cleanCurrent = currentTabUrl.replace(/\/$/, '').toLowerCase();
        const exists = data.links.some(l => l.url.replace(/\/$/, '').toLowerCase() === cleanCurrent);
        if (exists) {
            warningDiv.style.display = 'block';
            saveBtn.textContent = 'Save Anyway (Duplicate)';
        }
    }

    // Populate Categories
    catSelect.innerHTML = '';
    const sorted = data.categories.sort((a,b) => {
        if(a.id === 'common') return -1;
        if(b.id === 'common') return 1;
        return 0;
    });

    sorted.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });

    catSelect.value = 'common';

  } catch (e) {
    statusDiv.textContent = 'Error: ' + e.message;
    statusDiv.className = 'error';
    catSelect.innerHTML = '<option>Load failed</option>';
    saveBtn.disabled = true;
  }

  // 3. Save Handler
  saveBtn.addEventListener('click', async () => {
    const catId = catSelect.value;
    const title = titleInput.value;
    
    if (!currentTabUrl) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    statusDiv.textContent = '';

    try {
      const res = await fetch(\`\${CONFIG.apiBase}/api/link\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-password': CONFIG.password
        },
        body: JSON.stringify({
          title: title,
          url: currentTabUrl,
          categoryId: catId
        })
      });

      if (res.ok) {
        statusDiv.textContent = 'Saved successfully!';
        statusDiv.className = 'success';
        setTimeout(() => window.close(), 1200);
      } else {
        throw new Error(res.statusText);
      }
    } catch (e) {
      statusDiv.textContent = 'Save failed: ' + e.message;
      statusDiv.className = 'error';
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Bookmark';
    }
  });
});`;

  if (!isOpen) return null;

  const tabs = [
    { id: 'site', label: '网站设置', icon: LayoutTemplate },
    { id: 'ai', label: 'AI 设置', icon: Bot },
    { id: 'links', label: '链接管理', icon: List },
    { id: 'tools', label: '扩展工具', icon: Wrench },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex gap-4 overflow-x-auto no-scrollbar">
              {tabs.map(tab => (
                 <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`text-sm font-semibold flex items-center gap-2 pb-1 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    <tab.icon size={18} /> {tab.label}
                  </button>
              ))}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto min-h-[300px] flex-1">
            
            {activeTab === 'site' && (
                <div className="space-y-4">
                     <div>
                        <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
                           <LayoutTemplate size={16} className="text-blue-500"/> 浏览器标签标题设置
                        </h4>
                        <p className="text-xs text-slate-500 mb-3">配置浏览器标签页显示的网站标题，让您的书签管理器更具个性化。</p>
                        
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">网站标题 (Title)</label>
                                <input
                                    type="text"
                                    value={localSiteSettings.title}
                                    onChange={(e) => handleSiteChange('title', e.target.value)}
                                    placeholder="CloudNav - 我的导航"
                                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">显示在浏览器标签页上的标题</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">网页导航名称 (Navbar Name)</label>
                                <input
                                    type="text"
                                    value={localSiteSettings.navTitle}
                                    onChange={(e) => handleSiteChange('navTitle', e.target.value)}
                                    placeholder="CloudNav"
                                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">显示在网页左上角的导航名称</p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">网站图标 (Favicon URL)</label>
                                <div className="flex gap-2">
                                    <div className="shrink-0 w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                        {localSiteSettings.favicon ? (
                                            <img src={localSiteSettings.favicon} className="w-full h-full object-contain" onError={(e) => e.currentTarget.style.display='none'} />
                                        ) : (
                                            <Globe size={18} className="text-slate-400"/>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        value={localSiteSettings.favicon}
                                        onChange={(e) => handleSiteChange('favicon', e.target.value)}
                                        placeholder="/favicon.ico"
                                        className="flex-1 p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">网站图标的 URL 地址</p>
                            </div>
                        </div>
                     </div>
                </div>
            )}

            {activeTab === 'ai' && (
                <>
                    {/* Provider Selection */}
                    <div>
                        <label className="block text-sm font-medium mb-2 dark:text-slate-300">API 提供商</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => handleChange('provider', 'gemini')}
                                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                                    localConfig.provider === 'gemini'
                                    ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-300'
                                    : 'border-slate-200 dark:border-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                <span className="font-semibold">Google Gemini</span>
                            </button>
                            <button
                                onClick={() => handleChange('provider', 'openai')}
                                className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-all ${
                                    localConfig.provider === 'openai'
                                    ? 'bg-purple-50 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:border-purple-500 dark:text-purple-300'
                                    : 'border-slate-200 dark:border-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            >
                                <span className="font-semibold">OpenAI 兼容</span>
                            </button>
                        </div>
                    </div>

                    {/* Model Config */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                                <Key size={12}/> API Key
                            </label>
                            <input
                                type="password"
                                value={localConfig.apiKey}
                                onChange={(e) => handleChange('apiKey', e.target.value)}
                                placeholder="sk-..."
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>

                        {localConfig.provider === 'openai' && (
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                                    <Globe size={12}/> Base URL (API 地址)
                                </label>
                                <input
                                    type="text"
                                    value={localConfig.baseUrl}
                                    onChange={(e) => handleChange('baseUrl', e.target.value)}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    例如: https://api.deepseek.com/v1 (不需要加 /chat/completions)
                                </p>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                                <Sparkles size={12}/> 模型名称
                            </label>
                            <input
                                type="text"
                                value={localConfig.model}
                                onChange={(e) => handleChange('model', e.target.value)}
                                placeholder={localConfig.provider === 'gemini' ? "gemini-2.5-flash" : "gpt-3.5-turbo"}
                                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Bulk Actions */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-medium dark:text-white mb-3 flex items-center gap-2">
                            <Sparkles className="text-amber-500" size={16} /> 批量操作
                        </h4>
                        
                        {isProcessing ? (
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg space-y-3">
                                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300">
                                    <span>正在生成描述...</span>
                                    <span>{progress.current} / {progress.total}</span>
                                </div>
                                <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                                    <div 
                                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(progress.current / progress.total) * 100}%` }}
                                    ></div>
                                </div>
                                <button 
                                    onClick={handleStop}
                                    className="w-full py-1.5 text-xs flex items-center justify-center gap-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded border border-red-200 dark:border-red-800 transition-colors"
                                >
                                    <PauseCircle size={12} /> 停止处理
                                </button>
                            </div>
                        ) : (
                            <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                    自动扫描所有没有描述的链接，并调用上方配置的 AI 模型生成简介。
                                </div>
                                <button
                                    onClick={handleBulkGenerate}
                                    className="w-full py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-blue-500 hover:text-blue-500 dark:hover:text-blue-400 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Sparkles size={16} /> 一键补全所有描述
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === 'links' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                         <p className="text-xs text-slate-500">拖拽调整顺序</p>
                         <div className="flex items-center gap-2">
                             <Filter size={14} className="text-slate-400" />
                             <select 
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="text-sm p-1.5 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white outline-none"
                             >
                                <option value="all">所有分类</option>
                                {availableCategories.map(catId => (
                                    <option key={catId} value={catId}>
                                        {categories.find(c => c.id === catId)?.name || catId}
                                    </option>
                                ))}
                             </select>
                         </div>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                        {filteredLinks.length === 0 && <p className="text-sm text-center text-slate-400 py-8">该分类下暂无链接</p>}
                        {filteredLinks.map((link) => (
                            <div 
                                key={link.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, link.id)}
                                onDragOver={(e) => handleDragOver(e, link.id)}
                                onDrop={handleDrop}
                                className={`flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg group cursor-move transition-all border ${
                                    draggedId === link.id ? 'opacity-50 border-blue-500 border-dashed' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600'
                                }`}
                            >
                                <div className="text-slate-400 cursor-move">
                                    <GripVertical size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm truncate dark:text-slate-200">{link.title}</div>
                                    <div className="text-xs text-slate-400 truncate">{link.url}</div>
                                </div>
                                <div className="text-xs text-slate-400 px-2 bg-slate-200 dark:bg-slate-800 rounded">
                                     {categories.find(c => c.id === link.categoryId)?.name || link.categoryId}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'tools' && (
                <div className="space-y-6">
                    <div className="space-y-3">
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                            第一步：输入您的访问密码 (用于生成代码)
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono tracking-widest"
                            placeholder="部署时设置的 PASSWORD"
                        />
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-bold dark:text-white text-sm flex items-center gap-2">
                                <Box size={16} /> 浏览器扩展 (弹窗选择版)
                            </h4>
                            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1 text-xs font-medium">
                                <button 
                                    onClick={() => setBrowserType('chrome')}
                                    className={`px-3 py-1 rounded-md transition-all ${browserType === 'chrome' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    Chrome / Edge
                                </button>
                                <button 
                                    onClick={() => setBrowserType('firefox')}
                                    className={`px-3 py-1 rounded-md transition-all ${browserType === 'firefox' ? 'bg-white dark:bg-slate-600 shadow text-orange-600 dark:text-orange-300' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    Firefox
                                </button>
                            </div>
                        </div>
                        
                        <p className="text-xs text-slate-500 mb-4">
                            在本地创建一个文件夹，创建以下 3 个文件，然后使用“加载已解压的扩展程序”(Chrome) 或 “临时加载附加组件”(Firefox) 安装。
                        </p>
                        
                        <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                            {/* File 1: Manifest */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-mono font-bold text-slate-500">1. manifest.json ({browserType})</span>
                                    <button 
                                        onClick={() => handleCopy(extManifest, 'manifest')}
                                        className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 text-slate-600 dark:text-slate-300"
                                    >
                                        {copiedStates['manifest'] ? <Check size={12}/> : <Copy size={12}/>} 复制
                                    </button>
                                </div>
                                <pre className="bg-slate-100 dark:bg-slate-900 p-3 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-700">
                                    {extManifest}
                                </pre>
                            </div>

                            {/* File 2: Popup HTML */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-mono font-bold text-slate-500">2. popup.html</span>
                                    <button 
                                        onClick={() => handleCopy(extPopupHtml, 'popuphtml')}
                                        className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 text-slate-600 dark:text-slate-300"
                                    >
                                        {copiedStates['popuphtml'] ? <Check size={12}/> : <Copy size={12}/>} 复制
                                    </button>
                                </div>
                                <pre className="bg-slate-100 dark:bg-slate-900 p-3 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-700">
                                    {extPopupHtml}
                                </pre>
                            </div>
                            
                            {/* File 3: Popup JS */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-mono font-bold text-slate-500">3. popup.js</span>
                                    <button 
                                        onClick={() => handleCopy(extPopupJs, 'popupjs')}
                                        className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 text-slate-600 dark:text-slate-300"
                                    >
                                        {copiedStates['popupjs'] ? <Check size={12}/> : <Copy size={12}/>} 复制
                                    </button>
                                </div>
                                <pre className="bg-slate-100 dark:bg-slate-900 p-3 rounded text-[10px] font-mono text-slate-600 dark:text-slate-300 overflow-x-auto border border-slate-200 dark:border-slate-700">
                                    {extPopupJs}
                                </pre>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>

        {activeTab === 'ai' || activeTab === 'site' ? (
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3 shrink-0">
                <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">取消</button>
                <button 
                    onClick={handleSave}
                    className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 font-medium"
                >
                    <Save size={16} /> 保存设置
                </button>
            </div>
        ) : null}
      </div>
    </div>
  );
};

export default SettingsModal;
