

import React, { useState, useEffect, useCallback } from 'react';

// ===============================================
// GitHub API 設定
// ===============================================
const GITHUB_BASE_URL = 'https://api.github.com/users/';
const DEFAULT_USERNAME = 'google'; 
const ITEM_PER_PAGE = 6; // *** 設定每頁顯示的專案數量為 6 ***

// ===============================================
// 分頁控制元件
// ===============================================
const PaginationControls = ({ currentPage, totalPages, setCurrentPage }) => {
    if (totalPages <= 1) return null;

    const handlePrevious = () => {
        if (currentPage > 1) setCurrentPage(currentPage - 1);
    };

    const handleNext = () => {
        if (currentPage < totalPages) setCurrentPage(currentPage + 1);
    };

    return (
        <div style={paginationStyles.controls}>
            <button 
                onClick={handlePrevious} 
                disabled={currentPage === 1}
                style={paginationStyles.button}
            >
                上一頁
            </button>
            <span style={paginationStyles.info}>
                第 {currentPage} 頁 / 共 {totalPages} 頁
            </span>
            <button 
                onClick={handleNext} 
                disabled={currentPage === totalPages}
                style={paginationStyles.button}
            >
                下一頁
            </button>
        </div>
    );
};


export default function GitHubRepos() {
  // 狀態管理
  const [username, setUsername] = useState(DEFAULT_USERNAME);
  const [currentSearch, setCurrentSearch] = useState(DEFAULT_USERNAME); 
  const [repoList, setRepoList] = useState([]); 
  const [filteredList, setFilteredList] = useState([]); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [loading, setLoading] = useState(false); 
  const [error, setError] = useState('');
  
  // *** 分頁狀態 ***
  const [currentPage, setCurrentPage] = useState(1); 
  // 根據篩選結果計算總頁數
  const totalPages = Math.ceil(filteredList.length / ITEM_PER_PAGE);

  // ===============================================
  // 核心邏輯：API 呼叫
  // ===============================================
  const fetchRepos = useCallback(async (user) => {
    // ... (API 呼叫邏輯與原版相同，略)
    if (!user) { setError('請輸入 GitHub 帳號'); return; }
    setLoading(true);
    setError('');
    setRepoList([]); 
    setFilteredList([]); 
    setCurrentPage(1); // 每次新搜尋都回到第一頁

    const url = `${GITHUB_BASE_URL}${user}/repos?sort=updated&per_page=100`;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'react-personal-website-project' },
      });

      if (response.status === 404) {
        throw new Error(`找不到 GitHub 帳號: "${user}"`);
      }
      if (response.status === 403) {
         throw new Error(`API 請求超過限制 (Rate Limit Exceeded)。請稍後再試。`);
      }
      if (!response.ok) {
        throw new Error(`載入失敗: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const nonForkRepos = data.filter(repo => !repo.fork);
      
      setRepoList(nonForkRepos);
      setFilteredList(nonForkRepos); // 初始時 filteredList = repoList
      setCurrentSearch(user); 
      
      if (nonForkRepos.length === 0) {
          setError(`帳號 ${user} 沒有公開的原創儲存庫。`);
      }

    } catch (err) {
      console.error(err);
      setError(err.message || '連線錯誤，無法獲取資料。');
    } finally {
      setLoading(false);
    }
  }, []);

  // 1. 初始載入
  useEffect(() => {
    fetchRepos(username);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. 處理搜尋關鍵字 (篩選邏輯)
  useEffect(() => {
    // 每次 repoList 或 searchTerm 改變時執行篩選
    const lowerCaseSearch = searchTerm.toLowerCase();
    const filtered = repoList.filter(repo => 
        repo.name.toLowerCase().includes(lowerCaseSearch) ||
        (repo.description && repo.description.toLowerCase().includes(lowerCaseSearch))
    );
    
    setFilteredList(filtered);
    setCurrentPage(1); // 篩選結果變動時，回到第一頁
  }, [repoList, searchTerm]);

  // 3. 處理表單提交
  const handleUserSearch = (e) => {
      e.preventDefault();
      fetchRepos(username.trim());
  };
  
  // ===============================================
  // *** 分頁計算邏輯 ***
  // 根據當前頁碼和每頁數量，取得該頁要顯示的項目
  const startIndex = (currentPage - 1) * ITEM_PER_PAGE;
  const endIndex = startIndex + ITEM_PER_PAGE;
  const currentItems = filteredList.slice(startIndex, endIndex);
  // ===============================================


  // 渲染單個專案卡片的元件 (可將此抽離成獨立的 RepoCard.js)
  const RepoCard = ({ repo }) => {
    // ... (RepoCard 邏輯與原版相同，略)
    function getLanguageColor(lang) {
        const colors = {
            JavaScript: '#f1e05a', Python: '#3572A5', Java: '#b07219',
            HTML: '#e34c26', CSS: '#563d7c', TypeScript: '#2b7489',
            C: '#555555', 'C++': '#f34b7d', Ruby: '#701516',
        };
        return colors[lang] || '#cccccc';
    }
      
    return (
        <a 
            href={repo.html_url} 
            target="_blank" 
            rel="noopener noreferrer" 
            style={styles.repoCard}
        >
            <h3>{repo.name}</h3>
            <p style={styles.description}>{repo.description || '無描述'}</p>
            <div style={styles.metadata}>
                {repo.language && (
                    <span style={styles.tag}>
                        <span style={{...styles.languageDot, backgroundColor: getLanguageColor(repo.language)}}></span>
                        {repo.language}
                    </span>
                )}
                <span style={styles.tag}>⭐ {repo.stargazers_count}</span>
                <span style={styles.tag}>Fork: {repo.forks_count}</span>
            </div>
            <div style={styles.updateTime}>
                更新於: {new Date(repo.updated_at).toLocaleDateString()}
            </div>
        </a>
    );
  };


  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <div style={styles.header}>
            GitHub 專案儀表板
        </div>

        {/* 1. 帳號輸入與主要搜尋 */}
        <form onSubmit={handleUserSearch} style={styles.searchForm}>
          {/* ... (帳號輸入欄位與按鈕與原版相同) */}
          <label style={styles.label}>
            <span>GitHub 帳號:</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="輸入 GitHub 使用者名稱"
              style={styles.input}
              disabled={loading}
            />
          </label>
          <button type="submit" style={styles.searchBtn} disabled={loading}>
            {loading && username === currentSearch ? '載入中...' : '顯示專案'}
          </button>

        </form>

        {/* 2. 專案篩選輸入 (互動功能) */}
        {repoList.length > 0 && (
            <div style={styles.filterSection}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`輸入你想要搜索的資料...`}
                    style={styles.filterInput}
                />
            </div>
        )}

        {/* 3. 錯誤訊息 (Error 狀態) */}
        {error && <div style={styles.error}>⚠ {error}</div>}

        {/* 4. 專案列表 (資料顯示) */}
        <div style={styles.repoGrid}>
          {loading && username === currentSearch && repoList.length === 0 ? (
            // 初始或重新搜尋的 Loading 狀態
            <div style={styles.loadingState}>
                <p>🚀 正在載入 {currentSearch} 的專案列表...</p>
            </div>
          ) : (
             // 顯示【當前頁面】的專案
            currentItems.map(repo => (
              <RepoCard key={repo.id} repo={repo} />
            ))
          )}
          
          {/* 找不到篩選結果的訊息 */}
          {!loading && repoList.length > 0 && filteredList.length === 0 && (
              <div style={styles.emptyState}>
                  找不到符合 "{searchTerm}" 關鍵字的專案。
              </div>
          )}
        </div>
        
        {/* 5. 分頁控制區 (下一頁/上一頁) */}
        {!loading && filteredList.length > 0 && (
            <PaginationControls 
                currentPage={currentPage} 
                totalPages={totalPages} 
                setCurrentPage={setCurrentPage}
            />
        )}
      </div>
    </div>
  );
}


// ===============================================
// 樣式
// ===============================================

// *** 新增分頁控制的樣式 ***
const paginationStyles = {
    controls: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px',
        borderTop: '1px solid #e5e7eb',
        gap: 20,
        backgroundColor: '#f3f4f6',
    },
    button: {
        padding: '8px 16px',
        borderRadius: 8,
        border: '1px solid #866753ff',
        background: '#fff',
        color: '#866753ff',
        cursor: 'pointer',
        fontWeight: 600,
        transition: 'all 0.2s',
    },
    info: {
        fontSize: 14,
        color: '#9c8677ff',
        fontWeight: 500,
    }
}
// 原版樣式
const styles = {
    wrap: { 
        display: 'flex', 
        justifyContent: 'center',
        width: '100%', 
        padding: 5, 
        minHeight: '100vh',
        backgroundColor: '#f9fafb'
    },
    card: {
        width: 'min(1150px, 100%)', 
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        boxShadow: '0 4px 12px rgba(216, 173, 143, 0.1)',
        overflow: 'hidden',
        minHeight: 'calc(100vh - 32px)',
    },
    header: {
        padding: '12px 16px',
        fontWeight: 700,
        fontSize: 18,
        borderBottom: '1px solid #e5e7eb',
        background: '#866753ff', 
        color: '#fff',
    },
    searchForm: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        padding: 16,
        borderBottom: '1px solid #e5e7eb',
    },
    label: { 
        display: 'grid', 
        gap: 6, 
        fontSize: 13, 
        fontWeight: 600, 
        color: '#9c8677ff', 
        flexGrow: 1 
    },
    input: { 
        padding: '10px 12px', 
        borderRadius: 8, 
        border: '1px solid #d1d5db', 
        fontSize: 14, 
        width: '100%' 
    },
    searchBtn: {
        padding: '10px 20px',
        borderRadius: 8,
        border: 'none',
        background: '#ebb8b8ff', 
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
    },
    filterSection: {
        padding: '16px 16px 0 16px',
        borderBottom: '1px solid #e5e7eb',
    },
    filterInput: {
        width: '100%',
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid #d1d5db',
        fontSize: 14,
        marginBottom: 16,
    },
    error: { 
        color: '#b91c1c', 
        padding: '12px 16px', 
        backgroundColor: '#fee2e2', 
        borderBottom: '1px solid #fca5a5' 
    },
    
    repoGrid: {
        display: 'grid',
        // 調整網格欄位以適應每頁 6 個專案 (3*2 或 2*3)
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
        gap: 20,
        padding: 20,
        flexGrow: 1,
        // 為了確保每頁的視覺大小一致，可以考慮限制網格高度並設 overflowY: 'hidden'
        // 但這裡保留自動高度以適應不同尺寸，重點在於顯示的項目數量
        overflowY: 'auto', 
    },
    repoCard: {
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        backgroundColor: '#fff',
        transition: 'box-shadow 0.2s',
        textDecoration: 'none',
        color: 'inherit',
        height: '100%', // 確保卡片在網格內高度一致
    },
    description: {
        fontSize: 14,
        color: '#9c8677ff',
        marginBottom: 12,
        flexGrow: 1, 
    },
    metadata: {
        display: 'flex',
        gap: 15,
        alignItems: 'center',
        fontSize: 12,
        color: '#9c8677ff',
    },
    tag: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    languageDot: {
        width: 10,
        height: 10,
        borderRadius: '50%',
    },
    updateTime: {
        marginTop: 8,
        fontSize: 11,
        color: '#9c8677ff',
        textAlign: 'right',
    },
    loadingState: {
        gridColumn: '1 / -1', 
        textAlign: 'center',
        padding: '50px 0',
        fontSize: 18,
        color: '#9c8677ff',
    },
    emptyState: {
        gridColumn: '1 / -1',
        textAlign: 'center',
        padding: '30px 0',
        fontSize: 16,
        color: '#9c8677ff',
    }
};