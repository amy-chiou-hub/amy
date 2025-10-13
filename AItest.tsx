import { GoogleGenAI } from '@google/genai';
import React, { useEffect, useMemo, useRef, useState } from 'react';

// ===============================================
// 1. 修改 Chat 類型：支援文字和 Base64 內嵌資料 (圖片/檔案)
// ===============================================
export type Part = {
  text?: string;
  inlineData?: {
    mimeType: string; // 檔案類型，例如 'image/jpeg'
    data: string;     // Base64 編碼的檔案內容
  };
};

export type ChatMsg = { role: 'user' | 'model'; parts: Part[] };

type Props = {
  /** Default Gemini model id (you can type any valid one) */
  defaultModel?: string;
  /** Optional starter message */
  starter?: string;
};

// 輔助函式：將 File 物件轉換為 Base64 字串
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export default function AItest({
  defaultModel = 'gemini-2.5-flash', // 可以更改gemini 的模型版本
  starter = '嗨！可以幫我跟我說一下狗的品種有甚麼嗎?',
}: Props) {
  const [model, setModel] = useState<string>(defaultModel);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [rememberKey, setRememberKey] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 新增 State 來追蹤選取的檔案
  const [selectedFile, setSelectedFile] = useState<File | null>(null); 
  const listRef = useRef<HTMLDivElement | null>(null);

  // Load key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) setApiKey(saved);
  }, []);

  // Warm welcome + starter
  useEffect(() => {
    setHistory([{ role: 'model', parts: [{ text: '👋 這裡是 Gemini 小幫手，讓我們開始聊天吧！' }] }]);
    if (starter) setInput(starter);
  }, [starter]);

  // auto-scroll to bottom
  useEffect(() => {
    const el = listRef.current; if (!el) return; el.scrollTop = el.scrollHeight;
  }, [history, loading]);

  const ai = useMemo(() => {
    try {
      return apiKey ? new GoogleGenAI({ apiKey }) : null;
    } catch {
      return null;
    }
  }, [apiKey]);

  // ===============================================
  // 核心邏輯：修改 sendMessage 處理多模態
  // ===============================================
  async function sendMessage(message?: string) {
    const content = (message ?? input).trim();
    if (!content && !selectedFile) return; // 確保至少有文字或檔案
    if (loading) return;
    if (!ai) { setError('請先輸入有效的 Gemini API Key'); return; }

    setError('');
    setLoading(true);

    let newParts: Part[] = [];

    // 1. 處理選取的檔案 (如果存在)
    if (selectedFile) {
      try {
        const base64Data = await fileToBase64(selectedFile); 
        newParts.push({
          inlineData: {
            mimeType: selectedFile.type,
            data: base64Data.split(',')[1], // 移除 'data:image/jpeg;base64,' 前綴
          },
        });
      } catch (err) {
        setError('檔案處理失敗');
        setLoading(false);
        return;
      }
    }

    // 2. 處理文字內容 (如果存在)
    if (content) {
      newParts.push({ text: content });
    }

    const newUserMsg: ChatMsg = { role: 'user', parts: newParts };
    const newHistory: ChatMsg[] = [...history, newUserMsg];

    setHistory(newHistory);
    setInput('');
    setSelectedFile(null); // 發送後清除檔案

    try {
      // 使用 SDK 直接在瀏覽器中呼叫
      const resp = await ai.models.generateContent({
        model,
        contents: newHistory, // 送出包含圖片或文字的 history
      });

      const reply = resp.text || '[No content]';
      setHistory(h => [...h, { role: 'model', parts: [{ text: reply }] }]);
    } catch (err: any) {
      // 捕獲並顯示錯誤訊息 (例如 API Key 錯誤、模型不存在等)
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  // ===============================================
  // 渲染邏輯：支援顯示圖片和格式化文字
  // ===============================================
  function renderMessageBody(parts: Part[]) {
    return (
      <>
        {parts.map((p, i) => {
          if (p.inlineData && p.inlineData.mimeType.startsWith('image/')) {
            // 渲染圖片
            const imgSrc = `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`;
            return (
              <img
                key={i}
                src={imgSrc}
                alt="上傳的圖片"
                style={styles.imagePreview} 
              />
            );
          }
          if (p.text) {
            // 渲染格式化文字 (Markdown 簡易處理)
            const lines = p.text.split(/\n/);
            return lines.map((ln, j) => (
              <div key={`${i}-${j}`} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{ln}</div>
            ));
          }
          return null;
        })}
      </>
    );
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.header}>Gemini Chat</div>

        {/* Controls */}
        <div style={styles.controls}>
          {/* Model Input */}
          <label style={styles.label}>
            <span>Model</span>
            <input
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="例如 gemini-2.5-flash"
              style={styles.input}
            />
          </label>

          {/* API Key Input */}
          <label style={styles.label}>
            <span>Gemini API Key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => {
                const v = e.target.value; setApiKey(v);
                if (rememberKey) localStorage.setItem('gemini_api_key', v);
              }}
              placeholder="貼上你的 API Key (只在本機瀏覽器儲存)"
              style={styles.input}
            />
            <label style={{ display:'flex', alignItems:'center', gap:8, marginTop:6, fontSize:12 }}>
              <input type="checkbox" checked={rememberKey} onChange={(e)=>{
                setRememberKey(e.target.checked);
                if (!e.target.checked) localStorage.removeItem('gemini_api_key');
                else if (apiKey) localStorage.setItem('gemini_api_key', apiKey);
              }} />
              <span>記住在本機（localStorage）</span>
            </label>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              請勿在正式環境公開 Key，此用法僅供教學 Demo。
            </div>
          </label>
        </div>

        {/* Messages 聊天紀錄 */}
        <div ref={listRef} style={styles.messages}>
          {history.map((m, idx) => (
            <div 
                key={idx} 
                style={{ ...styles.msg, ...(m.role === 'user' ? styles.user : styles.assistant) }}
            >
              <div style={styles.msgRole}>{m.role === 'user' ? 'You' : 'Gemini'}</div>
              {/* 使用新的渲染函式 */}
              <div style={styles.msgBody}>{renderMessageBody(m.parts)}</div> 
            </div>
          ))}
          {loading && (
            <div style={{ ...styles.msg, ...styles.assistant }}>
              <div style={styles.msgRole}>Gemini</div>
              <div style={styles.msgBody}>思考中…</div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={styles.error}>⚠ {error}</div>
        )}

        {/* Composer 輸入框和發送區 */}
        <form
          onSubmit={e => { e.preventDefault(); sendMessage(); }}
          style={styles.composer}
        >
          <div style={styles.inputGroup}>
             {/* 檔案輸入框 */}
            <div style={styles.fileInputContainer}>
              <input
                type="file"
                accept="image/*" // 限制只接受圖片
                onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                style={styles.fileInput}
              />
              {selectedFile && (
                <span style={styles.fileName}>
                  已選取檔案: **{selectedFile.name}**
                </span>
              )}
            </div>

            {/* 文字輸入框 */}
            <input
              placeholder={selectedFile ? "輸入文字描述（選填），或直接送出圖片" : "輸入訊息，按 Enter 送出"}
              value={input}
              onChange={e => setInput(e.target.value)}
              style={styles.textInput}
            />
          </div>
          
          <button type="submit" disabled={loading || (!input.trim() && !selectedFile) || !apiKey} style={styles.sendBtn}>
            {loading ? '等待' : '送出'}
          </button>
        </form>

        {/* Quick examples 快速提問 */}
        <div style={styles.suggestionsContainer}>
          {['可以幫我描述一下這張照片嗎？(需先上傳圖片)', '幫我把這段英文翻成中文：Hello from Taipei!', '寫一首關於捷運的短詩'].map((q) => (
            <button key={q} type="button" style={styles.suggestion} onClick={() => sendMessage(q)}>{q}</button>
          ))}
        </div>
      </div>
    </div>
  );
}


// ===============================================
// 樣式調整：優化排版和視覺風格
// ===============================================
const styles: Record<string, React.CSSProperties> = {
  wrap: { 
    display: 'flex', // 讓內容居中
    justifyContent: 'center',
    width: '100%', 
    padding: 5, // 16
    minHeight: '100vh',
    backgroundColor: '#f9fafb'
  },
  card: {
    width: 'min(900px, 100%)', 
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', // 新增陰影
    overflow: 'hidden',
    maxHeight: 'calc(100vh - 32px)',
  },
  header: {
    padding: '12px 16px',
    fontWeight: 700,
    fontSize: 18,
    borderBottom: '1px solid #e5e7eb',
    background: '#2566bcff', // 標題顏色
    color: '#fff',
  },
 controls: {
  display: 'grid',
  gap: 16,
  gridTemplateColumns: '1fr 1fr',
  alignItems: 'start', // 🔥 讓上下對齊
  padding: 16,
  borderBottom: '1px solid #e5e7eb',
},

  label: { display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151' },
  input: { padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, width: '100%' },
  
  messages: { 
    padding: 16, 
    display: 'grid', 
    gap: 12, 
    overflowY: 'auto', // 讓聊天區塊可捲動
    flexGrow: 1, // 佔滿可用空間
  },
  msg: { 
    borderRadius: 16, 
    padding: 12, 
    maxWidth: '85%', 
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  user: { 
    background: '#2566bcff', // 藍色
    color: '#fff',
    marginLeft: 'auto', // 推到右邊
    border: 'none',
    borderBottomRightRadius: 4, // 箭頭效果
  },
  assistant: { 
    background: '#f3f4f6', // 淺灰色
    color: '#1f2937',
    marginRight: 'auto', // 推到左邊
    border: 'none',
    borderBottomLeftRadius: 4, // 箭頭效果
  },
  msgRole: {
    fontSize: 11,
    fontWeight: 600,
    opacity: 0.8,
    marginBottom: 4,
    color: 'inherit', // 繼承氣泡顏色
  },
  msgBody: { fontSize: 14, lineHeight: 1.6 },
  
  // 圖片預覽樣式
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '200px',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    objectFit: 'contain',
    border: '1px solid #e5e7eb'
  },

  error: { color: '#b91c1c', padding: '12px 16px', backgroundColor: '#fee2e2', borderTop: '1px solid #fca5a5' },
  
  composer: { 
    padding: 16, 
    display: 'grid', 
    gridTemplateColumns: '1fr auto', 
    gap: 12, 
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#fff'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  textInput: { 
    padding: '8px 10px',// 12 14 
    borderRadius: 10, 
    border: '1px solid #d1d5db', 
    fontSize: 16, 
    flexGrow: 1,
  },
  sendBtn: { 
    padding: '12px 20px', 
    borderRadius: 999, 
    border: 'none', 
    background: '#2566bcff', 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  // 檔案上傳樣式
  fileInputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '4px 0',
  },
  fileInput: {
    fontSize: 14,
    // 您可以隱藏這個原生 input，然後用一個 button/icon 來觸發它
  },
  fileName: {
    fontSize: 12,
    color: '#1f2937',
    backgroundColor: '#e5e7eb',
    padding: '4px 10px',
    borderRadius: 10,
    fontWeight: 500,
  },
  
  suggestionsContainer: {
    display: 'flex', 
    gap: 10, 
    flexWrap: 'wrap', 
    padding: '0 16px 16px 16px'
  },
  suggestion: { 
    padding: '8px 14px', 
    borderRadius: 999, 
    border: '1px solid #d1d5db', 
    background: '#f9fafb', 
    cursor: 'pointer', 
    fontSize: 13,
    transition: 'background-color 0.2s',
  },
};